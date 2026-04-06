/**
 * Controlador de escaneo OMR.
 *
 * Seguridad / multi-tenancy:
 * - La busqueda del examen se filtra por `docenteId`, evitando acceso cruzado entre docentes.
 * - Se valida que exista el mapa OMR para la pagina solicitada.
 */
import type { Response } from 'express';
import { createHash } from 'node:crypto';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { registrarOmrResultadoAnalisis } from '../../compartido/observabilidad/metrics';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { construirQrExamenLegacy, extraerResumenQrExamen } from '../modulo_generacion_pdf/domain/qrExamen';
import { ExamenGenerado } from '../modulo_generacion_pdf/modeloExamenGenerado';
import { ExamenPlantilla } from '../modulo_generacion_pdf/modeloExamenPlantilla';
import { Periodo } from '../modulo_alumnos/modeloPeriodo';
import { EscaneoOmrArchivado } from './modeloEscaneoOmrArchivado';
import { analizarOmr, leerQrDesdeImagen } from './servicioOmr';

const comprimirGzip = promisify(gzip);

/**
 * Analiza una imagen escaneada (base64) contra el mapa OMR del examen.
 *
 * Entradas esperadas:
 * - `folio`: se normaliza a mayusculas.
 * - `numeroPagina`: 1-indexed.
 * - `imagenBase64`: contenido de la pagina.
 */
export async function analizarImagen(req: SolicitudDocente, res: Response) {
  const { folio, numeroPagina, imagenBase64 } = req.body;
  const docenteId = obtenerDocenteId(req);

  let textoQr: string | undefined;
  if (!folio || !numeroPagina) {
    try {
      textoQr = await leerQrDesdeImagen(imagenBase64 ?? '');
    } catch {
      throw new ErrorAplicacion('OMR_IMAGEN_INVALIDA', 'Imagen OMR invalida o corrupta', 400);
    }
  }
  const qrResumen = extraerResumenQrExamen(textoQr);
  if (qrResumen?.payloadSignature && qrResumen.payloadSignatureValid === false) {
    throw new ErrorAplicacion(
      'OMR_QR_FIRMA_INVALIDA',
      'El QR detectado en la imagen no supera la validación de integridad',
      409,
      {
        signatureMode: qrResumen.payloadSignatureMode ?? 'desconocido'
      }
    );
  }
  const folioDetectado = qrResumen?.folio ?? '';
  const paginaDetectada = qrResumen?.numeroPagina;
  const templateQr = qrResumen?.templateVersion;

  const folioNormalizado = String(folio || folioDetectado || '').toUpperCase();
  const paginaSolicitada = Number(numeroPagina);
  const pagina = Number.isFinite(paginaSolicitada) && paginaSolicitada > 0 ? paginaSolicitada : Number(paginaDetectada || 1);

  const examen = await ExamenGenerado.findOne({ folio: folioNormalizado, docenteId }).lean();
  if (!examen) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }

  const mapaOmr = examen.mapaOmr?.paginas?.find((item: { numeroPagina: number }) => item.numeroPagina === pagina);
  if (!mapaOmr) {
    throw new ErrorAplicacion('PAGINA_NO_VALIDA', 'No hay mapa OMR para la pagina', 400);
  }

  const templateMapa = Number(examen.mapaOmr?.templateVersion);
  const templateVersionDetectada =
    templateQr === 3 || templateQr === 4
      ? templateQr
      : templateMapa === 3 || templateMapa === 4
        ? templateMapa
        : null;
  if (templateVersionDetectada !== 3 && templateVersionDetectada !== 4) {
    throw new ErrorAplicacion(
      'OMR_TEMPLATE_NO_COMPATIBLE',
      'Solo las plantillas TV3/TV4 son compatibles con el motor OMR actual',
      422
    );
  }
  const paginaExamen = Array.isArray((examen as { paginas?: unknown[] }).paginas)
    ? ((examen as { paginas?: Array<{ numero?: number; qrTexto?: string }> }).paginas ?? []).find(
        (item) => Number(item?.numero) === pagina
      )
    : undefined;
  const qrEsperado = [
    String(paginaExamen?.qrTexto ?? '').trim(),
    String((mapaOmr as { qr?: { texto?: string } }).qr?.texto ?? '').trim(),
    construirQrExamenLegacy(String(examen.folio ?? ''), pagina, templateVersionDetectada)
  ].filter((valor): valor is string => Boolean(valor));
  const margenMm = examen.mapaOmr?.margenMm ?? 10;
  const requestId = (req as SolicitudDocente & { requestId?: string }).requestId;
  let resultado;
  try {
    resultado = await analizarOmr(imagenBase64 ?? '', mapaOmr, qrEsperado, margenMm, {
      folio: folioNormalizado,
      numeroPagina: pagina,
      templateVersionDetectada
    }, requestId);
  } catch {
    throw new ErrorAplicacion('OMR_IMAGEN_INVALIDA', 'No se pudo procesar la imagen OMR', 400);
  }
  const qrResultado = extraerResumenQrExamen(String(resultado?.qrTexto ?? '').trim());
  if (qrResultado?.payloadSignature && qrResultado.payloadSignatureValid === false) {
    throw new ErrorAplicacion(
      'OMR_QR_FIRMA_INVALIDA',
      'El QR detectado en la imagen no supera la validación de integridad',
      409,
      {
        signatureMode: qrResultado.payloadSignatureMode ?? 'desconocido'
      }
    );
  }
  registrarOmrResultadoAnalisis({
    estadoAnalisis: resultado.estadoAnalisis,
    confianzaPromedioPagina: Number(resultado.confianzaPromedioPagina ?? 0),
    ratioAmbiguas: Number(resultado.ratioAmbiguas ?? 1),
    calidadPagina: Number(resultado.calidadPagina ?? 0)
  });
  await archivarEscaneoOmrIntento({
    base64: imagenBase64 ?? '',
    folio: folioNormalizado,
    numeroPagina: pagina,
    docenteId,
    examen,
    estadoAnalisis: resultado?.estadoAnalisis,
    templateVersionDetectada,
    engineVersion: resultado?.engineVersion,
    motivosRevision: resultado?.motivosRevision
  });
  res.json({
    resultado,
    examenId: examen._id,
    folio: folioNormalizado,
    numeroPagina: pagina,
    alumnoId: examen.alumnoId ?? null,
    templateVersionDetectada
  });
}

