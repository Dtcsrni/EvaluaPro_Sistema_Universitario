/**
 * middlewareObservabilidad
 *
 * Responsabilidad: Punto comun de metricas/logs/correlacion para operacion.
 * Limites: Evitar romper nombres de metricas o formato de log en produccion.
 */
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { log } from '../../infraestructura/logging/logger';
import { registrarRequestHttp } from './metrics';

function obtenerIdSolicitud(req: Request): string {
  const cabecera = req.header('x-request-id');
  return cabecera && cabecera.trim() ? cabecera.trim() : randomUUID();
}

function obtenerRuta(req: Request): string {
  const base = String(req.baseUrl || '');
  const ruta = (req.route && 'path' in req.route ? String((req.route as { path?: unknown }).path ?? '') : '').trim();
  if (ruta) return `${base}${ruta}`;
  return String(req.path || '/');
}

export function middlewareIdSolicitud(req: Request, res: Response, next: NextFunction) {
  const idSolicitud = obtenerIdSolicitud(req);
  res.setHeader('x-request-id', idSolicitud);
  (req as Request & { requestId?: string }).requestId = idSolicitud;
  next();
}

export function middlewareRegistroSolicitud(req: Request, res: Response, next: NextFunction) {
  const inicio = Date.now();
  res.on('finish', () => {
    const duracionMs = Date.now() - inicio;
    const ruta = obtenerRuta(req);
    const estatus = Number(res.statusCode || 0);
    const idSolicitud = (req as Request & { requestId?: string }).requestId;
    const idUsuario = (req as Request & { docenteId?: string }).docenteId;

    registrarRequestHttp(req.method, ruta, estatus, duracionMs);
    log(estatus >= 500 ? 'error' : estatus >= 400 ? 'warn' : 'info', 'HTTP request', {
      requestId: idSolicitud,
      route: ruta,
      method: req.method,
      status: estatus,
      durationMs: duracionMs,
      userId: idUsuario
    });
  });
  next();
}
