/**
 * Controlador de calificaciones.
 *
 * Nota de seguridad:
 * - Todas estas rutas asumen que el request ya paso por `requerirDocente`.
 * - `obtenerDocenteId(req)` actua como guard (y contrato) para obtener el docente autenticado.
 * - La autorizacion por objeto se aplica verificando que el examen/plantilla pertenezca al docente.
 */
import type { Response } from 'express';
import { createHash } from 'node:crypto';
import { gzip, gunzipSync } from 'node:zlib';
import { promisify } from 'node:util';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { configuracion } from '../../configuracion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { Periodo } from '../modulo_alumnos/modeloPeriodo';
import { BancoPregunta } from '../modulo_banco_preguntas/modeloBancoPregunta';
import { ExamenGenerado } from '../modulo_generacion_pdf/modeloExamenGenerado';
import { ExamenPlantilla } from '../modulo_generacion_pdf/modeloExamenPlantilla';
import { evaluarAutoCalificableOmr } from '../modulo_escaneo_omr/politicaAutoCalificacionOmr';
import { EscaneoOmrArchivado } from '../modulo_escaneo_omr/modeloEscaneoOmrArchivado';
import { leerCapturasOmrParaPortal } from '../modulo_sincronizacion_nube/infra/omrCapturas';
import { Calificacion } from './modeloCalificacion';
import { SolicitudRevisionAlumno } from './modeloSolicitudRevisionAlumno';
import { calcularCalificacion } from './servicioCalificacion';

const comprimirGzip = promisify(gzip);

type RespuestaDetectada = {
  numeroPregunta: number;
  opcion: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  confianza?: number;
  scoresPorOpcion?: Array<{
    opcion: 'A' | 'B' | 'C' | 'D' | 'E';
    score: number;
    fillRatioCore: number;
    fillRatioRing: number;
    centerDarknessDelta: number;
    strokeLeakPenalty: number;
    shapeCompactness: number;
    markConfidence: number;
  }>;
  flags?: Array<'doble_marca' | 'bajo_contraste' | 'fuera_roi'>;
};

type AnalisisOmrCalificacion = {
  estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
  calidadPagina: number;
  confianzaPromedioPagina?: number;
  ratioAmbiguas?: number;
  templateVersionDetectada?: 3;
  motivosRevision?: string[];
  revisionConfirmada?: boolean;
  usuarioRevisor?: string;
  revisionTimestamp?: string;
  motivoRevisionManual?: string;
  engineVersion?: string;
  geomQuality?: number;
  photoQuality?: number;
  decisionPolicy?: string;
};

type PaginaOmrCalificacionEntrada = {
  numeroPagina: number;
  imagenBase64: string;
  estadoAnalisis?: 'ok' | 'rechazado_calidad' | 'requiere_revision';
  templateVersionDetectada?: 3;
};

function extraerBase64Imagen(base64: string): { mimeType: string; contenido: string } {
  const limpio = String(base64 || '').trim();
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i.exec(limpio);
  if (match) {
    return {
      mimeType: String(match[1] || 'image/jpeg').toLowerCase(),
      contenido: String(match[2] || '').replace(/\s+/g, '')
    };
  }
  return {
    mimeType: 'image/jpeg',
    contenido: limpio.replace(/\s+/g, '')
  };
}

