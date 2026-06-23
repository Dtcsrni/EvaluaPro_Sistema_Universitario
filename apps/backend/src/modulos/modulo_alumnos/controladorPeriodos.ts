/**
 * Controlador de periodos.
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { configuracion } from '../../configuracion';
import { obtenerDocenteId } from '../modulo_autenticacion/middlewareAutenticacion';
import type { SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { prisma } from '../../infraestructura/baseDatos/sqlite';
import { aTituloPropio, normalizarEspacios } from '../../compartido/utilidades/texto';
import { guardarEnPapelera } from '../modulo_papelera/servicioPapelera';

export function normalizarNombrePeriodo(nombre: string): string {
  return normalizarEspacios(nombre).toLowerCase();
}

function validarAdminDev() {
  if (String(configuracion.entorno).toLowerCase() !== 'development') {
    throw new ErrorAplicacion('SOLO_DEV', 'Accion disponible solo en modo desarrollo', 403);
  }
}

function parsearQueryActivo(valor: unknown): boolean | null {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim().toLowerCase();
  if (!texto) return null;
  if (texto === '1' || texto === 'true' || texto === 'si' || texto === 'sí') return true;
  if (texto === '0' || texto === 'false' || texto === 'no') return false;
  return null;
}

/**
 * Lista periodos del docente autenticado.
 */
export async function listarPeriodos(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const activo = parsearQueryActivo(req.query.activo) ?? true;
  const limite = Number(req.query.limite ?? 0);

  const query: any = {
    where: {
      docenteId,
      activo
    },
    orderBy: {
      createdAt: 'desc'
    }
  };
  if (limite > 0) {
    query.take = limite;
  }

  const rawPeriodos = await prisma.periodo.findMany(query);
  const periodos = rawPeriodos.map((p) => ({
    ...p,
    grupos: JSON.parse(p.grupos || '[]'),
    resumenArchivado: p.resumenArchivado ? JSON.parse(p.resumenArchivado) : null
  }));

  res.json({ periodos });
}

/**
 * Crea un periodo asociado al docente.
 */
export async function crearPeriodo(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const nombre = String(req.body.nombre ?? '').trim();
  const nombreNormalizado = normalizarNombrePeriodo(nombre);

  const existente = await prisma.periodo.findUnique({
    where: {
      docenteId_nombreNormalizado: {
        docenteId,
        nombreNormalizado
      }
    }
  });
  if (existente) {
    throw new ErrorAplicacion('PERIODO_DUPLICADO', 'Ya existe una materia con ese nombre', 409);
  }

  const { fechaInicio, fechaFin, grupos } = req.body as { fechaInicio: Date | string; fechaFin: Date | string; grupos?: string[] };
  const nombreTitulo = aTituloPropio(nombre);

  const rawPeriodo = await prisma.periodo.create({
    data: {
      nombre: nombreTitulo,
      nombreNormalizado,
      docenteId,
      fechaInicio: new Date(fechaInicio),
      fechaFin: new Date(fechaFin),
      grupos: JSON.stringify(grupos || []),
      activo: true
    }
  });

  const periodo = {
    ...rawPeriodo,
    grupos: JSON.parse(rawPeriodo.grupos || '[]')
  };

  res.status(201).json({ periodo });
}

/**
 * Actualiza una materia del docente autenticado.
 */
export async function actualizarPeriodo(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.params.periodoId ?? '').trim();

  const periodo = await prisma.periodo.findFirst({
    where: { id: periodoId, docenteId }
  });
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }
  if (periodo.activo === false) {
    throw new ErrorAplicacion('PERIODO_INACTIVO', 'La materia está archivada', 409);
  }

  const payload = req.body as {
    nombre?: string;
    fechaInicio?: Date | string;
    fechaFin?: Date | string;
    grupos?: string[];
  };

  const data: Record<string, any> = {};

  if (payload.nombre !== undefined) {
    const nombre = String(payload.nombre ?? '').trim();
    const nombreNormalizado = normalizarNombrePeriodo(nombre);

    const existente = await prisma.periodo.findFirst({
      where: {
        docenteId,
        nombreNormalizado,
        id: { not: periodoId }
      }
    });
    if (existente) {
      throw new ErrorAplicacion('PERIODO_DUPLICADO', 'Ya existe una materia con ese nombre', 409);
    }
    data.nombre = aTituloPropio(nombre);
    data.nombreNormalizado = nombreNormalizado;
  }

  const fechaInicioNueva = payload.fechaInicio ? new Date(payload.fechaInicio) : new Date(periodo.fechaInicio);
  const fechaFinNueva = payload.fechaFin ? new Date(payload.fechaFin) : new Date(periodo.fechaFin);
  if (fechaFinNueva < fechaInicioNueva) {
    throw new ErrorAplicacion('PERIODO_FECHAS_INVALIDAS', 'La fecha fin debe ser igual o posterior a la fecha inicio', 400);
  }

  if (payload.fechaInicio !== undefined) data.fechaInicio = fechaInicioNueva;
  if (payload.fechaFin !== undefined) data.fechaFin = fechaFinNueva;
  if (payload.grupos !== undefined) data.grupos = JSON.stringify(payload.grupos);

  const rawActualizado = await prisma.periodo.update({
    where: { id: periodoId },
    data
  });

  const actualizado = {
    ...rawActualizado,
    grupos: JSON.parse(rawActualizado.grupos || '[]'),
    resumenArchivado: rawActualizado.resumenArchivado ? JSON.parse(rawActualizado.resumenArchivado) : null
  };

  res.json({ ok: true, periodo: actualizado });
}

/**
 * Archiva un periodo (materia): lo marca como inactivo, registra timestamp y genera un resumen.
 */
