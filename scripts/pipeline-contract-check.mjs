/**
 * pipeline-contract-check
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const requiredFiles = ['ci/pipeline.contract.md', 'ci/pipeline.matrix.json'];

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing ${relativePath}`);
  }
}

const testResult = spawnSync(process.execPath, ['--test', 'scripts/tests/ci-workflow-contract.test.mjs'], {
  cwd: root,
  stdio: 'inherit'
});

if (testResult.status !== 0) {
  throw new Error('Pipeline workflow contract check failed');
}

console.log('pipeline contract OK');
