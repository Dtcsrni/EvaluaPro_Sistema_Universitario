#!/usr/bin/env node
/**
 * run-backend-coverage-batches
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * run-backend-coverage-batches
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * run-backend-coverage-batches
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * run-backend-coverage-batches
 *
 * Responsabilidad: Ejecutar cobertura backend por lotes y aplicar umbrales en el merge global.
 * Limites: No altera la seleccion de tests ni los thresholds definidos por Vitest.
 */
import { execFile as execFileCallback, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { closeSync, openSync, readdirSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const execFile = promisify(execFileCallback);
const backendDir = path.join(rootDir, 'apps', 'backend');
const reportsRootDir = path.join(backendDir, '.vitest-reports');
const reportsDir = path.join(
  reportsRootDir,
  process.env.BACKEND_COVERAGE_REPORTS_DIR || `backend-coverage-batches-run-${process.pid}-${Date.now()}`
);
const logsDir = path.join(reportsRootDir, 'backend-coverage-logs');
const vitestEntry = path.join(rootDir, 'node_modules', 'vitest', 'vitest.mjs');
const batchAttempts = 3;
const defaultBatchConcurrency = getDefaultBatchConcurrency({
  totalMemoryBytes: os.totalmem(),
  logicalCpus: os.availableParallelism?.() ?? os.cpus().length
});
const maximumBatchConcurrency = 4;
function getDefaultBatchConcurrency({ totalMemoryBytes, logicalCpus }) {
  const minimumMemoryBytes = 12 * 1024 ** 3;
  return Number.isFinite(totalMemoryBytes) && totalMemoryBytes >= minimumMemoryBytes
    && Number.isInteger(logicalCpus) && logicalCpus >= 4
    ? 3
    : 2;
}
function resolveBatchConcurrency(value, fallback = defaultBatchConcurrency) {
  if (value == null || String(value).trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximumBatchConcurrency) {
    throw new RangeError(`BACKEND_COVERAGE_BATCH_CONCURRENCY debe ser un entero entre 1 y ${maximumBatchConcurrency}`);
  }
  return parsed;
}
const batchConcurrency = resolveBatchConcurrency(process.env.BACKEND_COVERAGE_BATCH_CONCURRENCY);
// Los E2E de flujo docente/OMR instrumentan mucho código y no deben compartir
// memoria con otros escenarios. Los lotes pequeños hacen el gate reproducible
// y permiten identificar el caso lento sin perder ninguna prueba.
const integrationChunkSize = 4;
const batchTimeoutMs = Number(process.env.BACKEND_COVERAGE_BATCH_TIMEOUT_MS || 8 * 60 * 1000);
const failureExcerptLineLimit = 50;
const failureExcerptLineLengthLimit = 1200;

const zeroThresholdArgs = [
  '--coverage.thresholds.lines=0',
  '--coverage.thresholds.functions=0',
  '--coverage.thresholds.branches=0',
  '--coverage.thresholds.statements=0'
];

const integrationFilesAM = [
  'tests/integracion/alumnosEdicion.test.ts',
  'tests/integracion/archivarExamenGenerado.test.ts',
  'tests/integracion/asistencia.reglas.test.ts',
  'tests/integracion/autenticacion.googleOnly.test.ts',
  'tests/integracion/autenticacion.recuperacion.test.ts',
  'tests/integracion/autenticacionSesion.test.ts',
  'tests/integracion/autorizacion.test.ts',
  'tests/integracion/bancoPreguntasAsignarMateria.test.ts',
  'tests/integracion/calificacionGlobalContratoE2E.test.ts',
  'tests/integracion/calificacionOmrPrioridad.test.ts',
  'tests/integracion/classroom.audit.test.ts',
  'tests/integracion/classroom.pull.test.ts',
  'tests/integracion/classroom.v2.test.ts',
  'tests/integracion/comercial.webhook.mercadopago.firma.test.ts',
  'tests/integracion/compliance.arco.test.ts',
  'tests/integracion/encuadre.modulo.test.ts',
  'tests/integracion/evaluaciones.modulo.test.ts',
  'tests/integracion/examenesRetention.test.ts',
  'tests/integracion/flujoDocenteAlumnoProduccionLikeE2E.test.ts'
];

const integrationFilesNZ = [
  'tests/integracion/flujoDocenteGlobalE2E.test.ts',
  'tests/integracion/flujoDocenteParcialE2E.test.ts',
  'tests/integracion/flujoExamen.test.ts',
  'tests/integracion/hidratacionCursos.test.ts',
  'tests/integracion/listaAcademicaContratos.test.ts',
  'tests/integracion/omrJobsWorkflow.test.ts',
  'tests/integracion/pdfImpresionContrato.test.ts',
  'tests/integracion/periodosBorradoDuplicados.test.ts',
  'tests/integracion/plantillasCrudYPreview.test.ts',
  'tests/integracion/plantillasDuplicadas.test.ts',
  'tests/integracion/qrEscaneoOmr.test.ts',
  'tests/integracion/recoveryBundleGeneracion.test.ts',
  'tests/integracion/recuperacionExamenes.test.ts',
  'tests/integracion/regenerarExamenGenerado.test.ts',
  'tests/integracion/rolesPermisos.test.ts',
  'tests/integracion/temario.pdf.test.ts',
  'tests/integracion/versionadoApiV2Contratos.test.ts'
];

// Mantener lotes pequeños evita que Vitest instrumente toda la suite raíz en
// un único proceso y deja identificar el grupo que exceda tiempo/memoria.
function listRootCoverageFiles() {
  const rootTests = readdirSync(path.join(backendDir, 'tests'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts') && entry.name !== 'calificacion.omr.payload.test.ts')
    .map((entry) => `tests/${entry.name}`);
  const nestedTests = readdirSync(path.join(backendDir, 'tests', 'contrato'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
    .map((entry) => `tests/contrato/${entry.name}`);
  const utilityTests = readdirSync(path.join(backendDir, 'tests', 'utils'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
    .map((entry) => `tests/utils/${entry.name}`);
  return [...rootTests, ...nestedTests, ...utilityTests].sort();
}

function buildRootCoverageBatches() {
  const files = listRootCoverageFiles();
  const batches = [];
  let index = 0;
  while (index < files.length) {
    const current = files[index];
    const chunkSize = current.includes('/omr.') || current.includes('sincronizacion.dos-equipos.e2e.test.ts') ? 1 : 4;
    const name = `backend-root-${String(batches.length + 1).padStart(2, '0')}`;
    batches.push({ name, args: batchArgs(name, files.slice(index, index + chunkSize)) });
    index += chunkSize;
  }
  return batches;
}

function buildChangedCoverageArgs(baseRef) {
  const normalizedBaseRef = String(baseRef ?? '').trim();
  if (!normalizedBaseRef || normalizedBaseRef.startsWith('-')) {
    throw new TypeError('BACKEND_COVERAGE_CHANGED_FROM debe ser una referencia Git válida');
  }
  return [
    'vitest',
    'run',
    '--coverage',
    `--changed=${normalizedBaseRef}`,
    '--pool=forks',
    '--reporter=default',
    ...zeroThresholdArgs
  ];
}

const focusedCoverageProfiles = new Map([
  ['apps/backend/src/modulos/modulo_escaneo_omr/controladorEscaneoOmr.ts', {
    tests: ['tests/omr.prevalidacion.test.ts'],
    include: 'src/modulos/modulo_escaneo_omr/controladorEscaneoOmr.ts'
  }],
  ['apps/backend/src/infraestructura/baseDatos/sqlite.ts', {
    tests: ['tests/integracion/periodosPortada.test.ts'],
    include: 'src/infraestructura/baseDatos/sqlite.ts'
  }],
  ['apps/backend/src/modulos/modulo_autenticacion/controladorAutenticacion.ts', {
    tests: ['tests/integracion/autenticacion.googleOnly.test.ts'],
    include: 'src/modulos/modulo_autenticacion/controladorAutenticacion.ts'
  }],
  ['apps/backend/src/modulos/modulo_autenticacion/servicioGoogle.ts', {
    tests: ['tests/servicioGoogle.test.ts'],
    include: 'src/modulos/modulo_autenticacion/servicioGoogle.ts'
  }]
]);

function buildFocusedCoverageArgsForFiles(files) {
  const normalizedFiles = [...new Set(files.map((file) => String(file).replaceAll(String.fromCharCode(92), '/')))];
  if (normalizedFiles.length === 0) return null;

  const profiles = normalizedFiles.map((file) => focusedCoverageProfiles.get(file));
  if (profiles.some((profile) => !profile)) return null;

  const tests = [...new Set(profiles.flatMap((profile) => profile.tests))];
  const includes = [...new Set(profiles.map((profile) => profile.include))];
  return [
    'vitest',
    'run',
    '--coverage',
    ...tests,
    ...includes.map((include) => `--coverage.include=${include}`),
    '--pool=forks',
    '--reporter=default',
    ...zeroThresholdArgs
  ];
}

function buildDifferentialCoveragePlan(changedFrom, changedFiles) {
  if (!String(changedFrom ?? '').trim()) throw new Error('referencia Git válida requerida para cobertura diferencial');
  if (!Array.isArray(changedFiles)) throw new TypeError('changedFiles debe ser un arreglo');
  if (changedFiles.length === 0) {
    return { mode: 'sin-fuentes-backend', args: null, skipReason: 'no-backend-source-files' };
  }

  const focusedArgs = buildFocusedCoverageArgsForFiles(changedFiles);
  const args = focusedArgs ?? buildChangedCoverageArgs(changedFrom);
  return {
    mode: args.includes('--changed=' + changedFrom) ? 'diferencial por dependencias' : 'diferencial enfocado',
    args,
    skipReason: null
  };
}

async function resolveChangedSourceFiles(baseRef) {
  const { stdout } = await execFile(
    'git',
    ['diff', '--name-only', `${baseRef}...HEAD`, '--', 'apps/backend/src'],
    { cwd: rootDir, windowsHide: true, maxBuffer: 20 * 1024 * 1024 }
  );
  return stdout.split(String.fromCharCode(10)).map((file) => file.trim()).filter(Boolean);
}

function batchArgs(name, filters) {
  const pool = filters.some((filter) => String(filter).includes('sincronizacion.dos-equipos.e2e.test.ts'))
    ? '--pool=threads'
    : '--pool=forks';
  return [
    'vitest',
    'run',
    '--coverage',
    ...filters,
    pool,
    '--reporter=default',
    '--reporter=blob',
    `--outputFile.blob=${path.join('.vitest-reports', 'backend-coverage-batches', `${name}.blob.json`)}`,
    ...zeroThresholdArgs,
    `--coverage.reportsDirectory=${path.join('coverage', 'backend-coverage-batches', name)}`
  ];
}

function formatFailureExcerpt(log, lineLimit = failureExcerptLineLimit, lineLengthLimit = failureExcerptLineLengthLimit) {
  const lines = String(log).split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.slice(-lineLimit).map((line) => line.slice(0, lineLengthLimit)).join('\n');
}

function chunkFiles(namePrefix, files, size = integrationChunkSize) {
  const batches = [];

  for (let index = 0; index < files.length;) {
    const current = files[index];
    const isolated = /flujoDocente(Global|Parcial)E2E|qrEscaneoOmr|pdfImpresionContrato|recoveryBundleGeneracion|recuperacionExamenes/.test(current);
    const chunkSize = isolated ? 1 : size;
    const chunk = files.slice(index, index + chunkSize);
    const suffix = String(batches.length + 1).padStart(2, '0');
    const name = `${namePrefix}-${suffix}`;
    batches.push({
      name,
      args: batchArgs(name, chunk)
    });
    index += chunkSize;
  }

  return batches;
}

function buildCoveragePlan() {
  return {
    batches: [
      ...buildRootCoverageBatches(),
      {
        name: 'backend-calificacion-omr-payload',
        args: batchArgs('backend-calificacion-omr-payload', ['tests/calificacion.omr.payload.test.ts'])
      },
      ...chunkFiles('backend-integracion-a-m', integrationFilesAM),
      ...chunkFiles('backend-integracion-n-z', integrationFilesNZ),
      {
        name: 'backend-aislamiento',
        args: batchArgs('backend-aislamiento', ['tests/integracion/aislamientoDocente.test.ts'])
      }
    ],
    merge: {
      name: 'backend-merge',
      args: [
        'vitest',
        `--merge-reports=${path.join('.vitest-reports', 'backend-coverage-batches')}`,
        '--reporter=default',
        '--coverage'
      ]
    }
  };
}

function runVitest(args, name) {
  return new Promise((resolve) => {
    process.stdout.write(`[backend-coverage] ${name}\n`);
    const [, ...vitestArgs] = args;
    const logFd = openSync(path.join(logsDir, `${name.replace(/[^a-z0-9_-]+/gi, '_')}.log`), 'a');
    const child = spawn(process.execPath, [vitestEntry, ...vitestArgs], {
      cwd: backendDir,
      env: process.env,
      stdio: ['ignore', logFd, logFd]
    });

    let finalizado = false;
    const timeout = setTimeout(() => {
      if (finalizado) return;
      finalizado = true;
      process.stderr.write(`[backend-coverage] timeout ${name} tras ${batchTimeoutMs} ms\n`);
      if (process.platform === 'win32' && child.pid) {
        spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 5000).unref();
      }
      closeSync(logFd);
      resolve(124);
    }, batchTimeoutMs);

    child.on('error', () => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(timeout);
      closeSync(logFd);
      resolve(1);
    });
    child.on('close', (code) => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(timeout);
      closeSync(logFd);
      resolve(typeof code === 'number' ? code : 1);
    });
  });
}

async function prepareRun() {
  await fs.rm(reportsDir, { recursive: true, force: true });
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });
  await fs.mkdir(path.join(backendDir, 'coverage', '.tmp'), { recursive: true });
}

async function cleanBatchArtifacts(name) {
  await fs.rm(path.join(reportsDir, `${name}.blob.json`), { force: true });
  await fs.rm(path.join(backendDir, 'coverage', 'backend-coverage-batches', name), {
    recursive: true,
    force: true
  });
}

async function emitFailureExcerpt(batchName, attempt, logFileName = null) {
  const attemptLabel = `${batchName} ${attempt}/${batchAttempts}`;
  const logPath = path.join(logsDir, logFileName ?? `${attemptLabel.replace(/[^a-z0-9_-]+/gi, '_')}.log`);
  try {
    const log = await fs.readFile(logPath, 'utf8');
    const excerpt = formatFailureExcerpt(log);
    if (excerpt) process.stderr.write(`[backend-coverage] salida de ${attemptLabel} (ultimas ${failureExcerptLineLimit} lineas):\n${excerpt}\n`);
  } catch (error) {
    process.stderr.write(`[backend-coverage] no se pudo leer el log de ${attemptLabel}: ${String(error?.message || error)}\n`);
  }
}

async function runBatch(batch) {
  for (let attempt = 1; attempt <= batchAttempts; attempt += 1) {
    await cleanBatchArtifacts(batch.name);
    const code = await runVitest(batch.args, `${batch.name} ${attempt}/${batchAttempts}`);
    if (code === 0) return 0;

    if (attempt < batchAttempts) {
      process.stderr.write(`[backend-coverage] retry ${batch.name} tras exit ${code}\n`);
      continue;
    }

    await emitFailureExcerpt(batch.name, attempt);
    return code;
  }

  return 1;
}

async function runBatches(batches, concurrency, executeBatch = runBatch) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > maximumBatchConcurrency) {
    throw new RangeError(`concurrency debe ser un entero entre 1 y ${maximumBatchConcurrency}`);
  }
  let nextIndex = 0;
  let failureCode = 0;
  const results = new Array(batches.length);
  const worker = async () => {
    while (failureCode === 0) {
      const index = nextIndex++;
      const batch = batches[index];
      if (!batch) return;
      const startedAt = Date.now();
      const code = await executeBatch(batch);
      results[index] = { name: batch.name, exitCode: code, durationMs: Date.now() - startedAt };
      if (code !== 0) failureCode = code;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, () => worker()));
  return { exitCode: failureCode, results: results.filter(Boolean) };
}

async function main() {
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  await prepareRun();
  const changedFrom = process.env.BACKEND_COVERAGE_CHANGED_FROM?.trim();
  if (changedFrom) {
    const changedFiles = await resolveChangedSourceFiles(changedFrom);
    const coveragePlan = buildDifferentialCoveragePlan(changedFrom, changedFiles);
    const { args, mode, skipReason } = coveragePlan;
    process.stdout.write(`[backend-coverage] modo ${mode}; base=${changedFrom}; fuentes=${changedFiles.length}\n`);
    if (skipReason) {
      await fs.writeFile(path.join(reportsDir, 'run-summary.json'), JSON.stringify({
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAtMs,
        changedFrom,
        changedFiles,
        mode,
        skipped: true,
        skipReason,
        results: [],
        failed: false,
        failureStage: null
      }, null, 2));
      process.exit(0);
    }
    const code = await runVitest(args, 'backend-changed');
    if (code !== 0) await emitFailureExcerpt('backend-changed', 1, 'backend-changed.log');
    await fs.writeFile(path.join(reportsDir, 'run-summary.json'), JSON.stringify({
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      changedFrom,
      changedFiles,
      mode,
      failureLog: path.relative(rootDir, path.join(logsDir, 'backend-changed.log')).replaceAll(path.sep, '/'),
      results: [{ name: 'backend-changed', exitCode: code, durationMs: Date.now() - startedAtMs }],
      failed: code !== 0,
      failureStage: code === 0 ? null : 'changed-coverage'
    }, null, 2));
    process.exit(code);
  }

  const plan = buildCoveragePlan();
  process.stdout.write(`[backend-coverage] concurrencia=${batchConcurrency}; lotes=${plan.batches.length}\n`);
  const batches = await runBatches(plan.batches, batchConcurrency);
  if (batches.exitCode !== 0) {
    const failedBatch = batches.results.find(({ exitCode }) => exitCode !== 0);
    await fs.writeFile(path.join(reportsDir, 'run-summary.json'), JSON.stringify({
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      concurrency: batchConcurrency,
      resources: {
        logicalCpus: os.availableParallelism?.() ?? os.cpus().length,
        totalMemoryBytes: os.totalmem()
      },
      results: batches.results,
      failed: true,
      failureStage: 'batch',
      failedBatch: failedBatch?.name ?? null,
      failureExitCode: failedBatch?.exitCode ?? null
    }, null, 2));
    process.exit(batches.exitCode);
  }
  const mergeCode = await runVitest(plan.merge.args, plan.merge.name);
  await fs.writeFile(path.join(reportsDir, 'run-summary.json'), JSON.stringify({
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAtMs,
    concurrency: batchConcurrency,
    resources: {
      logicalCpus: os.availableParallelism?.() ?? os.cpus().length,
      totalMemoryBytes: os.totalmem()
    },
    results: batches.results,
    mergeExitCode: mergeCode,
    failed: mergeCode !== 0,
    failureStage: mergeCode === 0 ? null : 'merge'
  }, null, 2));
  process.exit(mergeCode);
}

export { buildChangedCoverageArgs, buildCoveragePlan, buildDifferentialCoveragePlan, buildFocusedCoverageArgsForFiles, formatFailureExcerpt, getDefaultBatchConcurrency, resolveBatchConcurrency, runBatches };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[backend-coverage] ERROR: ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