export async function archivarPeriodo(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.params.periodoId ?? '').trim();

  const periodo = await prisma.periodo.findFirst({
    where: { id: periodoId, docenteId }
  });
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }

  if (periodo.activo === false) {
    const actualizado = {
      ...periodo,
      grupos: JSON.parse(periodo.grupos || '[]'),
      resumenArchivado: periodo.resumenArchivado ? JSON.parse(periodo.resumenArchivado) : null
    };
    return res.json({ ok: true, periodo: actualizado });
  }

  const [alumnos, bancoPreguntas, plantillas, generados, calificaciones, codigosAcceso] = await Promise.all([
    prisma.alumno.count({ where: { periodoId } }),
    prisma.bancoPregunta.count({ where: { periodoId } }),
    prisma.examenPlantilla.count({ where: { periodoId } }),
    prisma.examenGenerado.count({ where: { periodoId } }),
    prisma.calificacion.count({ where: { periodoId } }),
    prisma.codigoAcceso.count({ where: { periodoId } })
  ]);

  const resumenArchivado = {
    alumnos,
    bancoPreguntas,
    plantillas,
    examenesGenerados: generados,
    calificaciones,
    codigosAcceso
  };

  const rawActualizado = await prisma.periodo.update({
    where: { id: periodoId },
    data: {
      activo: false,
      archivadoEn: new Date(),
      resumenArchivado: JSON.stringify(resumenArchivado)
    }
  });

  await Promise.all([
    prisma.alumno.updateMany({ where: { periodoId }, data: { activo: false } }),
    prisma.bancoPregunta.updateMany({ where: { periodoId }, data: { activo: false, archivadoEn: new Date() } }),
    prisma.temaBanco.updateMany({ where: { periodoId }, data: { activo: false, archivadoEn: new Date() } }),
    prisma.examenPlantilla.updateMany({ where: { periodoId }, data: { archivadoEn: new Date() } }),
    prisma.examenGenerado.updateMany({ where: { periodoId }, data: { archivadoEn: new Date() } })
  ]);

  const actualizado = {
    ...rawActualizado,
    grupos: JSON.parse(rawActualizado.grupos || '[]'),
    resumenArchivado
  };

  res.json({ ok: true, periodo: actualizado });
}

/**
 * Elimina una materia y sus datos asociados (solo admin en desarrollo).
 */
export async function eliminarPeriodoDev(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  validarAdminDev();
  const periodoId = String(req.params.periodoId ?? '').trim();

  const periodo = await prisma.periodo.findFirst({
    where: { id: periodoId, docenteId }
  });
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }

  const examenesDocs = await prisma.examenGenerado.findMany({ where: { periodoId } });
  const examenesIds = examenesDocs.map((examen) => examen.id);

  const [
    alumnosDocs,
    bancoDocs,
    temasDocs,
    plantillasDocs,
    calificacionesDocs,
    codigosDocs,
    entregasDocs,
    banderasDocs
  ] = await Promise.all([
    prisma.alumno.findMany({ where: { periodoId } }),
    prisma.bancoPregunta.findMany({ where: { periodoId } }),
    prisma.temaBanco.findMany({ where: { periodoId } }),
    prisma.examenPlantilla.findMany({ where: { periodoId } }),
    prisma.calificacion.findMany({ where: { periodoId } }),
    prisma.codigoAcceso.findMany({ where: { periodoId } }),
    examenesIds.length ? prisma.entrega.findMany({ where: { examenGeneradoId: { in: examenesIds } } }) : Promise.resolve([]),
    examenesIds.length ? prisma.banderaRevision.findMany({ where: { examenGeneradoId: { in: examenesIds } } }) : Promise.resolve([])
  ]);

  await guardarEnPapelera({
    docenteId,
    tipo: 'periodo',
    entidadId: periodoId,
    payload: {
      periodo: {
        ...periodo,
        grupos: JSON.parse(periodo.grupos || '[]')
      },
      alumnos: alumnosDocs,
      bancoPreguntas: bancoDocs,
      temas: temasDocs,
      plantillas: plantillasDocs,
      examenes: examenesDocs,
      entregas: entregasDocs,
      calificaciones: calificacionesDocs,
      banderas: banderasDocs,
      codigosAcceso: codigosDocs
    }
  });

  if (examenesIds.length > 0) {
    await Promise.all([
      prisma.entrega.deleteMany({ where: { examenGeneradoId: { in: examenesIds } } }),
      prisma.banderaRevision.deleteMany({ where: { examenGeneradoId: { in: examenesIds } } })
    ]);
  }

  const [
    alumnosResp,
    bancoResp,
    temasResp,
    plantillasResp,
    calificacionesResp,
    codigosResp,
    periodoResp
  ] = await Promise.all([
    prisma.alumno.deleteMany({ where: { periodoId } }),
    prisma.bancoPregunta.deleteMany({ where: { periodoId } }),
    prisma.temaBanco.deleteMany({ where: { periodoId } }),
    prisma.examenPlantilla.deleteMany({ where: { periodoId } }),
    prisma.calificacion.deleteMany({ where: { periodoId } }),
    prisma.codigoAcceso.deleteMany({ where: { periodoId } }),
    prisma.periodo.deleteMany({ where: { id: periodoId, docenteId } })
  ]);

  res.json({
    ok: true,
    eliminados: {
      periodos: periodoResp.count,
      alumnos: alumnosResp.count,
      bancoPreguntas: bancoResp.count,
      temas: temasResp.count,
      plantillas: plantillasResp.count,
      examenes: examenesIds.length,
      entregas: entregasDocs.length,
      calificaciones: calificacionesResp.count,
      banderas: banderasDocs.length,
      codigosAcceso: codigosResp.count
    }
  });
}
