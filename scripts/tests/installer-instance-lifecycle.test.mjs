import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  canApplyUpdate,
  classifyInstanceState,
  isSideBySideSafe,
  lifecycleDecision
} from '../instance-lifecycle.mjs';

test('el ciclo de vida no autoriza downgrade cuando la copia local es más nueva', () => {
  assert.deepEqual(canApplyUpdate('1.1.6', '1.1.1'), { allowed: false, reason: 'local-ahead-of-official' });
  assert.equal(classifyInstanceState({
    manifestPresent: true,
    payloadPresent: true,
    dataPresent: true,
    currentVersion: '1.1.6',
    officialVersion: '1.1.1'
  }), 'local-ahead-of-official');
});

test('una instancia sin payload pero con datos es orphaned y no se borra automáticamente', () => {
  const state = classifyInstanceState({ dataPresent: true });
  assert.equal(state, 'orphaned');
  assert.equal(lifecycleDecision(state).canAutoDelete, false);
  assert.equal(lifecycleDecision(state).preserveDataByDefault, true);
});

test('raíces o puertos compartidos bloquean side-by-side', () => {
  assert.equal(isSideBySideSafe({ flavorId: 'docente-local', installDir: 'C:/EvaluaPro-A', dataDir: 'C:/Data-A', ports: [4000] }, { flavorId: 'saas-completo', installDir: 'C:/EvaluaPro-B', dataDir: 'C:/Data-B', ports: [4518] }), true);
  assert.equal(isSideBySideSafe({ flavorId: 'docente-local', installDir: 'C:/EvaluaPro', dataDir: 'C:/Data-A', ports: [4000] }, { flavorId: 'saas-completo', installDir: 'C:/EvaluaPro', dataDir: 'C:/Data-B', ports: [4518] }), false);
  assert.equal(isSideBySideSafe({ flavorId: 'docente-local', installDir: 'C:/A', dataDir: 'C:/Data-A', ports: [4000] }, { flavorId: 'saas-completo', installDir: 'C:/B', dataDir: 'C:/Data-B', ports: [4000] }), false);
});

test('manifest incompleto se clasifica como reparable y requiere respaldo', () => {
  const state = classifyInstanceState({ manifestPresent: true, payloadPresent: false, dataPresent: true });
  assert.equal(state, 'legacy');
  const decision = lifecycleDecision(state);
  assert.equal(decision.canRepair, true);
  assert.equal(decision.cleanupRequiresExplicitConfirmation, true);
});

test('el helper detiene solo procesos Node con ownership de la instancia', () => {
  const helper = fs.readFileSync(path.resolve('scripts/installer-burn/InstallerBurnHelper.ps1'), 'utf8');
  assert.match(helper, /Get-EvaluaProOwnedNodeProcessIds/);
  assert.match(helper, /Stop-EvaluaProOwnedNodeProcesses/);
  assert.doesNotMatch(helper, /Stop-Process -Name ["']node["']/i);
});
