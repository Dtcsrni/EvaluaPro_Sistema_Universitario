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

const origenesConfigurados = String(process.env.CORS_ORIGENES || 'http://localhost:4173,http://127.0.0.1:4173')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);
if (process.env.EVALUAPRO_E2E_BUILD === '1' && !origenesConfigurados.includes('http://127.0.0.1:4174')) {
  origenesConfigurados.push('http://127.0.0.1:4174');
}

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'production',
  EVALUAPRO_FLAVOR: process.env.EVALUAPRO_FLAVOR || 'docente-local',
  PUERTO_API: process.env.PUERTO_API || process.env.PORT || '4000',
  CORS_ORIGENES: origenesConfigurados.join(',')
};

const embeddedNode = path.join(root, 'runtime', 'node', process.platform === 'win32' ? 'node.exe' : 'node');
const nodeCommand = fs.existsSync(embeddedNode) ? embeddedNode : process.execPath;
const children = new Map();
let stopping = false;

function prepareE2EDatabase() {
  if (process.env.EVALUAPRO_E2E_BUILD !== '1') return Promise.resolve();
  const configuredPath = String(process.env.E2E_DOCENTE_SQLITE_PATH || '').trim();
  const databasePath = path.resolve(configuredPath || path.join(root, 'test-results', 'docente-cycle', 'evaluapro.db'));
  const databaseUrl = `file:${databasePath.replace(/\\/g, '/')}`;
  const schemaPath = path.join(root, 'apps', 'backend', 'prisma', 'schema.prisma');
  const prismaEntry = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.rmSync(`${databasePath}${suffix}`, { force: true }); } catch {}
  }
  process.env.DATABASE_URL = databaseUrl;
  process.env.BACKEND_DATABASE_URL = databaseUrl;
  env.DATABASE_URL = databaseUrl;
  env.BACKEND_DATABASE_URL = databaseUrl;
  const schemaSqlPath = `${databasePath}.schema.sql`;
  const bootstrapPath = path.join(root, 'scripts', 'prepare-docente-sqlite.mjs');
  return new Promise((resolve, reject) => {
    const diff = spawn(process.execPath, [
      prismaEntry,
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema-datamodel',
      schemaPath,
      '--script'
    ], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: databaseUrl, BACKEND_DATABASE_URL: databaseUrl },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false
    });
    let stdout = '';
    let stderr = '';
    diff.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    diff.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    diff.once('error', reject);
    diff.once('exit', (code, signal) => {
      if (signal || code !== 0) {
        reject(new Error(`generación de esquema SQLite E2E falló (code=${code ?? 'null'} signal=${signal ?? 'none'}): ${stderr.trim()}`));
        return;
      }
      const start = stdout.indexOf('-- CreateTable');
      const end = stdout.lastIndexOf(';');
      const schemaSql = start >= 0 && end >= start ? stdout.slice(start, end + 1).trim() : stdout.trim();
      if (!schemaSql || !schemaSql.includes('CREATE TABLE')) {
        reject(new Error('generación de esquema SQLite E2E no produjo SQL válido'));
        return;
      }
      fs.writeFileSync(schemaSqlPath, schemaSql, 'utf8');
      const bootstrap = spawn(process.execPath, [bootstrapPath, '--database', databasePath, '--schema-sql', schemaSqlPath], {
        cwd: root,
        env: { ...process.env, DATABASE_URL: databaseUrl, BACKEND_DATABASE_URL: databaseUrl },
        stdio: 'inherit',
        windowsHide: true,
        shell: false
      });
      bootstrap.once('error', reject);
      bootstrap.once('exit', (bootstrapCode, bootstrapSignal) => {
        if (bootstrapSignal || bootstrapCode !== 0) {
          reject(new Error(`bootstrap SQLite E2E falló (code=${bootstrapCode ?? 'null'} signal=${bootstrapSignal ?? 'none'})`));
          return;
        }
        resolve();
      });
    });
  });
}

