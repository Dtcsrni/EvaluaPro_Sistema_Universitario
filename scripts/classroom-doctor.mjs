#!/usr/bin/env node
/**
 * classroom-doctor
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * classroom-doctor
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * classroom-doctor
 *
 * Responsabilidad: Diagnosticar prerequisitos locales de Google Classroom.
 * Limites: No imprime secretos; solo reporta presencia y formato.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LEGACY_KEYS = ['GOOGLE_CLASSROOM_CLIENT_SECRET', 'GOOGLE_CLASSROOM_REDIRECT_URI'];

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function parseEnvText(text) {
  const result = {};
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function isBase64Key32(value) {
  try {
    const decoded = Buffer.from(String(value || ''), 'base64');
    return decoded.length === 32 && decoded.toString('base64') === String(value || '').trim();
  } catch {
    return false;
  }
}

export function evaluateClassroomConfig(env, { dpapiSupported = true } = {}) {
  const checks = [];
  const enabledRaw = String(env.CLASSROOM_ENABLED || '').trim().toLowerCase();
  const enabled = enabledRaw ? ['1', 'true', 'yes', 'on'].includes(enabledRaw) : true;
  checks.push({ id: 'CLASSROOM_DESKTOP_OAUTH', ok: true, detail: enabled ? 'habilitado-en-el-producto' : 'deshabilitado-por-configuracion' });
  if (enabled) checks.push({ id: 'DPAPI_CURRENT_USER', ok: dpapiSupported, detail: dpapiSupported ? 'disponible' : 'no-disponible' });

  for (const key of LEGACY_KEYS) {
    if (String(env[key] || '').trim()) {
      checks.push({ id: `${key}_LEGACY_IGNORED`, ok: true, detail: 'no-se-usa-en-oauth-desktop' });
    }
  }
  if (String(env.CLASSROOM_TOKEN_CIPHER_KEY || '').trim()) {
    const ok = isBase64Key32(env.CLASSROOM_TOKEN_CIPHER_KEY);
    checks.push({ id: 'CLASSROOM_TOKEN_CIPHER_KEY_FORMAT', ok, detail: ok ? 'base64-32-bytes' : 'formato-invalido' });
  }

  return {
    ok: checks.every((check) => check.ok),
    checks
  };
}

export function loadEnvForDoctor(envPath = '') {
  const resolvedPath = envPath ? path.resolve(process.cwd(), envPath) : path.resolve(process.cwd(), '.env');
  const fileEnv = fs.existsSync(resolvedPath) ? parseEnvText(fs.readFileSync(resolvedPath, 'utf8')) : {};
  return {
    envPath: resolvedPath,
    // Una ruta explicita representa el runtime que se esta auditando; no
    // debe quedar falseado por variables heredadas del proceso padre.
    env: envPath ? fileEnv : { ...fileEnv, ...process.env }
  };
}

export function isDpapiCurrentUserSupported() {
  if (process.platform !== 'win32') return false;
  const backendPackage = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps/backend/package.json');
  return createRequire(backendPackage)('@primno/dpapi').isPlatformSupported === true;
}

export async function main() {
  const { envPath, env } = loadEnvForDoctor(getArg('env', ''));
  const dpapiSupported = isDpapiCurrentUserSupported();
  const result = evaluateClassroomConfig(env, { dpapiSupported });
  const output = { envPath, ...result };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!result.ok) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[classroom:doctor] ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