async function archivarPaginasOmrEnCalificacion({
  paginasOmr,
  docenteId,
  examen,
  folio,
  estadoAnalisisDefault,
  templateVersionDetectadaDefault,
  engineVersionDefault,
  motivosRevisionDefault
}: {
  paginasOmr: PaginaOmrCalificacionEntrada[];
  docenteId: string;
  examen: {
    _id: unknown;
    alumnoId?: unknown;
    periodoId?: unknown;
    plantillaId?: unknown;
  };
  folio: string;
  estadoAnalisisDefault?: 'ok' | 'rechazado_calidad' | 'requiere_revision';
  templateVersionDetectadaDefault?: 3;
  engineVersionDefault?: string;
  motivosRevisionDefault?: string[];
}) {
  const paginasValidas = (Array.isArray(paginasOmr) ? paginasOmr : []).filter((pagina) => {
    const numeroPagina = Number(pagina?.numeroPagina ?? 0);
    const imagenBase64 = String(pagina?.imagenBase64 ?? '').trim();
    return Number.isInteger(numeroPagina) && numeroPagina > 0 && Boolean(imagenBase64);
  });
  if (paginasValidas.length === 0) return;

  const [periodo, plantilla] = await Promise.all([
    examen.periodoId ? Periodo.findById(examen.periodoId).select({ nombre: 1 }).lean() : Promise.resolve(null),
    examen.plantillaId ? ExamenPlantilla.findById(examen.plantillaId).select({ titulo: 1, temas: 1 }).lean() : Promise.resolve(null)
  ]);
  const materia = String(
    periodo?.nombre ??
      (Array.isArray(plantilla?.temas) && plantilla.temas.length > 0 ? plantilla.temas.join(' · ') : plantilla?.titulo ?? '')
  ).trim();

  const esErrorDuplicadoMongo = (error: unknown) => Number((error as { code?: unknown } | null)?.code ?? 0) === 11000;
  const calcularSiguienteIntentoOmr = async (numeroPagina: number) => {
    const ultimo = await EscaneoOmrArchivado.findOne({
      examenGeneradoId: examen._id,
      numeroPagina
    })
      .sort({ intento: -1, createdAt: -1 })
      .select({ intento: 1 })
      .lean();
    const intentoActual = Number((ultimo as { intento?: unknown } | null)?.intento ?? 0);
    return Number.isFinite(intentoActual) && intentoActual > 0 ? intentoActual + 1 : 1;
  };

  for (const pagina of paginasValidas) {
    const numeroPagina = Number(pagina.numeroPagina);
    const { mimeType, contenido } = extraerBase64Imagen(String(pagina.imagenBase64 ?? ''));
    if (!contenido) continue;
    const original = Buffer.from(contenido, 'base64');
    if (!original.length) continue;
    const comprimido = await comprimirGzip(original, { level: 9 });
    const sha256Original = createHash('sha256').update(original).digest('hex');
    const estadoAnalisisPagina =
      pagina.estadoAnalisis === 'ok' || pagina.estadoAnalisis === 'rechazado_calidad' || pagina.estadoAnalisis === 'requiere_revision'
        ? pagina.estadoAnalisis
        : estadoAnalisisDefault ?? 'ok';
    const templateVersionDetectada =
      pagina.templateVersionDetectada === 3 ? 3 : templateVersionDetectadaDefault;
    for (let reintento = 0; reintento < 3; reintento += 1) {
      const intento = await calcularSiguienteIntentoOmr(numeroPagina);
      try {
        await EscaneoOmrArchivado.create({
          docenteId,
          alumnoId: examen.alumnoId ?? null,
          periodoId: examen.periodoId ?? null,
          plantillaId: examen.plantillaId ?? null,
          examenGeneradoId: examen._id,
          folio,
          numeroPagina,
          intento,
          materia: materia || undefined,
          mimeType,
          algoritmoCompresion: 'gzip',
          tamanoOriginalBytes: original.length,
          tamanoComprimidoBytes: comprimido.length,
          sha256Original,
          templateVersionDetectada: templateVersionDetectada ?? undefined,
          engineVersion: engineVersionDefault,
          estadoAnalisis: estadoAnalisisPagina,
          motivosRevision: Array.isArray(motivosRevisionDefault) ? motivosRevisionDefault.slice(0, 24) : [],
          payloadComprimido: comprimido
        });
        break;
      } catch (error) {
        if (esErrorDuplicadoMongo(error) && reintento < 2) continue;
        throw error;
      }
    }
  }
}

function obtenerLetraCorrecta(opciones: Array<{ esCorrecta: boolean }>, orden: number[]) {
  const indiceCorrecto = opciones.findIndex((opcion) => opcion.esCorrecta);
  if (indiceCorrecto < 0) return null;
  // Se traduce el indice real al orden mostrado en el examen.
  const posicion = orden.findIndex((idx) => idx === indiceCorrecto);
  if (posicion < 0) return null;
  return String.fromCharCode(65 + posicion);
}

