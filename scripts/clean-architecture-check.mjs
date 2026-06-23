/**
 * clean-architecture-check
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const outPath = path.join(root, 'reports', 'qa', 'latest', 'clean-architecture.json');

const checks = [];

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

function exists(filePath) {
  return fs.existsSync(path.join(root, filePath));
}

function addCheck(id, ok, detail) {
  checks.push({ id, ok, detail });
}

function lineCount(filePath) {
  const content = read(filePath);
  return content.split(/\r?\n/g).length;
}

function grepCount(pattern, scope) {
  try {
    const out = execFileSync(
      'rg',
      [
        '-n',
        '--hidden',
        '-g',
        '!*reports/**',
        '-g',
        '!*.md',
        '-g',
        '!scripts/clean-architecture-check.mjs',
        '-S',
        pattern,
        ...scope
      ],
      { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }
    ).toString();
    return out.split(/\r?\n/g).filter(Boolean).length;
  } catch {
    return 0;
  }
}

const appDocenteLines = lineCount('apps/frontend/src/apps/app_docente/AppDocente.tsx');
const seccionEscaneoLines = lineCount('apps/frontend/src/apps/app_docente/SeccionEscaneo.tsx');
addCheck(
  'size.frontend.app_docente.files',
  appDocenteLines <= 1300 && seccionEscaneoLines <= 1100,
  `AppDocente=${appDocenteLines}, SeccionEscaneo=${seccionEscaneoLines}`
);

const bannedTokens = [
  { id: 'token.api.v2', pattern: '/api/v2' },
  { id: 'token.engineUsed', pattern: 'engineUsed' }
];

for (const token of bannedTokens) {
  const count = grepCount(token.pattern, ['apps/backend/src', 'apps/frontend/src', 'apps/portal_alumno_cloud/src', 'scripts']);
  addCheck(token.id, count === 0, `${token.pattern} matches=${count}`);
}

const pdfCompatCount = grepCount('totalReactivos', ['apps/backend/src/modulos/modulo_generacion_pdf']);
addCheck('token.pdf.totalReactivos.compat', pdfCompatCount === 0, `totalReactivos matches=${pdfCompatCount}`);

const removedFiles = [
  'apps/backend/src/compartido/observabilidad/middlewareVersionadoApi.ts',
  'apps/backend/src/compartido/observabilidad/metricsAdopcion.ts'
];

for (const filePath of removedFiles) {
  addCheck(`removed.${filePath}`, !exists(filePath), `${filePath} exists=${exists(filePath)}`);
}

const ok = checks.every((c) => c.ok);
const report = {
  version: 1,
  gate: 'clean-architecture',
  strict,
  generatedAt: new Date().toISOString(),
  ok,
  checks
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`[clean-architecture] ${ok ? 'OK' : 'FAIL'} -> ${path.relative(root, outPath)}\n`);
if (strict && !ok) process.exit(1);
