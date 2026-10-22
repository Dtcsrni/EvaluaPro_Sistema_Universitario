#!/usr/bin/env node
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function parseInstallerReleaseManifest(contents, manifestPath = 'EvaluaPro-release-manifest.json') {
  const text = Buffer.isBuffer(contents) ? contents.toString('utf8') : String(contents);
  const normalized = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  try {
    return JSON.parse(normalized);
  } catch (cause) {
    throw new Error(`Manifiesto de release inválido (${manifestPath}): ${cause.message}`, { cause });
  }
}

export function readInstallerReleaseManifest(manifestPath) {
  let contents;
  try {
    contents = fs.readFileSync(manifestPath);
  } catch (cause) {
    throw new Error(`No se pudo leer el manifiesto de release (${manifestPath}): ${cause.message}`, { cause });
  }
  return parseInstallerReleaseManifest(contents, manifestPath);
}

export function validateInstallerReleaseManifest(manifest, { targetVersion, sourceSha } = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('El manifiesto de release debe ser un objeto JSON.');
  }
  if (!targetVersion
      || manifest.version !== targetVersion
      || manifest.hubVersion !== targetVersion
      || manifest.build?.version !== targetVersion) {
    throw new Error('La versión del manifiesto no coincide con la versión objetivo.');
  }
  if (typeof manifest.appVersion !== 'string'
      || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(manifest.appVersion)) {
    throw new Error('appVersion del manifiesto debe ser una versión SemVer estable X.Y.Z.');
  }
  if (!/^[0-9a-f]{40}$/i.test(String(sourceSha || ''))
      || String(manifest.build?.commit || '').toLowerCase() !== sourceSha.toLowerCase()) {
    throw new Error('build.commit del manifiesto no coincide con el SHA candidato.');
  }
  if (!Array.isArray(manifest.flavors)
      || manifest.flavors.length !== 1
      || manifest.flavors[0]?.flavorId !== 'docente-local') {
    throw new Error('El artefacto debe contener únicamente el flavor docente-local.');
  }
  return manifest;
}

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length).trim() : fallback;
}

export function main() {
  const manifestPath = getArg('manifest', 'dist/installer/EvaluaPro-release-manifest.json');
  const targetVersion = process.env.TARGET_VERSION || '';
  const sourceSha = process.env.SOURCE_SHA || '';
  const manifest = readInstallerReleaseManifest(manifestPath);
  validateInstallerReleaseManifest(manifest, { targetVersion, sourceSha });
  process.stdout.write(`[installer-manifest] válido: hub=${targetVersion}, app=${manifest.appVersion}, flavor=docente-local\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`[installer-manifest] ${String(error?.message || error)}\n`);
    process.exitCode = 1;
  }
}
