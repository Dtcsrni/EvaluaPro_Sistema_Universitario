#!/usr/bin/env node
/**
 * start-frontend-e2e-server
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { spawn } from 'node:child_process';
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
const outDir = `dist-e2e-${destino}`;

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = {
  ...process.env,
  VITE_APP_DESTINO: destino,
  VITE_DISABLE_PWA: '1'
};

const build = spawn(`${npmCmd} -C "${frontendDir}" run build -- --outDir ${outDir}`, {
  stdio: 'inherit',
  shell: true,
  env
});

build.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  if ((code ?? 1) !== 0) {
    process.exit(code ?? 1);
  }

  const child = spawn(`${npmCmd} -C "${frontendDir}" run preview -- --host 127.0.0.1 --port ${port} --outDir ${outDir}`, {
    stdio: 'inherit',
    shell: true,
    env
  });

  const terminate = (sig) => {
    if (!child.killed) {
      child.kill(sig);
    }
  };

  process.on('SIGINT', () => terminate('SIGINT'));
  process.on('SIGTERM', () => terminate('SIGTERM'));

  child.on('exit', (childCode, childSignal) => {
    if (childSignal) {
      process.exit(1);
    }
    process.exit(childCode ?? 0);
  });
});
