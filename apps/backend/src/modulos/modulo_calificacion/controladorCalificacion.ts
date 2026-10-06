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
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { configuracion } from '../../configuracion.js';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion.js';
import { extraerResumenQrExamen, type ResumenQrExamen } from '../modulo_generacion_pdf/domain/qrExamen.js';
import { evaluarAutoCalificableOmr } from '../modulo_escaneo_omr/politicaAutoCalificacionOmr.js';
import { leerCapturasOmrParaPortal } from '../modulo_sincronizacion_nube/infra/omrCapturas.js';
import { calcularCalificacion, presentarCalificacionExtraordinaria } from './servicioCalificacion.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';

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
  flags?: Array<'doble_marca' | 'bajo_contraste' | 'fuera_roi' | 'parcial_detectada' | 'tachada_detectada'>;
  estadoRespuesta?: 'respondida' | 'sin_marca' | 'ambigua' | 'doble_marca' | 'tachada';
};

type AnalisisOmrCalificacion = {
  estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
  calidadPagina: number;
  confianzaPromedioPagina?: number;
  ratioAmbiguas?: number;
  templateVersionDetectada?: 4;
  motivosRevision?: string[];
  revisionConfirmada?: boolean;
  usuarioRevisor?: string;
  revisionTimestamp?: string;
  motivoRevisionManual?: string;
  engineVersion?: string;
  geomQuality?: number;
  photoQuality?: number;
  decisionPolicy?: string;
  qrTexto?: string;
  resumenRespuestas?: {
    totalReactivos: number;
    reactivosRespondidos: number;
    reactivosSinMarca: number;
    reactivosAmbiguos: number;
    reactivosInvalidos: number;
    examenVacio: boolean;
    examenVacioProbable: boolean;
    estadoExamen: 'vacio_confirmado' | 'vacio_probable' | 'con_respuestas' | 'requiere_revision';
  };
};

type PaginaOmrCalificacionEntrada = {
  numeroPagina: number;
  imagenBase64: string;
  estadoAnalisis?: 'ok' | 'rechazado_calidad' | 'requiere_revision';
  templateVersionDetectada?: 4;
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

function parseJsonSafe<T>(val: unknown): T | null {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return null;
    }
  }
  return val as T;
}

function normalizarParaHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizarParaHash);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalizarParaHash(item)]));
}

