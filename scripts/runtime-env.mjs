/**
 * runtime-env
 *
 * Responsabilidad: Cargar la configuración del runtime instalado sin permitir
 * que overrides vacíos oculten valores efectivos del archivo `.env`.
 */
import fs from 'node:fs';

export function cargarVariablesEnvDesdeArchivo(envPath, target = process.env, options = {}) {
  if (!fs.existsSync(envPath)) return target;

  const overrideKeys = new Set(options.overrideKeys || []);

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && (overrideKeys.has(key) || target[key] === undefined || String(target[key]).trim() === '')) {
      target[key] = value;
    }
  }

  return target;
}
