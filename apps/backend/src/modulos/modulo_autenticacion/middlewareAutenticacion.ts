/**
 * Middleware para requerir sesion docente via JWT.
 */
import type { NextFunction, Request, Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { normalizarRoles } from '../../infraestructura/seguridad/rbac';
import { prisma } from '../../infraestructura/baseDatos/sqlite';
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
    next(new ErrorAplicacion('TOKEN_INVALIDO', 'Token invalido o expirado', 401));
    return;
  }

  try {
    const docente = await prisma.docente.findUnique({
      where: { id: docenteId },
      select: { activo: true, roles: true }
    });
    if (!docente) {
      next(new ErrorAplicacion('NO_AUTORIZADO', 'Sesion requerida', 401));
      return;
    }
    if (!docente.activo) {
      next(new ErrorAplicacion('DOCENTE_INACTIVO', 'Docente inactivo', 403));
      return;
    }

    const rolesArray = typeof docente.roles === 'string' ? JSON.parse(docente.roles) : [];
    const roles = normalizarRoles(rolesArray);
    req.docenteId = docenteId;
    req.docenteRoles = roles.length > 0 ? roles : ['docente'];
    next();
  } catch (error) {
    next(error);
  }
}

export function obtenerDocenteId(req: SolicitudDocente) {
  if (!req.docenteId) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sesion requerida', 401);
  }
  return req.docenteId;
}
