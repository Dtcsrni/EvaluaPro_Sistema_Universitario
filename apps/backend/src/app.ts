/**
 * Crea la app HTTP (Express) del backend.
 *
 * Principios:
 * - Seguridad por defecto (cabeceras, sanitización, rate-limit)
 * - Validación en modulos (Zod) y error envelope consistente
 * - Sin side-effects al importar (fácil de testear)
 */
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { configuracion } from './configuracion';
import { crearRouterApi } from './rutas';
import { manejadorErrores } from './compartido/errores/manejadorErrores';
import { middlewareIdSolicitud, middlewareRegistroSolicitud } from './compartido/observabilidad/middlewareObservabilidad';
import {
  middlewareManejadorErroresRobusto,
  middlewareContextoRobustez
} from './compartido/robustez/manejadorErrores';

function mapearIdsAUnderscore(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(mapearIdsAUnderscore);
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    result[key] = mapearIdsAUnderscore(obj[key]);
  }
  if (result.id !== undefined && result._id === undefined) {
    result._id = result.id;
  }
  return result;
}

export function crearApp() {
  const app = express();

  // Reduce leakage de informacion sobre la tecnologia del servidor.
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: configuracion.corsOrigenes,
      credentials: true,
      // Permite que el frontend lea el nombre real del PDF (Content-Disposition)
      // al descargar via fetch.
      exposedHeaders: ['Content-Disposition']
    })
  );
  app.use(express.json({ limit: configuracion.limiteJson }));
  app.use(middlewareContextoRobustez);
  app.use(middlewareIdSolicitud);
  app.use(middlewareRegistroSolicitud);
  app.use(
    rateLimit({
      windowMs: configuracion.rateLimitWindowMs,
      limit: configuracion.rateLimitLimit,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.path.startsWith('/api/salud')
    })
  );

  // Interceptor para mapear 'id' a '_id' y asegurar compatibilidad absoluta con el frontend y tests legacy
  app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (body) {
      if (body) {
        body = mapearIdsAUnderscore(body);
      }
      return originalJson.call(this, body);
    };
    next();
  });

  app.use('/api', crearRouterApi());

  // Middleware de error handling robusto principal.
  app.use(middlewareManejadorErroresRobusto);

  // Capa final de compatibilidad de errores.
  app.use(manejadorErrores);

  return app;
}
