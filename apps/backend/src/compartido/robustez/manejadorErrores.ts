/**
 * Manejador de errores robusto con contexto, auditoría y categorización
 * Ola 3 - Fase 2: Endpoints Robustos
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ErrorCategoria, ErrorRobusto } from './tiposRobustez';
import { ErrorAplicacion } from '../errores/errorAplicacion';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tiempoInicio?: number;
    }
  }
}

export class ErrorOperacional extends Error implements Omit<ErrorRobusto, 'name'> {
  categoria: ErrorCategoria;
  statusHttp: number;
  auditoria: string;
  reintentable: boolean;
  duracionMs: number;
  traceId?: string;

  // eslint-disable-next-line max-params
  constructor(
    message: string,
    categoria?: ErrorCategoria,
    statusHttp?: number,
    auditoria?: string,
    reintentable?: boolean,
    duracionMs?: number,
    traceId?: string
  ) {
    super(message);
    this.name = 'ErrorOperacional';
    this.categoria = categoria ?? ErrorCategoria.INTERNO;
    this.statusHttp = statusHttp ?? 500;
    this.auditoria = auditoria ?? '';
    this.reintentable = reintentable ?? false;
    this.duracionMs = duracionMs ?? 0;
    this.traceId = traceId;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Convierte errores Zod en ErrorOperacional con detalles de validación
 */
export function procesarErrorZod(error: ZodError, traceId?: string): ErrorOperacional {
  const problemas = error.issues.map((issue) => ({
    campo: issue.path.join('.'),
    tipo: issue.code,
    mensaje: issue.message
  }));

  return new ErrorOperacional(
    `Validación fallida: ${problemas.map((p) => `${p.campo} (${p.mensaje})`).join('; ')}`,
    ErrorCategoria.VALIDACION,
    400,
    JSON.stringify(problemas),
    false,
    0,
    traceId
  );
}

/**
 * Middleware global de manejo de errores robusto
 */
export function middlewareManejadorErroresRobusto(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof ErrorAplicacion) {
    next(err);
    return;
  }

  if (!(err instanceof ErrorOperacional) && !(err instanceof ZodError)) {
    next(err);
    return;
  }

  const traceId = req.headers['x-trace-id'] as string || `trace-${Date.now()}`;
  const tiempoInicio = req['tiempoInicio'] || Date.now();
  const duracionMs = Date.now() - tiempoInicio;

  const errorOperacional: ErrorRobusto = err instanceof ErrorOperacional
    ? err
    : procesarErrorZod(err, traceId);

  errorOperacional.traceId = traceId;
  errorOperacional.duracionMs = duracionMs;

  // Registrar en logs con estructura
  const usuarioRequest = (req as Request & { usuario?: { id?: string } }).usuario;

  console.error('[ERROR_ROBUSTO]', {
    traceId,
    categoria: errorOperacional.categoria,
    statusHttp: errorOperacional.statusHttp,
    mensaje: errorOperacional.message,
    reintentable: errorOperacional.reintentable,
    duracionMs: errorOperacional.duracionMs,
    ruta: req.path,
    metodo: req.method,
    usuario: usuarioRequest?.id || 'anonimo',
    auditoria: errorOperacional.auditoria
  });

  // Respuesta estandarizada de error
  res.status(errorOperacional.statusHttp).json({
    exito: false,
    error: {
      categoria: errorOperacional.categoria,
      mensaje: errorOperacional.message,
      traceId: errorOperacional.traceId,
      reintentable: errorOperacional.reintentable,
      duracionMs: errorOperacional.duracionMs
    }
  });
}

/**
 * Middleware para capturar tiempo de inicio y trace ID
 */
export function middlewareContextoRobustez(req: Request, res: Response, next: NextFunction) {
  req['tiempoInicio'] = Date.now();
  if (!req.headers['x-trace-id']) {
    req.headers['x-trace-id'] = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  res.setHeader('x-trace-id', req.headers['x-trace-id']);
  next();
}
