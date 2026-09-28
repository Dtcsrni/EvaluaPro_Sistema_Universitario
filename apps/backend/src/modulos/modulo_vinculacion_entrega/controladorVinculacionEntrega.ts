/**
 * Controlador de vinculacion al recibir examenes.
 *
 * Objetivo: asociar un `ExamenGenerado` con un alumno cuando se entrega/identifica.
 *
 * Contrato de seguridad:
 * - La vinculacion siempre se restringe al `docenteId` autenticado.
 * - Se registra una `Entrega` como bitacora de la operacion.
 */
import type { Response } from 'express';
import type { Prisma } from '@prisma/client';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { esquemaListarEntregas } from './validacionesVinculacion.js';

function decodificarCursorEntrega(valor: string | undefined) {
  if (!valor) return undefined;
  try {
    const cursor = JSON.parse(Buffer.from(valor, 'base64url').toString('utf8')) as { id?: unknown; createdAt?: unknown };
    const id = String(cursor.id ?? '').trim();
    const createdAt = new Date(String(cursor.createdAt ?? ''));
    if (!id || id.length > 200 || !Number.isFinite(createdAt.getTime())) throw new Error('cursor inválido');
    return { id, createdAt };
  } catch {
    throw new ErrorAplicacion('ENTREGA_CURSOR_INVALIDO', 'El cursor de entregas no es válido', 400);
  }
}

const seleccionEntregaPublica = {
  id: true,
  examenGeneradoId: true,
  alumnoId: true,
  docenteId: true,
  estado: true,
  fechaEntrega: true,
  acordeonEntregado: true,
  bonoAcordeon: true,
  motivoDeshacer: true,
  createdAt: true,
  updatedAt: true,
  alumno: { select: { id: true, nombreCompleto: true, matricula: true } },
  examenGenerado: { select: { id: true, folio: true, estado: true, periodoId: true, plantillaId: true, loteId: true, generadoEn: true } }
} satisfies Prisma.EntregaSelect;

export async function listarEntregas(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const query = esquemaListarEntregas.parse(res.locals.validatedQuery ?? req.query);
  const cursor = decodificarCursorEntrega(query.cursor);
  const examenGenerado: Prisma.ExamenGeneradoScalarRelationFilter = {
    is: {
      ...(query.periodoId ? { periodoId: query.periodoId } : {}),
      ...(query.loteId ? { loteId: query.loteId } : {})
    }
  };
  const where: Prisma.EntregaWhereInput = {
    docenteId,
    ...(query.examenGeneradoId ? { examenGeneradoId: query.examenGeneradoId } : {}),
    ...(query.alumnoId ? { alumnoId: query.alumnoId } : {}),
    ...(query.estado ? { estado: query.estado } : {}),
    ...(query.periodoId || query.loteId ? { examenGenerado } : {}),
    ...(cursor ? {
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } }
      ]
    } : {})
  };
  const resultados = await prisma.entrega.findMany({
    where,
    select: seleccionEntregaPublica,
    take: query.limite + 1,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
  });
  const hayMas = resultados.length > query.limite;
  const entregas = resultados.slice(0, query.limite);
  const ultimo = hayMas ? entregas[entregas.length - 1] : undefined;
  const nextCursor = ultimo
    ? Buffer.from(JSON.stringify({ id: ultimo.id, createdAt: ultimo.createdAt.toISOString() }), 'utf8').toString('base64url')
    : null;
  res.json({ entregas, nextCursor });
}

export async function obtenerEntrega(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const entrega = await prisma.entrega.findFirst({
    where: { id: String(req.params.entregaId ?? '').trim(), docenteId },
    select: seleccionEntregaPublica
  });
  if (!entrega) throw new ErrorAplicacion('ENTREGA_NO_ENCONTRADA', 'Entrega no encontrada', 404);
  res.json({ entrega });
}

/**
 * Vincula un examen por id.
 *
 * Reglas:
 * - El examen debe existir y pertenecer al docente autenticado.
 * - Marca el examen como `entregado`.
 */
