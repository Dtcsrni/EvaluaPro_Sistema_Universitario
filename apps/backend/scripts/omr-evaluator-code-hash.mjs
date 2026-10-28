import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fingerprintModulePath = path.join(
  backendRoot,
  'src',
  'modulos',
  'modulo_escaneo_omr',
  'evaluatorCodeFingerprint.ts'
);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function listTypeScriptFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listTypeScriptFiles(entryPath));
    else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(entryPath);
  }
  return files;
}

export async function calcularHuellaCodigoEvaluador() {
  const codeFiles = [
    path.join(backendRoot, 'scripts', 'omr-tv4-validate-pilot-real.ts'),
    path.join(backendRoot, 'scripts', 'omr-evaluator-code-hash.mjs'),
    path.join(backendRoot, 'package.json'),
    path.join(backendRoot, 'package-lock.json'),
    path.join(backendRoot, 'tsconfig.json'),
    path.resolve(backendRoot, '..', '..', 'package-lock.json'),
    path.resolve(backendRoot, '..', '..', 'tsconfig.base.json'),
    path.join(backendRoot, 'src', 'compartido', 'utilidades', 'calculoCalificacion.ts'),
    ...await listTypeScriptFiles(path.join(backendRoot, 'src', 'modulos', 'modulo_escaneo_omr')),
    ...await listTypeScriptFiles(path.join(backendRoot, 'src', 'modulos', 'modulo_calificacion'))
  ].filter((filePath) => path.resolve(filePath) !== fingerprintModulePath).sort();

  const codeHashes = await Promise.all(codeFiles.map(async (filePath) => ({
    file: path.relative(backendRoot, filePath).replaceAll('\\', '/'),
    sha256: sha256(await fs.readFile(filePath))
  })));
  return sha256(JSON.stringify(codeHashes));
}

function moduleSource(sha256Value) {
  return `/** Generado por scripts/omr-evaluator-code-hash.mjs; no editar a mano. */\nexport const EVALUAPRO_OMR_EVALUATOR_CODE_SHA256 = '${sha256Value}';\n`;
}

const mode = process.argv[2];
if (mode === '--write') {
  await fs.writeFile(fingerprintModulePath, moduleSource(await calcularHuellaCodigoEvaluador()), 'utf8');
} else if (mode === '--check') {
  const expected = moduleSource(await calcularHuellaCodigoEvaluador());
  const actual = await fs.readFile(fingerprintModulePath, 'utf8').catch(() => '');
  if (actual !== expected) {
    console.error('La huella del evaluador OMR está desactualizada; ejecuta npm -C apps/backend run omr:fingerprint:write.');
    process.exitCode = 1;
  }
} else if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.error('Uso: node scripts/omr-evaluator-code-hash.mjs <--write|--check>');
  process.exitCode = 2;
}
