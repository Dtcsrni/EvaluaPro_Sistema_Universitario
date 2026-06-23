/**
 * Controlador de analiticas y banderas.
 *
 * Notas:
 * - Todo se particiona por `docenteId` (multi-tenancy).
 * - Telemetria (`registrarEventosUso`) es best-effort: no debe romper la UX.
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { prisma } from '../../infraestructura/baseDatos/sqlite';
import { generarCsv } from './servicioExportacionCsv';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { construirListaAcademica } from './servicioListaAcademica';
import { COLUMNAS_LISTA_ACADEMICA, ListaAcademicaFila } from './tiposListaAcademica';
import { generarDocxListaAcademica } from './servicioExportacionDocx';
import { generarXlsxCalificacionesProduccion } from './servicioExportacionXlsxCalificaciones';
import { construirManifiestoIntegridadLista, serializarManifiestoEstable } from './servicioFirmaIntegridad';
import { registrarExportacionLista } from '../../compartido/observabilidad/metrics';
import { log } from '../../infraestructura/logging/logger';

/**
 * Registra eventos de uso asociados al docente.
 *
 * Best-effort: si algunos documentos fallan (duplicados/validaciones), se responde 201.
 */
export async function registrarEventosUso(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const eventos = (req.body?.eventos ?? []) as Array<{
    sessionId?: unknown;
    pantalla?: unknown;
    accion?: unknown;
    exito?: unknown;
    duracionMs?: unknown;
    meta?: unknown;
  }>;

  const docs = eventos.map((evento) => {
    const metaObj = {
      sessionId: typeof evento.sessionId === 'string' ? evento.sessionId : undefined,
      pantalla: typeof evento.pantalla === 'string' ? evento.pantalla : undefined,
      exito: typeof evento.exito === 'boolean' ? evento.exito : undefined,
      duracionMs: typeof evento.duracionMs === 'number' ? evento.duracionMs : undefined,
      meta: evento.meta
    };
    return {
      docenteId,
      accion: String(evento.accion || ''),
      meta: JSON.stringify(metaObj)
    };
  });

  try {
    await prisma.eventoUso.createMany({
      data: docs
    });
    res.status(201).json({ ok: true, recibidos: docs.length });
  } catch {
    // Best-effort: la telemetria no debe romper la UX.
    res.status(201).json({ ok: true, recibidos: docs.length, advertencia: 'Algunos eventos no se pudieron guardar' });
  }
}

export async function listarBanderas(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const where: any = { docenteId };
  if (req.query.examenGeneradoId) where.examenGeneradoId = String(req.query.examenGeneradoId);
  if (req.query.alumnoId) where.alumnoId = String(req.query.alumnoId);

  const limite = Number(req.query.limite ?? 0);
  const records = await prisma.banderaRevision.findMany({
    where,
    take: limite > 0 ? limite : undefined
  });

  const banderas = records.map((b) => ({
    _id: b.id,
    id: b.id,
    docenteId: b.docenteId,
    examenGeneradoId: b.examenGeneradoId,
    alumnoId: b.alumnoId,
    tipo: b.motivo, // Map motivo -> tipo
    severidad: 'baja',
    descripcion: '',
    sugerencia: '',
    createdAt: b.createdAt,
    updatedAt: b.updatedAt
  }));

  res.json({ banderas });
}

export async function crearBandera(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const created = await prisma.banderaRevision.create({
    data: {
      examenGeneradoId: req.body.examenGeneradoId,
      alumnoId: req.body.alumnoId,
      docenteId,
      motivo: req.body.tipo || req.body.motivo || ''
    }
  });

  const bandera = {
    _id: created.id,
    id: created.id,
    docenteId: created.docenteId,
    examenGeneradoId: created.examenGeneradoId,
    alumnoId: created.alumnoId,
    tipo: created.motivo,
    severidad: 'baja',
    descripcion: '',
    sugerencia: '',
    createdAt: created.createdAt,
    updatedAt: created.updatedAt
  };

  res.status(201).json({ bandera });
}

/**
 * Exporta CSV generico (sin persistencia).
 */
