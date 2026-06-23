#!/usr/bin/env node
/**
 * diagramas-render-linux
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const mode = args.has('--check') ? 'check' : 'write';

const npmScript = mode === 'check' ? 'diagramas:render:check' : 'diagramas:render';

const containerCommand = [
  'apt-get update',
  'apt-get install -y --no-install-recommends libglib2.0-0 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxrandr2 libgbm1 libasound2 libpangocairo-1.0-0 libxdamage1 libxfixes3 libx11-6 libx11-xcb1 libxcb1 libxext6 libxrender1 libcairo2 libpango-1.0-0 fonts-liberation ca-certificates',
  'npm ci --no-audit --no-fund',
  `npm run ${npmScript}`
].join(' && ');

const dockerArgs = [
  'run',
  '--rm',
  '-v',
  `${rootDir}:/work`,
  '-w',
  '/work',
  'node:24-slim',
  'bash',
  '-lc',
  containerCommand
];

const child = spawn('docker', dockerArgs, {
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    CI: '1'
  }
});

child.on('error', (error) => {
  console.error(`[diagramas:render:linux] no se pudo ejecutar Docker: ${error.message}`);
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code ?? 1);
});
