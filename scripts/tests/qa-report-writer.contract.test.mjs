/**
 * Contrato del escritor de reportes QA.
 * Evita que un archivo de evidencia bloqueado convierta un gate verde en EPERM.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

test('el escritor QA usa reemplazo atómico y fallback ante archivos bloqueados', async () => {
  const source = await readFile(resolve(root, 'scripts/testing/run-gate-with-report.mjs'), 'utf8');

  assert.match(source, /\.tmp/);
  assert.match(source, /fs\.rename\(temporary, absolute\)/);
  assert.match(source, /esErrorPermiso/);
  assert.match(source, /reporte alterno/);
  assert.match(source, /os\.tmpdir\(\)/);
});
