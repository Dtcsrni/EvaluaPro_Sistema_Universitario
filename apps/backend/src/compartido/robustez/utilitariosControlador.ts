/**
 * Wrapper de controlador con error handling, retry y circuit breaker
 * Ola 3 - Fase 2: Endpoints Robustos
 */

import { Request, Response, NextFunction } from 'express';
import { z, type ZodIssue } from 'zod';
import { ErrorOperacional } from '../../compartido/robustez/manejadorErrores';
import { ErrorCategoria } from '../../compartido/robustez/tiposRobustez';
import { conRetry } from '../../compartido/robustez/soporteRetry';
import { obtenerCircuitBreaker } from '../../compartido/robustez/circuitBreaker';

/**
 * Wrapper para controladores que añade:
 * - Circuit breaker
 * - Retry automático para errores transitorios
 * - Error handling robusto
 * - Logging de auditoría
 */
export function wrapControladorRobusto(
  controlador: (req: Request, res: Response, next: NextFunction) => Promise<void>,
  nombreEndpoint: string,
  reintentos: number = 1
) {
  const circuitBreaker = obtenerCircuitBreaker(`omr-${nombreEndpoint}`);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Envolver en circuit breaker + retry
      await circuitBreaker.ejecutar(async () => {
        const resultado = await conRetry(
          () => controlador(req, res, next),
          nombreEndpoint,
          {
            maxIntentos: reintentos,
            delayMs: 100,
            delayMultiplicador: 2
          }
        );

        if (!resultado.exito && resultado.error) {
          throw resultado.error;
        }

        return resultado.datos;
      });
    } catch (err) {
      // El middleware global se encargará de manejar el error
      next(err);
    }
  };
}

/**
 * Validador de payload con conversión de errores Zod
 */
export function validarPayloadRobusto(schema: z.ZodTypeAny) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resultado = schema.safeParse(req.body);

      if (!resultado.success) {
        const problemas = resultado.error.issues.map((issue: ZodIssue) => ({
          campo: issue.path.join('.'),
          tipo: issue.code,
          mensaje: issue.message
        }));

        throw new ErrorOperacional(
          `Validación fallida en payload`,
          ErrorCategoria.VALIDACION,
          400,
          JSON.stringify(problemas),
          false
        );
      }

      req.body = resultado.data;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Validador de parámetros de query
 */
export function validarQueryRobusto(schema: z.ZodTypeAny) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resultado = schema.safeParse(req.query);

      if (!resultado.success) {
        const problemas = resultado.error.issues.map((issue: ZodIssue) => ({
          campo: issue.path.join('.'),
          tipo: issue.code,
          mensaje: issue.message
        }));

        throw new ErrorOperacional(
          `Validación fallida en query`,
          ErrorCategoria.VALIDACION,
          400,
          JSON.stringify(problemas),
          false
        );
      }

      req.query = resultado.data as Request['query'];
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Respuesta estandarizada exitosa
 */
export function respuestaExitosa<T>(
  res: Response,
  datos: T,
  statusCode: number = 200,
  duracionMs?: number
): void {
  res.status(statusCode).json({
    exito: true,
    datos,
    duracionMs,
    timestamp: new Date().toISOString()
  });
}

/**
 * Respuesta estandarizada de error (NO DEBE USARSE - usar next() en su lugar)
 */
export function respuestaError(
  res: Response,
  categoria: ErrorCategoria = ErrorCategoria.INTERNO,
  mensaje: string = 'Error interno',
  statusCode: number = 500
): void {
  res.status(statusCode).json({
    exito: false,
    error: {
      categoria,
      mensaje,
      timestamp: new Date().toISOString()
    }
  });
}
