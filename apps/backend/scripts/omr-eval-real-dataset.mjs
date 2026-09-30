import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { analizarOmr, leerQrDetalleDesdeImagen } from '../src/modulos/modulo_escaneo_omr/servicioOmrCv.js';
import { OMR_ENGINE_RELEASE } from '../src/modulos/modulo_escaneo_omr/omr/engineRelease.js';
import { crearHuellaGeometriaMapaOmr } from './omr-map-geometry-fingerprint.mjs';
import {
  clasificarLecturaQrBenchmark,
  resumirIntegridadDatasetOmr
} from '../src/modulos/modulo_escaneo_omr/infra/metricasDatasetOmr.js';

const mobileDir = process.env.OMR_EVAL_DATASET_DIR ?? 'D:/Downloads/Mobile Devices';
const attachedImage = 'C:/Users/evega/AppData/Local/Temp/codex-clipboard-1431522e-1624-46ee-80fb-d21b6531a671.jpg';
const dbPath = 'C:/ProgramData/EvaluaPro/data/evaluapro.db';
const truthPath = 'C:/Users/evega/AppData/Local/Temp/codex-evaluapro-pdfs/calificacion-verificada-preview.json';
const previousPath = 'C:/Users/evega/AppData/Local/Temp/omr-current-eval-20260919.json';
const outputPath = process.env.OMR_EVAL_OUTPUT_PATH ?? 'C:/Users/evega/AppData/Local/Temp/omr-current-eval-20260919-post-improvements.json';
const onlyFile = process.env.OMR_EVAL_ONLY_FILE ?? null;
const onlyFiles = new Set(
  String(process.env.OMR_EVAL_ONLY_FILES ?? '')
    .split('|')
    .map((name) => name.trim())
    .filter(Boolean)
);
const debugFile = process.env.OMR_EVAL_DEBUG_FILE ?? null;
const includeScores = process.env.OMR_EVAL_INCLUDE_SCORES === '1';
const internalVariant = process.env.OMR_EVAL_INTERNAL_VARIANT ?? 'base';
const qrGeometryOutputSize = process.env.OMR_EVAL_QR_GEOMETRY_OUTPUT_SIZE == null
  ? undefined
  : Number(process.env.OMR_EVAL_QR_GEOMETRY_OUTPUT_SIZE);
const extraHints = JSON.parse(process.env.OMR_EVAL_FALLBACK_HINTS ?? '{}');
const concurrency = Number(process.env.OMR_EVAL_CONCURRENCY ?? 2);
const omrSourceRoot = fileURLToPath(new URL('../src/modulos/modulo_escaneo_omr/', import.meta.url));
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
  throw new RangeError('OMR_EVAL_CONCURRENCY debe ser un entero entre 1 y 8');
}
if (qrGeometryOutputSize !== undefined && (!Number.isInteger(qrGeometryOutputSize) || qrGeometryOutputSize < 256 || qrGeometryOutputSize > 768)) {
  throw new RangeError('OMR_EVAL_QR_GEOMETRY_OUTPUT_SIZE debe ser un entero entre 256 y 768');
}

async function listarFuentesOmr(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listarFuentesOmr(fullPath);
    return /\.(?:ts|tsx|js|mjs)$/.test(entry.name) ? [fullPath] : [];
  }));
  return nested.flat().sort((a, b) => a.localeCompare(b));
}

async function calcularHuellaFuentesOmr() {
  const files = await listarFuentesOmr(omrSourceRoot);
  const hash = createHash('sha256');
  for (const file of files) {
    const relativePath = path.relative(omrSourceRoot, file).replaceAll(path.sep, '/');
    hash.update(relativePath).update('\0').update(await fs.readFile(file)).update('\0');
  }
  return { fileCount: files.length, sha256: hash.digest('hex') };
}

const opciones = new Set(['A', 'B', 'C', 'D', 'E']);
const estadosRespuesta = new Set(['respondida', 'sin_marca', 'ambigua', 'doble_marca', 'tachada']);

function limpiarFolio(value) {
  const match = String(value ?? '').toUpperCase().match(/(?:EXAMEN:|FOLIO:)([A-Z0-9-]+)/);
  return match?.[1] ?? null;
}