export async function prevalidarLoteCapturas(req: SolicitudDocente, res: Response) {
  const entradas = Array.isArray((req.body as { capturas?: unknown[] })?.capturas)
    ? (((req.body as { capturas?: unknown[] }).capturas ?? []) as Array<{ imagenBase64?: string; nombreArchivo?: string }>)
    : [];
  const capturas = entradas.slice(0, 200);
  const resultados: Array<{
    indice: number;
    nombreArchivo?: string;
    legible: boolean;
    calidad: number;
    contraste: number;
    resolucion: { ancho: number; alto: number };
    qrDetectado: boolean;
    sugerencias: string[];
  }> = [];

  for (let i = 0; i < capturas.length; i += 1) {
    const item = capturas[i];
    const sugerencias: string[] = [];
    const nombreArchivo = String(item?.nombreArchivo ?? '').trim() || undefined;
    const limpio = String(item?.imagenBase64 ?? '').replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    if (!limpio) {
      resultados.push({
        indice: i,
        nombreArchivo,
        legible: false,
        calidad: 0,
        contraste: 0,
        resolucion: { ancho: 0, alto: 0 },
        qrDetectado: false,
        sugerencias: ['Archivo vacío o dañado. Captura nuevamente la hoja completa.']
      });
      continue;
    }
    try {
      const buffer = Buffer.from(limpio, 'base64');
      const imagen = sharp(buffer).rotate();
      const [meta, stats] = await Promise.all([imagen.metadata(), imagen.stats()]);
      const ancho = Number(meta.width ?? 0);
      const alto = Number(meta.height ?? 0);
      const menor = Math.min(ancho, alto);
      const mayor = Math.max(ancho, alto);
      const contraste = Number(stats.channels?.[0]?.stdev ?? 0);
      const calidadResolucion = menor >= 900 && mayor >= 1300 ? 1 : menor >= 720 && mayor >= 1024 ? 0.7 : 0.4;
      const calidadContraste = Math.max(0, Math.min(1, contraste / 44));
      const calidad = Number(((calidadResolucion * 0.58) + (calidadContraste * 0.42)).toFixed(4));

      if (menor < 900) sugerencias.push('Acerca la cámara: el área útil de la hoja quedó pequeña.');
      if (contraste < 14) sugerencias.push('Iluminación insuficiente: evita sombras y sube la luz ambiente.');
      if (contraste > 95) sugerencias.push('Reflejo o sobreexposición detectada: evita flash directo.');

      let qrDetectado = false;
      try {
        const qr = await leerQrDesdeImagen(String(item?.imagenBase64 ?? ''));
        qrDetectado = Boolean(qr && /EXAMEN:/i.test(qr));
      } catch {
        qrDetectado = false;
      }
      if (!qrDetectado) sugerencias.push('No se detectó QR: recorta menos y captura la hoja completa.');

      const legible = calidad >= 0.58 && qrDetectado;
      if (!legible && sugerencias.length === 0) {
        sugerencias.push('Captura no legible para OMR. Repite foto con mejor enfoque y encuadre.');
      }
      resultados.push({
        indice: i,
        nombreArchivo,
        legible,
        calidad,
        contraste,
        resolucion: { ancho, alto },
        qrDetectado,
        sugerencias
      });
    } catch {
      resultados.push({
        indice: i,
        nombreArchivo,
        legible: false,
        calidad: 0,
        contraste: 0,
        resolucion: { ancho: 0, alto: 0 },
        qrDetectado: false,
        sugerencias: ['Formato no compatible o archivo corrupto. Usa JPG/PNG y recaptura.']
      });
    }
  }

  const legibles = resultados.filter((r) => r.legible).length;
  const noLegibles = resultados.length - legibles;
  res.json({
    total: resultados.length,
    legibles,
    noLegibles,
    porcentajeLegible: resultados.length > 0 ? Number(((legibles / resultados.length) * 100).toFixed(2)) : 0,
    resultados
  });
}

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

