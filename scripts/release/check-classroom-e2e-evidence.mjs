#!/usr/bin/env node
/**
 * check-classroom-e2e-evidence
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * check-classroom-e2e-evidence
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * check-classroom-e2e-evidence
 *
 * Responsabilidad: Validar evidencia manual del E2E real de Google Classroom.
 * Limites: No ejecuta Google APIs ni persiste secretos; valida contrato documental.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const CAMPOS_GOOGLE = [
  'clientIdDesktopVerificado',
  'pkceS256Verificado',
  'callbackLoopbackValidado',
  'dpapiCurrentUserVerificado',
  'scopesClassroomAprobados',
  'consentimientoDisponibleParaDocentes'
];

const PASOS_REQUERIDOS = [
  'configuracionOAuthValidada',
  'loginDocenteValidado',
  'oauthClassroomCompletado',
  'cursoListadoDesdeGoogle',
  'rosterListadoDesdeGoogle',
  'mapeoAlumnosGuardado',
  'actividadListadaDesdeGoogle',
  'previewImportacionRevisado',
  'importacionPersistenteEjecutada',
  'reimportacionIdempotenteValidada',
  'filtrosUxUsadosEnRosterYPreview',
  'historialSincronizacionRevisado'
];

const EVIDENCIAS_REQUERIDAS = [
  'capturaRoster',
  'capturaPreview',
  'capturaResultadoImportacion',
  'capturaHistorial'
];

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function esPlaceholder(value) {
  const texto = String(value || '').trim();
  return !texto || /^<.*>$/.test(texto) || texto.includes('placeholder');
}

function assertStringReal(value, label) {
  if (esPlaceholder(value)) {
    throw new Error(`${label} invalido o placeholder`);
  }
}

function assertPositiveNumber(value, label) {
  const numero = Number(value);
  if (!Number.isFinite(numero) || numero <= 0) {
    throw new Error(`${label} debe ser mayor a cero`);
  }
}

function assertNonNegativeNumber(value, label) {
  const numero = Number(value);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error(`${label} debe ser cero o mayor`);
  }
}

function esFechaLimiteValida(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) {
    return false;
  }
  const fechaDia = value.slice(0, 10);
  const fechaUtc = new Date(`${fechaDia}T00:00:00.000Z`);
  return fechaUtc.toISOString().slice(0, 10) === fechaDia && Number.isFinite(Date.parse(value));
}

function validateActividad(actividad) {
  assertStringReal(actividad.courseWorkId, 'actividad.courseWorkId');
  assertStringReal(actividad.titulo, 'actividad.titulo');
  assertStringReal(actividad.topicId, 'actividad.topicId');
  assertStringReal(actividad.tema, 'actividad.tema');
  if (!Object.hasOwn(actividad, 'fechaLimite')) {
    throw new Error('actividad.fechaLimite es obligatorio; usa null cuando Google no reporte fecha limite');
  }
  const fechaLimiteValida = esFechaLimiteValida(actividad.fechaLimite);
  if (actividad.fechaLimite !== null && !fechaLimiteValida) {
    throw new Error('actividad.fechaLimite debe ser una fecha ISO valida o null');
  }

  assertPositiveNumber(actividad.submissionsTotal, 'actividad.submissionsTotal');
  assertPositiveNumber(actividad.submissionsConCalificacion, 'actividad.submissionsConCalificacion');
  assertPositiveNumber(actividad.submissionsImportadas, 'actividad.submissionsImportadas');
  assertNonNegativeNumber(actividad.submissionsSinMatch, 'actividad.submissionsSinMatch');
  if (Number(actividad.submissionsImportadas) > Number(actividad.submissionsTotal)) {
    throw new Error('actividad.submissionsImportadas no puede exceder submissionsTotal');
  }
}

function validateGoogleWorkspace(workspace) {
  for (const campo of CAMPOS_GOOGLE) {
    if (workspace[campo] !== true) {
      throw new Error(`googleWorkspace.${campo} debe ser true`);
    }
  }
  assertStringReal(workspace.dominio, 'googleWorkspace.dominio');
}

function validateCurso(curso) {
  assertStringReal(curso.courseId, 'curso.courseId');
  assertStringReal(curso.nombre, 'curso.nombre');
  assertStringReal(curso.periodoId, 'curso.periodoId');
  assertPositiveNumber(curso.alumnosClassroomTotal, 'curso.alumnosClassroomTotal');
  assertPositiveNumber(curso.alumnosLocalesVinculados, 'curso.alumnosLocalesVinculados');
  if (Number(curso.alumnosLocalesVinculados) > Number(curso.alumnosClassroomTotal)) {
    throw new Error('curso.alumnosLocalesVinculados no puede exceder alumnosClassroomTotal');
  }
}

function validateMetadata(evidence, expectedCandidateSha) {
  if (String(evidence.resultado || '') !== 'ok') {
    throw new Error('resultado debe ser ok');
  }
  if (String(evidence.entorno || '') !== 'google-classroom-real') {
    throw new Error('entorno debe ser google-classroom-real');
  }

  assertStringReal(evidence.displayVersion, 'displayVersion');
  assertStringReal(evidence.candidateSha, 'candidateSha');
  const candidateSha = String(evidence.candidateSha).trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(candidateSha)) {
    throw new Error('candidateSha debe ser el SHA completo de 40 caracteres hexadecimales');
  }
  if (expectedCandidateSha && candidateSha !== String(expectedCandidateSha).trim().toLowerCase()) {
    throw new Error(`candidateSha no coincide con el SHA candidato esperado: ${expectedCandidateSha}`);
  }

  for (const campo of ['operatorName', 'windowStartedAt', 'windowEndedAt', 'periodoLabel', 'apiBase', 'docenteIdHash']) {
    assertStringReal(evidence[campo], campo);
  }
  return candidateSha;
}

function validateStepsAndEvidence(evidence) {
  const pasos = evidence.pasos || {};
  for (const paso of PASOS_REQUERIDOS) {
    if (pasos[paso] !== true) {
      throw new Error(`pasos.${paso} debe ser true`);
    }
  }

  const evidencias = evidence.evidencias || {};
  for (const evidencia of EVIDENCIAS_REQUERIDAS) {
    assertStringReal(evidencias[evidencia], `evidencias.${evidencia}`);
  }
  if (!Array.isArray(evidencias.requestIds) || evidencias.requestIds.length === 0) {
    throw new Error('evidencias.requestIds debe tener al menos un requestId');
  }
  for (const requestId of evidencias.requestIds) {
    assertStringReal(requestId, 'evidencias.requestIds[]');
  }
}

export function validateClassroomE2eEvidence(filePath, expectedCandidateSha = '') {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Falta evidencia Classroom: ${filePath}`);
  }
  const evidence = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const candidateSha = validateMetadata(evidence, expectedCandidateSha);

  const workspace = evidence.googleWorkspace || {};
  validateGoogleWorkspace(workspace);

  const curso = evidence.curso || {};
  validateCurso(curso);

  const actividad = evidence.actividad || {};
  validateActividad(actividad);
  validateStepsAndEvidence(evidence);

  return {
    filePath,
    displayVersion: String(evidence.displayVersion || '').trim(),
    candidateSha,
    courseId: curso.courseId,
    courseWorkId: actividad.courseWorkId,
    submissionsImportadas: Number(actividad.submissionsImportadas)
  };
}

export async function main() {
  const evidencePath = path.resolve(process.cwd(), getArg('manual', 'docs/release/manual/classroom-e2e-real-mayo-junio.json'));
  const result = validateClassroomE2eEvidence(evidencePath, getArg('candidate-sha'));
  process.stdout.write(`[classroom:e2e-evidence] OK ${evidencePath}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[classroom:e2e-evidence] ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
