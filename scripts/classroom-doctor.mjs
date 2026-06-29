#!/usr/bin/env node
/**
 * classroom-doctor
 *
 * Responsabilidad: Diagnosticar prerequisitos locales de Google Classroom.
 * Limites: No imprime secretos; solo reporta presencia y formato.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REQUIRED_KEYS = [
  'GOOGLE_CLASSROOM_CLIENT_ID',
  'GOOGLE_CLASSROOM_CLIENT_SECRET',
  'GOOGLE_CLASSROOM_REDIRECT_URI',
  'CLASSROOM_TOKEN_CIPHER_KEY'
];

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

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function evaluateClassroomConfig(env) {
  const checks = [];
  for (const key of REQUIRED_KEYS) {
    const present = Boolean(String(env[key] || '').trim());
    checks.push({ id: key, ok: present, detail: present ? 'presente' : 'faltante' });
  }

  if (String(env.GOOGLE_CLASSROOM_REDIRECT_URI || '').trim()) {
    const ok = isHttpUrl(env.GOOGLE_CLASSROOM_REDIRECT_URI);
    checks.push({ id: 'GOOGLE_CLASSROOM_REDIRECT_URI_FORMAT', ok, detail: ok ? 'url-valida' : 'url-invalida' });
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
    env: { ...fileEnv, ...process.env }
  };
}

export async function main() {
  const { envPath, env } = loadEnvForDoctor(getArg('env', ''));
  const result = evaluateClassroomConfig(env);
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
