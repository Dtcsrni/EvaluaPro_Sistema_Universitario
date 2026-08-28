#!/usr/bin/env node
/**
 * import-anon-fixture
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * import-anon-fixture
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * import-anon-fixture
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const inputPath = path.resolve(process.cwd(), process.env.ANON_INPUT_GZ || 'tests/fixtures/prodlike/prodlike-anon.json.gz');
const outputPath = path.resolve(process.cwd(), process.env.ANON_IMPORTED_JSON || 'reports/qa/latest/prodlike-imported.json');

async function main() {
  const gz = await fs.readFile(inputPath);
  const json = zlib.gunzipSync(gz).toString('utf8');
  const parsed = JSON.parse(json);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');

  process.stdout.write(`[import-anon-fixture] OK -> ${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`[import-anon-fixture] ERROR: ${String(error?.message || error)}\n`);
  process.exit(1);
});

