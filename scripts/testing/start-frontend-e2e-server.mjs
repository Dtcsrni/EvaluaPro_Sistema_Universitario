#!/usr/bin/env node
/**
 * start-frontend-e2e-server
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * start-frontend-e2e-server
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * start-frontend-e2e-server
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const frontendDir = path.join(rootDir, 'apps', 'frontend');

function getArg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] ?? fallback;
}

const port = String(getArg('--port', '4173')).trim() || '4173';
const destino = String(getArg('--destino', 'docente')).trim() || 'docente';
const safeDestino = destino.replace(/[^a-z0-9_-]/gi, '-');
// Cada servidor E2E necesita una salida propia: Vite no debe compartir ni
// sobrescribir estáticos entre builds concurrentes de docente/alumno/admin.
const outDir = `dist-e2e-${safeDestino}-${process.pid}-${Date.now()}`;
const outPath = path.join(frontendDir, outDir);
let activeProcess = null;

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = {
  ...process.env,
  VITE_APP_DESTINO: destino,
  VITE_DISABLE_PWA: '1'
};

function cleanOutput() {
  try {
    fs.rmSync(outPath, { recursive: true, force: true });
  } catch {
    // La limpieza es best-effort; nunca oculta el resultado del proceso E2E.
  }
}

process.once('exit', cleanOutput);
process.once('SIGINT', () => {
  if (activeProcess && !activeProcess.killed) activeProcess.kill('SIGINT');
  cleanOutput();
  process.exit(130);
});
process.once('SIGTERM', () => {
  if (activeProcess && !activeProcess.killed) activeProcess.kill('SIGTERM');
  cleanOutput();
  process.exit(143);
});

const build = spawn(`${npmCmd} -C "${frontendDir}" run build -- --outDir ${outDir}`, {
  stdio: 'inherit',
  shell: true,
  env
});
activeProcess = build;

build.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  if ((code ?? 1) !== 0) {
    cleanOutput();
    process.exit(code ?? 1);
  }

  const child = spawn(`${npmCmd} -C "${frontendDir}" run preview -- --host 127.0.0.1 --port ${port} --outDir ${outDir}`, {
    stdio: 'inherit',
    shell: true,
    env
  });
  activeProcess = child;

  child.on('exit', (childCode, childSignal) => {
    cleanOutput();
    if (childSignal) {
      process.exit(1);
    }
    process.exit(childCode ?? 0);
  });
});
