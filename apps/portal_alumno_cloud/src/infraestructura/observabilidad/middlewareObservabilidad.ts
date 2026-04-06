/**
 * middlewareObservabilidad
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { log } from '../logging/logger';
import { registrarRequestHttp } from './metrics';

function obtenerRuta(req: Request): string {
  const base = String(req.baseUrl || '');
  const ruta = (req.route && 'path' in req.route ? String((req.route as { path?: unknown }).path ?? '') : '').trim();
  if (ruta) return `${base}${ruta}`;
  return String(req.path || '/');
}

export function middlewareIdSolicitud(req: Request, res: Response, next: NextFunction) {
  const idEntrada = req.header('x-request-id');
  const idSolicitud = idEntrada && idEntrada.trim() ? idEntrada.trim() : randomUUID();
  (req as Request & { requestId?: string }).requestId = idSolicitud;
  res.setHeader('x-request-id', idSolicitud);
  next();
}

export function middlewareRegistroSolicitud(req: Request, res: Response, next: NextFunction) {
  const inicio = Date.now();
  res.on('finish', () => {
    const ruta = obtenerRuta(req);
    const estatus = Number(res.statusCode || 0);
    const duracionMs = Date.now() - inicio;
    const idSolicitud = (req as Request & { requestId?: string }).requestId;
    const idUsuario = (req as Request & { alumnoId?: string }).alumnoId;
    registrarRequestHttp(req.method, ruta, estatus);
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
