/**
 * Controlador de analiticas y banderas.
 *
 * Notas:
 * - Todo se particiona por `docenteId` (multi-tenancy).
 * - Telemetria (`registrarEventosUso`) es best-effort: no debe romper la UX.
 */
import type { Response } from 'express';
import type { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { Decimal } from 'decimal.js';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { generarCsv } from './servicioExportacionCsv.js';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion.js';
import { construirListaAcademica } from './servicioListaAcademica.js';
import { presentarCalificacionExtraordinaria } from '../modulo_calificacion/servicioCalificacion.js';
import { COLUMNAS_LISTA_ACADEMICA, ListaAcademicaFila } from './tiposListaAcademica.js';
import { generarDocxListaAcademica } from './servicioExportacionDocx.js';
import { generarXlsxCalificacionesProduccion } from './servicioExportacionXlsxCalificaciones.js';
import { construirManifiestoIntegridadLista, serializarManifiestoEstable } from './servicioFirmaIntegridad.js';
import { registrarExportacionLista } from '../../compartido/observabilidad/metrics.js';
import { log } from '../../infraestructura/logging/logger.js';

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
    where: { docenteId, periodoId },
    orderBy: { createdAt: 'asc' },
    include: { examenGenerado: { include: { plantilla: true } } }
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
    const fila = construirListaAcademica(
      [
        {
          _id: alumno.id,
          matricula: alumno.matricula,
          nombreCompleto: alumno.nombreCompleto,
          grupo: alumno.grupo
        }
      ],
      calificaciones
        .filter((item) => String(item.alumnoId) === String(alumno.id))
        .map((item) => ({
          ...item,
          plantillaTitulo: item.examenGenerado?.plantilla?.titulo
        })),
      banderas
    )[0];
    return {
      matricula: alumno.matricula,
      nombre: alumno.nombreCompleto,
      grupo: alumno.grupo ?? '',
      parcial1: fila?.parcial1 ?? '',
      parcial2: fila?.parcial2 ?? '',
      global: fila?.global ?? '',
      final: fila?.final ?? '',
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

function leerRegistroJson(valor: unknown): Record<string, unknown> {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) return valor as Record<string, unknown>;
  if (typeof valor !== 'string' || !valor.trim()) return {};
  try {
    const parsed = JSON.parse(valor);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function cargarDatosListaAcademica(docenteId: string, periodoId: string, bonoExtracurricularPorAlumno?: ReadonlyMap<string, number>) {
  const [alumnos, calificaciones, banderas, evidencias, mapeos, calificacionesManuales, componentesExamen, resultadosExtraExternos] = await Promise.all([
    prisma.alumno.findMany({ where: { periodo: { id: periodoId, docenteId } } }),
    prisma.calificacion.findMany({
      where: { docenteId, periodoId },
      include: { examenGenerado: { include: { plantilla: true } } }
    }),
    prisma.banderaRevision.findMany({ where: { docenteId } }),
    prisma.evidenciaEvaluacion.findMany({ where: { docenteId, periodoId, fuente: 'classroom' } }),
    prisma.mapeoClassroomEvidencia.findMany({ where: { docenteId, periodoId } }),
    prisma.calificacionListaManual.findMany({ where: { docenteId, periodoId } }),
    prisma.componenteExamen.findMany({ where: { docenteId, periodoId, corte: 'global' } }),
    prisma.resultadoExtraExterno.findMany({ where: { docenteId, periodoId } })
  ]);

  const mappedAlumnos = alumnos.map((alumno) => ({ ...alumno, _id: alumno.id }));
  const mappedCalificaciones = calificaciones.map((calificacion) => ({
    ...calificacion,
    _id: calificacion.id,
    tipoExamen: calificacion.tipoExamen as 'parcial' | 'global' | 'extraordinario',
    plantillaTitulo: calificacion.examenGenerado?.plantilla?.titulo
  }));
  const mappedBanderas = banderas.map((bandera) => ({ ...bandera, _id: bandera.id, tipo: bandera.motivo }));
  const mappedMapeos = mapeos.map((mapeo) => {
    const metadata = leerRegistroJson(mapeo.metadata);
    return {
      courseId: mapeo.courseId,
      courseWorkId: mapeo.courseWorkId,
      corte: metadata.corte,
      destinoColumna: metadata.destinoColumna,
      activo: metadata.activo,
      metadata
    };
  });
  const filas = construirListaAcademica(mappedAlumnos, mappedCalificaciones, mappedBanderas, {
    evidencias,
    mapeosClassroom: mappedMapeos,
    calificacionesManuales,
    componentesExamen,
    resultadosExtraExternos,
    bonoExtracurricularPorAlumno
  });

  return { alumnos: mappedAlumnos, calificaciones: mappedCalificaciones, filas };
}

export async function exportarXlsxCalificaciones(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.query.periodoId || '').trim();
  if (!periodoId) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'periodoId requerido', 400);
  }

  const [docente, periodo] = await Promise.all([
    prisma.docente.findUnique({ where: { id: docenteId } }),
    prisma.periodo.findFirst({ where: { id: periodoId, docenteId } })
  ]);

  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Periodo no encontrado', 404);
  }

  const datosLista = await cargarDatosListaAcademica(docenteId, periodoId);

  const xlsx = await generarXlsxCalificacionesProduccion({
    docenteNombre: String(docente?.nombreCompleto || ''),
    nombrePeriodo: String(periodo.nombre || ''),
    cicloLectivo: cicloLectivo(periodo.fechaInicio, periodo.fechaFin),
    alumnos: datosLista.alumnos,
    calificaciones: datosLista.calificaciones as any,
    listaAcademica: datosLista.filas
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', 'attachment; filename="calificaciones-produccion.xlsx"');
  res.send(xlsx);
}

export async function obtenerListaAcademicaPorPeriodo(docenteId: string, periodoId: string, bonoExtracurricularPorAlumno?: ReadonlyMap<string, number>) {
  return (await cargarDatosListaAcademica(docenteId, periodoId, bonoExtracurricularPorAlumno)).filas;
}

export async function consultarListaAcademica(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.query.periodoId || '').trim();
  validarPeriodoId(periodoId);

  const filas = await obtenerListaAcademicaPorPeriodo(docenteId, periodoId);
  res.json({ filas });
}

