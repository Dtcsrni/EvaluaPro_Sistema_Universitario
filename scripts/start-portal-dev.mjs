/**
 * start-portal-dev
 *
 * Responsabilidad: iniciar el portal alumno en modo dev con defaults locales
 * compatibles cuando el .env usa hostname de Docker (mongo_local).
 */
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

function resolveMongoUri(rawValue) {
  const value = String(rawValue ?? '').trim();
  if (!value) {
    return 'mongodb://127.0.0.1:27017/mern_app_dev';
  }
  if (value.includes('mongo_local')) {
    return value.replaceAll('mongo_local', '127.0.0.1');
  }
  return value;
}

const env = {
  ...process.env,
  MONGODB_URI: resolveMongoUri(process.env.MONGODB_URI_DEV)
};

console.log(`[portal-dev] MONGODB_URI=${env.MONGODB_URI}`);
const result = spawnSync('npm', ['-C', 'apps/portal_alumno_cloud', 'run', 'dev'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env
});

const exitCode = Number(result.status ?? 1);
if (exitCode !== 0) {
  console.error(`[portal-dev] Error al iniciar portal dev (exit=${exitCode}).`);
}
process.exit(exitCode);
