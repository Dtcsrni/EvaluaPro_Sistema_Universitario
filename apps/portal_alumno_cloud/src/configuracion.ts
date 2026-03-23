/**
 * Configuracion del portal alumno cloud.
 */
import { cargarDotenvRaizSiAplica, parsearListaCsv, parsearNumeroSeguro } from './compartido/configuracion/env';

const entorno = process.env.NODE_ENV ?? 'development';
cargarDotenvRaizSiAplica(entorno);

const puerto = Number(process.env.PUERTO_PORTAL ?? process.env.PORT ?? 8080);
const mongoUri = process.env.MONGODB_URI ?? '';
const corsOrigenesRaw = String(process.env.CORS_ORIGENES ?? '').trim();
const corsOrigenes = parsearListaCsv(process.env.CORS_ORIGENES ?? '*');
const portalApiKey = process.env.PORTAL_API_KEY ?? '';
const codigoAccesoHoras = Number(process.env.CODIGO_ACCESO_HORAS ?? 12);
if (entorno === 'production' && !mongoUri) {
  throw new Error('MONGODB_URI es requerido en producción (portal)');
}
if (entorno === 'production' && !portalApiKey) {
  throw new Error('PORTAL_API_KEY es requerido en producción (portal)');
}
if (entorno === 'production' && !corsOrigenesRaw) {
  throw new Error('CORS_ORIGENES es requerido en producción (portal)');
}
if (entorno === 'production' && corsOrigenes.includes('*')) {
  throw new Error('CORS_ORIGENES no puede usar "*" en producción (portal)');
}

const rateLimitWindowMs = parsearNumeroSeguro(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, {
  min: 1_000,
  max: 24 * 60 * 60 * 1000
});
const rateLimitLimit = parsearNumeroSeguro(process.env.RATE_LIMIT_LIMIT, 200, { min: 1, max: 10_000 });

export const configuracion = {
  puerto,
  mongoUri,
  entorno,
  corsOrigenes,
  portalApiKey,
  codigoAccesoHoras,
  rateLimitWindowMs,
  rateLimitLimit
};
