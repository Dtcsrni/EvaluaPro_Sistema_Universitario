#!/usr/bin/env node
/**
 * Arranca el flavor docente-local sin Docker: API Node + Web docente preview.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logsDir = path.join(root, 'logs');
fs.mkdirSync(logsDir, { recursive: true });

function loadRuntimeEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadRuntimeEnv();

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'production',
  EVALUAPRO_FLAVOR: process.env.EVALUAPRO_FLAVOR || 'docente-local',
  PUERTO_API: process.env.PUERTO_API || process.env.PORT || '4000',
  CORS_ORIGENES: process.env.CORS_ORIGENES || 'http://localhost:4173,http://127.0.0.1:4173'
};

const embeddedNode = path.join(root, 'runtime', 'node', process.platform === 'win32' ? 'node.exe' : 'node');
const nodeCommand = fs.existsSync(embeddedNode) ? embeddedNode : process.execPath;
const children = new Map();
let stopping = false;

function launch(name, args, options = {}) {
  const proc = spawn(options.command || nodeCommand, args, {
    cwd: options.cwd || root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false
  });
  children.set(name, proc);
  const logPath = path.join(logsDir, `docente-native-${name}.log`);
  const log = fs.createWriteStream(logPath, { flags: 'a' });
  log.write(`\n[${new Date().toISOString()}] start ${name}: node ${args.join(' ')}\n`);
  proc.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
    log.write(chunk);
  });
  proc.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
    log.write(chunk);
  });
  proc.on('exit', (code, signal) => {
    children.delete(name);
    log.write(`[${new Date().toISOString()}] exit ${name}: code=${code ?? ''} signal=${signal ?? ''}\n`);
    log.end();
    if (!stopping) {
      console.error(`[docente-native] ${name} finalizo inesperadamente (code=${code ?? 'null'} signal=${signal ?? 'none'}).`);
      stopAll(code || 1);
    }
  });
  proc.on('error', (error) => {
    children.delete(name);
    log.write(`[${new Date().toISOString()}] error ${name}: ${error.message}\n`);
    log.end();
    if (!stopping) stopAll(1);
  });
}

function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const proc of children.values()) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { windowsHide: true, stdio: 'ignore' });
      } else {
        proc.kill('SIGTERM');
      }
    } catch {}
  }
  setTimeout(() => process.exit(exitCode), 700).unref();
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

launch('api', [path.join('apps', 'backend', 'dist', 'index.js')]);
launch('web', [path.join('scripts', 'serve-docente-static.mjs')]);

setInterval(() => {}, 60_000).unref();
