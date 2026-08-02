/**
 * release-stable-promotion.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
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

function writeQaEvidence(baseDir, overrides = {}) {
  const qaDir = path.join(baseDir, 'reports', 'qa', 'latest');
  fs.mkdirSync(qaDir, { recursive: true });
  const gates = [
    'dataset-prodlike',
    'e2e-docente-alumno',
    'global-grade',
    'evaluaciones-policy',
    'evaluaciones-e2e',
    'pdf-print',
    'ux-visual',
    'clean-architecture'
  ];
  const artefactos = [];
  for (const gate of gates) {
    const rel = `reports/qa/latest/${gate}.json`;
    const abs = path.join(baseDir, rel);
    fs.writeFileSync(abs, `${JSON.stringify({ version: '1', gate, ok: true }, null, 2)}\n`);
    artefactos.push({ archivo: rel, existe: true, bytes: 64 });
  }
  const manifest = {
    version: '1',
    artefactos,
    resumen: { total: gates.length, presentes: gates.length, faltantes: 0, estado: 'ok' },
    ...overrides
  };
  const manifestPath = path.join(baseDir, 'reports', 'qa', 'latest', 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifestPath;
}

function writeInstallerManifest(baseDir, overrides = {}) {
  const version = overrides.version || '1.0.0';
  const manifest = {
    version,
    build: {
      version,
      commit: 'abc123'
    },
    artifacts: [
      {
        name: 'EvaluaPro-release-manifest.json',
        path: 'EvaluaPro-release-manifest.json',
        sha256: 'abc',
        signed: true
      }
    ],
    deployment: {
      target: 'multi-flavor-windows'
    },
    flavors: [
      {
        flavorId: 'saas-completo',
        assetName: `EvaluaPro-InstallerHub-saas-completo-v${version}.exe`,
        msiName: 'EvaluaPro-saas-completo.msi',
        installerHubName: `EvaluaPro-InstallerHub-saas-completo-v${version}.exe`,
        installerHubVersionedName: `EvaluaPro-InstallerHub-saas-completo-v${version}.exe`
      },
      {
        flavorId: 'docente-local',
        assetName: `EvaluaPro-InstallerHub-docente-local-v${version}.exe`,
        msiName: 'EvaluaPro-docente-local.msi',
        installerHubName: `EvaluaPro-InstallerHub-docente-local-v${version}.exe`,
        installerHubVersionedName: `EvaluaPro-InstallerHub-docente-local-v${version}.exe`
      }
    ]
  };
  Object.assign(manifest, overrides.manifest || {});
  const manifestPath = path.join(baseDir, 'EvaluaPro-release-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifestPath;
}

function writeClassroomEvidence(baseDir, overrides = {}) {
  const evidence = {
    displayVersion: '1.0.0',
    operatorName: 'qa-classroom',
    windowStartedAt: '2026-06-27T00:00:00.000-06:00',
    windowEndedAt: '2026-06-27T00:30:00.000-06:00',
    entorno: 'google-classroom-real',
    periodoLabel: 'mayo-junio',
    apiBase: 'https://api.example.test/api',
    docenteIdHash: 'docente-hash',
    googleWorkspace: {
      dominio: 'example.edu',
      oauthClientConfigurado: true,
      redirectUriRegistrado: true,
      classroomTokenCipherKeyPresente: true,
      scopesClassroomAprobados: true
    },
    curso: {
      courseId: 'course-123',
      nombre: 'Electronica mayo-junio',
      periodoId: 'periodo-mayo-junio',
      alumnosClassroomTotal: 2,
      alumnosLocalesVinculados: 2
    },
    actividad: {
      courseWorkId: 'work-123',
      titulo: 'Primer parcial',
      submissionsTotal: 2,
      submissionsConCalificacion: 2,
      submissionsImportadas: 2,
      submissionsSinMatch: 0
    },
    pasos: {
      configuracionOAuthValidada: true,
      loginDocenteValidado: true,
      oauthClassroomCompletado: true,
      cursoListadoDesdeGoogle: true,
      rosterListadoDesdeGoogle: true,
      mapeoAlumnosGuardado: true,
      actividadListadaDesdeGoogle: true,
      previewImportacionRevisado: true,
      importacionPersistenteEjecutada: true,
      reimportacionIdempotenteValidada: true,
      filtrosUxUsadosEnRosterYPreview: true,
      historialSincronizacionRevisado: true
    },
    evidencias: {
      capturaRoster: 'roster.png',
      capturaPreview: 'preview.png',
      capturaResultadoImportacion: 'importacion.png',
      capturaHistorial: 'historial.png',
      requestIds: ['req-123']
    },
    resultado: 'ok',
    ...overrides
  };
  const evidencePath = path.join(baseDir, 'classroom-e2e.json');
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  return evidencePath;
}

test('stable promotion pasa con evidencia completa, streak y manifest multi-flavor', () => {
  const evidenceDir = mkTempDir('evaluapro-stable-evidence-');
  const installerDir = mkTempDir('evaluapro-installer-manifest-');
  const qaDir = mkTempDir('evaluapro-qa-evidence-');
  writeEvidenceDir(evidenceDir);
  const installerManifestPath = writeInstallerManifest(installerDir);
  const qaManifestPath = writeQaEvidence(qaDir);

  const runs = Array.from({ length: 10 }).map((_, index) => ({ id: index + 1, conclusion: 'success' }));
  const result = evaluateStablePromotion({
    version: '1.0.0',
    requiredStreak: 10,
    runs,
    evidenceDir,
    installerManifestPath,
    qaManifestPath
  });

  assert.equal(result.ok, true);
  assert.equal(result.checks.every((item) => item.ok), true);
});

test('stable promotion no exige gate humano ni Classroom manual cuando QA automatizada esta completa', () => {
  const evidenceDir = mkTempDir('evaluapro-stable-evidence-failed-');
  const installerDir = mkTempDir('evaluapro-installer-manifest-failed-');
  const qaDir = mkTempDir('evaluapro-qa-evidence-failed-');
  writeEvidenceDir(evidenceDir);
  const manifestPath = path.join(evidenceDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.gateHumanoProduccion.resultado = 'fallo';
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const installerManifestPath = writeInstallerManifest(installerDir);
  const qaManifestPath = writeQaEvidence(qaDir);

  const runs = Array.from({ length: 10 }).map((_, index) => ({ id: index + 1, conclusion: 'success' }));
  const result = evaluateStablePromotion({
    version: '1.0.0',
    requiredStreak: 10,
    runs,
    evidenceDir,
    installerManifestPath,
    qaManifestPath,
    classroomE2eManualPath: path.join(qaDir, 'missing-classroom.json')
  });

  assert.equal(result.ok, true);
  assert.equal(result.checks.some((item) => item.id === 'automated-qa-evidence' && item.ok === true), true);
});

test('stable promotion falla si el manifest release es incompleto aunque tenga flavors requeridos', () => {
  const evidenceDir = mkTempDir('evaluapro-stable-evidence-invalid-manifest-');
  const installerDir = mkTempDir('evaluapro-installer-manifest-invalid-');
  const qaDir = mkTempDir('evaluapro-qa-evidence-invalid-manifest-');
  writeEvidenceDir(evidenceDir);
  const installerManifestPath = writeInstallerManifest(installerDir);
  const qaManifestPath = writeQaEvidence(qaDir);
  const installerManifest = JSON.parse(fs.readFileSync(installerManifestPath, 'utf8'));
  delete installerManifest.build;
  fs.writeFileSync(installerManifestPath, `${JSON.stringify(installerManifest, null, 2)}\n`);

  const runs = Array.from({ length: 10 }).map((_, index) => ({ id: index + 1, conclusion: 'success' }));
  const result = evaluateStablePromotion({
    version: '1.0.0',
    requiredStreak: 10,
    runs,
    evidenceDir,
    installerManifestPath,
    qaManifestPath
  });

  assert.equal(result.ok, false);
  assert.equal(result.checks.some((item) => item.id === 'installer-multi-flavor' && item.ok === false), true);
});

test('stable promotion falla si la evidencia release no corresponde a la version objetivo', () => {
  const evidenceDir = mkTempDir('evaluapro-stable-evidence-target-version-mismatch-');
  const installerDir = mkTempDir('evaluapro-installer-manifest-target-version-mismatch-');
  const qaDir = mkTempDir('evaluapro-qa-evidence-target-version-mismatch-');
  writeEvidenceDir(evidenceDir);
  const installerManifestPath = writeInstallerManifest(installerDir, { version: '1.1.1' });
  const qaManifestPath = writeQaEvidence(qaDir);

  const runs = Array.from({ length: 10 }).map((_, index) => ({ id: index + 1, conclusion: 'success' }));
  const result = evaluateStablePromotion({
    version: '1.1.1',
    requiredStreak: 10,
    runs,
    evidenceDir,
    installerManifestPath,
    qaManifestPath
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.checks.some((item) => item.id === 'release-evidence' && item.ok === false && /version=1\.0\.0, esperado=1\.1\.1/.test(item.detail)),
    true
  );
});

test('stable promotion falla si el manifest de instalador no corresponde a la version objetivo', () => {
  const evidenceDir = mkTempDir('evaluapro-stable-evidence-version-mismatch-');
  const installerDir = mkTempDir('evaluapro-installer-manifest-version-mismatch-');
  const qaDir = mkTempDir('evaluapro-qa-evidence-version-mismatch-');
  writeEvidenceDir(evidenceDir);
  const installerManifestPath = writeInstallerManifest(installerDir, { version: '1.0.0' });
  const qaManifestPath = writeQaEvidence(qaDir);

  const runs = Array.from({ length: 10 }).map((_, index) => ({ id: index + 1, conclusion: 'success' }));
  const result = evaluateStablePromotion({
    version: '1.1.1',
    requiredStreak: 10,
    runs,
    evidenceDir,
    installerManifestPath,
    qaManifestPath
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.checks.some((item) => item.id === 'installer-multi-flavor' && item.ok === false && /build\.version=1\.0\.0, esperado=1\.1\.1/.test(item.detail)),
    true
  );
});

test('stable promotion falla si un flavor apunta a asset versionado incorrecto', () => {
  const evidenceDir = mkTempDir('evaluapro-stable-evidence-asset-version-mismatch-');
  const installerDir = mkTempDir('evaluapro-installer-manifest-asset-version-mismatch-');
  const qaDir = mkTempDir('evaluapro-qa-evidence-asset-version-mismatch-');
  writeEvidenceDir(evidenceDir);
  const installerManifestPath = writeInstallerManifest(installerDir, { version: '1.1.1' });
  const qaManifestPath = writeQaEvidence(qaDir);
  const installerManifest = JSON.parse(fs.readFileSync(installerManifestPath, 'utf8'));
  installerManifest.flavors[1].installerHubName = 'EvaluaPro-InstallerHub-docente-local-v1.1.0.exe';
  fs.writeFileSync(installerManifestPath, `${JSON.stringify(installerManifest, null, 2)}\n`);

  const runs = Array.from({ length: 10 }).map((_, index) => ({ id: index + 1, conclusion: 'success' }));
  const result = evaluateStablePromotion({
    version: '1.1.1',
    requiredStreak: 10,
    runs,
    evidenceDir,
    installerManifestPath,
    qaManifestPath
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.checks.some((item) => item.id === 'installer-multi-flavor' && item.ok === false && /installerHubName invalido/.test(item.detail)),
    true
  );
});

test('stable promotion falla si el catalogo de artefactos contiene un Hub de otra version', () => {
  const evidenceDir = mkTempDir('evaluapro-stable-evidence-artifact-version-mismatch-');
  const installerDir = mkTempDir('evaluapro-installer-manifest-artifact-version-mismatch-');
  const qaDir = mkTempDir('evaluapro-qa-evidence-artifact-version-mismatch-');
  writeEvidenceDir(evidenceDir);
  const installerManifestPath = writeInstallerManifest(installerDir, { version: '1.1.1' });
  const qaManifestPath = writeQaEvidence(qaDir);
  const installerManifest = JSON.parse(fs.readFileSync(installerManifestPath, 'utf8'));
  installerManifest.artifacts.push({
    name: 'EvaluaPro-InstallerHub-docente-local-v1.1.0.exe',
    path: 'docente-local/EvaluaPro-InstallerHub-docente-local-v1.1.0.exe',
    sha256: 'abc123',
    signed: true
  });
  fs.writeFileSync(installerManifestPath, `${JSON.stringify(installerManifest, null, 2)}\n`);

  const runs = Array.from({ length: 10 }).map((_, index) => ({ id: index + 1, conclusion: 'success' }));
  const result = evaluateStablePromotion({
    version: '1.1.1',
    requiredStreak: 10,
    runs,
    evidenceDir,
    installerManifestPath,
    qaManifestPath
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.checks.some((item) => item.id === 'installer-multi-flavor' && item.ok === false && /artefactos Installer Hub de otra version/.test(item.detail)),
    true
  );
});

test('stable promotion falla si algun artefacto de instalador no esta firmado', () => {
  const evidenceDir = mkTempDir('evaluapro-stable-evidence-unsigned-installer-');
  const installerDir = mkTempDir('evaluapro-installer-manifest-unsigned-');
  const qaDir = mkTempDir('evaluapro-qa-evidence-unsigned-installer-');
  writeEvidenceDir(evidenceDir);
  const installerManifestPath = writeInstallerManifest(installerDir);
  const qaManifestPath = writeQaEvidence(qaDir);
  const installerManifest = JSON.parse(fs.readFileSync(installerManifestPath, 'utf8'));
  installerManifest.artifacts.push({
    name: 'EvaluaPro-InstallerHub-docente-local-v1.0.0.exe',
    path: 'docente-local/EvaluaPro-InstallerHub-docente-local-v1.0.0.exe',
    sha256: 'def',
    signed: false
  });
  fs.writeFileSync(installerManifestPath, `${JSON.stringify(installerManifest, null, 2)}\n`);

  const runs = Array.from({ length: 10 }).map((_, index) => ({ id: index + 1, conclusion: 'success' }));
  const result = evaluateStablePromotion({
    version: '1.0.0',
    requiredStreak: 10,
    runs,
    evidenceDir,
    installerManifestPath,
    qaManifestPath
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.checks.some((item) => item.id === 'installer-multi-flavor' && item.ok === false && /sin firma/i.test(item.detail)),
    true
  );
});

test('stable promotion falla si un artefacto firmado no tiene path verificable', () => {
  const evidenceDir = mkTempDir('evaluapro-stable-evidence-artifact-no-path-');
  const installerDir = mkTempDir('evaluapro-installer-manifest-artifact-no-path-');
  const qaDir = mkTempDir('evaluapro-qa-evidence-artifact-no-path-');
  writeEvidenceDir(evidenceDir);
  const installerManifestPath = writeInstallerManifest(installerDir);
  const qaManifestPath = writeQaEvidence(qaDir);
  const installerManifest = JSON.parse(fs.readFileSync(installerManifestPath, 'utf8'));
  delete installerManifest.artifacts[0].path;
  fs.writeFileSync(installerManifestPath, `${JSON.stringify(installerManifest, null, 2)}\n`);

  const runs = Array.from({ length: 10 }).map((_, index) => ({ id: index + 1, conclusion: 'success' }));
  const result = evaluateStablePromotion({
    version: '1.0.0',
    requiredStreak: 10,
    runs,
    evidenceDir,
    installerManifestPath,
    qaManifestPath
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.checks.some((item) => item.id === 'installer-multi-flavor' && item.ok === false && /path o sha256/i.test(item.detail)),
    true
  );
});

test('stable promotion falla si falta evidencia automatizada de UX/UI y flujo docente', () => {
  const evidenceDir = mkTempDir('evaluapro-stable-evidence-no-qa-');
  const installerDir = mkTempDir('evaluapro-installer-manifest-no-qa-');
  const qaDir = mkTempDir('evaluapro-qa-evidence-missing-');
  writeEvidenceDir(evidenceDir);
  const installerManifestPath = writeInstallerManifest(installerDir);
  const qaManifestPath = writeQaEvidence(qaDir, {
    resumen: { total: 8, presentes: 7, faltantes: 1, estado: 'missing-artifacts' }
  });

  const runs = Array.from({ length: 10 }).map((_, index) => ({ id: index + 1, conclusion: 'success' }));
  const result = evaluateStablePromotion({
    version: '1.0.0',
    requiredStreak: 10,
    runs,
    evidenceDir,
    installerManifestPath,
    qaManifestPath
  });

  assert.equal(result.ok, false);
  assert.equal(result.checks.some((item) => item.id === 'automated-qa-evidence' && item.ok === false), true);
});

test('stable promotion valida presencia y estructura del gate de release', () => {
  const evidenceDir = mkTempDir('evaluapro-stable-evidence-gate-');
  const installerDir = mkTempDir('evaluapro-installer-manifest-gate-');
  const qaDir = mkTempDir('evaluapro-qa-evidence-gate-');
  writeEvidenceDir(evidenceDir);
  const installerManifestPath = writeInstallerManifest(installerDir);
  const qaManifestPath = writeQaEvidence(qaDir);

  const runs = Array.from({ length: 10 }).map((_, index) => ({ id: index + 1, conclusion: 'success' }));
  const result = evaluateStablePromotion({
    version: '1.0.0',
    requiredStreak: 10,
    runs,
    evidenceDir,
    installerManifestPath,
    qaManifestPath
  });

  assert.equal(result.ok, true);
});

