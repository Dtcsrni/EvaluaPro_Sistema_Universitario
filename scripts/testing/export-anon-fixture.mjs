#!/usr/bin/env node
/**
 * export-anon-fixture
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * export-anon-fixture
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * export-anon-fixture
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const inputPath = path.resolve(process.cwd(), process.env.ANON_SOURCE_JSON || 'tests/fixtures/prodlike/source.raw.json');
const outputPath = path.resolve(process.cwd(), process.env.ANON_OUTPUT_GZ || 'tests/fixtures/prodlike/prodlike-anon.json.gz');

function hashToken(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 12);
}

function normalizeName(prefix, index) {
  return `${prefix} ${String(index).padStart(4, '0')}`;
}

function anonymizeRecord(record, counters) {
  if (!record || typeof record !== 'object') return record;
  const output = Array.isArray(record) ? [] : {};
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      output[key] = value.map((item) => anonymizeRecord(item, counters));
      continue;
    }
    if (value && typeof value === 'object') {
      output[key] = anonymizeRecord(value, counters);
      continue;
    }

    const lower = key.toLowerCase();
    if (lower.includes('correo') || lower.includes('email')) {
      counters.email += 1;
      output[key] = `anon-${hashToken(value)}@example.invalid`;
      continue;
    }
    if (lower.includes('matricula')) {
      counters.matricula += 1;
      output[key] = `ANON${String(counters.matricula).padStart(8, '0')}`;
      continue;
    }
    if (lower.includes('nombre') || lower.includes('apellido')) {
      counters.nombre += 1;
      output[key] = normalizeName('Anon', counters.nombre);
      continue;
    }
    if (lower.includes('token') || lower.includes('secret') || lower.includes('contrasena') || lower.includes('password')) {
      output[key] = undefined;
      continue;
    }

    output[key] = value;
  }
  return output;
}

async function main() {
  const raw = await fs.readFile(inputPath, 'utf8');
  const parsed = JSON.parse(raw);
  const counters = { email: 0, matricula: 0, nombre: 0 };
  const anonymized = anonymizeRecord(parsed, counters);
  const json = `${JSON.stringify(anonymized, null, 2)}\n`;
  const gz = zlib.gzipSync(Buffer.from(json, 'utf8'));

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, gz);

  process.stdout.write(
    `[export-anon-fixture] OK -> ${outputPath} (emails=${counters.email}, matriculas=${counters.matricula}, nombres=${counters.nombre})\n`
  );
}

main().catch((error) => {
  process.stderr.write(`[export-anon-fixture] ERROR: ${String(error?.message || error)}\n`);
  process.exit(1);
});

