/**
 * stabilization-completion-audit.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const auditPath = path.join(root, 'docs', 'release', 'manual', 'stabilization-completion-audit-2026-05-27.md');

test('auditoria de completitud conserva cierre parcial y evidencia requerida', () => {
  assert.equal(fs.existsSync(auditPath), true, 'debe existir auditoria de completitud versionada');
  const audit = fs.readFileSync(auditPath, 'utf8');

  assert.match(audit, /Estado: `partial`/);
  assert.match(audit, /E2E mutativo completo/);
  assert.match(audit, /install.*repair.*update smoke.*uninstall/s);
  assert.match(audit, /ejecutar en esta PC/);
  assert.match(audit, /-IUnderstandThisMutatesPc/);

  for (const command of [
    'npm run test:gui:screen-matrix',
    'npm run test:gui:design-contract',
    'npm run test:gui:responsive:e2e:ci',
    'npm run test:installer-hub:contract',
    'npm run test:installer-hub:ui',
    'npm run installer:hub:e2e:local',
    'npm run test:dashboard:repair',
    'npm run test:dashboard:ui'
  ]) {
    assert.match(audit, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `falta comando ${command}`);
  }

  const removedExternalDesignPattern = new RegExp(['FIG', 'MA|fig', 'ma|GUI_REDISENO_FIG', 'MA'].join(''), 'i');
  assert.doesNotMatch(audit, removedExternalDesignPattern);
});
