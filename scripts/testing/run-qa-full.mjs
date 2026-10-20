#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateQaReports } from './validate-qa-reports.mjs';

export const QA_FULL_TASKS = [
  'test:dataset-prodlike:ci',
  'test:e2e:docente-alumno:ci',
  'test:global-grade:ci',
  'test:evaluaciones:policy:ci',
  'test:evaluaciones:e2e:ci',
  'test:pdf-print:ci',
  'test:ux-visual:ci',
  'qa:clean-architecture:check',
  'test:qa:manifest'
];

function executeNpmTask(task, root) {
  const npmCli = process.env.npm_execpath;
  const args = npmCli ? [npmCli, 'run', task] : ['run', task];
  const command = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: !npmCli, env: process.env });
  return { status: result.status ?? 1, error: result.error };
}

export async function runQaFull({
  root = process.cwd(),
  runTask = (task) => executeNpmTask(task, root),
  validateReports = () => validateQaReports(path.join(root, 'reports/qa/latest/manifest.json'))
} = {}) {
  const failedTasks = [];
  for (const task of QA_FULL_TASKS) {
    process.stdout.write(`\n[qa:full] Ejecutando ${task}\n`);
    try {
      const result = await runTask(task);
      if (result?.status !== 0) {
        failedTasks.push(`${task} (exit=${result?.status ?? 'desconocido'})`);
      }
      if (result?.error) failedTasks.push(`${task} (spawn: ${result.error.message})`);
    } catch (error) {
      failedTasks.push(`${task} (error: ${error.message})`);
    }
  }

  let reportResult;
  try {
    reportResult = await validateReports();
  } catch (error) {
    reportResult = { ok: false, errors: [error.message] };
  }
  if (!reportResult?.ok) {
    for (const error of reportResult?.errors ?? ['validación QA no disponible']) {
      process.stderr.write(`[qa:full] Reporte inválido: ${error}\n`);
    }
    failedTasks.push('validación de manifiesto/reportes QA');
  }

  if (failedTasks.length > 0) {
    process.stderr.write(`\n[qa:full] FAIL: ${failedTasks.join('; ')}\n`);
    return 1;
  }
  process.stdout.write('\n[qa:full] OK: tareas y reportes requeridos están aprobados.\n');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runQaFull().then((status) => { process.exitCode = status; });
}