export async function vincularEntrega(req: SolicitudDocente, res: Response) {
  const { examenGeneradoId, alumnoId, acordeonEntregado, bonoAcordeon } = req.body;
  const docenteId = obtenerDocenteId(req);

  const examen = await prisma.examenGenerado.findUnique({
    where: { id: examenGeneradoId }
  });
  if (!examen) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }
  if (examen.docenteId !== docenteId) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a este examen', 403);
  }
  const estadoActual = String(examen.estado ?? '').toLowerCase();
  if (estadoActual === 'entregado' || estadoActual === 'calificado') {
    throw new ErrorAplicacion('EXAMEN_YA_ENTREGADO', 'Este examen ya fue entregado', 409);
  }

  await prisma.examenGenerado.update({
    where: { id: examenGeneradoId },
    data: {
      alumnoId,
      estado: 'entregado',
      entregadoEn: new Date()
    }
  });

  const entrega = await prisma.entrega.create({
    data: {
      examenGeneradoId,
      alumnoId,
      docenteId,
      estado: 'entregado',
      fechaEntrega: new Date(),
      acordeonEntregado: Boolean(acordeonEntregado),
      bonoAcordeon: acordeonEntregado
        ? Number.isFinite(Number(bonoAcordeon))
          ? Math.max(0, Math.min(0.5, Number(bonoAcordeon)))
          : 0.25
        : 0
    }
  });

  res.status(201).json({ entrega });
}

/**
 * Vincula un examen por folio.
 *
 * Nota: aqui la autorizacion por objeto se implementa filtrando directamente
 * por `{ folio, docenteId }`.
 */
export async function vincularEntregaPorFolio(req: SolicitudDocente, res: Response) {
  const folio = String(req.body.folio || '').toUpperCase();
  const { alumnoId, acordeonEntregado, bonoAcordeon } = req.body;
  const docenteId = obtenerDocenteId(req);

  const examen = await prisma.examenGenerado.findFirst({
    where: { folio, docenteId }
  });
  if (!examen) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }
  const estadoActual = String(examen.estado ?? '').toLowerCase();
  if (estadoActual === 'entregado' || estadoActual === 'calificado') {
    throw new ErrorAplicacion('EXAMEN_YA_ENTREGADO', 'Este examen ya fue entregado', 409);
  }

  await prisma.examenGenerado.update({
    where: { id: examen.id },
    data: {
      alumnoId,
      estado: 'entregado',
      entregadoEn: new Date()
    }
  });

  const entrega = await prisma.entrega.create({
    data: {
      examenGeneradoId: examen.id,
      alumnoId,
      docenteId,
      estado: 'entregado',
      fechaEntrega: new Date(),
      acordeonEntregado: Boolean(acordeonEntregado),
      bonoAcordeon: acordeonEntregado
        ? Number.isFinite(Number(bonoAcordeon))
          ? Math.max(0, Math.min(0.5, Number(bonoAcordeon)))
          : 0.25
        : 0
    }
  });

  res.status(201).json({ entrega });
}

/**
 * Deshace la vinculacion/entrega por folio.
 *
 * Reglas:
 * - El examen debe existir y pertenecer al docente autenticado.
 * - Regresa el examen a estado "generado", limpiando alumno y fecha de entrega.
 * - Actualiza la ultima entrega registrada a estado "pendiente".
 */
export async function deshacerEntregaPorFolio(req: SolicitudDocente, res: Response) {
  const folio = String(req.body.folio || '').toUpperCase();
  const motivo = String(req.body.motivo || '').trim();
  const docenteId = obtenerDocenteId(req);

  const examen = await prisma.examenGenerado.findFirst({
    where: { folio, docenteId }
  });
  if (!examen) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }

  const estadoActual = String(examen.estado ?? '').toLowerCase();
  if (estadoActual === 'calificado') {
    throw new ErrorAplicacion('ENTREGA_NO_REVERSIBLE', 'No se puede deshacer una entrega calificada', 409);
  }
  if (estadoActual !== 'entregado' && estadoActual !== 'calificado') {
    return res.status(200).json({ actualizado: false, estado: examen.estado });
  }

  const updatedExamen = await prisma.examenGenerado.update({
    where: { id: examen.id },
    data: {
      alumnoId: null,
      estado: 'generado',
      entregadoEn: null
    }
  });

  const lasEntregas = await prisma.entrega.findMany({
    where: { examenGeneradoId: examen.id, docenteId },
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  const entrega = lasEntregas[0];
  if (entrega) {
    await prisma.entrega.update({
      where: { id: entrega.id },
      data: {
        estado: 'pendiente',
        fechaEntrega: null,
        motivoDeshacer: motivo || null
      }
    });
  }

  res.status(200).json({ actualizado: true, estado: updatedExamen.estado });
}
