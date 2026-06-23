/**
 * Controlador de administracion de docentes (solo admin).
 */
import type { Request, Response } from 'express';
import { prisma } from '../../infraestructura/baseDatos/sqlite';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { normalizarRoles, permisosComoLista } from '../../infraestructura/seguridad/rbac';

export async function listarDocentes(req: Request, res: Response) {
  const q = String(req.query.q ?? '').trim();
  const activo = typeof req.query.activo === 'string' ? req.query.activo : undefined;
  const limite = Math.min(Math.max(Number(req.query.limite ?? 50), 1), 200);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);

  const where: any = {};
  if (q) {
    where.OR = [
      { correo: { contains: q } },
      { nombreCompleto: { contains: q } }
    ];
  }
  if (activo === '1' || activo === 'true') where.activo = true;
  if (activo === '0' || activo === 'false') where.activo = false;

  const [total, docentes] = await Promise.all([
    prisma.docente.count({ where }),
    prisma.docente.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limite
    })
  ]);

  res.json({
    total,
    docentes: docentes.map((docente) => {
      const rawRoles = typeof docente.roles === 'string' ? JSON.parse(docente.roles) : (docente.roles || []);
      const roles = normalizarRoles(rawRoles);
      return {
        id: docente.id,
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

  const updateData: any = {};
  if (roles) updateData.roles = JSON.stringify(roles);
  if (typeof activo === 'boolean') updateData.activo = activo;

  const actualizado = await prisma.docente.update({
    where: { id: docenteId },
    data: updateData
  });

  const rawRoles = typeof actualizado.roles === 'string' ? JSON.parse(actualizado.roles) : (actualizado.roles || []);
  const rolesFinales = normalizarRoles(rawRoles);
  res.json({
    docente: {
      id: actualizado.id,
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

