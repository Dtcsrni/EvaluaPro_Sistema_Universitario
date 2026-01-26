/**
 * Middleware para requerir sesion docente via JWT.
 *
 * Formato esperado: `Authorization: Bearer <token>`.
 * Si el token es valido, se adjunta `docenteId` al request para que los
 * controladores puedan aplicar autorizacion por objeto.
 */
import type { NextFunction, Request, Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { verificarTokenDocente } from './servicioTokens';

export type SolicitudDocente = Request & { docenteId?: string; docenteRoles?: string[] };

export function requerirDocente(req: SolicitudDocente, _res: Response, next: NextFunction) {
  const auth = req.headers.authorization ?? '';
  const [tipo, token] = auth.split(' ');

  if (tipo !== 'Bearer' || !token) {
    next(new ErrorAplicacion('NO_AUTORIZADO', 'Token requerido', 401));
    return;
  }

  try {
    const payload = verificarTokenDocente(token);
    req.docenteId = payload.docenteId;
    req.docenteRoles = Array.isArray(payload.roles) && payload.roles.length > 0 ? payload.roles : ['docente'];
    next();
  } catch {
    // `jsonwebtoken.verify` lanza si el token es invalido o expiro.
    next(new ErrorAplicacion('TOKEN_INVALIDO', 'Token invalido o expirado', 401));
  }
}

export function obtenerDocenteId(req: SolicitudDocente) {
  if (!req.docenteId) {
    // Error de uso interno (p. ej., se llamo sin `requerirDocente` antes).
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sesion requerida', 401);
  }
  return req.docenteId;
}
