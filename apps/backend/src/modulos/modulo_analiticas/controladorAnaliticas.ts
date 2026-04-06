/**
 * Controlador de analiticas y banderas.
 *
 * Notas:
 * - Todo se particiona por `docenteId` (multi-tenancy).
 * - Telemetria (`registrarEventosUso`) es best-effort: no debe romper la UX.
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { BanderaRevision } from './modeloBanderaRevision';
import { EventoUso } from './modeloEventoUso';
import { generarCsv } from './servicioExportacionCsv';
import { Calificacion } from '../modulo_calificacion/modeloCalificacion';
import { Alumno } from '../modulo_alumnos/modeloAlumno';
import { Periodo } from '../modulo_alumnos/modeloPeriodo';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { Docente } from '../modulo_autenticacion/modeloDocente';
import { construirListaAcademica } from './servicioListaAcademica';
import { COLUMNAS_LISTA_ACADEMICA } from './tiposListaAcademica';
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

  const docs = eventos.map((evento) => ({
    docenteId,
    sessionId: typeof evento.sessionId === 'string' ? evento.sessionId : undefined,
    pantalla: typeof evento.pantalla === 'string' ? evento.pantalla : undefined,
    accion: String(evento.accion || ''),
    exito: typeof evento.exito === 'boolean' ? evento.exito : undefined,
    duracionMs: typeof evento.duracionMs === 'number' ? evento.duracionMs : undefined,
    meta: evento.meta
  }));

  try {
    await EventoUso.insertMany(docs, { ordered: false });
    res.status(201).json({ ok: true, recibidos: docs.length });
  } catch {
    // Best-effort: la telemetria no debe romper la UX.
    res.status(201).json({ ok: true, recibidos: docs.length, advertencia: 'Algunos eventos no se pudieron guardar' });
  }
}

export async function listarBanderas(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtro: Record<string, string> = {};
  if (req.query.examenGeneradoId) filtro.examenGeneradoId = String(req.query.examenGeneradoId);
  if (req.query.alumnoId) filtro.alumnoId = String(req.query.alumnoId);
  filtro.docenteId = docenteId;

  const limite = Number(req.query.limite ?? 0);
  const consulta = BanderaRevision.find(filtro);
  const banderas = await (limite > 0 ? consulta.limit(limite) : consulta).lean();
  res.json({ banderas });
}

export async function crearBandera(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const bandera = await BanderaRevision.create({ ...req.body, docenteId });
  res.status(201).json({ bandera });
}

/**
 * Exporta CSV generico (sin persistencia).
 *
 * Seguridad: se invoca `obtenerDocenteId` para asegurar que la ruta este autenticada,
 * aunque el contenido lo provea el cliente.
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
 *
 * Contrato de autorizacion por objeto:
 * - `periodoId` se valida y se usa junto con `docenteId` para acotar datos.
 */
export async function exportarCsvCalificaciones(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.query.periodoId || '').trim();
  if (!periodoId) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'periodoId requerido', 400);
  }

  const alumnos = await Alumno.find({ docenteId, periodoId }).lean();
  const calificaciones = await Calificacion.find({ docenteId, periodoId }).lean();
  const banderas = await BanderaRevision.find({ docenteId }).lean();

  const columnas = ['matricula', 'nombre', 'grupo', 'parcial1', 'parcial2', 'global', 'final', 'banderas'];
  const banderasPorAlumno = new Map<string, string[]>();
  banderas.forEach((bandera) => {
    const alumnoId = String(bandera.alumnoId);
    const lista = banderasPorAlumno.get(alumnoId) ?? [];
    lista.push(bandera.tipo);
    banderasPorAlumno.set(alumnoId, lista);
  });

  const filas = alumnos.map((alumno) => {
    const calificacion = calificaciones.find((item) => String(item.alumnoId) === String(alumno._id));
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
      banderas: (banderasPorAlumno.get(String(alumno._id)) ?? []).join(';')
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
    Docente.findById(docenteId).lean(),
    Periodo.findOne({ _id: periodoId, docenteId }).lean(),
    Alumno.find({ docenteId, periodoId }).lean(),
    Calificacion.find({ docenteId, periodoId }).lean()
  ]);

  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Periodo no encontrado', 404);
  }

  const xlsx = await generarXlsxCalificacionesProduccion({
    docenteNombre: String(docente?.nombreCompleto || ''),
    nombrePeriodo: String(periodo.nombre || ''),
    cicloLectivo: cicloLectivo(periodo.fechaInicio, periodo.fechaFin),
    alumnos,
    calificaciones
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', 'attachment; filename="calificaciones-produccion.xlsx"');
  res.send(xlsx);
}

async function obtenerListaAcademicaPorPeriodo(docenteId: string, periodoId: string) {
  const alumnos = await Alumno.find({ docenteId, periodoId }).lean();
  const calificaciones = await Calificacion.find({ docenteId, periodoId }).lean();
  const banderas = await BanderaRevision.find({ docenteId }).lean();
  return construirListaAcademica(alumnos, calificaciones, banderas);
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

export async function exportarListaAcademicaDocx(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.query.periodoId || '').trim();
  const requestId = (req as SolicitudDocente & { requestId?: string }).requestId;
  validarPeriodoId(periodoId);

  try {
    const filas = await obtenerListaAcademicaPorPeriodo(docenteId, periodoId);
    const docx = await generarDocxListaAcademica(COLUMNAS_LISTA_ACADEMICA, filas);
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
    const docxData = await generarDocxListaAcademica(COLUMNAS_LISTA_ACADEMICA, filas);
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
