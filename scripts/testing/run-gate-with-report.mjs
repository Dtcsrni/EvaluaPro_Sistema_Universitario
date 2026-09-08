#!/usr/bin/env node
/**
 * run-gate-with-report
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * run-gate-with-report
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * run-gate-with-report
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
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
  const directory = path.dirname(absolute);
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  const temporary = path.join(directory, `.${path.basename(absolute)}.${process.pid}.${Date.now()}.tmp`);
  const fallback = path.join(directory, `${path.basename(absolute, path.extname(absolute))}.${process.pid}.${Date.now()}.json`);
  const fallbackPortable = path.join(os.tmpdir(), 'evaluapro-qa-reports', `${path.basename(absolute, path.extname(absolute))}.${process.pid}.${Date.now()}.json`);

  const esErrorPermiso = (error) => {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    return code === 'EPERM' || code === 'EACCES';
  };

  const escribirAlterno = async () => {
    try {
      await fs.writeFile(fallback, serialized, 'utf8');
      process.stderr.write(`[qa-gate-report] WARN: salida en uso; reporte alterno -> ${fallback}\n`);
      return fallback;
    } catch (fallbackError) {
      if (!esErrorPermiso(fallbackError)) throw fallbackError;
      await fs.mkdir(path.dirname(fallbackPortable), { recursive: true });
      await fs.writeFile(fallbackPortable, serialized, 'utf8');
      process.stderr.write(`[qa-gate-report] WARN: evidencia protegida por el entorno; reporte temporal -> ${fallbackPortable}\n`);
      return fallbackPortable;
    }
  };

  try {
    await fs.writeFile(temporary, serialized, 'utf8');
  } catch (error) {
    if (!esErrorPermiso(error)) throw error;
    return escribirAlterno();
  }
  try {
    await fs.rename(temporary, absolute);
    return absolute;
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    if (!esErrorPermiso(error)) throw error;

    return escribirAlterno();
  }
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

  const reportWritten = await writeReport(report, payload);

  if (result.code !== 0) {
    process.stderr.write(`[qa-gate-report] FAIL -> ${reportWritten}\n`);
    process.exit(result.code);
  }

  process.stdout.write(`[qa-gate-report] OK -> ${reportWritten}\n`);
}

main().catch((error) => {
  process.stderr.write(`[qa-gate-report] ERROR: ${String(error?.message || error)}\n`);
  process.exit(1);
});
