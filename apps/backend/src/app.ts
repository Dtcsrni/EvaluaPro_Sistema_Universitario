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

function mapearIdsAUnderscore(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(mapearIdsAUnderscore);
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    result[key] = mapearIdsAUnderscore((obj as Record<string, unknown>)[key]);
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

  // Interceptor para SQLite/Prisma que mapea `id` a `_id` en respuestas
  app.use((_req, res, next) => {
    const originalJson = res.json;
    res.json = function (body) {
      const mappedBody = mapearIdsAUnderscore(body);
      return originalJson.call(this, mappedBody);
    };
    next();
  });

  app.use('/api', crearRouterApi());

  // Servir frontend nativo si estamos en modo Desktop/Native
  if (process.env.EVALUAPRO_NATIVE_STATIC_DIR) {
    app.use(express.static(process.env.EVALUAPRO_NATIVE_STATIC_DIR));
    // SPA Fallback para React Router
    app.get('*', (_req, res) => {
      res.sendFile('index.html', { root: process.env.EVALUAPRO_NATIVE_STATIC_DIR });
    });
  }

  // Middleware de error handling robusto principal.
  app.use(middlewareManejadorErroresRobusto);

  // Capa final de compatibilidad de errores.
  app.use(manejadorErrores);

  return app;
}