export async function previsualizarBonoExtracurricular(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { periodoId, alumnoId, bono } = req.body as { periodoId: string; alumnoId: string; bono: number };
  const periodo = await prisma.periodo.findFirst({ where: { id: periodoId, docenteId }, select: { id: true } });
  if (!periodo) throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Periodo no encontrado', 404);
  const override = new Map([[alumnoId, bono]]);
  const filas = await obtenerListaAcademicaPorPeriodo(docenteId, periodoId, override);
  const fila = filas.find((item) => item.alumnoId === alumnoId);
  if (!fila) throw new ErrorAplicacion('ALUMNO_NO_ENCONTRADO', 'El alumno no pertenece al periodo seleccionado', 404);
  res.json({
    preview: {
      alumnoId,
      bonoSolicitado: fila.bonoExtracurricularSolicitado,
      bonoAplicado: fila.bonoExtracurricular,
      bonoDistribucion: fila.bonoDistribucion,
      parcial1: fila.parcial1,
      parcial2: fila.parcial2,
      parcial3: fila.calificacionTercerParcial,
      calificacionFinalCurso: fila.calificacionFinalCurso,
      escalaMaxima: 10,
      regla: 'continua-primero; global-c3, p2, p1',
      requiereConfirmacion: true
    }
  });
}

