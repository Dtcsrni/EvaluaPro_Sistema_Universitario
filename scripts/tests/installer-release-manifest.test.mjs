import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseInstallerReleaseManifest,
  readInstallerReleaseManifest,
  validateInstallerReleaseManifest
} from '../release/installer-release-manifest.mjs';

const SOURCE_SHA = 'a'.repeat(40);
const MANIFEST = {
  version: '1.2.8',
  build: { version: '1.2.8', commit: SOURCE_SHA },
  flavors: [{ flavorId: 'docente-local' }]
};
const JSON_TEXT = JSON.stringify(MANIFEST);

test('el manifiesto conserva los mismos valores con y sin BOM UTF-8 inicial', () => {
  const withoutBom = parseInstallerReleaseManifest(JSON_TEXT);
  const withBom = parseInstallerReleaseManifest(`\uFEFF${JSON_TEXT}`);

  assert.deepEqual(withBom, withoutBom);
  assert.deepEqual(validateInstallerReleaseManifest(withBom, {
    targetVersion: '1.2.8',
    sourceSha: SOURCE_SHA
  }), MANIFEST);
});

test('JSON malformado se rechaza con y sin BOM y nombra el manifiesto', () => {
  const manifestPath = 'dist/installer/EvaluaPro-release-manifest.json';
  for (const contents of ['{"version":', '\uFEFF{"version":']) {
    assert.throws(
      () => parseInstallerReleaseManifest(contents, manifestPath),
      (error) => error instanceof Error
        && error.message.includes('Manifiesto de release inválido')
        && error.message.includes(manifestPath)
        && error.cause instanceof SyntaxError
    );
  }
});

test('el parser solo normaliza un BOM colocado al inicio del archivo', () => {
  assert.throws(() => parseInstallerReleaseManifest(` ${'\uFEFF'}${JSON_TEXT}`), /Manifiesto de release inválido/);
});

test('el lector acepta bytes UTF-8 con BOM en el archivo del manifiesto', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-installer-manifest-'));
  const manifestPath = path.join(tempDir, 'EvaluaPro-release-manifest.json');
  try {
    fs.writeFileSync(manifestPath, Buffer.from(`\uFEFF${JSON_TEXT}`, 'utf8'));
    assert.deepEqual(readInstallerReleaseManifest(manifestPath), MANIFEST);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('el manifiesto rechaza una versión, SHA o flavor distinto al candidato', () => {
  assert.throws(() => validateInstallerReleaseManifest(MANIFEST, {
    targetVersion: '1.2.7',
    sourceSha: SOURCE_SHA
  }), /versión del manifiesto/i);
  assert.throws(() => validateInstallerReleaseManifest(MANIFEST, {
    targetVersion: '1.2.8',
    sourceSha: 'b'.repeat(40)
  }), /build\.commit/);
  assert.throws(() => validateInstallerReleaseManifest({
    ...MANIFEST,
    flavors: [{ flavorId: 'portal-cloud' }]
  }, {
    targetVersion: '1.2.8',
    sourceSha: SOURCE_SHA
  }), /únicamente el flavor docente-local/);
});

test('el CLI valida el manifiesto BOM y rechaza versiones o JSON inválidos', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-installer-manifest-cli-'));
  const manifestPath = path.join(tempDir, 'EvaluaPro-release-manifest.json');
  const scriptPath = fileURLToPath(new URL('../release/installer-release-manifest.mjs', import.meta.url));
  const env = {
    ...process.env,
    TARGET_VERSION: '1.2.8',
    SOURCE_SHA
  };
  try {
    fs.writeFileSync(manifestPath, Buffer.from(`\uFEFF${JSON_TEXT}`, 'utf8'));
    const success = spawnSync(process.execPath, [scriptPath, `--manifest=${manifestPath}`], { encoding: 'utf8', env });
    assert.equal(success.status, 0, success.stderr);
    assert.match(success.stdout, /versión=1\.2\.8, flavor=docente-local/);

    const wrongVersion = spawnSync(process.execPath, [scriptPath, `--manifest=${manifestPath}`], {
      encoding: 'utf8',
      env: { ...env, TARGET_VERSION: '1.2.7' }
    });
    assert.notEqual(wrongVersion.status, 0);
    assert.match(wrongVersion.stderr, /versión del manifiesto/i);

    fs.writeFileSync(manifestPath, Buffer.from('\uFEFF{"version":', 'utf8'));
    const malformed = spawnSync(process.execPath, [scriptPath, `--manifest=${manifestPath}`], { encoding: 'utf8', env });
    assert.notEqual(malformed.status, 0);
    assert.match(malformed.stderr, /Manifiesto de release inválido/);
    assert.match(malformed.stderr, /EvaluaPro-release-manifest\.json/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
