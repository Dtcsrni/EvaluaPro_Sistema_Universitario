#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const eolOnlyAllowlist = new Set([
  'docs/specs/SPEC-109_aislamiento_regeneracion_examen_en_cobertura.spec.md',
  'scripts/testing/run-backend-coverage-batches.mjs',
  'scripts/tests/backend-coverage-batches.test.mjs'
]);

const stage = process.argv.slice(2).join(' ') || 'etapa sin nombre';

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
}

function fail(paths, reason) {
  console.error(`Primera etapa que modificó el checkout candidato: ${stage}`);
  console.error(reason);
  for (const item of paths) console.error(` - ${item}`);
  process.exitCode = 1;
}

let status;
try {
  status = git(['status', '--porcelain=v1', '--untracked-files=all']);
} catch (error) {
  console.error(`No se pudo consultar el checkout candidato en la etapa '${stage}': ${error.message}`);
  process.exit(2);
}

const entries = status.split(/\r?\n/).filter(Boolean).map((line) => ({
  code: line.slice(0, 2),
  path: line.slice(3)
}));
if (entries.length === 0) process.exit(0);

const rejected = [];
const tolerated = [];
for (const { code, path } of entries) {
  const staged = code[0] !== ' ' && code[0] !== '?';
  const untracked = code === '??';
  const unstagedModification = code === ' M';
  if (staged || untracked || !unstagedModification || !eolOnlyAllowlist.has(path)) {
    rejected.push(`${code} ${path}`);
    continue;
  }

  let semanticDiff;
  try {
    execFileSync('git', ['diff', '--ignore-cr-at-eol', '--quiet', '--', path], { stdio: 'ignore' });
    semanticDiff = false;
  } catch (error) {
    if (error.status === 1) semanticDiff = true;
    else {
      console.error(`No se pudo comparar '${path}' en la etapa '${stage}': ${error.message}`);
      process.exit(2);
    }
  }

  if (semanticDiff) rejected.push(`${code} ${path} (diferencia de contenido)`);
  else tolerated.push(path);
}

if (rejected.length > 0) fail(rejected, 'El checkout contiene cambios no permitidos:');
else if (tolerated.length > 0) console.log(`Diferencias EOL heredadas permitidas en ${stage}: ${tolerated.join(', ')}`);
