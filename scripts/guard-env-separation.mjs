import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const args = { mode: 'check', strict: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mode') {
      args.mode = String(argv[index + 1] ?? '').trim();
      index += 1;
    } else if (arg === '--no-strict') {
      args.strict = false;
    } else if (arg === '--strict') {
      args.strict = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log('Uso: node scripts/guard-env-separation.mjs [--mode check] [--strict|--no-strict]');
}

function normalizeUri(uri) {
  return String(uri ?? '').trim().replace(/\/+$/, '').toLowerCase();
}

function extractDbName(uri) {
  const value = normalizeUri(uri);
  if (!value) return '';
  const noQuery = value.split('?')[0];
  const parts = noQuery.split('/').filter(Boolean);
  if (parts.length === 0) return '';
  const dbName = parts[parts.length - 1];
  if (dbName.includes(':')) return '';
  return dbName;
}

function getEnv(name, fallback = '') {
  const value = String(process.env[name] ?? '').trim();
  return value || fallback;
}

function fail(message) {
  // eslint-disable-next-line no-console
  console.error(`[guard-env-separation] ${message}`);
}

function warn(message) {
  // eslint-disable-next-line no-console
  console.warn(`[guard-env-separation] ${message}`);
}

function info(message) {
  // eslint-disable-next-line no-console
  console.log(`[guard-env-separation] ${message}`);
}

function validateConfig() {
  const mongoDev = getEnv('MONGODB_URI_DEV', 'mongodb://mongo_local:27017/evaluapro_dev');
  const mongoProd = getEnv('MONGODB_URI_PROD', 'mongodb://mongo_local:27017/evaluapro_prod');
  const mongoTest = getEnv('MONGODB_URI_TEST', 'mongodb://localhost:27017/evaluapro_test');

  const dataDirDev = getEnv('BACKEND_DATA_DIR_DEV', './apps/backend/data/examenes_dev');
  const dataDirProd = getEnv('BACKEND_DATA_DIR_PROD', './apps/backend/data/examenes_prod');

  const checks = [];

  const devNorm = normalizeUri(mongoDev);
  const prodNorm = normalizeUri(mongoProd);
  const testNorm = normalizeUri(mongoTest);

  if (devNorm === prodNorm) {
    checks.push('MONGODB_URI_DEV y MONGODB_URI_PROD no pueden ser iguales.');
  }

  if (devNorm === testNorm) {
    checks.push('MONGODB_URI_DEV y MONGODB_URI_TEST no pueden ser iguales.');
  }

  if (prodNorm === testNorm) {
    checks.push('MONGODB_URI_PROD y MONGODB_URI_TEST no pueden ser iguales.');
  }

  const dbDev = extractDbName(mongoDev);
  const dbProd = extractDbName(mongoProd);
  const dbTest = extractDbName(mongoTest);

  if (dbDev && dbProd && dbDev === dbProd) {
    checks.push(`Base de datos repetida entre dev/prod (${dbDev}).`);
  }

  if (dbDev && dbTest && dbDev === dbTest) {
    checks.push(`Base de datos repetida entre dev/test (${dbDev}).`);
  }

  if (dbProd && dbTest && dbProd === dbTest) {
    checks.push(`Base de datos repetida entre prod/test (${dbProd}).`);
  }

  if (path.normalize(dataDirDev).toLowerCase() === path.normalize(dataDirProd).toLowerCase()) {
    checks.push('BACKEND_DATA_DIR_DEV y BACKEND_DATA_DIR_PROD no pueden apuntar a la misma carpeta.');
  }

  const legacyMongo = String(process.env.MONGODB_URI ?? '').trim();
  if (legacyMongo) {
    warn('MONGODB_URI (legacy) está definido; no se usa para separación dev/prod. Usa MONGODB_URI_DEV y MONGODB_URI_PROD.');
  }

  return {
    checks,
    snapshot: {
      MONGODB_URI_DEV: mongoDev,
      MONGODB_URI_PROD: mongoProd,
      MONGODB_URI_TEST: mongoTest,
      BACKEND_DATA_DIR_DEV: dataDirDev,
      BACKEND_DATA_DIR_PROD: dataDirProd
    }
  };
}

function assertDirectories(rootDir, relativePaths) {
  const missing = [];
  for (const relativePath of relativePaths) {
    const target = path.resolve(rootDir, relativePath);
    if (!fs.existsSync(target)) {
      missing.push(relativePath);
    }
  }
  return missing;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, '..');

  const { checks, snapshot } = validateConfig();

  info(`DEV DB: ${snapshot.MONGODB_URI_DEV}`);
  info(`PROD DB: ${snapshot.MONGODB_URI_PROD}`);
  info(`TEST DB: ${snapshot.MONGODB_URI_TEST}`);
  info(`DEV DATA DIR: ${snapshot.BACKEND_DATA_DIR_DEV}`);
  info(`PROD DATA DIR: ${snapshot.BACKEND_DATA_DIR_PROD}`);

  const missingDirs = assertDirectories(rootDir, [
    snapshot.BACKEND_DATA_DIR_DEV,
    snapshot.BACKEND_DATA_DIR_PROD,
    './apps/backend/data/examenes_test'
  ]);

  for (const missingDir of missingDirs) {
    checks.push(`Carpeta requerida no existe: ${missingDir}`);
  }

  if (checks.length > 0) {
    for (const issue of checks) {
      fail(issue);
    }
    if (args.strict) {
      process.exitCode = 1;
      return;
    }
  }

  info('Validación de separación dev/prod/test OK.');
}

main();