function validarPayloadCalificacionOmr(params: {
  folioPayload?: string;
  folioExamen: string;
  templateVersionOmr: number;
  totalPreguntasEsperadas: number;
  respuestas: RespuestaDetectada[];
  analisisOmr?: AnalisisOmrCalificacion;
}) {
  const {
    folioPayload,
    folioExamen,
    templateVersionOmr,
    totalPreguntasEsperadas,
    respuestas,
    analisisOmr
  } = params;

  const folioReq = String(folioPayload ?? '').trim().toUpperCase();
  const folioDb = String(folioExamen ?? '').trim().toUpperCase();
  if (folioReq && folioDb && folioReq !== folioDb) {
    throw new ErrorAplicacion('OMR_FOLIO_NO_COINCIDE', 'El folio del payload no coincide con el examen', 409, {
      folioPayload: folioReq,
      folioExamen: folioDb
    });
  }

  if (respuestas.length > 0 && templateVersionOmr !== 3) {
    throw new ErrorAplicacion('OMR_TEMPLATE_NO_COMPATIBLE', 'Solo TV3 puede guardar calificación OMR automática', 422);
  }
  if (respuestas.length > 0 && totalPreguntasEsperadas <= 0) {
    throw new ErrorAplicacion(
      'OMR_MAPA_VARIANTE_INVALIDO',
      'No existe un mapa de preguntas válido para validar respuestas OMR',
      409
    );
  }

  if (respuestas.length > 0) {
    if (totalPreguntasEsperadas > 0 && respuestas.length !== totalPreguntasEsperadas) {
      throw new ErrorAplicacion(
        'OMR_PAYLOAD_INCOMPLETO',
        'La cantidad de respuestas detectadas no coincide con el total esperado',
        422,
        { totalEsperado: totalPreguntasEsperadas, totalRecibido: respuestas.length }
      );
    }
    const vistos = new Set<number>();
    for (const respuesta of respuestas) {
      const numero = Number(respuesta.numeroPregunta ?? 0);
      if (!Number.isInteger(numero) || numero <= 0 || numero > totalPreguntasEsperadas) {
        throw new ErrorAplicacion('OMR_PREGUNTA_FUERA_RANGO', 'Existe una pregunta fuera del rango del examen', 422, {
          numeroPregunta: respuesta.numeroPregunta,
          totalPreguntasEsperadas
        });
      }
      if (vistos.has(numero)) {
        throw new ErrorAplicacion('OMR_PREGUNTA_DUPLICADA', 'Hay preguntas repetidas en respuestasDetectadas', 422, {
          numeroPregunta: numero
        });
      }
      vistos.add(numero);
      if (respuesta.opcion !== null && !['A', 'B', 'C', 'D', 'E'].includes(respuesta.opcion)) {
        throw new ErrorAplicacion('OMR_OPCION_INVALIDA', 'La opción detectada no es válida', 422, {
          numeroPregunta: numero,
          opcion: respuesta.opcion
        });
      }
      if (
        respuesta.confianza !== undefined &&
        (!Number.isFinite(respuesta.confianza) || respuesta.confianza < 0 || respuesta.confianza > 1)
      ) {
        throw new ErrorAplicacion('OMR_CONFIANZA_INVALIDA', 'La confianza de respuesta está fuera de rango [0,1]', 422, {
          numeroPregunta: numero,
          confianza: respuesta.confianza
        });
      }
    }
  }

  if (respuestas.length > 0 && !analisisOmr) {
    throw new ErrorAplicacion('OMR_ANALISIS_REQUERIDO', 'Se requiere omrAnalisis cuando se envían respuestasDetectadas', 422);
  }
  if (!analisisOmr) return;
  if (analisisOmr.templateVersionDetectada !== undefined && analisisOmr.templateVersionDetectada !== 3) {
    throw new ErrorAplicacion('OMR_TEMPLATE_NO_COMPATIBLE', 'El análisis OMR recibido no corresponde a TV3', 422);
  }
  if (analisisOmr.estadoAnalisis !== 'ok' && analisisOmr.revisionConfirmada) {
    const usuarioRevisor = String(analisisOmr.usuarioRevisor ?? '').trim();
    const revisionTimestamp = String(analisisOmr.revisionTimestamp ?? '').trim();
    const motivoRevisionManual = String(analisisOmr.motivoRevisionManual ?? '').trim();
    if (!usuarioRevisor || !revisionTimestamp || !motivoRevisionManual) {
      throw new ErrorAplicacion(
        'OMR_REVISION_METADATA_OBLIGATORIA',
        'Para confirmar revisión se requiere usuarioRevisor, revisionTimestamp y motivoRevisionManual',
        422
      );
    }
  }
}

