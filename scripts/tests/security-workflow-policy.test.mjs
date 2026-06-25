/**
 * security-workflow-policy.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('workflow CodeQL existe y contiene contrato minimo', () => {
  const workflowPath = path.join(root, '.github', 'workflows', 'security-codeql.yml');
  assert.equal(fs.existsSync(workflowPath), true);
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /name:\s*Security CodeQL/i);
  assert.match(workflow, /pull_request:/i);
  assert.match(workflow, /push:/i);
  assert.match(workflow, /github\/codeql-action\/init@/i);
  assert.match(workflow, /github\/codeql-action\/analyze@/i);
  assert.match(workflow, /javascript-typescript/i);
});

