/**
 * runtime-env
 *
 * Responsabilidad: Cargar la configuración del runtime instalado sin permitir
 * que overrides vacíos oculten valores efectivos del archivo `.env`.
 */
import fs from 'node:fs';
import process from 'node:process';

const CLAVES_CLASSROOM_RUNTIME = [
  'CLASSROOM_ENABLED',
  'CLASSROOM_TOKEN_CIPHER_KEY'
];

const CLAVES_OMR_RUNTIME = [
  'OMR_QR_HMAC_SECRET',
  'OMR_QR_HMAC_KEY_ID',
  'OMR_QR_HMAC_SECRETS_JSON',
  'OMR_QR_RECOVERY_KEY_ID',
  'OMR_QR_RECOVERY_SECRET',
  'OMR_QR_RECOVERY_SECRETS_JSON'
];
const CLAVES_SEGURIDAD_RUNTIME = ['JWT_SECRETO', ...CLAVES_OMR_RUNTIME];

export function obtenerClavesEnvAutoritativas({ nodeEnv, flavor } = {}) {
  if (String(nodeEnv || '').trim() !== 'production' || String(flavor || '').trim().toLowerCase() !== 'docente-local') {
    return [];
  }
  return [
    'NODE_ENV',
    'EVALUAPRO_FLAVOR',
    'DATABASE_URL',
    'BACKEND_DATABASE_URL',
    ...CLAVES_CLASSROOM_RUNTIME,
    ...CLAVES_SEGURIDAD_RUNTIME
  ];
}

export function obtenerClavesEnvLimpiarSiAusentes({ nodeEnv, flavor } = {}) {
  if (String(nodeEnv || '').trim() === 'test' && String(flavor || '').trim().toLowerCase() === 'docente-local-test') {
    return [...CLAVES_OMR_RUNTIME];
  }
  if (String(nodeEnv || '').trim() !== 'production' || String(flavor || '').trim().toLowerCase() !== 'docente-local') {
    return [];
  }
  return [...CLAVES_SEGURIDAD_RUNTIME];
}

export function obtenerClavesEnvIgnorar({ nodeEnv, flavor } = {}) {
  if (String(nodeEnv || '').trim() === 'test' && String(flavor || '').trim().toLowerCase() === 'docente-local-test') {
    return [...CLAVES_OMR_RUNTIME];
  }
  return [];
}

export function leerVariablesEnvDesdeArchivo(envPath) {
  if (!fs.existsSync(envPath)) return {};

  const values = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) values[key] = value;
  }
  return values;
}

export function resolverContextoEnvRuntime(
  valoresInstalados = {},
  processEnv = process.env,
  { installedEnvPresent = Object.keys(valoresInstalados).length > 0 } = {}
) {
  if (processEnv.EVALUAPRO_E2E_BUILD === '1' && String(processEnv.NODE_ENV || '').trim() === 'test') {
    return { nodeEnv: 'test', flavor: 'docente-local-test' };
  }
  if (!installedEnvPresent && String(processEnv.EVALUAPRO_MODE || '').trim().toLowerCase() === 'dev') {
    return { nodeEnv: 'development', flavor: 'docente-local-dev' };
  }
  const nodeEnv = String(valoresInstalados.NODE_ENV || 'production').trim();
  const flavor = String(valoresInstalados.EVALUAPRO_FLAVOR || 'docente-local').trim();
  return {
    nodeEnv,
    flavor
  };
}

export function cargarVariablesEnvDesdeArchivo(envPath, target = process.env, options = {}) {

  const overrideKeys = new Set(options.overrideKeys || []);
  const clearMissingKeys = new Set(options.clearMissingKeys || []);
  const ignoreKeys = new Set(options.ignoreKeys || []);
  for (const key of clearMissingKeys) delete target[key];

  for (const [key, value] of Object.entries(leerVariablesEnvDesdeArchivo(envPath))) {
    if (ignoreKeys.has(key)) continue;
    if (key && (overrideKeys.has(key) || target[key] === undefined || String(target[key]).trim() === '')) {
      target[key] = value;
    }
  }

  return target;
}