function prepareE2EPortalDatabase() {
  if (process.env.EVALUAPRO_E2E_BUILD !== '1') return Promise.resolve();
  const databasePath = path.resolve(path.join(root, 'test-results', 'docente-cycle', 'portal.db'));
  const databaseUrl = `file:${databasePath.replace(/\\/g, '/')}`;
  const schemaPath = path.join(root, 'apps', 'portal_alumno_cloud', 'prisma', 'schema.prisma');
  const prismaEntry = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.rmSync(`${databasePath}${suffix}`, { force: true }); } catch {}
  }
  process.env.PORTAL_DATABASE_URL = databaseUrl;
  env.PORTAL_DATABASE_URL = databaseUrl;
  const schemaSqlPath = `${databasePath}.schema.sql`;
  return new Promise((resolve, reject) => {
    const diff = spawn(process.execPath, [
      prismaEntry,
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema-datamodel',
      schemaPath,
      '--script'
    ], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: databaseUrl, PORTAL_DATABASE_URL: databaseUrl },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false
    });
    let stdout = '';
    let stderr = '';
    diff.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    diff.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    diff.once('error', reject);
    diff.once('exit', (code, signal) => {
      if (signal || code !== 0) {
        reject(new Error(`generación de esquema portal E2E falló (code=${code ?? 'null'} signal=${signal ?? 'none'}): ${stderr.trim()}`));
        return;
      }
      const end = stdout.lastIndexOf(';');
      const schemaSql = end >= 0 ? stdout.slice(0, end + 1).trim() : stdout.trim();
      if (!schemaSql.includes('CREATE TABLE')) {
        reject(new Error('generación de esquema portal E2E no produjo SQL válido'));
        return;
      }
      fs.writeFileSync(schemaSqlPath, schemaSql, 'utf8');
      const execute = spawn(process.execPath, [prismaEntry, 'db', 'execute', '--file', schemaSqlPath, '--schema', schemaPath], {
        cwd: root,
        env: { ...process.env, DATABASE_URL: databaseUrl, PORTAL_DATABASE_URL: databaseUrl },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        shell: false
      });
      let executeErr = '';
      execute.stderr.on('data', (chunk) => { executeErr += chunk.toString(); });
      execute.once('error', reject);
      execute.once('exit', (executeCode, executeSignal) => {
        if (executeSignal || executeCode !== 0) reject(new Error(`bootstrap SQLite portal E2E falló (code=${executeCode ?? 'null'} signal=${executeSignal ?? 'none'}): ${executeErr.trim()}`));
        else resolve();
      });
    });
  });
}

function buildE2EFrontend() {
  if (process.env.EVALUAPRO_E2E_BUILD !== '1') return Promise.resolve();
  const npmCommand = process.platform === 'win32' ? process.execPath : 'npm';
  const npmArgsPrefix = process.platform === 'win32'
    ? [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')]
    : [];
  const destino = 'docente';
  const outputDir = 'dist-e2e-docente';
  return new Promise((resolve, reject) => {
    const build = spawn(npmCommand, [...npmArgsPrefix, '-C', path.join(root, 'apps', 'frontend'), 'run', 'build', '--', '--outDir', outputDir], {
      cwd: root,
      env: {
        ...process.env,
        VITE_APP_DESTINO: destino,
        VITE_DISABLE_PWA: '1',
        VITE_API_BASE_URL: 'http://127.0.0.1:4000/api'
      },
      stdio: 'inherit',
      windowsHide: true,
      shell: false
    });
    build.once('error', reject);
    build.once('exit', (code, signal) => {
      if (signal || code !== 0) {
        reject(new Error(`build E2E docente falló (code=${code ?? 'null'} signal=${signal ?? 'none'})`));
        return;
      }
      resolve();
    });
  });
}

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

async function main() {
  await prepareE2EDatabase();
  await prepareE2EPortalDatabase();
  await buildE2EFrontend();
  if (process.env.EVALUAPRO_E2E_BUILD === '1') {
    process.env.DOCENTE_WEB_DIST = 'apps/frontend/dist-e2e-docente';
    env.DOCENTE_WEB_DIST = process.env.DOCENTE_WEB_DIST;
    env.PUERTO_PORTAL = '8080';
    env.PORTAL_API_KEY = 'e2e-local-portal-key';
    env.PORTAL_ALUMNO_URL = 'http://127.0.0.1:8080';
    env.PORTAL_ALUMNO_API_KEY = 'e2e-local-portal-key';
    env.PORTAL_DATABASE_URL = process.env.PORTAL_DATABASE_URL;
  }
  launch('api', [path.join('apps', 'backend', 'dist', 'index.js')]);
  if (process.env.EVALUAPRO_E2E_BUILD === '1') {
    launch('portal', [path.join('node_modules', 'tsx', 'dist', 'cli.mjs'), path.join('apps', 'portal_alumno_cloud', 'src', 'index.ts')]);
  }
  launch('web', [path.join('scripts', 'serve-docente-static.mjs')]);
}

main().catch((error) => {
  console.error(`[docente-native] ${error instanceof Error ? error.message : String(error)}`);
  stopAll(1);
});

setInterval(() => {}, 60_000).unref();
