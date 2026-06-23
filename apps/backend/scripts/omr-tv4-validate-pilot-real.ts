/**
 * omr-tv4-validate-pilot-real
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr';
import { evaluarAutoCalificableOmr } from '../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr';
import type {
  CaptureManifestPorFolio,
  GroundTruthRowPorFolio,
  MapaOmrPaginaPorFolio
} from '../src/modulos/modulo_escaneo_omr/porFolioDataset';

type EstadoAnalisisOmr = 'ok' | 'rechazado_calidad' | 'requiere_revision';

type EvalThresholds = {
  precisionMin: number;
  falsePositiveMax: number;
  invalidDetectionMin: number;
  pagePassMin: number;
  autoGradeTrustMin: number;
  autoCoverageMin: number;
};

type ManifestDataset = {
  version: string;
  datasetType: string;
  thresholds: EvalThresholds;
  groundTruthRef: string;
  capturas: CaptureManifestPorFolio[];
};

type Args = {
  dataset: string;
  report: string;
  failureReport: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dataset: '../../omr_samples_tv4_pilot_real',
    report: '../../reports/qa/latest/omr/tv4-pilot-real-validation.json',
    failureReport: '../../reports/qa/latest/omr/tv4-pilot-real-failures.json'
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if ((key === '--dataset' || key === '-d') && value) {
      args.dataset = value;
      i += 1;
      continue;
    }
    if ((key === '--report' || key === '-r') && value) {
      args.report = value;
      i += 1;
      continue;
    }
    if (key === '--failure-report' && value) {
      args.failureReport = value;
      i += 1;
    }
  }
  return args;
}

async function readJsonFile<T>(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

async function readGroundTruth(filePath: string) {
  return (await fs.readFile(filePath, 'utf8'))
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GroundTruthRowPorFolio);
}

function imageToDataUrl(imagePath: string, fileBuffer: Buffer) {
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${fileBuffer.toString('base64')}`;
}

function round6(value: number) {
  return Number(value.toFixed(6));
}

function isResolvedDetection(current?: { opcion: string | null; flags: string[]; confianza: number }) {
  if (!current) return false;
  if (current.opcion) return true;
  if (current.flags.includes('bajo_contraste')) return false;
  if (current.flags.includes('doble_marca')) return current.confianza >= 0.62;
  return current.confianza >= 0.62;
}

function groupTruth(rows: GroundTruthRowPorFolio[]) {
  const grouped = new Map<string, Map<number, GroundTruthRowPorFolio>>();
  for (const row of rows) {
    if (!grouped.has(row.captureId)) grouped.set(row.captureId, new Map<number, GroundTruthRowPorFolio>());
    grouped.get(row.captureId)!.set(row.numeroPregunta, row);
  }
  return grouped;
}

function bump(counter: Map<string, number>, key: string) {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

export async function runTv4PilotRealValidation(args: {
  datasetRoot: string;
  reportPath: string;
  failureReportPath: string;
}) {
  const datasetRoot = path.resolve(process.cwd(), args.datasetRoot);
  const reportPath = path.resolve(process.cwd(), args.reportPath);
  const failureReportPath = path.resolve(process.cwd(), args.failureReportPath);
  const manifest = await readJsonFile<ManifestDataset>(path.join(datasetRoot, 'manifest.json'));
  if (!Array.isArray(manifest.capturas) || manifest.capturas.length === 0) {
    throw new Error('El dataset piloto real TV4 no contiene capturas. Ejecuta primero el armado del piloto real.');
  }
  const truthRows = await readGroundTruth(path.join(datasetRoot, manifest.groundTruthRef));
  const truthByCapture = groupTruth(truthRows);

  let tp = 0;
  let fp = 0;
  let invalidTotal = 0;
  let invalidDetected = 0;
  let pagePassCount = 0;
  let autoPages = 0;
  let autoPagesPassing = 0;
  let totalPreguntasEvaluadas = 0;
  let totalCaptures = 0;

  const estadoCounts: Record<EstadoAnalisisOmr, number> = {
    ok: 0,
    requiere_revision: 0,
    rechazado_calidad: 0
  };
  const causeCounts = new Map<string, number>();
  const errorTypeCounts = new Map<string, number>();
  const byFolio = new Map<string, { captures: number; mismatches: number; pagesOk: number }>();
  const byPage = new Map<string, { captures: number; mismatches: number; pagesOk: number }>();
  const perCapture: Array<{
    captureId: string;
    folio: string;
    numeroPagina: number;
    estadoAnalisis: EstadoAnalisisOmr;
    calidadPagina: number;
    confianzaPromedioPagina: number;
    ratioAmbiguas: number;
    coberturaDeteccion: number;
    autoCalificable: boolean;
    mismatches: number;
    totalPreguntas: number;
    pagePass: boolean;
  }> = [];

  for (const capture of manifest.capturas) {
    const expected = truthByCapture.get(capture.captureId);
    if (!expected) throw new Error(`No hay truth para ${capture.captureId}`);
    const mapPage = await readJsonFile<MapaOmrPaginaPorFolio>(path.join(datasetRoot, capture.mapaOmrPath));
    const imageBuffer = await fs.readFile(path.join(datasetRoot, capture.imagePath));
    const result = await analizarOmr(
      imageToDataUrl(capture.imagePath, imageBuffer),
      mapPage,
      [capture.expectedQr, capture.folio, `EXAMEN:${capture.folio}:P${capture.numeroPagina}:TV4`],
      10,
      {
        folio: capture.folio,
        numeroPagina: capture.numeroPagina,
        templateVersionDetectada: 4
      }
    );

    totalCaptures += 1;
    estadoCounts[result.estadoAnalisis] += 1;

    const detected = new Map<number, { opcion: string | null; flags: string[]; confianza: number }>();
    const captureCauseTokens: string[] = [];
    for (const respuesta of result.respuestasDetectadas) {
      detected.set(respuesta.numeroPregunta, {
        opcion: respuesta.opcion,
        flags: respuesta.flags,
        confianza: Number(respuesta.confianza ?? 0)
      });
      for (const flag of respuesta.flags) captureCauseTokens.push(`flag:${flag}`);
    }

    let mismatches = 0;
    let respuestasResueltas = 0;
    for (const [questionNumber, row] of expected.entries()) {
      const current = detected.get(questionNumber);
      const detectedOption = (current?.opcion as string | null | undefined) ?? null;
      const selected = row.selectedOptions ?? [];
      totalPreguntasEvaluadas += 1;
      if (isResolvedDetection(current)) respuestasResueltas += 1;

      if (row.markType === 'double' || row.markType === 'smudge') {
        invalidTotal += 1;
        if (detectedOption === null) invalidDetected += 1;
      }

      if (row.markType === 'valid' && detectedOption === row.opcionEsperada) {
        tp += 1;
        continue;
      }
      if (row.markType === 'blank' && detectedOption === null) continue;
      if ((row.markType === 'double' || row.markType === 'smudge') && detectedOption === null) continue;

      mismatches += 1;
      if (row.markType === 'valid' && detectedOption === null) {
        bump(errorTypeCounts, 'missed_mark');
      } else if ((row.markType === 'blank' || row.markType === 'double' || row.markType === 'smudge') && detectedOption) {
        fp += 1;
        bump(errorTypeCounts, 'false_positive');
      } else if (row.markType === 'valid' && detectedOption && !selected.includes(detectedOption as never)) {
        fp += 1;
        bump(errorTypeCounts, 'wrong_option');
      } else {
        bump(errorTypeCounts, 'other');
      }
    }

    const totalPreguntas = expected.size;
    const coberturaDeteccion = totalPreguntas > 0 ? respuestasResueltas / totalPreguntas : 0;
    const auto = evaluarAutoCalificableOmr({
      estadoAnalisis: result.estadoAnalisis,
      calidadPagina: result.calidadPagina,
      confianzaPromedioPagina: result.confianzaPromedioPagina,
      ratioAmbiguas: result.ratioAmbiguas,
      coberturaDeteccion
    });

    const pagePass = mismatches === 0 && result.estadoAnalisis === 'ok';
    if (!pagePass) {
      for (const warning of result.advertencias) captureCauseTokens.push(`warning:${warning}`);
      for (const motivo of result.motivosRevision) captureCauseTokens.push(`motivo:${motivo}`);
      for (const token of captureCauseTokens) bump(causeCounts, token);
    }
    if (pagePass) pagePassCount += 1;
    if (auto.autoCalificableOmr) {
      autoPages += 1;
      if (pagePass) autoPagesPassing += 1;
    }

    const folioKey = capture.folio;
    const pageKey = `${capture.folio}:P${capture.numeroPagina}`;
    if (!byFolio.has(folioKey)) byFolio.set(folioKey, { captures: 0, mismatches: 0, pagesOk: 0 });
    if (!byPage.has(pageKey)) byPage.set(pageKey, { captures: 0, mismatches: 0, pagesOk: 0 });
    const folioBucket = byFolio.get(folioKey)!;
    folioBucket.captures += 1;
    folioBucket.mismatches += mismatches;
    if (pagePass) folioBucket.pagesOk += 1;
    const pageBucket = byPage.get(pageKey)!;
    pageBucket.captures += 1;
    pageBucket.mismatches += mismatches;
    if (pagePass) pageBucket.pagesOk += 1;

    perCapture.push({
      captureId: capture.captureId,
      folio: capture.folio,
      numeroPagina: capture.numeroPagina,
      estadoAnalisis: result.estadoAnalisis,
      calidadPagina: round6(result.calidadPagina),
      confianzaPromedioPagina: round6(result.confianzaPromedioPagina),
      ratioAmbiguas: round6(result.ratioAmbiguas),
      coberturaDeteccion: round6(coberturaDeteccion),
      autoCalificable: auto.autoCalificableOmr,
      mismatches,
      totalPreguntas,
      pagePass
    });
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const falsePositiveRate = totalPreguntasEvaluadas > 0 ? fp / totalPreguntasEvaluadas : 0;
  const invalidDetectionRate = invalidTotal > 0 ? invalidDetected / invalidTotal : 1;
  const pagePassRate = totalCaptures > 0 ? pagePassCount / totalCaptures : 0;
  const autoGradeTrustRate = autoPages > 0 ? autoPagesPassing / autoPages : 0;
  const autoCoverageRate = totalCaptures > 0 ? autoPages / totalCaptures : 1;
  const capturePassRate = pagePassRate;
  const checks = {
    precision: precision >= manifest.thresholds.precisionMin,
    falsePositiveRate: falsePositiveRate <= manifest.thresholds.falsePositiveMax,
    invalidDetectionRate: invalidDetectionRate >= manifest.thresholds.invalidDetectionMin,
    pagePassRate: pagePassRate >= manifest.thresholds.pagePassMin,
    autoGradeTrustRate: autoGradeTrustRate >= manifest.thresholds.autoGradeTrustMin,
    autoCoverageRate: autoCoverageRate >= manifest.thresholds.autoCoverageMin
  };
  const ok = Object.values(checks).every(Boolean);
  const runId = `omr-tv4-pilot-real-${Date.now()}`;
  const report = {
    runId,
    timestamp: new Date().toISOString(),
    datasetRoot,
    datasetType: manifest.datasetType,
    thresholds: manifest.thresholds,
    metrics: {
      precision: round6(precision),
      falsePositiveRate: round6(falsePositiveRate),
      invalidDetectionRate: round6(invalidDetectionRate),
      pagePassRate: round6(pagePassRate),
      autoGradeTrustRate: round6(autoGradeTrustRate),
      autoCoverageRate: round6(autoCoverageRate),
      capturePassRate: round6(capturePassRate),
      totalCaptures,
      totalPreguntasEvaluadas
    },
    checks,
    ok,
    perCapture
  };
  const failures = {
    runId,
    timestamp: new Date().toISOString(),
    datasetRoot,
    topCauses: [...causeCounts.entries()]
      .map(([causa, total]) => ({ causa, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 40),
    topCaptures: [...perCapture]
      .filter((capture) => capture.mismatches > 0 || capture.estadoAnalisis !== 'ok')
      .sort((a, b) => b.mismatches - a.mismatches || a.captureId.localeCompare(b.captureId))
      .slice(0, 40),
    byEstadoAnalisis: estadoCounts,
    byFolio: Object.fromEntries([...byFolio.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    byPagina: Object.fromEntries([...byPage.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    byTipoError: Object.fromEntries([...errorTypeCounts.entries()].sort((a, b) => b[1] - a[1]))
  };

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.mkdir(path.dirname(failureReportPath), { recursive: true });
  await fs.writeFile(failureReportPath, `${JSON.stringify(failures, null, 2)}\n`, 'utf8');

  return { report, failures };
}

async function main() {
  const args = parseArgs(process.argv);
  const { report } = await runTv4PilotRealValidation({
    datasetRoot: args.dataset,
    reportPath: args.report,
    failureReportPath: args.failureReport
  });
  process.stdout.write(`${JSON.stringify({ ok: report.ok, metrics: report.metrics, checks: report.checks })}\n`);
  if (!report.ok) process.exit(1);
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
    process.exit(1);
  });
}
