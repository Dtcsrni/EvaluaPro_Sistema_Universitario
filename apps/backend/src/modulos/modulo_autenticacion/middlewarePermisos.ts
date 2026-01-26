/**
 * Middleware de permisos basado en roles (RBAC).
 */
import type { NextFunction, Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import type { SolicitudDocente } from './middlewareAutenticacion';
import type { Permiso } from '../../infraestructura/seguridad/rbac';
import { permisosParaRoles } from '../../infraestructura/seguridad/rbac';

export function requerirPermiso(...permisos: Permiso[]) {
  return (req: SolicitudDocente, _res: Response, next: NextFunction) => {
    const roles = req.docenteRoles ?? [];
    const permisosUsuario = permisosParaRoles(roles);
    const ok = permisos.every((permiso) => permisosUsuario.has(permiso));
    if (!ok) {
      next(new ErrorAplicacion('NO_AUTORIZADO', 'Sin permisos para esta accion', 403));
      return;
    }
    next();
  };
}