function extraerPagina(value) {
  const match = String(value ?? '').toUpperCase().match(/(?:^|:)P(\d+)(?:[:|]|$)/);
  return match ? Number(match[1]) : null;
}

function respuestaString(respuestas) {
  return respuestas.map((respuesta) => respuesta.opcion ?? '?').join('');
}

function contarFlags(respuestas) {
  const counts = {};
  for (const respuesta of respuestas) {
    for (const flag of respuesta.flags ?? []) counts[flag] = (counts[flag] ?? 0) + 1;
  }
  return counts;
}

function combinarCounts(target, source) {
  for (const [key, value] of Object.entries(source)) target[key] = (target[key] ?? 0) + value;
}

function truthFor(truthByFolio, folio, pagina) {
  const page = truthByFolio.get(folio)?.find((item) => Number(item.pagina) === pagina);
  if (!page) return null;
  return {
    key: String(page.clave ?? '').toUpperCase(),
    observed: String(page.respuestasObservadas ?? '').toUpperCase()
  };
}

const truth = JSON.parse(await fs.readFile(truthPath, 'utf8'));
const truthByFolio = new Map(truth.folios.map((folio) => [folio.folio, folio.paginas]));
const previous = JSON.parse(await fs.readFile(previousPath, 'utf8'));
const fallbackByFile = new Map(
  previous.changedRows.map((row) => [row.file, { folio: row.folio, pagina: Number(row.page) }])
);
const fallbackSourceByFile = new Map(
  previous.changedRows.map((row) => [row.file, 'previous_benchmark_mapping'])
);
// Filas que no cambiaron en la corrida anterior no aparecen en changedRows.
// Se documentan aqui para que la repeticion del benchmark no dependa de leer
// nuevamente un QR que ya se sabe fragil en estas fotografias.
for (const [file, folio, pagina] of [
  ['CamScanner 17-09-2026 02.30_11.jpg', '8EB5ED48', 1],
  ['CamScanner 17-09-2026 02.30_13.jpg', 'BE4152FD', 1],
  ['CamScanner 17-09-2026 02.30_19.jpg', 'DCA5097F', 1],
  ['codex-clipboard-1431522e-1624-46ee-80fb-d21b6531a671.jpg', 'C5051CA1', 2]
]) fallbackByFile.set(file, { folio, pagina });
for (const file of [
  'CamScanner 17-09-2026 02.30_11.jpg',
  'CamScanner 17-09-2026 02.30_13.jpg',
  'CamScanner 17-09-2026 02.30_19.jpg',
  'codex-clipboard-1431522e-1624-46ee-80fb-d21b6531a671.jpg'
]) fallbackSourceByFile.set(file, 'explicit_verified_fixture');
for (const [file, hint] of Object.entries(extraHints)) {
  if (!hint || !hint.folio || !Number.isInteger(Number(hint.pagina))) continue;
  fallbackByFile.set(file, { folio: String(hint.folio), pagina: Number(hint.pagina) });
  fallbackSourceByFile.set(file, 'runtime_fixture');
}

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: `file:${dbPath.replaceAll('\\', '/')}` })
});
const omrSourceFingerprint = await calcularHuellaFuentesOmr();
const evaluationScriptSha256 = createHash('sha256')
  .update(await fs.readFile(fileURLToPath(import.meta.url)))
  .digest('hex');
const geometryFingerprintModuleSha256 = createHash('sha256')
  .update(await fs.readFile(new URL('./omr-map-geometry-fingerprint.mjs', import.meta.url)))
  .digest('hex');

