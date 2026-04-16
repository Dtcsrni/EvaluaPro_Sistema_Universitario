import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateStablePromotion } from '../release/validate-stable-promotion.mjs';

function mkTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeEvidenceDir(baseDir) {
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
      path: 'docs/release/evidencias/1.0.0-beta.1/windows-release-smoke-2026-03-20.md'
    },
    gateHumanoProduccion: {
      periodoId: 'periodo-001',
      displayVersion: '1.0.0b',
      resultado: 'ok',
      pasos
    }
  };
  fs.writeFileSync(path.join(baseDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(baseDir, 'timeline.md'), '# Timeline Gate Estable 1.0.0\n\nResultado: OK\n');
  fs.writeFileSync(path.join(baseDir, 'metrics_snapshot.txt'), 'evaluapro_lista_export_csv_total 1\n');
  fs.writeFileSync(path.join(baseDir, 'integridad_sha256.json'), `${JSON.stringify({
    csv: { hashCalculado: 'abc' },
    docx: { hashCalculado: 'def' }
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(baseDir, 'rollback_readiness.json'), `${JSON.stringify({
    version: '1.0.0',
    status: 'ready',
    previousStableVersion: '0.9.9',
    activationCriteria: ['degradacion critica'],
    rollbackSteps: ['restaurar release previa'],
    postRollbackChecks: ['GET /api/salud/live'],
    approvedBy: 'release-manager',
    approvedAt: new Date().toISOString()
  }, null, 2)}\n`);
}

function writeInstallerManifest(baseDir) {
  const manifest = {
    build: {
      version: '1.0.0',
      commit: 'abc123'
    },
    artifacts: [
      {
        name: 'EvaluaPro-release-manifest.json',
        sha256: 'abc',
        signed: false
      }
    ],
    deployment: {
      target: 'multi-flavor-windows'
    },
    flavors: [
      {
        flavorId: 'saas-completo',
        assetName: 'EvaluaPro-InstallerHub-saas-completo-v1.0.0.exe',
        msiName: 'EvaluaPro-saas-completo.msi',
        installerHubName: 'EvaluaPro-InstallerHub-saas-completo-v1.0.0.exe'
      },
      {
        flavorId: 'docente-local',
        assetName: 'EvaluaPro-InstallerHub-docente-local-v1.0.0.exe',
        msiName: 'EvaluaPro-docente-local.msi',
        installerHubName: 'EvaluaPro-InstallerHub-docente-local-v1.0.0.exe'
      }
    ]
  };
  const manifestPath = path.join(baseDir, 'EvaluaPro-release-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifestPath;
}

test('stable promotion pasa con evidencia completa, streak y manifest multi-flavor', () => {
  const evidenceDir = mkTempDir('evaluapro-stable-evidence-');
  const installerDir = mkTempDir('evaluapro-installer-manifest-');
  writeEvidenceDir(evidenceDir);
  const installerManifestPath = writeInstallerManifest(installerDir);

  const runs = Array.from({ length: 10 }).map((_, index) => ({ id: index + 1, conclusion: 'success' }));
  const result = evaluateStablePromotion({
    requiredStreak: 10,
    runs,
    evidenceDir,
    installerManifestPath
  });

  assert.equal(result.ok, true);
  assert.equal(result.checks.every((item) => item.ok), true);
});

test('stable promotion falla si el gate humano persistido no esta en ok', () => {
  const evidenceDir = mkTempDir('evaluapro-stable-evidence-failed-');
  const installerDir = mkTempDir('evaluapro-installer-manifest-failed-');
  writeEvidenceDir(evidenceDir);
  const manifestPath = path.join(evidenceDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.gateHumanoProduccion.resultado = 'fallo';
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const installerManifestPath = writeInstallerManifest(installerDir);

  const runs = Array.from({ length: 10 }).map((_, index) => ({ id: index + 1, conclusion: 'success' }));
  const result = evaluateStablePromotion({
    requiredStreak: 10,
    runs,
    evidenceDir,
    installerManifestPath
  });

  assert.equal(result.ok, false);
  assert.equal(result.checks.some((item) => item.id === 'prod-flow-evidence' && item.ok === false), true);
});

test('stable promotion falla si el manifest release es incompleto aunque tenga flavors requeridos', () => {
  const evidenceDir = mkTempDir('evaluapro-stable-evidence-invalid-manifest-');
  const installerDir = mkTempDir('evaluapro-installer-manifest-invalid-');
  writeEvidenceDir(evidenceDir);
  const installerManifestPath = writeInstallerManifest(installerDir);
  const installerManifest = JSON.parse(fs.readFileSync(installerManifestPath, 'utf8'));
  delete installerManifest.build;
  fs.writeFileSync(installerManifestPath, `${JSON.stringify(installerManifest, null, 2)}\n`);

  const runs = Array.from({ length: 10 }).map((_, index) => ({ id: index + 1, conclusion: 'success' }));
  const result = evaluateStablePromotion({
    requiredStreak: 10,
    runs,
    evidenceDir,
    installerManifestPath
  });

  assert.equal(result.ok, false);
  assert.equal(result.checks.some((item) => item.id === 'installer-multi-flavor' && item.ok === false), true);
});

