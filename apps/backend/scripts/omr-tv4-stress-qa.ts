/**
 * Perfil adversarial reproducible para el renderer y el detector OMR TV4.
 * No sustituye capturas impresas: descubre regresiones bajo degradaciones
 * controladas más severas que el perfil móvil canónico, pero todavía útiles
 * para una captura de cámara razonable.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { evaluateSyntheticTv4Dataset, generateSyntheticTv4Dataset } from './omr-tv4-synthetic-lib.js';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr.js';

const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-omr-stress-'));
const reportPath = path.join(temporaryRoot, 'reports', 'stress-eval.json');
const conservarArtefactos = process.env.OMR_STRESS_KEEP_ARTIFACTS === '1';
let passed = false;

try {
  await generateSyntheticTv4Dataset({
    datasetRoot: temporaryRoot,
    variants: 6,
    seed: 20260909,
    rasterDpi: 120,
    affineShearMax: 0.01,
    noise: {
      rotationDegMax: 1.2,
      blurSigmaMax: 0.55,
      brightnessMin: 0.9,
      brightnessMax: 1.1,
      contrastMin: 0.88,
      contrastMax: 1.12,
      jpegQualityMin: 80,
      jpegQualityMax: 92,
      shadowOpacityMax: 0.12
    }
  });

  const report = await evaluateSyntheticTv4Dataset({
    datasetRoot: temporaryRoot,
    reportPath,
    thresholds: {
      precisionMin: 0.95,
      falsePositiveMax: 0.02,
      invalidDetectionMin: 0.8,
      pagePassMin: 0.8
    }
  });

  const diagnostics = [];
  for (const captureId of ['TV4-SYNTH-001-P1', 'TV4-SYNTH-003-P1']) {
    const mapPath = path.join(temporaryRoot, 'maps', `${captureId}.json`);
    const imagePath = path.join(temporaryRoot, 'images', `${captureId}.jpg`);
    const mapa = JSON.parse(await fs.readFile(mapPath, 'utf8')) as { qr?: { texto?: string } };
    const image = await fs.readFile(imagePath);
    const result = await analizarOmr(
      `data:image/jpeg;base64,${image.toString('base64')}`,
      mapa as never,
      mapa.qr?.texto,
      10,
      {
        folio: captureId,
        numeroPagina: 1,
        templateVersionDetectada: 4
      },
      captureId
    );
    diagnostics.push({
      captureId,
      calidadPagina: result.calidadPagina,
      geomQuality: result.geomQuality,
      photoQuality: result.photoQuality,
      estadoAnalisis: result.estadoAnalisis,
      qrTexto: result.qrTexto,
      advertencias: result.advertencias,
      motivosRevision: result.motivosRevision,
      respuestas: result.respuestasDetectadas.map((respuesta) => ({
        numeroPregunta: respuesta.numeroPregunta,
        opcion: respuesta.opcion,
        confianza: respuesta.confianza,
        flags: respuesta.flags
      }))
    });
  }

  process.stdout.write(`${JSON.stringify({
    ok: report.ok,
    metrics: report.metrics,
    checks: report.checks,
    errors: report.errors,
    diagnostics,
    perCapture: report.perCapture.map((capture) => ({
      captureId: capture.captureId,
      mismatches: capture.mismatches,
      expectedScore: capture.expectedScore,
      detectedScore: capture.detectedScore,
      pagePass: capture.pagePass,
      estadoAnalisis: capture.estadoAnalisis
    })),
    reportPath: '<temporary-cleaned-after-run>'
  }, null, 2)}\n`);

  if (!report.ok) {
    process.stderr.write(`stress-artifacts-preserved=${temporaryRoot}\n`);
    throw new Error('El perfil adversarial OMR no cumplio sus umbrales.');
  }
  passed = true;
} finally {
  if (conservarArtefactos) {
    process.stderr.write(`stress-artifacts-kept=${temporaryRoot}\n`);
  } else if (passed) {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}
