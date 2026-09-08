/**
 * Impide escrituras locales concurrentes cuando se habilita la carpeta nube.
 * Las rutas de adquirir/renovar/liberar lease son las únicas excepciones.
 */
import type { NextFunction, Request, Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { verificarLeaseEscritura } from './domain/leaseSincronizacion';
import { obtenerConfiguracionSincronizacion } from './domain/preferenciasSincronizacion';

export async function requerirLeaseEscritura(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  if (/^\/sincronizaciones\/local\/lease(?:\/|$)/.test(req.path) || /^\/sincronizaciones\/local\/configuracion(?:\/|$)/.test(req.path) || req.path === '/sincronizaciones/local/exportar' || req.path === '/analiticas/eventos-uso') {
    next();
    return;
  }
  const docenteId = obtenerDocenteId(req as SolicitudDocente);
  try {
    const configuracionDocente = await obtenerConfiguracionSincronizacion(docenteId);
    if (!configuracionDocente.configurado) {
      next();
      return;
    }
  } catch (error) {
    next(error);
    return;
  }
  const equipoId = String(req.header('X-EvaluaPro-Equipo') || '').trim();
  if (!equipoId) {
    next(new ErrorAplicacion('SYNC_LEASE_REQUERIDO', 'Adquiere el control de edición desde Sincronización antes de modificar datos', 423));
    return;
  }
  try {
    await verificarLeaseEscritura(docenteId, equipoId);
    next();
  } catch (error) {
    next(error);
  }
}