export async function guardarCalificacionLista(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { periodoId, alumnoId, componente, calificacion, version, clientRequestId } = req.body as {
    periodoId: string; alumnoId: string; componente: string; calificacion: number; version?: number; clientRequestId: string;
  };
  const payloadHash = createHash('sha256')
    .update(JSON.stringify({ periodoId, alumnoId, componente, calificacion, version: version ?? null }))
    .digest('hex');

  const reproducir = async (tx: Prisma.TransactionClient | typeof prisma) => {
    const mutacion = await tx.calificacionListaMutacion.findUnique({
      where: { docenteId_clientRequestId: { docenteId, clientRequestId: clientRequestId! } }
    });
    if (!mutacion) return null;
    if (mutacion.payloadHash !== payloadHash) {
      throw new ErrorAplicacion('CLAVE_IDEMPOTENCIA_REUTILIZADA', 'clientRequestId ya fue usado con otro payload.', 409);
    }
    const calificacionPersistida = await tx.calificacionListaManual.findFirst({
      where: { id: mutacion.calificacionId, docenteId }
    });
    if (!calificacionPersistida) {
      throw new ErrorAplicacion('RESULTADO_IDEMPOTENTE_NO_DISPONIBLE', 'La calificación original ya no existe; consulta la lista antes de continuar.', 409);
    }
    return calificacionPersistida;
  };

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const repetida = await reproducir(tx);
      if (repetida) return { calificacion: repetida, repetida: true, creada: false };

      const periodo = await tx.periodo.findFirst({ where: { id: periodoId, docenteId }, select: { id: true } });
      if (!periodo) throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Periodo no encontrado', 404);
      const alumno = await tx.alumno.findFirst({ where: { id: alumnoId, periodoId }, select: { id: true } });
      if (!alumno) throw new ErrorAplicacion('ALUMNO_NO_ENCONTRADO', 'El alumno no pertenece al periodo seleccionado', 404);

      const clave = { docenteId_periodoId_alumnoId_componente: { docenteId, periodoId, alumnoId, componente } };
      const existente = await tx.calificacionListaManual.findUnique({ where: clave });
      if ((existente && version !== existente.version) || (!existente && version !== undefined)) {
        throw new ErrorAplicacion('CONFLICTO_VERSION', 'La calificación cambió desde que se abrió. Recarga la lista antes de editar.', 409);
      }

      const evento = {
        en: new Date().toISOString(), usuarioId: docenteId,
        anterior: existente?.calificacion ?? null, nueva: calificacion,
        clientRequestId, payloadHash
      };
      const auditoriaAnterior = leerRegistroJson(existente?.auditoria);
      const eventosPrevios = Array.isArray(auditoriaAnterior.eventos) ? auditoriaAnterior.eventos : [];
      const auditoria = JSON.stringify({ eventos: [...eventosPrevios, evento].slice(-50) });
      let guardado;
      if (!existente) {
        guardado = await tx.calificacionListaManual.create({ data: { docenteId, periodoId, alumnoId, componente, calificacion, capturadoPor: docenteId, version: 1, auditoria } });
      } else {
        const actualizado = await tx.calificacionListaManual.updateMany({
          where: { id: existente.id, docenteId, version: existente.version },
          data: { calificacion, version: { increment: 1 }, auditoria, capturadoPor: docenteId }
        });
        if (actualizado.count !== 1) throw new ErrorAplicacion('CONFLICTO_VERSION', 'La calificación cambió en otra sesión. Recarga la lista antes de editar.', 409);
        guardado = await tx.calificacionListaManual.findUniqueOrThrow({ where: { id: existente.id } });
      }
      await tx.calificacionListaMutacion.create({ data: {
        docenteId, clientRequestId, payloadHash, calificacionId: guardado.id
      } });
      return { calificacion: guardado, repetida: false, creada: !existente };
    });
    res.status(resultado.repetida ? 200 : resultado.creada ? 201 : 200).json({
      calificacion: resultado.calificacion,
      ...(resultado.repetida ? { repetida: true } : {})
    });
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      const repetida = await reproducir(prisma);
      if (repetida) {
        res.status(200).json({ calificacion: repetida, repetida: true });
        return;
      }
      throw new ErrorAplicacion('CONFLICTO_VERSION', 'La calificación fue capturada en otra sesión. Recarga la lista.', 409);
    }
    throw error;
  }
}

