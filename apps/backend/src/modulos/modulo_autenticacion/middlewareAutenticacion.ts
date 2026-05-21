/**
 * Middleware para requerir sesion docente via JWT.
 *
 * Formato esperado: `Authorization: Bearer <token>`.
 * Si el token es valido, se adjunta `docenteId` al request para que los
 * controladores puedan aplicar autorizacion por objeto.
 */
import type { NextFunction, Request, Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { normalizarRoles } from '../../infraestructura/seguridad/rbac';
import { Docente } from './modeloDocente';
import { verificarTokenDocente } from './servicioTokens';

export type SolicitudDocente = Request & { docenteId?: string; docenteRoles?: string[] };

export async function requerirDocente(req: SolicitudDocente, _res: Response, next: NextFunction) {
  const auth = req.headers.authorization ?? '';
  const [tipo, token] = auth.split(' ');

  if (tipo !== 'Bearer' || !token) {
    next(new ErrorAplicacion('NO_AUTORIZADO', 'Token requerido', 401));
    return;
  }

  let docenteId = '';
  try {
    docenteId = verificarTokenDocente(token).docenteId;
  } catch {
    // `jsonwebtoken.verify` lanza si el token es invalido o expiro.
    next(new ErrorAplicacion('TOKEN_INVALIDO', 'Token invalido o expirado', 401));
    return;
  }

  try {
    const docente = await Docente.findById(docenteId).select({ activo: 1, roles: 1 }).lean();
    if (!docente) {
      next(new ErrorAplicacion('NO_AUTORIZADO', 'Sesion requerida', 401));
      return;
    }
    if (!docente.activo) {
      next(new ErrorAplicacion('DOCENTE_INACTIVO', 'Docente inactivo', 403));
      return;
    }

    const roles = normalizarRoles((docente as unknown as { roles?: unknown }).roles);
    req.docenteId = docenteId;
    req.docenteRoles = roles.length > 0 ? roles : ['docente'];
    next();
  } catch (error) {
    next(error);
  }
}

export function obtenerDocenteId(req: SolicitudDocente) {
  if (!req.docenteId) {
    // Error de uso interno (p. ej., se llamo sin `requerirDocente` antes).
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sesion requerida', 401);
  }
  return req.docenteId;
}
