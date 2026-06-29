#!/usr/bin/env node
/**
 * check-classroom-e2e-evidence
 *
 * Responsabilidad: Validar evidencia manual del E2E real de Google Classroom.
 * Limites: No ejecuta Google APIs ni persiste secretos; valida contrato documental.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CAMPOS_GOOGLE = [
  'oauthClientConfigurado',
  'redirectUriRegistrado',
  'classroomTokenCipherKeyPresente',
  'scopesClassroomAprobados'
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

export function validateClassroomE2eEvidence(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Falta evidencia Classroom: ${filePath}`);
  }
  const evidence = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (String(evidence.resultado || '') !== 'ok') {
    throw new Error('resultado debe ser ok');
  }
  if (String(evidence.entorno || '') !== 'google-classroom-real') {
    throw new Error('entorno debe ser google-classroom-real');
  }

  assertStringReal(evidence.displayVersion, 'displayVersion');
  assertStringReal(evidence.operatorName, 'operatorName');
  assertStringReal(evidence.windowStartedAt, 'windowStartedAt');
  assertStringReal(evidence.windowEndedAt, 'windowEndedAt');
  assertStringReal(evidence.periodoLabel, 'periodoLabel');
  assertStringReal(evidence.apiBase, 'apiBase');
  assertStringReal(evidence.docenteIdHash, 'docenteIdHash');

  const workspace = evidence.googleWorkspace || {};
  for (const campo of CAMPOS_GOOGLE) {
    if (workspace[campo] !== true) {
      throw new Error(`googleWorkspace.${campo} debe ser true`);
    }
  }
  assertStringReal(workspace.dominio, 'googleWorkspace.dominio');

  const curso = evidence.curso || {};
  assertStringReal(curso.courseId, 'curso.courseId');
  assertStringReal(curso.nombre, 'curso.nombre');
  assertStringReal(curso.periodoId, 'curso.periodoId');
  assertPositiveNumber(curso.alumnosClassroomTotal, 'curso.alumnosClassroomTotal');
  assertPositiveNumber(curso.alumnosLocalesVinculados, 'curso.alumnosLocalesVinculados');
  if (Number(curso.alumnosLocalesVinculados) > Number(curso.alumnosClassroomTotal)) {
    throw new Error('curso.alumnosLocalesVinculados no puede exceder alumnosClassroomTotal');
  }

  const actividad = evidence.actividad || {};
  assertStringReal(actividad.courseWorkId, 'actividad.courseWorkId');
  assertStringReal(actividad.titulo, 'actividad.titulo');
  assertPositiveNumber(actividad.submissionsTotal, 'actividad.submissionsTotal');
  assertPositiveNumber(actividad.submissionsConCalificacion, 'actividad.submissionsConCalificacion');
  assertPositiveNumber(actividad.submissionsImportadas, 'actividad.submissionsImportadas');
  assertNonNegativeNumber(actividad.submissionsSinMatch, 'actividad.submissionsSinMatch');
  if (Number(actividad.submissionsImportadas) > Number(actividad.submissionsTotal)) {
    throw new Error('actividad.submissionsImportadas no puede exceder submissionsTotal');
  }

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

  return {
    filePath,
    courseId: curso.courseId,
    courseWorkId: actividad.courseWorkId,
    submissionsImportadas: Number(actividad.submissionsImportadas)
  };
}

export async function main() {
  const evidencePath = path.resolve(process.cwd(), getArg('manual', 'docs/release/manual/classroom-e2e-real-mayo-junio.json'));
  const result = validateClassroomE2eEvidence(evidencePath);
  process.stdout.write(`[classroom:e2e-evidence] OK ${evidencePath}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[classroom:e2e-evidence] ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