export async function registrarResultadoExtraExterno(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const datos = req.body as {
    periodoId: string; alumnoId: string; solicitaExtra: true; folio: string; loteId?: string | null;
    fuenteArchivo: string; documentoSha256: string; aciertos: number; totalReactivos: number;
    criteriosAplicados: string; clientRequestId: string;
  };
  const { periodoId, alumnoId, folio, clientRequestId } = datos;
  const payloadCanonico = {
    periodoId, alumnoId, solicitaExtra: datos.solicitaExtra, folio, loteId: datos.loteId ?? null,
    fuenteArchivo: datos.fuenteArchivo, documentoSha256: datos.documentoSha256.toLowerCase(),
    aciertos: datos.aciertos, totalReactivos: datos.totalReactivos, criteriosAplicados: datos.criteriosAplicados
  };
  const payloadHash = createHash('sha256').update(JSON.stringify(payloadCanonico)).digest('hex');
  const buscarReintento = async (tx: Prisma.TransactionClient | typeof prisma) => {
    const anterior = await tx.resultadoExtraExterno.findUnique({
      where: { docenteId_clientRequestId: { docenteId, clientRequestId } }
    });
    if (!anterior) return null;
    if (anterior.payloadHash !== payloadHash) {
      throw new ErrorAplicacion('CLAVE_IDEMPOTENCIA_REUTILIZADA', 'clientRequestId ya fue usado con otro resultado externo.', 409);
    }
    return anterior;
  };

  const existente = await buscarReintento(prisma);
  if (existente) {
    res.status(200).json({ resultado: existente, repetido: true });
    return;
  }

  const periodo = await prisma.periodo.findFirst({ where: { id: periodoId, docenteId }, select: { id: true } });
  if (!periodo) throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Periodo no encontrado.', 404);
  const alumno = await prisma.alumno.findFirst({ where: { id: alumnoId, periodoId }, select: { id: true } });
  if (!alumno) throw new ErrorAplicacion('ALUMNO_NO_ENCONTRADO', 'El alumno no pertenece al periodo seleccionado.', 404);

  const filas = await obtenerListaAcademicaPorPeriodo(docenteId, periodoId);
  const fila = filas.find((item) => item.alumnoId === alumnoId);
  if (!fila?.extraDisponible) {
    throw new ErrorAplicacion('EXTRA_NO_DISPONIBLE', 'La calificación final vigente debe ser menor que 6 para registrar Extra.', 409);
  }
  if (!fila.solicitaExtra) {
    throw new ErrorAplicacion('SOLICITUD_EXTRA_REQUERIDA', 'El docente debe registrar primero que el alumno solicita presentar Extra.', 409);
  }

  const sobre5Exacto = new Decimal(datos.aciertos).mul(5).div(datos.totalReactivos);
  const presentacion = presentarCalificacionExtraordinaria(sobre5Exacto.toString());
  const evidencia = JSON.stringify({
    fuenteArchivo: datos.fuenteArchivo,
    documentoSha256: datos.documentoSha256.toLowerCase(),
    criteriosAplicados: datos.criteriosAplicados,
    loteId: datos.loteId ?? null,
    folio,
    actorDocenteId: docenteId,
    registradoEn: new Date().toISOString(),
    claseResultado: 'externo'
  });
  const data = {
    docenteId, periodoId, alumnoId, folio, loteId: datos.loteId ?? null,
    fuenteArchivo: datos.fuenteArchivo, documentoSha256: datos.documentoSha256.toLowerCase(),
    aciertos: datos.aciertos, totalReactivos: datos.totalReactivos,
    calificacionSobre5Exacta: sobre5Exacto.toString(), calificacionSobre5Texto: sobre5Exacto.toFixed(2),
    calificacionSobre10Texto: presentacion.calificacionEquivalenteSobre10Texto,
    estadoAprobatorio: presentacion.estadoAprobatorio, origen: 'inferida manualmente', evidencia,
    clientRequestId, payloadHash, capturadoPor: docenteId
  };

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const recuperado = await buscarReintento(tx);
      if (recuperado) return { resultado: recuperado, repetido: true };
      const solicitud = await tx.calificacionListaManual.findUnique({
        where: { docenteId_periodoId_alumnoId_componente: { docenteId, periodoId, alumnoId, componente: 'Solicitud Extra' } }
      });
      if (Number(solicitud?.calificacion) !== 1) {
        throw new ErrorAplicacion('SOLICITUD_EXTRA_REQUERIDA', 'El docente debe registrar primero que el alumno solicita presentar Extra.', 409);
      }
      const resultadoExistente = await tx.resultadoExtraExterno.findUnique({
        where: { docenteId_periodoId_alumnoId_folio: { docenteId, periodoId, alumnoId, folio } }
      });
      if (resultadoExistente) {
        throw new ErrorAplicacion('FOLIO_EXTRA_DUPLICADO', 'El folio externo ya tiene un resultado registrado para este alumno.', 409);
      }
      return { resultado: await tx.resultadoExtraExterno.create({ data }), repetido: false };
    });
    res.status(resultado.repetido ? 200 : 201).json(resultado);
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      const recuperado = await buscarReintento(prisma);
      if (recuperado) {
        res.status(200).json({ resultado: recuperado, repetido: true });
        return;
      }
      throw new ErrorAplicacion('FOLIO_EXTRA_DUPLICADO', 'El folio externo ya tiene un resultado registrado para este alumno.', 409);
    }
    throw error;
  }
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
