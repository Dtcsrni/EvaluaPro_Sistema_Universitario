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
  assert.match(audit, /E2E real mutante del Installer Hub/);
  assert.match(audit, /install.*repair.*update smoke.*uninstall/s);
  assert.match(audit, /EVALUAPRO_E2E_VM_SNAPSHOT/);
  assert.match(audit, /-IUnderstandThisMutatesVm/);
  assert.match(audit, /Get-VM EvaluaPro-E2E-Win11.*Running.*MemoryAssigned=3221225472/s);
  assert.match(audit, /Test-WSMan EVALPRO-E2E.*responde/s);
  assert.match(audit, /WinRM con `EVALPRO-E2E\\evaluaqa` vuelve a autenticar/s);
  assert.match(audit, /%APPDATA%\\EvaluaPro\\e2e-qa-pass\.dpapi/s);
  assert.match(audit, /reports\/qa\/installer-hub-e2e-docente\/20260602-042758\/report\.json/s);
  assert.match(audit, /No aparecio Installer Hub para mode=install/s);
  assert.match(audit, /quser: No User exists/s);

  for (const command of [
    'npm run test:gui:screen-matrix',
    'npm run test:gui:design-contract',
    'npm run test:gui:responsive:e2e:ci',
    'npm run test:installer-hub:contract',
    'npm run test:installer-hub:ui',
    'npm run installer:hub:vm-readiness',
    'npm run installer:hub:e2e:elevated',
    'npm run test:dashboard:repair',
    'npm run test:dashboard:ui'
  ]) {
    assert.match(audit, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `falta comando ${command}`);
  }

  const removedExternalDesignPattern = new RegExp(['FIG', 'MA|fig', 'ma|GUI_REDISENO_FIG', 'MA'].join(''), 'i');
  assert.doesNotMatch(audit, removedExternalDesignPattern);
});
