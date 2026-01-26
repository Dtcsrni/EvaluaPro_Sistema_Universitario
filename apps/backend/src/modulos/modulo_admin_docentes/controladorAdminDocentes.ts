/**
 * Controlador de administracion de docentes (solo admin).
 */
import type { Request, Response } from 'express';
import { Docente } from '../modulo_autenticacion/modeloDocente';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { normalizarRoles, permisosComoLista } from '../../infraestructura/seguridad/rbac';

export async function listarDocentes(req: Request, res: Response) {
  const q = String(req.query.q ?? '').trim();
  const activo = typeof req.query.activo === 'string' ? req.query.activo : undefined;
  const limite = Math.min(Math.max(Number(req.query.limite ?? 50), 1), 200);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);

  const filtro: Record<string, unknown> = {};
  if (q) {
    filtro.$or = [
      { correo: { $regex: q, $options: 'i' } },
      { nombreCompleto: { $regex: q, $options: 'i' } }
    ];
  }
  if (activo === '1' || activo === 'true') filtro.activo = true;
  if (activo === '0' || activo === 'false') filtro.activo = false;

  const [total, docentes] = await Promise.all([
    Docente.countDocuments(filtro),
    Docente.find(filtro)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limite)
      .lean()
  ]);

  res.json({
    total,
    docentes: docentes.map((docente) => {
      const roles = normalizarRoles((docente as unknown as { roles?: unknown }).roles);
      return {
        id: docente._id,
        nombreCompleto: docente.nombreCompleto,
        correo: docente.correo,
        activo: Boolean(docente.activo),
        roles,
        permisos: permisosComoLista(roles),
        createdAt: docente.createdAt,
        ultimoAcceso: docente.ultimoAcceso
      };
    })
  });
}

export async function actualizarDocenteAdmin(req: Request, res: Response) {
  const docenteId = String(req.params.docenteId || '').trim();
  if (!docenteId) {
    throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'Docente no encontrado', 404);
  }

  const roles = typeof req.body.roles !== 'undefined' ? normalizarRoles(req.body.roles) : undefined;
  const activo = typeof req.body.activo !== 'undefined' ? Boolean(req.body.activo) : undefined;

  const set: Record<string, unknown> = {};
  if (roles) set.roles = roles;
  if (typeof activo === 'boolean') set.activo = activo;

  const actualizado = await Docente.findOneAndUpdate(
    { _id: docenteId },
    { $set: set },
    { new: true }
  ).lean();

  if (!actualizado) {
    throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'Docente no encontrado', 404);
  }

  const rolesFinales = normalizarRoles((actualizado as unknown as { roles?: unknown }).roles);
  res.json({
    docente: {
      id: actualizado._id,
      nombreCompleto: actualizado.nombreCompleto,
      correo: actualizado.correo,
      activo: Boolean(actualizado.activo),
      roles: rolesFinales,
      permisos: permisosComoLista(rolesFinales),
      createdAt: actualizado.createdAt,
      ultimoAcceso: actualizado.ultimoAcceso
    }
  });
}