/**
 * Califica un examen generado.
 *
 * Contrato de autorizacion por objeto:
 * - El `examenGeneradoId` debe pertenecer al `docenteId` autenticado.
 * - Se recalcula el numero de aciertos si se proporcionan `respuestasDetectadas`.
 * - El endpoint persiste la calificacion y marca el examen como `calificado`.
 */
export async function calificarExamen(req: SolicitudDocente, res: Response) {
  const {
    examenGeneradoId,
    folio,
    alumnoId,
    aciertos,
    totalReactivos,
    bonoSolicitado,
    evaluacionContinua,
    proyecto,
    retroalimentacion,
    respuestasDetectadas,
    omrAnalisis,
    paginasOmr,
    soloPreview,
    politicaId,
    versionPolitica,
    componentesExamen,
    bloqueContinuaDecimal,
    bloqueExamenesDecimal,
    finalDecimal,
    finalRedondeada
  } = req.body;
  const docenteId = obtenerDocenteId(req);

  const examen = await ExamenGenerado.findById(examenGeneradoId).lean();
  if (!examen) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }
  if (String(examen.docenteId) !== String(docenteId)) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a este examen', 403);
  }

  const plantilla = await ExamenPlantilla.findById(examen.plantillaId).lean();
  if (!plantilla) {
    throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
  }

  const alumnoFinal = alumnoId ?? examen.alumnoId;
  if (!alumnoFinal && !soloPreview) {
    throw new ErrorAplicacion('ALUMNO_NO_ENCONTRADO', 'Alumno no vinculado al examen', 400);
  }

  const ordenPreguntas: string[] = examen.mapaVariante?.ordenPreguntas ?? [];
  const preguntasDb = await BancoPregunta.find({ _id: { $in: ordenPreguntas } }).lean();
  const mapaPreguntas = new Map(preguntasDb.map((pregunta) => [String(pregunta._id), pregunta]));

  const respuestas = Array.isArray(respuestasDetectadas) ? (respuestasDetectadas as RespuestaDetectada[]) : [];
  const respuestasPorNumero = new Map(respuestas.map((item) => [item.numeroPregunta, item.opcion]));

  const analisisOmr = omrAnalisis as AnalisisOmrCalificacion | undefined;
  const paginasOmrEntrada = Array.isArray(paginasOmr) ? (paginasOmr as PaginaOmrCalificacionEntrada[]) : [];
  const revisionConfirmada = Boolean(analisisOmr?.revisionConfirmada);
  const calidadPagina = Number(analisisOmr?.calidadPagina ?? 1);
  const confianzaPromedioPagina = Number(analisisOmr?.confianzaPromedioPagina ?? 1);
  const ratioAmbiguas = Number(analisisOmr?.ratioAmbiguas ?? 0);
  const totalPreguntasEsperadas = Array.isArray(ordenPreguntas) ? ordenPreguntas.length : 0;
  validarPayloadCalificacionOmr({
    folioPayload: String(folio ?? ''),
    folioExamen: String(examen.folio ?? ''),
    templateVersionOmr: Number(examen.mapaOmr?.templateVersion ?? 0),
    totalPreguntasEsperadas,
    respuestas,
    analisisOmr
  });
  const coberturaDeteccion = totalPreguntasEsperadas > 0 ? respuestas.length / totalPreguntasEsperadas : 0;
  const { autoCalificableOmr } = evaluarAutoCalificableOmr({
    estadoAnalisis: analisisOmr?.estadoAnalisis,
    calidadPagina,
    confianzaPromedioPagina,
    ratioAmbiguas,
    coberturaDeteccion
  });
  if (respuestas.length > 0 && !autoCalificableOmr && !revisionConfirmada) {
    throw new ErrorAplicacion(
      'OMR_REQUIERE_REVISION_MANUAL',
      'La detección OMR no cumple confianza mínima para calificación automática; confirma revisión manual para continuar',
      422,
      {
        estadoAnalisis: analisisOmr?.estadoAnalisis ?? null,
        calidadPagina,
        confianzaPromedioPagina,
        ratioAmbiguas,
        coberturaDeteccion
      }
    );
  }

  let aciertosCalculados = 0;
  let contestadasTotal = 0;
  let contestadasCorrectas = 0;
  const total = ordenPreguntas.length || totalReactivos || 0;

  ordenPreguntas.forEach((idPregunta, idx) => {
    const pregunta = mapaPreguntas.get(idPregunta);
    if (!pregunta) return;

    const version =
      pregunta.versiones.find((item: { numeroVersion: number }) => item.numeroVersion === pregunta.versionActual) ??
      pregunta.versiones[0];
    const ordenOpciones = examen.mapaVariante?.ordenOpcionesPorPregunta?.[idPregunta] ?? [0, 1, 2, 3, 4];
    const letraCorrecta = obtenerLetraCorrecta(version.opciones, ordenOpciones);
    const respuesta = respuestasPorNumero.get(idx + 1);
    const estaContestada = Boolean(respuesta);
    if (estaContestada) contestadasTotal += 1;

    if (letraCorrecta && respuesta && letraCorrecta === respuesta) {
      aciertosCalculados += 1;
      contestadasCorrectas += 1;
    }
  });

  const usarAciertosDetectados = respuestas.length > 0 && (autoCalificableOmr || revisionConfirmada);
  const aciertosFinal = usarAciertosDetectados ? aciertosCalculados : typeof aciertos === 'number' ? aciertos : aciertosCalculados;
  const totalFinal = total || totalReactivos || aciertosFinal || 1;
  const aciertosAjustados = Math.min(aciertosFinal, totalFinal);

  const resultado = calcularCalificacion(
    aciertosAjustados,
    totalFinal,
    bonoSolicitado ?? 0,
    evaluacionContinua ?? 0,
    proyecto ?? 0,
    plantilla.tipo as 'parcial' | 'global'
  );

  if (soloPreview) {
    res.status(200).json({
      preview: {
        aciertos: aciertosAjustados,
        totalReactivos: totalFinal,
        fraccion: {
          numerador: resultado.numerador,
          denominador: resultado.denominador
        },
        calificacionExamenTexto: resultado.calificacionTexto,
        bonoTexto: resultado.bonoTexto,
        calificacionExamenFinalTexto: resultado.calificacionFinalTexto,
        evaluacionContinuaTexto: resultado.evaluacionContinuaTexto,
        proyectoTexto: resultado.proyectoTexto,
        calificacionParcialTexto: resultado.calificacionParcialTexto,
        calificacionGlobalTexto: resultado.calificacionGlobalTexto
      }
    });
    return;
  }

  await archivarPaginasOmrEnCalificacion({
    paginasOmr: paginasOmrEntrada,
    docenteId,
    examen,
    folio: String(examen.folio ?? '').trim().toUpperCase(),
    estadoAnalisisDefault: analisisOmr?.estadoAnalisis,
    templateVersionDetectadaDefault: analisisOmr?.templateVersionDetectada,
    engineVersionDefault: analisisOmr?.engineVersion,
    motivosRevisionDefault: analisisOmr?.motivosRevision
  });

  const calificacion = await Calificacion.create({
    docenteId,
    periodoId: examen.periodoId,
    examenGeneradoId,
    alumnoId: alumnoFinal,
    tipoExamen: plantilla.tipo,
    totalReactivos: totalFinal,
    aciertos: aciertosAjustados,
    fraccion: {
      numerador: resultado.numerador,
      denominador: resultado.denominador
    },
    calificacionExamenTexto: resultado.calificacionTexto,
    bonoTexto: resultado.bonoTexto,
    calificacionExamenFinalTexto: resultado.calificacionFinalTexto,
    evaluacionContinuaTexto: resultado.evaluacionContinuaTexto,
    proyectoTexto: resultado.proyectoTexto,
    calificacionParcialTexto: resultado.calificacionParcialTexto,
    calificacionGlobalTexto: resultado.calificacionGlobalTexto,
    retroalimentacion,
    respuestasDetectadas,
    omrAuditoria: analisisOmr
      ? {
          estadoAnalisis: analisisOmr.estadoAnalisis,
          calidadPagina,
          confianzaPromedioPagina,
          ratioAmbiguas,
          templateVersionDetectada: analisisOmr.templateVersionDetectada ?? null,
          revisionConfirmada,
          usuarioRevisor: analisisOmr.usuarioRevisor ?? null,
          revisionTimestamp: analisisOmr.revisionTimestamp ?? null,
          motivoRevisionManual: analisisOmr.motivoRevisionManual ?? null,
          engineVersion: analisisOmr.engineVersion ?? null,
          geomQuality: analisisOmr.geomQuality ?? null,
          photoQuality: analisisOmr.photoQuality ?? null,
          decisionPolicy: analisisOmr.decisionPolicy ?? null,
          motivosRevision: analisisOmr.motivosRevision ?? [],
          autoCalificableOmr,
          contestadasTotal,
          contestadasCorrectas,
          precisionSobreContestadas: contestadasTotal > 0 ? contestadasCorrectas / contestadasTotal : null
        }
      : undefined,
    politicaId,
    versionPolitica,
    componentesExamen,
    bloqueContinuaDecimal:
      typeof bloqueContinuaDecimal === 'number' && Number.isFinite(bloqueContinuaDecimal)
        ? bloqueContinuaDecimal
        : undefined,
    bloqueExamenesDecimal:
      typeof bloqueExamenesDecimal === 'number' && Number.isFinite(bloqueExamenesDecimal)
        ? bloqueExamenesDecimal
        : undefined,
    finalDecimal: typeof finalDecimal === 'number' && Number.isFinite(finalDecimal) ? finalDecimal : undefined,
    finalRedondeada:
      typeof finalRedondeada === 'number' && Number.isFinite(finalRedondeada) ? finalRedondeada : undefined
  });

  await ExamenGenerado.updateOne({ _id: examenGeneradoId }, { estado: 'calificado' });
  // Cierra solicitudes pendientes relacionadas cuando se recalifica el examen.
  await SolicitudRevisionAlumno.updateMany(
    { docenteId, examenGeneradoId, estado: 'pendiente' },
    {
      $set: {
        estado: 'atendida',
        atendidoEn: new Date(),
        respuestaDocente: 'Solicitud atendida durante recalificacion'
      }
    }
  ).catch(() => {
    // Best-effort: una falla de sincronizacion de solicitudes no debe romper la calificacion.
  });

  res.status(201).json({ calificacion });
}