try {
  const examenes = await prisma.examenGenerado.findMany({
    where: { mapaOmr: { not: null } },
    select: { folio: true, mapaOmr: true }
  });
  const maps = new Map();
  for (const examen of examenes) {
    if (!examen.mapaOmr) continue;
    maps.set(examen.folio, JSON.parse(examen.mapaOmr));
  }

  const names = (await fs.readdir(mobileDir))
    .filter((name) => /\.(jpe?g|png)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (await fs.stat(attachedImage).catch(() => null)) names.push(attachedImage);
  const selectedNames = onlyFiles.size > 0
    ? names.filter((name) => onlyFiles.has(path.basename(name)))
    : onlyFile
      ? names.filter((name) => path.basename(name) === onlyFile)
      : names;

  const rows = [];
  const errors = [];
  const sha256PorArchivo = new Map();
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  let peakRssBytes = process.memoryUsage().rss;
  const memoryMonitor = setInterval(() => {
    peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
  }, 1000);
  memoryMonitor.unref();
  let completedFiles = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < selectedNames.length) {
      const index = cursor++;
      const file = selectedNames[index];
      const fullPath = path.isAbsolute(file) ? file : path.join(mobileDir, file);
      const started = Date.now();
      try {
        const imageBuffer = await fs.readFile(fullPath);
        sha256PorArchivo.set(path.basename(fullPath), createHash('sha256').update(imageBuffer).digest('hex'));
        const image = imageBuffer.toString('base64');
        const hint = fallbackByFile.get(path.basename(fullPath));
        // La identidad de respaldo asocia la captura a su mapa, pero nunca
        // debe omitir ni condicionar la medición del lector QR de la imagen.
        const qrDetalleDirecto = await leerQrDetalleDesdeImagen(image);
        const qrDetectado = qrDetalleDirecto?.data;
        const folio = hint?.folio ?? limpiarFolio(qrDetectado);
        const pagina = hint?.pagina ?? extraerPagina(qrDetectado);
        const mapa = folio ? maps.get(folio) : null;
        const mapaPagina = mapa?.paginas?.find((item) => Number(item.numeroPagina) === pagina) ??
          (pagina ? mapa?.paginas?.[pagina - 1] : null);
        if (!folio || !pagina || !mapaPagina) {
          const qrLectura = clasificarLecturaQrBenchmark(qrDetalleDirecto);
          rows.push({
            file: path.basename(fullPath),
            qrTextoDetectado: qrDetectado ?? null,
            ...qrLectura,
            qrFuenteAnalisis: null,
            qrTextoEsperado: null,
            qrCoincideEsperado: null,
            mappingSource: 'qr_unresolved',
            mapGeometrySha256: null,
            fallbackMappingUsed: false,
            folio,
            pagina,
            skipped: true,
            reason: 'qr_o_mapa_no_resuelto'
          });
          continue;
        }
        const opcionesInternasBase = internalVariant === 'homography'
          ? { aggressivePreprocess: false, noRetry: true, rescueFiduciales: true, disableLocalGeometry: true, forceHomographyGeometry: true }
          : internalVariant === 'aggressive'
          ? { aggressivePreprocess: true, noRetry: true, rescueFiduciales: true, disableLocalGeometry: false }
          : internalVariant === 'highres'
            ? { aggressivePreprocess: true, highResolutionRescue: true, noRetry: true, rescueFiduciales: true, disableLocalGeometry: false }
          : internalVariant === 'base-no-retry'
            ? { aggressivePreprocess: false, noRetry: true, rescueFiduciales: true, disableLocalGeometry: false }
          : internalVariant === 'no-local'
            ? { aggressivePreprocess: false, noRetry: true, rescueFiduciales: true, disableLocalGeometry: true }
            : undefined;
        const opcionesInternas = qrGeometryOutputSize === undefined
          ? opcionesInternasBase
          : { ...opcionesInternasBase, qrGeometryOutputSize };
        const resultado = await analizarOmr(
          image,
          mapaPagina,
          mapaPagina.qr?.texto,
          Number(mapa.margenMm ?? 10),
          { folio, numeroPagina: pagina, templateVersionDetectada: 4 },
          opcionesInternas
        );
        const qrTextoDetectado = resultado.qrTexto ?? qrDetectado ?? null;
        const qrTextoEsperado = mapaPagina.qr?.texto ?? null;
        const qrLectura = clasificarLecturaQrBenchmark(qrDetalleDirecto, qrTextoEsperado);
        const qrCoincideDirectoEsperado = qrLectura.qrCoincideDirectoEsperado;
        const qrDetectionMode = qrLectura.qrDetectionMode !== 'not_detected'
          ? qrLectura.qrDetectionMode
          : resultado.qrTexto
            ? (resultado.qrFuenteDeteccion ?? 'analysis_rescue')
            : 'not_detected';
        const mappingSource = hint
          ? fallbackSourceByFile.get(path.basename(fullPath)) ?? 'fallback_mapping'
          : 'qr_detected';
        if (debugFile && path.basename(fullPath) === debugFile) {
          console.error(JSON.stringify({ file: path.basename(fullPath), advertencias: resultado.advertencias, motivosRevision: resultado.motivosRevision, geometryMode: resultado.geometryMode, geometryLocalEnabled: resultado.geometryLocalEnabled }, null, 2));
        }
        const respuestas = resultado.respuestasDetectadas ?? [];
        const estados = respuestas.map((item) => item.estadoRespuesta ?? null);
        const reactivosConEstado = estados.filter((estado) => estadosRespuesta.has(estado)).length;
        const conteoEstados = estados.reduce((acc, estado) => {
          const clave = estadosRespuesta.has(estado) ? estado : 'sin_estado';
          acc[clave] = (acc[clave] ?? 0) + 1;
          return acc;
        }, {});
        const truthPage = truthFor(truthByFolio, folio, pagina);
        const key = truthPage?.key ?? '';
        let known = 0;
        let knownDetermined = 0;
        let knownAgreement = 0;
        let observedKnown = 0;
        let observedDetermined = 0;
        let observedAgreement = 0;
        for (let i = 0; i < key.length; i += 1) {
          if (!opciones.has(key[i])) continue;
          known += 1;
          const detected = respuestas[i]?.opcion ?? null;
          if (detected) {
            knownDetermined += 1;
            if (detected === key[i]) knownAgreement += 1;
          }
        }
        const observed = truthPage?.observed ?? '';
        for (let i = 0; i < observed.length; i += 1) {
          if (!opciones.has(observed[i])) continue;
          observedKnown += 1;
          const detected = respuestas[i]?.opcion ?? null;
          if (detected) {
            observedDetermined += 1;
            if (detected === observed[i]) observedAgreement += 1;
          }
        }
        rows.push({
          file: path.basename(fullPath),
          folio,
          page: pagina,
          qrTextoDetectado,
          ...qrLectura,
          qrFuenteAnalisis: resultado.qrFuenteDeteccion ?? null,
          qrTextoEsperado,
          qrDetectionMode,
          qrGeometryRescueUsed: !qrDetectado && resultado.qrFuenteDeteccion === 'known_geometry_rescue',
          qrPayloadLength: qrTextoDetectado ? qrTextoDetectado.length : null,
          qrCoincideEsperado: qrTextoDetectado && qrTextoEsperado
            ? qrTextoDetectado === qrTextoEsperado
            : null,
          qrCoincideDirectoEsperado,
          mappingSource,
          mapGeometrySha256: crearHuellaGeometriaMapaOmr(mapaPagina),
          fallbackMappingUsed: Boolean(hint),
          response: respuestaString(respuestas),
          responseDetails: respuestas.map((item) => ({
            pregunta: item.numeroPregunta,
            opcion: item.opcion,
            confianza: item.confianza,
            estadoRespuesta: item.estadoRespuesta ?? null,
            flags: item.flags ?? []
          })),
          key,
          observed: truthPage?.observed ?? null,
          determined: respuestas.filter((item) => item.opcion != null).length,
          ambiguous: respuestas.filter((item) => item.estadoRespuesta === 'ambigua' || (item.opcion == null && (item.flags?.length ?? 0) > 0)).length,
          blank: respuestas.filter((item) => item.estadoRespuesta === 'sin_marca' || (item.estadoRespuesta === undefined && item.opcion == null && (item.flags?.length ?? 0) === 0)).length,
          invalid: respuestas.filter((item) => item.estadoRespuesta === 'doble_marca' || item.estadoRespuesta === 'tachada').length,
          emptyExam: Boolean(resultado.resumenRespuestas?.examenVacio),
          responseSummary: resultado.resumenRespuestas ?? null,
          reactivosConEstado,
          reactivosSinEstado: respuestas.length - reactivosConEstado,
          coberturaEstados: respuestas.length > 0 ? reactivosConEstado / respuestas.length : 0,
          conteoEstados,
          known,
          knownDetermined,
          knownAgreement,
          observedKnown,
          observedDetermined,
          observedAgreement,
          estado: resultado.estadoAnalisis,
          calidadPagina: resultado.calidadPagina,
          confianzaPromedioPagina: resultado.confianzaPromedioPagina,
          ratioAmbiguas: resultado.ratioAmbiguas,
          geomQuality: resultado.geomQuality,
          photoQuality: resultado.photoQuality,
          geometryMode: resultado.geometryMode ?? null,
          geometryReferencePoints: resultado.geometryReferencePoints ?? null,
          geometryReferenceQuality: resultado.geometryReferenceQuality ?? null,
          geometryLocalEnabled: resultado.geometryLocalEnabled ?? false,
          orientationMode: resultado.orientationMode ?? 'none',
          pageRotationDegrees: resultado.pageRotationDegrees ?? null,
          pageSkewDegrees: resultado.pageSkewDegrees ?? null,
          pageOrientationDetermined: resultado.pageOrientationDetermined ?? false,
          pageOrientationSource: resultado.pageOrientationSource ?? 'indeterminada',
          pageOrientationConfidence: resultado.pageOrientationConfidence ?? null,
          pageOrientationMargin: resultado.pageOrientationMargin ?? null,
          flags: contarFlags(respuestas),
          ...(includeScores
            ? {
                scoreDetails: respuestas.map((respuesta) => ({
                  pregunta: respuesta.numeroPregunta,
                  opcion: respuesta.opcion,
                  scores: respuesta.scoresPorOpcion
                }))
              }
            : {}),
          durationMs: Date.now() - started
        });
      } catch (error) {
        errors.push({ file: path.basename(fullPath), message: error instanceof Error ? error.message : String(error) });
      } finally {
        completedFiles += 1;
        process.stderr.write(`[omr-eval] ${completedFiles}/${selectedNames.length} ${path.basename(fullPath)} ${Date.now() - started}ms\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  clearInterval(memoryMonitor);
  peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
  rows.sort((a, b) => String(a.file).localeCompare(String(b.file), undefined, { numeric: true }));
  const integridadDataset = resumirIntegridadDatasetOmr(rows, sha256PorArchivo);
  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startedAtMs;

  const summary = {
    engineRelease: OMR_ENGINE_RELEASE,
    startedAt,
    finishedAt,
    durationMs,
    execution: {
      nodeProcesses: 1,
      concurrentImages: concurrency,
      qrGeometryOutputSize: qrGeometryOutputSize ?? 384,
      peakRssBytes,
      imagesPerSecond: durationMs > 0 ? rows.length / (durationMs / 1000) : null
    },
    provenance: {
      fingerprintVersion: 1,
      omrSourceFileCount: omrSourceFingerprint.fileCount,
      omrSourceSha256: omrSourceFingerprint.sha256,
      evaluationScriptSha256,
      geometryFingerprintModuleSha256
    },
    dataset: {
      directory: mobileDir,
      attachedImage,
      rows: selectedNames.length,
      uniqueByteContents: integridadDataset.imageContent.uniqueByteContents,
      uniqueFolioPages: integridadDataset.folioPage.uniquePages,
      uniqueQuestionSlots: integridadDataset.question.uniqueQuestionSlots
    },
    dataQuality: integridadDataset,
    previous: {
      report: previousPath,
      processed: previous.processed,
      determined: previous.determined,
      ambiguous: previous.ambiguous,
      states: previous.states
    },
    processed: rows.filter((row) => !row.skipped).length,
    skipped: rows.filter((row) => row.skipped).length,
    determined: rows.reduce((sum, row) => sum + (row.determined ?? 0), 0),
    ambiguous: rows.reduce((sum, row) => sum + (row.ambiguous ?? 0), 0),
    blank: rows.reduce((sum, row) => sum + (row.blank ?? 0), 0),
    invalid: rows.reduce((sum, row) => sum + (row.invalid ?? 0), 0),
    totalReactivos: rows.reduce((sum, row) => sum + (row.responseDetails?.length ?? 0), 0),
    reactivosConEstado: rows.reduce((sum, row) => sum + (row.reactivosConEstado ?? 0), 0),
    reactivosSinEstado: rows.reduce((sum, row) => sum + (row.reactivosSinEstado ?? 0), 0),
    coberturaEstados: (() => {
      const total = rows.reduce((sum, row) => sum + (row.responseDetails?.length ?? 0), 0);
      const conEstado = rows.reduce((sum, row) => sum + (row.reactivosConEstado ?? 0), 0);
      return total > 0 ? conEstado / total : 0;
    })(),
    estados: rows.reduce((counts, row) => {
      for (const [estado, count] of Object.entries(row.conteoEstados ?? {})) {
        counts[estado] = (counts[estado] ?? 0) + count;
      }
      return counts;
    }, {}),
    emptyPages: rows.filter((row) => row.emptyExam === true).length,
    probableEmptyPages: rows.filter((row) => row.responseSummary?.examenVacioProbable === true).length,
    known: rows.reduce((sum, row) => sum + (row.known ?? 0), 0),
    knownDetermined: rows.reduce((sum, row) => sum + (row.knownDetermined ?? 0), 0),
    knownAgreement: rows.reduce((sum, row) => sum + (row.knownAgreement ?? 0), 0),
    knownAgreementRateAmongDetermined: (() => {
      const determined = rows.reduce((sum, row) => sum + (row.knownDetermined ?? 0), 0);
      const agreement = rows.reduce((sum, row) => sum + (row.knownAgreement ?? 0), 0);
      return determined ? agreement / determined : null;
    })(),
    observedKnown: rows.reduce((sum, row) => sum + (row.observedKnown ?? 0), 0),
    observedDetermined: rows.reduce((sum, row) => sum + (row.observedDetermined ?? 0), 0),
    observedAgreement: rows.reduce((sum, row) => sum + (row.observedAgreement ?? 0), 0),
    observedAgreementRateAmongDetermined: (() => {
      const determined = rows.reduce((sum, row) => sum + (row.observedDetermined ?? 0), 0);
      const agreement = rows.reduce((sum, row) => sum + (row.observedAgreement ?? 0), 0);
      return determined ? agreement / determined : null;
    })(),
    states: rows.reduce((counts, row) => {
      if (row.estado) counts[row.estado] = (counts[row.estado] ?? 0) + 1;
      return counts;
    }, {}),
    geometryModes: rows.reduce((counts, row) => {
      if (row.geometryMode) counts[row.geometryMode] = (counts[row.geometryMode] ?? 0) + 1;
      return counts;
    }, {}),
    localGeometryPages: rows.filter((row) => row.geometryLocalEnabled).length,
    orientationModes: rows.reduce((counts, row) => {
      if (row.orientationMode) counts[row.orientationMode] = (counts[row.orientationMode] ?? 0) + 1;
      return counts;
    }, {}),
    mappingSources: rows.reduce((counts, row) => {
      if (row.mappingSource) counts[row.mappingSource] = (counts[row.mappingSource] ?? 0) + 1;
      return counts;
    }, {}),
    qrDetected: rows.filter((row) => Boolean(row.qrTextoDetectado)).length,
    qrDirectDetected: rows.filter((row) => Boolean(row.qrTextoDirecto)).length,
    qrGeometryRescueDetected: rows.filter((row) => row.qrGeometryRescueUsed === true).length,
    qrNotDetected: rows.filter((row) => row.qrDetectionMode === 'not_detected').length,
    qrExpectedChecked: rows.filter((row) => Boolean(row.qrTextoEsperado)).length,
    qrMatchedExpected: rows.filter((row) => row.qrCoincideEsperado === true).length,
    qrDirectExpectedChecked: rows.filter((row) => Boolean(row.qrTextoEsperado)).length,
    qrDirectMatchedExpected: rows.filter((row) => row.qrCoincideDirectoEsperado === true).length,
    qrDirectWrongPayload: rows.filter((row) => Boolean(row.qrTextoDirecto) && row.qrCoincideDirectoEsperado !== true).length,
    qrRotatedRescueDetected: rows.filter((row) => row.qrRotationRescueUsed === true).length,
    qrRotatedExpectedChecked: rows.filter((row) => row.qrRotationRescueUsed === true && Boolean(row.qrTextoEsperado)).length,
    qrRotatedMatchedExpected: rows.filter((row) => row.qrCoincideRotadoEsperado === true).length,
    qrRotatedWrongPayload: rows.filter((row) => Boolean(row.qrTextoEsperado) && Boolean(row.qrTextoRotado) && row.qrCoincideRotadoEsperado !== true).length,
    qrDirectDecoderSources: rows.reduce((counts, row) => {
      if (row.qrFuenteDirecta) counts[row.qrFuenteDirecta] = (counts[row.qrFuenteDirecta] ?? 0) + 1;
      return counts;
    }, {}),
    qrAnalysisDecoderSources: rows.reduce((counts, row) => {
      if (row.qrFuenteAnalisis) counts[row.qrFuenteAnalisis] = (counts[row.qrFuenteAnalisis] ?? 0) + 1;
      return counts;
    }, {}),
    pageRotations: rows.reduce((counts, row) => {
      if (Number.isFinite(row.pageRotationDegrees)) {
        const giro = String(row.pageRotationDegrees);
        counts[giro] = (counts[giro] ?? 0) + 1;
      }
      return counts;
    }, {}),
    pageSkew: (() => {
      const angulos = rows.map((row) => row.pageSkewDegrees).filter(Number.isFinite);
      return {
        measuredPages: angulos.length,
        meanAbsoluteDegrees: angulos.length
          ? angulos.reduce((sum, angle) => sum + Math.abs(angle), 0) / angulos.length
          : null,
        maximumAbsoluteDegrees: angulos.length
          ? Math.max(...angulos.map(Math.abs))
          : null
      };
    })(),
    flagCounts: rows.reduce((counts, row) => {
      combinarCounts(counts, row.flags ?? {});
      return counts;
    }, {}),
    errors,
    rows
  };
  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(JSON.stringify({
    outputPath,
    processed: summary.processed,
    skipped: summary.skipped,
    uniqueFolioPages: summary.dataQuality.folioPage.uniquePages,
    uniqueQuestionSlots: summary.dataQuality.question.uniqueQuestionSlots,
    uniqueObservedAgreementRate: summary.dataQuality.question.agreementRateAmongMarkedObserved,
    determined: summary.determined,
    ambiguous: summary.ambiguous,
    keyAgreementRateAmongDetermined: summary.knownAgreementRateAmongDetermined,
    observedAgreementRateAmongDetermined: summary.observedAgreementRateAmongDetermined,
    qr: {
      directDetected: summary.qrDirectDetected,
      geometryRescueDetected: summary.qrGeometryRescueDetected,
      notDetected: summary.qrNotDetected,
      expectedChecked: summary.qrExpectedChecked,
      matchedExpectedAfterRescue: summary.qrMatchedExpected,
      directExpectedChecked: summary.qrDirectExpectedChecked,
      directMatchedExpected: summary.qrDirectMatchedExpected,
      directWrongPayload: summary.qrDirectWrongPayload,
      rotationRescueDetected: summary.qrRotatedRescueDetected,
      rotationRescueMatchedExpected: summary.qrRotatedMatchedExpected,
      rotationRescueWrongPayload: summary.qrRotatedWrongPayload,
      directDecoderSources: summary.qrDirectDecoderSources,
      analysisDecoderSources: summary.qrAnalysisDecoderSources,
      directUniquePages: summary.dataQuality.qrDirectByUniquePage,
      geometryRescueUniquePages: summary.dataQuality.qrGeometryRescueByUniquePage,
      rotationRescueUniquePages: summary.dataQuality.qrRotationRescueByUniquePage
    },
    states: summary.states,
    geometryModes: summary.geometryModes,
    orientationModes: summary.orientationModes,
    localGeometryPages: summary.localGeometryPages,
    errors: summary.errors.length
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
