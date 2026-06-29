/**
 * classroom-e2e-evidence.test
 *
 * Responsabilidad: Contrato de evidencia manual para Google Classroom real.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateClassroomE2eEvidence } from '../release/check-classroom-e2e-evidence.mjs';

function mkEvidenceFile(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-classroom-e2e-'));
  const evidence = {
    displayVersion: '1.1.0',
    operatorName: 'qa-classroom',
    windowStartedAt: '2026-06-27T00:00:00.000-06:00',
    windowEndedAt: '2026-06-27T00:30:00.000-06:00',
    notes: 'Evidencia sin secretos',
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
      alumnosClassroomTotal: 3,
      alumnosLocalesVinculados: 3
    },
    actividad: {
      courseWorkId: 'work-123',
      titulo: 'Primer parcial',
      submissionsTotal: 3,
      submissionsConCalificacion: 3,
      submissionsImportadas: 3,
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
      capturaRoster: 'docs/release/evidencias/classroom/roster.png',
      capturaPreview: 'docs/release/evidencias/classroom/preview.png',
      capturaResultadoImportacion: 'docs/release/evidencias/classroom/importacion.png',
      capturaHistorial: 'docs/release/evidencias/classroom/historial.png',
      requestIds: ['req-123']
    },
    resultado: 'ok',
    ...overrides
  };
  const file = path.join(dir, 'classroom.json');
  fs.writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
  return file;
}

test('classroom e2e evidence pasa con datos reales no sensibles', () => {
  const file = mkEvidenceFile();
  const result = validateClassroomE2eEvidence(file);
  assert.equal(result.courseId, 'course-123');
  assert.equal(result.submissionsImportadas, 3);
});

test('classroom e2e evidence rechaza placeholders', () => {
  const file = mkEvidenceFile({
    curso: {
      courseId: '<course-id-real>',
      nombre: 'Electronica mayo-junio',
      periodoId: 'periodo-mayo-junio',
      alumnosClassroomTotal: 3,
      alumnosLocalesVinculados: 3
    }
  });
  assert.throws(() => validateClassroomE2eEvidence(file), /curso\.courseId/i);
});

test('classroom e2e evidence rechaza pasos incompletos', () => {
  const file = mkEvidenceFile({
    pasos: {
      configuracionOAuthValidada: true
    }
  });
  assert.throws(() => validateClassroomE2eEvidence(file), /pasos\.loginDocenteValidado/i);
});
