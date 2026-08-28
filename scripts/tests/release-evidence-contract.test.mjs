/**
 * release-evidence-contract.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateEvidenceContract } from '../release/check-release-evidence.mjs';

function mkEvidenceDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-release-evidence-'));
}

function writeEvidence(baseDir, { includeIntegrity = true } = {}) {
  const pasos = Array.from({ length: 10 }).map((_, index) => ({
    id: `p${index + 1}`,
    nombre: `Paso ${index + 1}`,
    resultado: 'ok'
  }));
  const manifest = {
    version: '1.0.0',
    displayVersion: '1.0.0b',
    commit: 'abc123',
    ciConsecutivoVerde: 10,
    evidenciaWindows: {
      path: 'docs/release/evidencias/1.1.1/windows-release-smoke.md'
    },
    gateHumanoProduccion: {
      periodoId: 'p-001',
      displayVersion: '1.0.0b',
      resultado: 'ok',
      pasos
    }
  };
  fs.writeFileSync(path.join(baseDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(baseDir, 'timeline.md'), '# Timeline Gate Estable 1.0.0\n\nResultado: OK\n');
  fs.writeFileSync(path.join(baseDir, 'metrics_snapshot.txt'), 'evaluapro_lista_export_csv_total 1\n');
  if (includeIntegrity) {
    const integrity = {
      csv: { hashCalculado: 'abc' },
      docx: { hashCalculado: 'def' }
    };
    fs.writeFileSync(path.join(baseDir, 'integridad_sha256.json'), `${JSON.stringify(integrity, null, 2)}\n`);
  }
  const rollback = {
    version: '1.0.0',
    status: 'ready',
    previousStableVersion: '0.9.9',
    activationCriteria: ['readiness inestable'],
    rollbackSteps: ['restaurar release estable previa'],
    postRollbackChecks: ['GET /api/salud/live', 'GET /api/portal/salud/live'],
    approvedBy: 'release-manager',
    approvedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(baseDir, 'rollback_readiness.json'), `${JSON.stringify(rollback, null, 2)}\n`);
}

test('release evidence falla si falta archivo obligatorio', () => {
  const dir = mkEvidenceDir();
  writeEvidence(dir, { includeIntegrity: false });
  assert.throws(() => validateEvidenceContract(dir), /integridad_sha256\.json/i);
});

test('release evidence pasa con estructura completa', () => {
  const dir = mkEvidenceDir();
  writeEvidence(dir, { includeIntegrity: true });
  const result = validateEvidenceContract(dir);
  assert.equal(Boolean(result.manifestPath), true);
  assert.equal(Boolean(result.integrityPath), true);
});