function uuidIdempotenciaCalificacion(docenteId: string, clientRequestId: string) {
  const hex = createHash('sha256').update(`${docenteId}\r\n${clientRequestId}`, 'utf8').digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20, 32).join('')}`;
}

function formatearExamenGeneradoPrisma(raw: any) {
  if (!raw) return null;
  return {
    ...raw,
    _id: raw.id,
    mapaVariante: parseJsonSafe(raw.mapaVariante),
    mapaOmr: parseJsonSafe(raw.mapaOmr),
    paginas: parseJsonSafe(raw.paginas) ?? []
  };
}

function formatearCalificacionPrisma(raw: any) {
  if (!raw) return null;
  return {
    ...raw,
    _id: raw.id,
    fraccion: parseJsonSafe(raw.fraccion),
    origenEvidencia: parseJsonSafe(raw.origenEvidencia),
    respuestasDetectadas: parseJsonSafe(raw.respuestasDetectadas),
    omrAuditoria: parseJsonSafe(raw.omrAuditoria),
    componentesExamen: parseJsonSafe(raw.componentesExamen),
    ...(String(raw.tipoExamen ?? '').toLowerCase() === 'extraordinario'
      ? presentarCalificacionExtraordinaria(raw.calificacionExamenFinalTexto)
      : {})
  };
}

function formatearSolicitudRevisionPrisma(raw: any) {
  if (!raw) return null;
  return {
    ...raw,
    _id: raw.id
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
    id: string;
    alumnoId?: string | null;
    periodoId?: string | null;
    plantillaId?: string | null;
  };
  folio: string;
  estadoAnalisisDefault?: 'ok' | 'rechazado_calidad' | 'requiere_revision';
  templateVersionDetectadaDefault?: 4;
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
    examen.periodoId ? prisma.periodo.findUnique({ where: { id: examen.periodoId } }) : Promise.resolve(null),
    examen.plantillaId ? prisma.examenPlantilla.findUnique({ where: { id: examen.plantillaId } }) : Promise.resolve(null)
  ]);
  const temasPlantilla = plantilla ? (parseJsonSafe<string[]>(plantilla.temas) ?? []) : [];
  const materia = String(
    periodo?.nombre ??
      (temasPlantilla.length > 0 ? temasPlantilla.join(' · ') : plantilla?.titulo ?? '')
  ).trim();

  const calcularSiguienteIntentoOmr = async (numeroPagina: number) => {
    const ultimo = await prisma.escaneoOmrArchivado.findFirst({
      where: {
        examenGeneradoId: examen.id,
        numeroPagina
      },
      orderBy: [{ intento: 'desc' }, { createdAt: 'desc' }]
    });
    const intentoActual = Number(ultimo?.intento ?? 0);
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

    const intento = await calcularSiguienteIntentoOmr(numeroPagina);
    const estado = pagina.estadoAnalisis || estadoAnalisisDefault || 'ok';
    const tempVer = pagina.templateVersionDetectada || templateVersionDetectadaDefault || null;

    try {
      await prisma.escaneoOmrArchivado.create({
        data: {
          docenteId,
          alumnoId: examen.alumnoId || null,
          periodoId: examen.periodoId || null,
          plantillaId: examen.plantillaId || null,
          examenGeneradoId: examen.id,
          folio,
          numeroPagina,
          intento,
          materia,
          mimeType,
          algoritmoCompresion: 'gzip',
          tamanoOriginalBytes: original.length,
          tamanoComprimidoBytes: comprimido.length,
          sha256Original,
          templateVersionDetectada: tempVer,
          engineVersion: engineVersionDefault || null,
          estadoAnalisis: estado,
          motivosRevision: JSON.stringify(motivosRevisionDefault || []),
          payloadComprimido: comprimido
        }
      });
    } catch {
      // no-op en caso de colision de indice unico por concurrencia
    }
  }
}

function obtenerLetraCorrecta(opciones: Array<{ esCorrecta: boolean }>, orden: number[]) {
  const indiceCorrecto = opciones.findIndex((opcion) => opcion.esCorrecta);
  if (indiceCorrecto < 0) return null;
  const posicion = orden.findIndex((idx) => idx === indiceCorrecto);
  if (posicion < 0) return null;
  return String.fromCharCode(65 + posicion);
}

function resolverPaginasQrEsperadas(examen: {
  paginas?: any;
}) {
  const paginas = Array.isArray(examen.paginas) ? examen.paginas : parseJsonSafe<any[]>(examen.paginas) ?? [];
  return paginas
    .map((pagina) => String(pagina?.qrTexto ?? '').trim())
    .filter((qrTexto) => qrTexto.length > 0);
}

function validarResumenQrContraExamen(params: {
  qrTexto: string;
  folioExamen: string;
  templateVersionOmr: number;
  templateIdOmr?: string;
  paginasQrEsperadas: string[];
}): ResumenQrExamen {
  const { qrTexto, folioExamen, templateVersionOmr, templateIdOmr, paginasQrEsperadas } = params;
  const resumenQr = extraerResumenQrExamen(qrTexto);
  if (!resumenQr) {
    throw new ErrorAplicacion(
      'OMR_QR_INVALIDO',
      'El QR incluido en omrAnalisis no tiene un formato válido para verificar la variante del examen',
      422
    );
  }
  if (resumenQr.payloadSignature && resumenQr.payloadSignatureValid === false) {
    throw new ErrorAplicacion(
      'OMR_QR_FIRMA_INVALIDA',
      'El QR incluido en omrAnalisis no supera la validación de integridad',
      409,
      {
        signatureMode: resumenQr.payloadSignatureMode ?? 'desconocido'
      }
    );
  }

  const folioQr = String(resumenQr.folio ?? '').trim().toUpperCase();
  const folioDb = String(folioExamen ?? '').trim().toUpperCase();
  if (folioQr && folioDb && folioQr !== folioDb) {
    throw new ErrorAplicacion('OMR_QR_FOLIO_NO_COINCIDE', 'El QR analizado no corresponde al folio del examen', 409, {
      folioQr,
      folioExamen: folioDb
    });
  }

  if (resumenQr.templateVersion !== 4 || templateVersionOmr !== 4) {
    throw new ErrorAplicacion(
      'OMR_QR_TEMPLATE_NO_COINCIDE',
      'La plantilla detectada por el QR no coincide con la plantilla del examen',
      409,
      {
        templateVersionQr: resumenQr.templateVersion,
        templateVersionExamen: templateVersionOmr
      }
    );
  }
  const templateIdEsperado = templateIdOmr ?? 'omr-canonical-v4';
  if (resumenQr.templateId !== templateIdEsperado) {
    throw new ErrorAplicacion('OMR_QR_TEMPLATE_NO_COINCIDE', 'El ID de plantilla del QR no coincide con el mapa OMR del examen', 409, {
      templateIdQr: resumenQr.templateId,
      templateIdExamen: templateIdEsperado
    });
  }

  const resumenesEsperados = paginasQrEsperadas
    .map((texto) => extraerResumenQrExamen(texto))
    .filter(
      (
        resumen
      ): resumen is NonNullable<ReturnType<typeof extraerResumenQrExamen>> =>
        Boolean(resumen) && resumen!.payloadSignatureValid !== false
    );
  if (resumenesEsperados.length === 0) {
    if (resumenQr.qrPayloadMode === 'manifest-bound') {
      throw new ErrorAplicacion(
        'OMR_QR_MANIFIESTO_REQUERIDO',
        'El QR corto requiere el QR esperado del mapa/manifiesto local para validar variante y clave',
        409
      );
    }
    return resumenQr;
  }

  const paginasCandidatas = resumenesEsperados.filter((item) => item.numeroPagina === resumenQr.numeroPagina);
  if (resumenQr.qrPayloadMode === 'manifest-bound') {
    const esperado = paginasCandidatas.find((item) => item.raw === resumenQr.raw);
    if (!esperado || resumenQr.payloadSignatureValid !== true) {
      throw new ErrorAplicacion(
        'OMR_QR_NO_COINCIDE_MANIFIESTO',
        'El QR corto no coincide exactamente con la página esperada del mapa/manifiesto local',
        409,
        { numeroPaginaQr: resumenQr.numeroPagina }
      );
    }
    return {
      ...resumenQr,
      keyId: esperado.keyId,
      variantHash: esperado.variantHash,
      answerKeyHash: esperado.answerKeyHash,
      pageAnswerKey: esperado.pageAnswerKey,
      examId: esperado.examId,
      validatedAgainstManifest: true
    };
  }

  if (!resumenQr.variantHash || !resumenQr.answerKeyHash) {
    throw new ErrorAplicacion(
      'OMR_QR_HASHES_REQUERIDOS',
      'El QR analizado no incluye hashes de variante y clave requeridos para validar la calificación',
      422
    );
  }

  const candidatos = paginasCandidatas.length > 0 ? paginasCandidatas : resumenesEsperados;

  const coincideVariante = candidatos.some((item) => item.variantHash === resumenQr.variantHash);
  if (!coincideVariante) {
    throw new ErrorAplicacion(
      'OMR_QR_VARIANTE_NO_COINCIDE',
      'El QR analizado no coincide con la variante de preguntas del examen generado',
      409,
      {
        numeroPaginaQr: resumenQr.numeroPagina,
        variantHashQr: resumenQr.variantHash
      }
    );
  }

  const coincideClave = candidatos.some((item) => item.answerKeyHash === resumenQr.answerKeyHash);
  if (!coincideClave) {
    throw new ErrorAplicacion(
      'OMR_QR_CLAVE_NO_COINCIDE',
      'El QR analizado no coincide con la clave correcta del examen generado',
      409,
      {
        numeroPaginaQr: resumenQr.numeroPagina,
        answerKeyHashQr: resumenQr.answerKeyHash
      }
    );
  }

  if (resumenQr.examId) {
    const coincideExamId = candidatos.some((item) => !item.examId || item.examId === resumenQr.examId);
    if (!coincideExamId) {
      throw new ErrorAplicacion(
        'OMR_QR_EXAM_ID_NO_COINCIDE',
        'El QR analizado no corresponde al identificador del examen generado',
        409,
        {
          examIdQr: resumenQr.examId
        }
      );
    }
  }

  return resumenQr;
}

function validarPayloadCalificacionOmr(params: {
  folioPayload?: string;
  folioExamen: string;
  templateVersionOmr: number;
  templateIdOmr?: string;
  totalPreguntasEsperadas: number;
  respuestas: RespuestaDetectada[];
  analisisOmr?: AnalisisOmrCalificacion;
  paginasQrEsperadas?: string[];
}): ResumenQrExamen | undefined {
  const {
    folioPayload,
    folioExamen,
    templateVersionOmr,
    templateIdOmr,
    totalPreguntasEsperadas,
    respuestas,
    analisisOmr,
    paginasQrEsperadas = []
  } = params;

  const folioReq = String(folioPayload ?? '').trim().toUpperCase();
  const folioDb = String(folioExamen ?? '').trim().toUpperCase();
  if (folioReq && folioDb && folioReq !== folioDb) {
    throw new ErrorAplicacion('OMR_FOLIO_NO_COINCIDE', 'El folio del payload no coincide con el examen', 409, {
      folioPayload: folioReq,
      folioExamen: folioDb
    });
  }

  if (respuestas.length > 0 && templateVersionOmr !== 4) {
    throw new ErrorAplicacion('OMR_TEMPLATE_NO_COMPATIBLE', 'Solo la plantilla OMR canónica puede guardar calificación automática', 422);
  }
  if (respuestas.length > 0 && templateIdOmr === 'omr-inline-exam-v1') {
    throw new ErrorAplicacion('OMR_REQUIERE_REVISION_MANUAL', 'La plantilla OMR integrada sigue en evaluación y no admite calificación automática', 422);
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
        private_isInvalidConf(respuesta.confianza)
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
  if (!analisisOmr) return undefined;
  if (analisisOmr.templateVersionDetectada !== undefined && analisisOmr.templateVersionDetectada !== 4) {
    throw new ErrorAplicacion('OMR_TEMPLATE_NO_COMPATIBLE', 'El análisis OMR recibido no corresponde a la plantilla canónica', 422);
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

  if (respuestas.length > 0) {
    const qrTexto = String(analisisOmr.qrTexto ?? '').trim();
    const resumenQrEntrada = extraerResumenQrExamen(qrTexto);
    const requiereCotejoQr = paginasQrEsperadas.length > 0 || resumenQrEntrada?.qrPayloadMode === 'manifest-bound';
    if (requiereCotejoQr && !qrTexto) {
      throw new ErrorAplicacion(
        'OMR_QR_ANALISIS_REQUERIDO',
        'Se requiere el qrTexto analizado para validar variante y clave del examen',
        422
      );
    }
    if (requiereCotejoQr) {
      return validarResumenQrContraExamen({
        qrTexto,
        folioExamen,
        templateVersionOmr,
        templateIdOmr,
        paginasQrEsperadas
      });
    }
  }
  return undefined;
}

function private_isInvalidConf(conf: any) {
  return conf !== undefined && (!Number.isFinite(conf) || conf < 0 || conf > 1);
}

/**
 * Califica un examen generado.
 */
export async function calificarExamen(req: SolicitudDocente, res: Response) {
  const {
    examenGeneradoId,
    folio,
    alumnoId,
    aciertos,
    totalReactivos,
    bonoSolicitado,
    origen,
    origenEvidencia,
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
  const clientRequestId = String(req.body?.clientRequestId ?? '').trim();
  const requestHash = clientRequestId
    ? createHash('sha256').update(JSON.stringify(normalizarParaHash(req.body)), 'utf8').digest('hex')
    : undefined;

  const rawExamen = await prisma.examenGenerado.findUnique({ where: { id: examenGeneradoId } });
  if (!rawExamen) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }
  if (String(rawExamen.docenteId) !== String(docenteId)) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a este examen', 403);
  }
  const calificacionId = clientRequestId ? uuidIdempotenciaCalificacion(docenteId, clientRequestId) : undefined;
  if (calificacionId && requestHash) {
    const existente = await prisma.calificacion.findUnique({ where: { id: calificacionId } });
    if (existente) {
      const auditoria = parseJsonSafe<{ apiIdempotency?: { requestHash?: string } }>(existente.omrAuditoria);
      if (existente.docenteId !== docenteId || auditoria?.apiIdempotency?.requestHash !== requestHash) {
        throw new ErrorAplicacion('CALIFICACION_IDEMPOTENCY_CONFLICT', 'clientRequestId ya fue usado con otra calificación', 409);
      }
      res.status(200).json({ calificacion: formatearCalificacionPrisma(existente) });
      return;
    }
  }
  const examen = formatearExamenGeneradoPrisma(rawExamen) as any;

  const plantilla = await prisma.examenPlantilla.findUnique({ where: { id: examen.plantillaId } });
  if (!plantilla) {
    throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
  }
  const tipoExamenCalificado = String(examen.tipoExamen ?? plantilla.tipo);
  if (!['parcial', 'global', 'extraordinario'].includes(tipoExamenCalificado)) {
    throw new ErrorAplicacion('TIPO_EXAMEN_INVALIDO', 'El tipo de examen no está admitido para calificación.', 400);
  }
  const esExtraordinario = tipoExamenCalificado === 'extraordinario';
  const esInferidaManualmente = origen === 'inferida manualmente';
  if (esInferidaManualmente) {
    const loteEvidencia = String(origenEvidencia?.loteId ?? '').trim().toUpperCase();
    const folioEvidencia = String(origenEvidencia?.folio ?? '').trim().toUpperCase();
    const loteExamen = String(examen.loteId ?? '').trim().toUpperCase();
    const folioExamen = String(examen.folio ?? '').trim().toUpperCase();
    if (!esExtraordinario) {
      throw new ErrorAplicacion('ORIGEN_INFERIDO_INVALIDO', 'El origen inferido manualmente solo se admite en extraordinarios.', 400);
    }
    if (!loteExamen || loteEvidencia !== loteExamen || folioEvidencia !== folioExamen || !examen.alumnoId || (alumnoId && String(alumnoId) !== String(examen.alumnoId))) {
      throw new ErrorAplicacion('EVIDENCIA_ORIGEN_NO_COINCIDE', 'El lote, folio o alumno de la evidencia no coincide con el examen generado.', 409);
    }
  }

  const alumnoFinal = alumnoId ?? examen.alumnoId;
  if (!alumnoFinal && !soloPreview) {
    throw new ErrorAplicacion('ALUMNO_NO_ENCONTRADO', 'Alumno no vinculado al examen', 400);
  }

  // ─── VALIDACIÓN DE ASISTENCIAS Y DERECHO A EXAMEN ───
  if (alumnoFinal && !soloPreview && examen.periodoId) {
    const regla = await prisma.asistenciaRegla.findFirst({
      where: {
        docenteId,
        periodoId: examen.periodoId
      }
    });

    if (regla && regla.accion === 'bloquear_examen') {
      const faltas = await prisma.asistenciaRegistro.count({
        where: {
          alumnoId: String(alumnoFinal),
          estado: 'F',
          sesion: {
            periodoId: examen.periodoId
          }
        }
      });

      const retardos = regla.contarRetardos
        ? await prisma.asistenciaRegistro.count({
            where: {
              alumnoId: String(alumnoFinal),
              estado: 'R',
              sesion: { periodoId: examen.periodoId }
            }
          })
        : 0;

      const faltasRetardos =
        regla.contarRetardos && regla.retardosEquivalenFalta > 0
          ? Math.floor(retardos / regla.retardosEquivalenFalta)
          : 0;
      const faltasEfectivas = faltas + faltasRetardos;

      if (faltasEfectivas > regla.maxFaltas) {
        const excepcion = await prisma.asistenciaExcepcion.findFirst({
          where: {
            docenteId,
            alumnoId: String(alumnoFinal),
            periodoId: examen.periodoId
          }
        });

        if (!excepcion) {
          throw new ErrorAplicacion(
            'BLOQUEADO_POR_ASISTENCIAS',
            'El alumno no tiene derecho a presentar examen por exceso de inasistencias sin excepción autorizada.',
            400
          );
        }
      }
    }
  }

  const ordenPreguntas: string[] = examen.mapaVariante?.ordenPreguntas ?? [];
  const rawPreguntas = await prisma.bancoPregunta.findMany({
    where: { id: { in: ordenPreguntas } },
    include: { versiones: { include: { opciones: true } } }
  });
  const mapaPreguntas = new Map(rawPreguntas.map((p) => [p.id, p]));

  const respuestas = Array.isArray(respuestasDetectadas) ? (respuestasDetectadas as RespuestaDetectada[]) : [];
  const respuestasPorNumero = new Map(respuestas.map((item) => [item.numeroPregunta, item.opcion]));

  const analisisOmr = omrAnalisis as AnalisisOmrCalificacion | undefined;
  const paginasOmrEntrada = Array.isArray(paginasOmr) ? (paginasOmr as PaginaOmrCalificacionEntrada[]) : [];
  const revisionConfirmada = Boolean(analisisOmr?.revisionConfirmada);
  const calidadPagina = Number(analisisOmr?.calidadPagina ?? 1);
  const confianzaPromedioPagina = Number(analisisOmr?.confianzaPromedioPagina ?? 1);
  const ratioAmbiguas = Number(analisisOmr?.ratioAmbiguas ?? 0);
  const totalPreguntasEsperadas = Array.isArray(ordenPreguntas) ? ordenPreguntas.length : 0;
  const paginasQrEsperadas = resolverPaginasQrEsperadas(examen);

  const qrResumenValidado = validarPayloadCalificacionOmr({
    folioPayload: String(folio ?? ''),
    folioExamen: String(examen.folio ?? ''),
    templateVersionOmr: Number(parseJsonSafe<any>(examen.mapaOmr)?.templateVersion ?? 0),
    templateIdOmr: String(parseJsonSafe<any>(examen.mapaOmr)?.templateId ?? ''),
    totalPreguntasEsperadas,
    respuestas,
    analisisOmr,
    paginasQrEsperadas
  });

  const qrResumenAnalisis = qrResumenValidado ??
    (analisisOmr && String(analisisOmr.qrTexto ?? '').trim()
      ? extraerResumenQrExamen(String(analisisOmr.qrTexto ?? '').trim())
      : null);
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
  const totalFinal = esInferidaManualmente
    ? Number(totalReactivos || 0)
    : total || totalReactivos || aciertosFinal || 1;
  if (!Number.isInteger(totalFinal) || totalFinal <= 0 || aciertosFinal > totalFinal) {
    throw new ErrorAplicacion('TOTAL_REACTIVOS_INVALIDO', 'El total evaluable debe ser positivo y no menor que los aciertos.', 400);
  }
  if (esInferidaManualmente && total > 0 && totalFinal > total) {
    throw new ErrorAplicacion('TOTAL_REACTIVOS_INVALIDO', 'El total inferido no puede superar los reactivos oficiales del examen.', 400);
  }
  const aciertosAjustados = Math.min(aciertosFinal, totalFinal);

  const entrega = await prisma.entrega.findFirst({
    where: {
      examenGeneradoId,
      docenteId,
      estado: 'entregado'
    },
    orderBy: { createdAt: 'desc' }
  });
  const bonoAcordeon = entrega?.acordeonEntregado
    ? Number.isFinite(Number(entrega.bonoAcordeon))
      ? Math.max(0, Math.min(0.5, Number(entrega.bonoAcordeon)))
      : 0.25
    : 0;
  const bonoSolicitadoTotal = (Number(bonoSolicitado) || 0) + bonoAcordeon;

  const resultado = calcularCalificacion(
    aciertosAjustados,
    totalFinal,
    bonoSolicitadoTotal,
    evaluacionContinua ?? 0,
    proyecto ?? 0,
    tipoExamenCalificado as 'parcial' | 'global' | 'extraordinario'
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
        ...(esExtraordinario ? presentarCalificacionExtraordinaria(resultado.calificacionFinalTexto) : {}),
        evaluacionContinuaTexto: resultado.evaluacionContinuaTexto,
        proyectoTexto: resultado.proyectoTexto,
        calificacionParcialTexto: resultado.calificacionParcialTexto,
        calificacionGlobalTexto: resultado.calificacionGlobalTexto
      }
    });
    return;
  }

  let rawCalificacion;
  try {
    rawCalificacion = await prisma.calificacion.create({
    data: {
      ...(calificacionId ? { id: calificacionId } : {}),
      docenteId,
      periodoId: examen.periodoId || null,
      examenGeneradoId,
      alumnoId: alumnoFinal,
      tipoExamen: tipoExamenCalificado,
      totalReactivos: totalFinal,
      aciertos: aciertosAjustados,
      fraccion: JSON.stringify({
        numerador: resultado.numerador,
        denominador: resultado.denominador
      }),
      calificacionExamenTexto: resultado.calificacionTexto,
      bonoTexto: resultado.bonoTexto,
      calificacionExamenFinalTexto: resultado.calificacionFinalTexto,
      evaluacionContinuaTexto: resultado.evaluacionContinuaTexto,
      proyectoTexto: resultado.proyectoTexto,
      calificacionParcialTexto: resultado.calificacionParcialTexto,
      calificacionGlobalTexto: resultado.calificacionGlobalTexto,
      retroalimentacion: retroalimentacion ? String(retroalimentacion) : null,
      origen: esInferidaManualmente ? 'inferida manualmente' : null,
      origenEvidencia: esInferidaManualmente
        ? JSON.stringify({
            ...origenEvidencia,
            loteId: String(origenEvidencia.loteId).trim().toUpperCase(),
            folio: String(origenEvidencia.folio).trim().toUpperCase(),
            actorDocenteId: docenteId,
            registradoEn: new Date().toISOString()
          })
        : null,
      respuestasDetectadas: JSON.stringify(respuestasDetectadas || []),
      omrAuditoria: analisisOmr || (clientRequestId && requestHash)
        ? JSON.stringify({
            ...(analisisOmr ? {
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
            qrTexto: analisisOmr.qrTexto ?? null,
            qrValidationMode: qrResumenValidado?.validatedAgainstManifest ? 'manifest-exact' : null,
            variantHash: qrResumenAnalisis?.variantHash ?? null,
            answerKeyHash: qrResumenAnalisis?.answerKeyHash ?? null,
            motivosRevision: analisisOmr.motivosRevision ?? [],
            autoCalificableOmr,
            resumenRespuestas: analisisOmr.resumenRespuestas ?? null,
            contestadasTotal,
            contestadasCorrectas,
            precisionSobreContestadas: contestadasTotal > 0 ? contestadasCorrectas / contestadasTotal : null
            } : {}),
            ...(clientRequestId && requestHash ? { apiIdempotency: { clientRequestId, requestHash } } : {})
          })
        : null,
      politicaId: !esExtraordinario && politicaId ? String(politicaId) : null,
      versionPolitica: !esExtraordinario && versionPolitica ? Number(versionPolitica) : null,
      componentesExamen: !esExtraordinario && componentesExamen ? JSON.stringify(componentesExamen) : null,
      bloqueContinuaDecimal: !esExtraordinario && typeof bloqueContinuaDecimal === 'number' && Number.isFinite(bloqueContinuaDecimal)
          ? bloqueContinuaDecimal
          : null,
      bloqueExamenesDecimal: !esExtraordinario && typeof bloqueExamenesDecimal === 'number' && Number.isFinite(bloqueExamenesDecimal)
          ? bloqueExamenesDecimal
          : null,
      finalDecimal: !esExtraordinario && typeof finalDecimal === 'number' && Number.isFinite(finalDecimal) ? finalDecimal : null,
      finalRedondeada: !esExtraordinario && typeof finalRedondeada === 'number' && Number.isFinite(finalRedondeada) ? finalRedondeada : null
    }
    });
  } catch (error) {
    if (calificacionId && requestHash) {
      const ganadora = await prisma.calificacion.findUnique({ where: { id: calificacionId } });
      const auditoria = parseJsonSafe<{ apiIdempotency?: { requestHash?: string } }>(ganadora?.omrAuditoria);
      if (ganadora?.docenteId === docenteId && auditoria?.apiIdempotency?.requestHash === requestHash) {
        res.status(200).json({ calificacion: formatearCalificacionPrisma(ganadora) });
        return;
      }
    }
    throw error;
  }

  await archivarPaginasOmrEnCalificacion({
    paginasOmr: paginasOmrEntrada,
    docenteId,
    examen: {
      id: rawExamen.id,
      alumnoId: rawExamen.alumnoId,
      periodoId: rawExamen.periodoId,
      plantillaId: rawExamen.plantillaId
    },
    folio: String(rawExamen.folio ?? '').trim().toUpperCase(),
    estadoAnalisisDefault: analisisOmr?.estadoAnalisis,
    templateVersionDetectadaDefault: analisisOmr?.templateVersionDetectada,
    engineVersionDefault: analisisOmr?.engineVersion,
    motivosRevisionDefault: analisisOmr?.motivosRevision
  });

  await prisma.examenGenerado.update({
    where: { id: examenGeneradoId },
    data: { estado: 'calificado' }
  });

  await prisma.solicitudRevisionAlumno.updateMany({
    where: { docenteId, examenGeneradoId, estado: 'pendiente' },
    data: {
      estado: 'atendida',
      atendidoEn: new Date(),
      respuestaDocente: 'Solicitud atendida durante recalificacion'
    }
  }).catch(() => {
    // Best-effort
  });

  res.status(201).json({ calificacion: formatearCalificacionPrisma(rawCalificacion) });
}

export async function obtenerCalificacionPorExamen(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const examenGeneradoId = String(req.params.examenGeneradoId ?? '').trim();
  if (!examenGeneradoId) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }

  const rawCalificacion = await prisma.calificacion.findFirst({
    where: { docenteId, examenGeneradoId },
    orderBy: { createdAt: 'desc' }
  });
  if (!rawCalificacion) {
    throw new ErrorAplicacion('CALIFICACION_NO_ENCONTRADA', 'No hay calificación registrada para este examen', 404);
  }

  const capturasArchivadasRaw = await prisma.escaneoOmrArchivado.findMany({
    where: { docenteId, examenGeneradoId },
    orderBy: [{ numeroPagina: 'asc' }, { intento: 'desc' }, { createdAt: 'desc' }]
  });

  const capturasPorPagina = new Map<number, any>();
  for (const captura of capturasArchivadasRaw) {
    const numeroPagina = Number(captura?.numeroPagina ?? 0);
    if (!Number.isFinite(numeroPagina) || numeroPagina <= 0) continue;
    if (!capturasPorPagina.has(numeroPagina)) {
      capturasPorPagina.set(numeroPagina, captura);
    }
  }
  const capturasArchivadas = Array.from(capturasPorPagina.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, captura]) => captura);

  const paginasOmr = capturasArchivadas
    .map((captura) => {
      try {
        const numeroPagina = Number(captura.numeroPagina);
        const mimeType = String(captura.mimeType ?? 'image/jpeg').trim() || 'image/jpeg';
        const payload = captura.payloadComprimido;
        if (!Number.isFinite(numeroPagina) || numeroPagina <= 0 || !payload) return null;
        
        const bufferGzip = Buffer.from(payload);
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
    const examen = await prisma.examenGenerado.findFirst({
      where: { id: examenGeneradoId, docenteId }
    });
    const folio = String(examen?.folio ?? '').trim().toUpperCase();
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

  const calificacion = formatearCalificacionPrisma(rawCalificacion);

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
  
  const where: any = { docenteId };
  if (estado) where.estado = estado;

  const rawSolicitudes = await prisma.solicitudRevisionAlumno.findMany({
    where,
    orderBy: [{ solicitadoEn: 'desc' }, { createdAt: 'desc' }],
    take: limite
  });

  const solicitudes = rawSolicitudes.map(formatearSolicitudRevisionPrisma);
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

    // Check if it exists to perform manual create/update
    const existente = await prisma.solicitudRevisionAlumno.findFirst({
      where: { externoId }
    });

    const dataObj = {
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
      firmaDocente: String((item as any)?.firmaDocente ?? '').trim() || null,
      firmadoEn: (item as any)?.firmadoEn ? new Date(String((item as any).firmadoEn)) : null,
      cerradoEn: (item as any)?.cerradoEn ? new Date(String((item as any).cerradoEn)) : null,
      conformidadAlumno: Boolean(item?.conformidadAlumno),
      conformidadActualizadaEn: item?.conformidadActualizadaEn ? new Date(item.conformidadActualizadaEn) : null,
      origen: 'portal'
    };

    if (existente) {
      await prisma.solicitudRevisionAlumno.update({
        where: { id: existente.id },
        data: dataObj
      });
    } else {
      await prisma.solicitudRevisionAlumno.create({
        data: {
          externoId,
          ...dataObj
        }
      });
    }
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

  const existente = await prisma.solicitudRevisionAlumno.findFirst({
    where: { id, docenteId }
  });
  if (!existente) {
    throw new ErrorAplicacion('SOLICITUD_NO_ENCONTRADA', 'Solicitud no encontrada', 404);
  }

  const rawUpdated = await prisma.solicitudRevisionAlumno.update({
    where: { id },
    data: {
      estado,
      atendidoEn: new Date(),
      respuestaDocente,
      firmaDocente: `docente:${docenteId}`,
      firmadoEn: estado === 'atendida' ? new Date() : null,
      cerradoEn: estado === 'rechazada' ? new Date() : null
    }
  });

  const actualizada = formatearSolicitudRevisionPrisma(rawUpdated) as any;

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
      // Best-effort
    });
  }

  res.json({ solicitud: actualizada });
}
