/**
 * start-portal-prod
 *
 * Responsabilidad: Arrancar portal alumno en modo estable local.
 * Estrategia:
 * - Si no existe dist/index.js, compilar portal.
 * - Iniciar portal compilado (sin watch/dev server).
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const portalDistEntry = path.join(root, 'apps', 'portal_alumno_cloud', 'dist', 'index.js');

function resolveMongoUri(rawValue) {
  const value = String(rawValue ?? '').trim();
  if (!value) {
    return 'mongodb://127.0.0.1:27017/mern_app_prod';
  }
  if (value.includes('mongo_local')) {
    return value.replaceAll('mongo_local', '127.0.0.1');
  }
  return value;
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env
  });
  return Number(result.status ?? 1);
}

const env = {
  ...process.env,
  MONGODB_URI: resolveMongoUri(process.env.MONGODB_URI_PROD)
};

const needsBuild = !fs.existsSync(portalDistEntry);
if (needsBuild) {
  console.log('[portal-prod] Portal prod build en curso (dist/index.js no existe)...');
  const buildCode = run('npm', ['-C', 'apps/portal_alumno_cloud', 'run', 'build'], env);
  if (buildCode !== 0) {
    console.error(`[portal-prod] Error de build del portal (exit=${buildCode}).`);
    process.exit(buildCode);
  }
}

console.log(`[portal-prod] MONGODB_URI=${env.MONGODB_URI}`);
console.log('[portal-prod] Portal prod iniciado.');
const startCode = run('npm', ['run', 'start:portal'], env);
if (startCode !== 0) {
  console.error(`[portal-prod] Error al iniciar portal prod (exit=${startCode}).`);
}
process.exit(startCode);