export function exportarCsv(req: SolicitudDocente, res: Response) {
  obtenerDocenteId(req);
  const { columnas, filas } = (req.body ?? {}) as { columnas?: unknown; filas?: unknown };
  if (!Array.isArray(columnas) || columnas.length === 0 || columnas.some((c) => typeof c !== 'string' || !c.trim())) {
    throw new ErrorAplicacion('VALIDACION', 'Payload invalido', 400);
  }
  if (!Array.isArray(filas)) {
    throw new ErrorAplicacion('VALIDACION', 'Payload invalido', 400);
  }
  const csv = generarCsv(columnas, filas);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="exportacion.csv"');
  res.send(csv);
}

/**
 * Exporta CSV de calificaciones de un periodo del docente.
 */
export async function exportarCsvCalificaciones(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.query.periodoId || '').trim();
  if (!periodoId) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'periodoId requerido', 400);
  }

  const alumnos = await prisma.alumno.findMany({
    where: { periodo: { id: periodoId, docenteId } }
  });
  const calificaciones = await prisma.calificacion.findMany({
    where: { docenteId, periodoId }
  });
  const banderas = await prisma.banderaRevision.findMany({
    where: { docenteId }
  });

  const columnas = ['matricula', 'nombre', 'grupo', 'parcial1', 'parcial2', 'global', 'final', 'banderas'];
  const banderasPorAlumno = new Map<string, string[]>();
  banderas.forEach((bandera) => {
    const alumnoId = String(bandera.alumnoId);
    const lista = banderasPorAlumno.get(alumnoId) ?? [];
    lista.push(bandera.motivo); // Map motivo -> tipo
    banderasPorAlumno.set(alumnoId, lista);
  });

  const filas = alumnos.map((alumno) => {
    const calificacion = calificaciones.find((item) => String(item.alumnoId) === String(alumno.id));
    const parcial = calificacion?.calificacionParcialTexto ?? '';
    const global = calificacion?.calificacionGlobalTexto ?? '';
    const final = global || parcial || calificacion?.calificacionExamenFinalTexto || '';
    return {
      matricula: alumno.matricula,
      nombre: alumno.nombreCompleto,
      grupo: alumno.grupo ?? '',
      parcial1: calificacion?.tipoExamen === 'parcial' ? parcial : '',
      parcial2: '',
      global: calificacion?.tipoExamen === 'global' ? global : '',
      final,
      banderas: (banderasPorAlumno.get(String(alumno.id)) ?? []).join(';')
    };
  });

  const csv = generarCsv(columnas, filas);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="calificaciones.csv"');
  res.send(csv);
}

function cicloLectivo(fechaInicio?: Date, fechaFin?: Date): string {
  if (!fechaInicio || !fechaFin) return '';
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  const mesInicio = meses[inicio.getUTCMonth()] ?? '';
  const mesFin = meses[fin.getUTCMonth()] ?? '';
  const anio = fin.getUTCFullYear();
  return `${mesInicio}-${mesFin} ${anio}`;
}

export async function exportarXlsxCalificaciones(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.query.periodoId || '').trim();
  if (!periodoId) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'periodoId requerido', 400);
  }

  const [docente, periodo, alumnos, calificaciones] = await Promise.all([
    prisma.docente.findUnique({ where: { id: docenteId } }),
    prisma.periodo.findFirst({ where: { id: periodoId, docenteId } }),
    prisma.alumno.findMany({ where: { periodo: { id: periodoId, docenteId } } }),
    prisma.calificacion.findMany({ where: { docenteId, periodoId } })
  ]);

  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Periodo no encontrado', 404);
  }

  const mappedAlumnos = alumnos.map((a) => ({ ...a, _id: a.id }));
  const mappedCalificaciones = calificaciones.map((c) => ({ ...c, _id: c.id, tipoExamen: c.tipoExamen as 'parcial' | 'global' }));

  const xlsx = await generarXlsxCalificacionesProduccion({
    docenteNombre: String(docente?.nombreCompleto || ''),
    nombrePeriodo: String(periodo.nombre || ''),
    cicloLectivo: cicloLectivo(periodo.fechaInicio, periodo.fechaFin),
    alumnos: mappedAlumnos,
    calificaciones: mappedCalificaciones as any
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', 'attachment; filename="calificaciones-produccion.xlsx"');
  res.send(xlsx);
}

async function obtenerListaAcademicaPorPeriodo(docenteId: string, periodoId: string) {
  const alumnos = await prisma.alumno.findMany({
    where: { periodo: { id: periodoId, docenteId } }
  });
  const calificaciones = await prisma.calificacion.findMany({
    where: { docenteId, periodoId }
  });
  const banderas = await prisma.banderaRevision.findMany({
    where: { docenteId }
  });

  const mappedAlumnos = alumnos.map((a) => ({ ...a, _id: a.id }));
  const mappedCalificaciones = calificaciones.map((c) => ({ ...c, _id: c.id }));
  const mappedBanderas = banderas.map((b) => ({
    ...b,
    _id: b.id,
    tipo: b.motivo // Map motivo -> tipo
  }));

  return construirListaAcademica(mappedAlumnos, mappedCalificaciones, mappedBanderas);
}

function validarPeriodoId(periodoId: string) {
  if (!periodoId) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'periodoId requerido', 400);
  }
}

