#!/usr/bin/env node
/**
 * validate-anon-fixture
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * validate-anon-fixture
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const inputPath = path.resolve(process.cwd(), process.env.ANON_INPUT_GZ || 'tests/fixtures/prodlike/prodlike-anon.json.gz');
const reportPath = path.resolve(process.cwd(), process.env.ANON_REPORT_JSON || 'reports/qa/latest/dataset-prodlike.json');

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const MATRICULA_REAL_REGEX = /\bCUH\d{6,}\b/i;
const TOKEN_LIKE_REGEX = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/;

function walk(value, onLeaf, pathParts = []) {
  if (Array.isArray(value)) {
    value.forEach((item, idx) => walk(item, onLeaf, [...pathParts, `[${idx}]`]));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      walk(item, onLeaf, [...pathParts, key]);
    }
    return;
  }
  onLeaf(value, pathParts.join('.'));
}

async function main() {
  const gz = await fs.readFile(inputPath);
  const json = zlib.gunzipSync(gz).toString('utf8');
  const parsed = JSON.parse(json);

  const hallazgos = [];
  const conteos = {
    periodos: Array.isArray(parsed.periodos) ? parsed.periodos.length : 0,
    alumnos: Array.isArray(parsed.alumnos) ? parsed.alumnos.length : 0,
    docentes: Array.isArray(parsed.docentes) ? parsed.docentes.length : 0,
    examenes: Array.isArray(parsed.examenes) ? parsed.examenes.length : 0
  };

  walk(parsed, (value, pointer) => {
    const text = String(value ?? '');
    if (!text) return;
    if (EMAIL_REGEX.test(text) && !text.endsWith('@example.invalid')) {
      hallazgos.push({ tipo: 'correo_real', pointer, valor: text });
    }
    if (MATRICULA_REAL_REGEX.test(text)) {
      hallazgos.push({ tipo: 'matricula_real', pointer, valor: text });
    }
    if (TOKEN_LIKE_REGEX.test(text)) {
      hallazgos.push({ tipo: 'token_detectado', pointer, valor: text.slice(0, 16) });
    }
  });

  const resultado = {
    version: '1',
    ejecutadoEn: new Date().toISOString(),
    archivo: path.relative(process.cwd(), inputPath),
    conteos,
    hallazgos,
    valido: hallazgos.length === 0
  };

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(resultado, null, 2)}\n`, 'utf8');

  if (!resultado.valido) {
    process.stderr.write(`[validate-anon-fixture] ERROR -> ${hallazgos.length} hallazgos de PII/token\n`);
    process.exit(1);
  }
  process.stdout.write('[validate-anon-fixture] OK\n');
}

main().catch((error) => {
  process.stderr.write(`[validate-anon-fixture] ERROR: ${String(error?.message || error)}\n`);
  process.exit(1);
});

