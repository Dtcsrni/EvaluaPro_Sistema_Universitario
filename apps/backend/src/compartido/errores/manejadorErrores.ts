/**
 * Middleware de manejo de errores para el API.
 *
 * Contrato:
 * - Si se lanza/propaga `ErrorAplicacion`, se serializa tal cual (codigo/estado/detalles).
 * - Para errores no esperados, se registra (excepto en tests) y se devuelve 500.
 *
 * Nota: el formato del envelope de error es parte del contrato publico del API.
 */
import type { NextFunction, Request, Response } from 'express';
import { ErrorAplicacion } from './errorAplicacion';
import { logError } from '../../infraestructura/logging/logger';

function obtenerNombreError(error: unknown): unknown {
  return typeof error === 'object' && error ? (error as { name?: unknown }).name : undefined;
}

function esErrorIdInvalido(error: unknown): boolean {
  const nombreError = obtenerNombreError(error);
  return nombreError === 'CastError' || nombreError === 'BSONError' || nombreError === 'BSONTypeError';
}

function obtenerStatusYTipo(error: unknown): { status: unknown; type: unknown } {
  if (typeof error !== 'object' || !error) {
    return { status: undefined, type: undefined };
  }

  return {
    status: (error as { status?: unknown; statusCode?: unknown }).status ?? (error as { statusCode?: unknown }).statusCode,
    type: (error as { type?: unknown }).type
  };
}

function esPayloadDemasiadoGrande(error: unknown): boolean {
  const { status, type } = obtenerStatusYTipo(error);
  return status === 413 || type === 'entity.too.large';
}

function responderErrorSimple(res: Response, status: number, codigo: string, mensaje: string) {
  res.status(status).json({
    error: {
      codigo,
      mensaje
    }
  });
}

export function manejadorErrores(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  void _next;

  // IDs malformados u otros errores de casteo (p. ej. CastError/BSONError).
  // Se normalizan como 400 para evitar 500 por input del cliente.
  if (esErrorIdInvalido(error)) {
    responderErrorSimple(res, 400, 'DATOS_INVALIDOS', 'Id invalido');
    return;
  }

  // body-parser: payload demasiado grande (413).
  if (esPayloadDemasiadoGrande(error)) {
    responderErrorSimple(res, 413, 'PAYLOAD_DEMASIADO_GRANDE', 'Payload demasiado grande');
    return;
  }

  if (error instanceof ErrorAplicacion) {
    if (error.estadoHttp >= 500 && process.env.NODE_ENV !== 'test') {
      logError('Error controlado 5xx en request', error, {
        requestId: (req as Request & { requestId?: string }).requestId,
        route: req.path,
        method: req.method,
        status: error.estadoHttp,
        codigo: error.codigo
      });
    }

    res.status(error.estadoHttp).json({
      error: {
        codigo: error.codigo,
        mensaje: error.message,
        detalles: error.detalles
      }
    });
    return;
  }

  // Errores no esperados: se registran para diagnostico y se responde con un
  // mensaje generico al cliente para evitar leakage de detalles internos.
  const entorno = process.env.NODE_ENV;
  if (entorno !== 'test') {
    logError('Error no controlado en request', error, {
      requestId: (req as Request & { requestId?: string }).requestId,
      route: req.path,
      method: req.method
    });
  }

  const exponerMensaje = entorno !== 'production';
  const mensaje = exponerMensaje && error instanceof Error ? error.message : 'Error interno';
  responderErrorSimple(res, 500, 'ERROR_INTERNO', mensaje);
}