export async function obtenerCalificacionPorExamen(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const examenGeneradoId = String(req.params.examenGeneradoId ?? '').trim();
  if (!examenGeneradoId) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }

  const calificacion = await Calificacion.findOne({ docenteId, examenGeneradoId }).sort({ createdAt: -1 }).lean();
  if (!calificacion) {
    throw new ErrorAplicacion('CALIFICACION_NO_ENCONTRADA', 'No hay calificación registrada para este examen', 404);
  }

  const capturasArchivadasRaw = await EscaneoOmrArchivado.find({ docenteId, examenGeneradoId })
    .sort({ numeroPagina: 1, intento: -1, createdAt: -1 })
    .select({ numeroPagina: 1, intento: 1, mimeType: 1, payloadComprimido: 1 })
    .lean();
  const capturasPorPagina = new Map<number, (typeof capturasArchivadasRaw)[number]>();
  for (const captura of Array.isArray(capturasArchivadasRaw) ? capturasArchivadasRaw : []) {
    const numeroPagina = Number((captura as { numeroPagina?: unknown })?.numeroPagina ?? 0);
    if (!Number.isFinite(numeroPagina) || numeroPagina <= 0) continue;
    if (!capturasPorPagina.has(numeroPagina)) {
      capturasPorPagina.set(numeroPagina, captura);
    }
  }
  const capturasArchivadas = Array.from(capturasPorPagina.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, captura]) => captura);
  const paginasOmr = (Array.isArray(capturasArchivadas) ? capturasArchivadas : [])
    .map((captura) => {
      try {
        const numeroPagina = Number((captura as { numeroPagina?: unknown })?.numeroPagina ?? 0);
        const mimeType = String((captura as { mimeType?: unknown })?.mimeType ?? 'image/jpeg').trim() || 'image/jpeg';
        const payload = (captura as { payloadComprimido?: unknown })?.payloadComprimido;
        if (!Number.isFinite(numeroPagina) || numeroPagina <= 0 || !payload) return null;
        const payloadBinario = payload as { buffer?: unknown; value?: (asBuffer?: boolean) => Uint8Array | Buffer };
        const bufferGzip = Buffer.isBuffer(payload)
          ? payload
          : Buffer.isBuffer(payloadBinario?.buffer)
            ? payloadBinario.buffer
            : typeof payloadBinario?.value === 'function'
              ? Buffer.from(payloadBinario.value(true))
              : Buffer.from(payload as Uint8Array);
        if (!bufferGzip.length) return null;
        const contenidoOriginal = gunzipSync(bufferGzip);
        if (!contenidoOriginal.length) return null;
        return {
          numeroPagina,
          imagenBase64: `data:${mimeType};base64,${contenidoOriginal.toString('base64')}`
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is { numeroPagina: number; imagenBase64: string } => Boolean(item?.imagenBase64));

  let paginasOmrFinales = paginasOmr;
  if (paginasOmrFinales.length === 0) {
    const examen = await ExamenGenerado.findOne({ _id: examenGeneradoId, docenteId }).select({ folio: 1 }).lean();
    const folio = String((examen as { folio?: unknown } | null | undefined)?.folio ?? '').trim().toUpperCase();
    if (folio) {
      const capturasPortal = await leerCapturasOmrParaPortal(folio).catch(() => []);
      paginasOmrFinales = (Array.isArray(capturasPortal) ? capturasPortal : [])
        .map((captura) => {
          const numeroPagina = Number(captura?.numeroPagina ?? 0);
          const imagenBase64 = String(captura?.imagenBase64 ?? '').trim();
          if (!Number.isFinite(numeroPagina) || numeroPagina <= 0 || !imagenBase64) return null;
          return {
            numeroPagina,
            imagenBase64: `data:image/webp;base64,${imagenBase64}`
          };
        })
        .filter((item): item is { numeroPagina: number; imagenBase64: string } => Boolean(item?.imagenBase64));
    }
  }

  res.json({
    calificacion: {
      ...calificacion,
      paginasOmr: paginasOmrFinales
    }
  });
}

export async function listarSolicitudesRevision(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const estado = String(req.query.estado ?? '').trim().toLowerCase();
  const limite = Math.min(200, Math.max(1, Number(req.query.limite ?? 60) || 60));
  const filtro: Record<string, unknown> = { docenteId };
  if (estado) filtro.estado = estado;

  const solicitudes = await SolicitudRevisionAlumno.find(filtro)
    .sort({ solicitadoEn: -1, createdAt: -1 })
    .limit(limite)
    .lean();
  res.json({ solicitudes });
}

export async function sincronizarSolicitudesRevision(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  if (!configuracion.portalAlumnoUrl || !configuracion.portalApiKey) {
    throw new ErrorAplicacion('SYNC_SERVIDOR_NO_CONFIG', 'El servidor de sincronizacion no esta configurado', 503);
  }

  const desde = String((req.body as { desde?: unknown })?.desde ?? '').trim();
  const limite = Math.min(200, Math.max(1, Number((req.body as { limite?: unknown })?.limite ?? 80) || 80));
  const body: Record<string, unknown> = { docenteId, limite };
  if (desde) body.desde = desde;

  const respuesta = await fetch(`${configuracion.portalAlumnoUrl}/api/portal/sincronizacion-docente/solicitudes-revision/pull`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': configuracion.portalApiKey
    },
    body: JSON.stringify(body)
  });

  const payload = (await respuesta.json().catch(() => ({}))) as {
    solicitudes?: Array<{
      externoId?: string;
      docenteId?: string;
      periodoId?: string;
      alumnoId?: string;
      examenGeneradoId?: string;
      folio?: string;
      numeroPregunta?: number;
      comentario?: string;
      estado?: string;
      solicitadoEn?: string;
      atendidoEn?: string | null;
      respuestaDocente?: string;
      firmaDocente?: string;
      firmadoEn?: string | null;
      cerradoEn?: string | null;
      conformidadAlumno?: boolean;
      conformidadActualizadaEn?: string | null;
    }>;
    error?: { mensaje?: string };
  };

  if (!respuesta.ok) {
    throw new ErrorAplicacion('SYNC_PULL_FALLIDO', payload?.error?.mensaje || 'No se pudieron sincronizar solicitudes', 502);
  }

  const solicitudes = Array.isArray(payload.solicitudes) ? payload.solicitudes : [];
  let aplicadas = 0;
  for (const item of solicitudes) {
    const externoId = String(item?.externoId ?? '').trim();
    const folio = String(item?.folio ?? '').trim();
    const numeroPregunta = Number(item?.numeroPregunta ?? 0);
    if (!externoId || !folio || !Number.isInteger(numeroPregunta) || numeroPregunta <= 0) continue;
    const comentario = String(item?.comentario ?? '').trim();
    if (comentario.length < 12) continue;
    await SolicitudRevisionAlumno.updateOne(
      { externoId },
      {
        $set: {
          docenteId,
          periodoId: item?.periodoId || null,
          alumnoId: item?.alumnoId || null,
          examenGeneradoId: item?.examenGeneradoId || null,
          folio,
          numeroPregunta,
          comentario,
          estado: String(item?.estado ?? 'pendiente').trim().toLowerCase() || 'pendiente',
          solicitadoEn: item?.solicitadoEn ? new Date(item.solicitadoEn) : new Date(),
          atendidoEn: item?.atendidoEn ? new Date(item.atendidoEn) : null,
          respuestaDocente: String(item?.respuestaDocente ?? '').trim() || null,
          firmaDocente: String((item as { firmaDocente?: unknown })?.firmaDocente ?? '').trim() || null,
          firmadoEn: (item as { firmadoEn?: string | null })?.firmadoEn ? new Date(String((item as { firmadoEn?: unknown }).firmadoEn)) : null,
          cerradoEn: (item as { cerradoEn?: string | null })?.cerradoEn ? new Date(String((item as { cerradoEn?: unknown }).cerradoEn)) : null,
          conformidadAlumno: Boolean(item?.conformidadAlumno),
          conformidadActualizadaEn: item?.conformidadActualizadaEn ? new Date(item.conformidadActualizadaEn) : null,
          origen: 'portal'
        }
      },
      { upsert: true }
    );
    aplicadas += 1;
  }

  res.json({ mensaje: 'Solicitudes sincronizadas', recibidas: solicitudes.length, aplicadas });
}

