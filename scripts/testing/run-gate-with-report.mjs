#!/usr/bin/env node
/**
 * run-gate-with-report
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

function parseArgs(argv) {
  const values = {
    report: '',
    command: '',
    gate: ''
  };

  for (const arg of argv) {
    if (arg.startsWith('--report=')) values.report = arg.slice('--report='.length);
    if (arg.startsWith('--command=')) values.command = arg.slice('--command='.length);
    if (arg.startsWith('--gate=')) values.gate = arg.slice('--gate='.length);
  }

  return values;
}

async function writeReport(reportPath, payload) {
  const absolute = path.resolve(process.cwd(), reportPath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function runCommand(command) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true
    });

    child.on('exit', (code, signal) => {
      resolve({ code: typeof code === 'number' ? code : 1, signal: signal ?? null });
    });

    child.on('error', () => {
      resolve({ code: 1, signal: null });
    });
  });
}

async function main() {
  const { report, command, gate } = parseArgs(process.argv.slice(2));
  if (!report || !command) {
    process.stderr.write('[qa-gate-report] ERROR missing --report or --command\n');
    process.exit(1);
  }

  const started = new Date();
  const result = await runCommand(command);
  const finished = new Date();
  const payload = {
    version: '1',
    gate: gate || path.basename(report, path.extname(report)),
    command,
    ok: result.code === 0,
    exitCode: result.code,
    signal: result.signal,
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationMs: finished.getTime() - started.getTime()
  };

  await writeReport(report, payload);

  if (result.code !== 0) {
    process.stderr.write(`[qa-gate-report] FAIL -> ${report}\n`);
    process.exit(result.code);
  }

  process.stdout.write(`[qa-gate-report] OK -> ${report}\n`);
}

main().catch((error) => {
  process.stderr.write(`[qa-gate-report] ERROR: ${String(error?.message || error)}\n`);
  process.exit(1);
});