export async function exportarListaAcademicaCsv(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.query.periodoId || '').trim();
  const requestId = (req as SolicitudDocente & { requestId?: string }).requestId;
  validarPeriodoId(periodoId);

  try {
    const filas = await obtenerListaAcademicaPorPeriodo(docenteId, periodoId);
    const csv = generarCsv(COLUMNAS_LISTA_ACADEMICA, filas);
    registrarExportacionLista('csv', true);
    log('info', 'Exportacion lista academica CSV', { requestId, userId: docenteId, periodoId, filas: filas.length });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="lista-academica.csv"');
    res.send(csv);
  } catch (error) {
    registrarExportacionLista('csv', false);
    throw error;
  }
}

const cacheDocx = new Map<string, { promesa: Promise<Buffer>; timestamp: number }>();

function obtenerDocxCacheado(periodoId: string, filas: ListaAcademicaFila[], columnas: string[]): Promise<Buffer> {
  const clave = `${periodoId}_${filas.length}`;
  const entrada = cacheDocx.get(clave);
  const ahora = Date.now();
  if (entrada && (ahora - entrada.timestamp) < 5000) {
    console.log(`[Cache DOCX] HIT para clave ${clave}`);
    return entrada.promesa;
  }
  console.log(`[Cache DOCX] MISS para clave ${clave}`);
  const promesa = generarDocxListaAcademica(columnas, filas);
  cacheDocx.set(clave, { promesa, timestamp: ahora });
  return promesa;
}

export async function exportarListaAcademicaDocx(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.query.periodoId || '').trim();
  const requestId = (req as SolicitudDocente & { requestId?: string }).requestId;
  validarPeriodoId(periodoId);

  try {
    const filas = await obtenerListaAcademicaPorPeriodo(docenteId, periodoId);
    const docx = await obtenerDocxCacheado(periodoId, filas, COLUMNAS_LISTA_ACADEMICA);
    registrarExportacionLista('docx', true);
    log('info', 'Exportacion lista academica DOCX', { requestId, userId: docenteId, periodoId, filas: filas.length });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="lista-academica.docx"');
    res.send(docx);
  } catch (error) {
    registrarExportacionLista('docx', false);
    throw error;
  }
}

export async function exportarListaAcademicaFirma(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.query.periodoId || '').trim();
  const requestId = (req as SolicitudDocente & { requestId?: string }).requestId;
  validarPeriodoId(periodoId);

  try {
    const filas = await obtenerListaAcademicaPorPeriodo(docenteId, periodoId);
    const csvData = Buffer.from(generarCsv(COLUMNAS_LISTA_ACADEMICA, filas), 'utf-8');
    const docxData = await obtenerDocxCacheado(periodoId, filas, COLUMNAS_LISTA_ACADEMICA);
    const manifiesto = construirManifiestoIntegridadLista(periodoId, csvData, docxData);
    registrarExportacionLista('firma', true);
    log('info', 'Exportacion firma lista academica', { requestId, userId: docenteId, periodoId, filas: filas.length });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="lista-academica.manifest.json"');
    res.send(serializarManifiestoEstable(manifiesto));
  } catch (error) {
    registrarExportacionLista('firma', false);
    throw error;
  }
}