export async function resolverSolicitudRevision(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const id = String(req.params.id ?? '').trim();
  const estado = String((req.body as { estado?: unknown })?.estado ?? '').trim().toLowerCase();
  const respuestaDocente = String((req.body as { respuestaDocente?: unknown })?.respuestaDocente ?? '').trim();

  if (!id) {
    throw new ErrorAplicacion('SOLICITUD_ID_INVALIDO', 'Identificador de solicitud invalido', 400);
  }
  if (estado !== 'atendida' && estado !== 'rechazada') {
    throw new ErrorAplicacion('SOLICITUD_ESTADO_INVALIDO', 'Estado de solicitud invalido', 400);
  }
  if (respuestaDocente.length < 8) {
    throw new ErrorAplicacion(
      'RESPUESTA_DOCENTE_OBLIGATORIA',
      'La respuesta docente es obligatoria (minimo 8 caracteres)',
      400
    );
  }

  const actualizada = await SolicitudRevisionAlumno.findOneAndUpdate(
    { _id: id, docenteId },
    {
      $set: {
        estado,
        atendidoEn: new Date(),
        respuestaDocente,
        firmaDocente: `docente:${docenteId}`,
        firmadoEn: estado === 'atendida' ? new Date() : null,
        cerradoEn: estado === 'rechazada' ? new Date() : null
      }
    },
    { returnDocument: 'after' }
  ).lean();

  if (!actualizada) {
    throw new ErrorAplicacion('SOLICITUD_NO_ENCONTRADA', 'Solicitud no encontrada', 404);
  }

  if (configuracion.portalAlumnoUrl && configuracion.portalApiKey) {
    await fetch(`${configuracion.portalAlumnoUrl}/api/portal/sincronizacion-docente/solicitudes-revision/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': configuracion.portalApiKey
      },
      body: JSON.stringify({
        externoId: actualizada.externoId,
        estado,
        respuestaDocente: actualizada.respuestaDocente,
        firmaDocente: actualizada.firmaDocente,
        firmadoEn: actualizada.firmadoEn,
        cerradoEn: actualizada.cerradoEn
      })
    }).catch(() => {
      // Best-effort: no bloquear resolucion local si el portal no responde.
    });
  }

  res.json({ solicitud: actualizada });
}
