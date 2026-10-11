import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

test('el gate estricto de arquitectura incluye la validación de módulos',()=>{
  const root=process.cwd();
  execFileSync(process.execPath,['scripts/clean-architecture-check.mjs','--strict'],{cwd:root,stdio:'pipe'});
  const report=JSON.parse(fs.readFileSync(path.join(root,'reports/qa/latest/clean-architecture.json'),'utf8'));
  assert.equal(report.ok,true);
  assert.equal(report.moduleContracts.ok,true);
  assert.ok(report.checks.some(check=>check.id==='modules.contracts'&&check.ok));
});