async function calcularSiguienteIntentoOmr(examenGeneradoId: unknown, numeroPagina: number) {
  const ultimo = await EscaneoOmrArchivado.findOne({
    examenGeneradoId,
    numeroPagina
  })
    .sort({ intento: -1, createdAt: -1 })
    .select({ intento: 1 })
    .lean();
  const intentoActual = Number((ultimo as { intento?: unknown } | null)?.intento ?? 0);
  return Number.isFinite(intentoActual) && intentoActual > 0 ? intentoActual + 1 : 1;
}

function esErrorDuplicadoMongo(error: unknown) {
  return Number((error as { code?: unknown } | null)?.code ?? 0) === 11000;
}

async function archivarEscaneoOmrIntento({
  base64,
  folio,
  numeroPagina,
  docenteId,
  examen,
  estadoAnalisis,
  templateVersionDetectada,
  engineVersion,
  motivosRevision
}: {
  base64: string;
  folio: string;
  numeroPagina: number;
  docenteId: string;
  examen: {
    _id: unknown;
    alumnoId?: unknown;
    periodoId?: unknown;
    plantillaId?: unknown;
  };
  estadoAnalisis?: 'ok' | 'rechazado_calidad' | 'requiere_revision' | string;
  templateVersionDetectada: 1 | 3 | 4;
  engineVersion?: string;
  motivosRevision?: string[];
}) {
  const { mimeType, contenido } = extraerBase64Imagen(base64);
  if (!contenido) return;

  const original = Buffer.from(contenido, 'base64');
  if (!original.length) return;
  const comprimido = await comprimirGzip(original, { level: 9 });
  const sha256Original = createHash('sha256').update(original).digest('hex');

  const [periodo, plantilla] = await Promise.all([
    examen.periodoId ? Periodo.findById(examen.periodoId).select({ nombre: 1 }).lean() : Promise.resolve(null),
    examen.plantillaId ? ExamenPlantilla.findById(examen.plantillaId).select({ titulo: 1, temas: 1 }).lean() : Promise.resolve(null)
  ]);
  const materia = String(
    periodo?.nombre ??
      (Array.isArray(plantilla?.temas) && plantilla.temas.length > 0 ? plantilla.temas.join(' · ') : plantilla?.titulo ?? '')
  ).trim();

  for (let reintento = 0; reintento < 3; reintento += 1) {
    const intento = await calcularSiguienteIntentoOmr(examen._id, numeroPagina);
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
        templateVersionDetectada,
        engineVersion,
        estadoAnalisis:
          estadoAnalisis === 'ok' || estadoAnalisis === 'rechazado_calidad' || estadoAnalisis === 'requiere_revision'
            ? estadoAnalisis
            : 'ok',
        motivosRevision: Array.isArray(motivosRevision) ? motivosRevision.slice(0, 24) : [],
        payloadComprimido: comprimido
      });
      return;
    } catch (error) {
      if (esErrorDuplicadoMongo(error) && reintento < 2) continue;
      throw error;
    }
  }
}
