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
 * Responsabilidad: Ejecutar cobertura backend por lotes y aplicar umbrales en el merge global.
 * Limites: No altera la seleccion de tests ni los thresholds definidos por Vitest.
 */
import { spawn } from 'node:child_process';
import { closeSync, openSync, readdirSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const backendDir = path.join(rootDir, 'apps', 'backend');
const reportsDir = path.join(backendDir, '.vitest-reports', 'backend-coverage-batches');
const logsDir = path.join(backendDir, '.vitest-reports', 'backend-coverage-logs');
const vitestEntry = path.join(rootDir, 'node_modules', 'vitest', 'vitest.mjs');
const batchAttempts = 3;
const batchConcurrency = 2;
// Los E2E de flujo docente/OMR instrumentan mucho código y no deben compartir
// memoria con otros escenarios. Los lotes pequeños hacen el gate reproducible
// y permiten identificar el caso lento sin perder ninguna prueba.
const integrationChunkSize = 4;
const batchTimeoutMs = Number(process.env.BACKEND_COVERAGE_BATCH_TIMEOUT_MS || 8 * 60 * 1000);

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
  'tests/integracion/omrV1Workflow.test.ts',
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
    const chunkSize = current.includes('/omr.') ? 1 : 4;
    const name = `backend-root-${String(batches.length + 1).padStart(2, '0')}`;
    batches.push({ name, args: batchArgs(name, files.slice(index, index + chunkSize)) });
    index += chunkSize;
  }
  return batches;
}

function batchArgs(name, filters) {
  return [
    'vitest',
    'run',
    '--coverage',
    ...filters,
    '--reporter=default',
    '--reporter=blob',
    `--outputFile.blob=${path.join('.vitest-reports', 'backend-coverage-batches', `${name}.blob.json`)}`,
    ...zeroThresholdArgs,
    `--coverage.reportsDirectory=${path.join('coverage', 'backend-coverage-batches', name)}`
  ];
}

function chunkFiles(namePrefix, files, size = integrationChunkSize) {
  const batches = [];

  for (let index = 0; index < files.length;) {
    const current = files[index];
    const isolated = /flujoDocente(Global|Parcial)E2E|omrV1Workflow|qrEscaneoOmr|pdfImpresionContrato|recoveryBundleGeneracion|recuperacionExamenes/.test(current);
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

async function runBatch(batch) {
  for (let attempt = 1; attempt <= batchAttempts; attempt += 1) {
    await cleanBatchArtifacts(batch.name);
    const code = await runVitest(batch.args, `${batch.name} ${attempt}/${batchAttempts}`);
    if (code === 0) return 0;

    if (attempt < batchAttempts) {
      process.stderr.write(`[backend-coverage] retry ${batch.name} tras exit ${code}\n`);
      continue;
    }

    return code;
  }

  return 1;
}

async function main() {
  const plan = buildCoveragePlan();
  await prepareRun();

  for (let index = 0; index < plan.batches.length; index += batchConcurrency) {
    const wave = plan.batches.slice(index, index + batchConcurrency);
    const results = await Promise.all(wave.map((batch) => runBatch(batch)));
    const failed = results.find((code) => code !== 0);
    if (failed !== undefined) process.exit(failed);
  }

  const mergeCode = await runVitest(plan.merge.args, plan.merge.name);
  process.exit(mergeCode);
}

export { buildCoveragePlan };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[backend-coverage] ERROR: ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
