#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Falta ${label}: ${filePath}`);
  }
}

function readJson(filePath, label) {
  assertFileExists(filePath, label);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath, label) {
  assertFileExists(filePath, label);
  return fs.readFileSync(filePath, 'utf8');
}

export function validateEvidenceContract(baseDir) {
  const manifestPath = path.join(baseDir, 'manifest.json');
  const timelinePath = path.join(baseDir, 'timeline.md');
  const metricsPath = path.join(baseDir, 'metrics_snapshot.txt');
  const integrityPath = path.join(baseDir, 'integridad_sha256.json');
  const rollbackPath = path.join(baseDir, 'rollback_readiness.json');

  const manifest = readJson(manifestPath, 'manifest.json');
  const integrity = readJson(integrityPath, 'integridad_sha256.json');
  const rollback = readJson(rollbackPath, 'rollback_readiness.json');
  const timeline = readText(timelinePath, 'timeline.md');
  const metrics = readText(metricsPath, 'metrics_snapshot.txt');

  if (typeof manifest.version !== 'string' || !manifest.version.trim()) {
    throw new Error('manifest.json: campo version invalido');
  }
  if (typeof manifest.displayVersion !== 'string' || !manifest.displayVersion.trim()) {
    throw new Error('manifest.json: campo displayVersion invalido');
  }
  if (typeof manifest.commit !== 'string' || !manifest.commit.trim()) {
    throw new Error('manifest.json: campo commit invalido');
  }
  if (!Number.isFinite(Number(manifest.ciConsecutivoVerde))) {
    throw new Error('manifest.json: campo ciConsecutivoVerde invalido');
  }

  const gate = manifest.gateHumanoProduccion || {};
  if (typeof gate.periodoId !== 'string' || !gate.periodoId.trim()) {
    throw new Error('manifest.json: gateHumanoProduccion.periodoId invalido');
  }
  if (!['ok', 'fallo'].includes(String(gate.resultado || ''))) {
    throw new Error('manifest.json: gateHumanoProduccion.resultado invalido');
  }
  if (typeof gate.displayVersion !== 'string' || !gate.displayVersion.trim()) {
    throw new Error('manifest.json: gateHumanoProduccion.displayVersion invalido');
  }
  if (!Array.isArray(gate.pasos) || gate.pasos.length < 10) {
    throw new Error('manifest.json: gateHumanoProduccion.pasos incompleto');
  }
  const windowsEvidencePath = String(manifest?.evidenciaWindows?.path || '').trim();
  if (!windowsEvidencePath) {
    throw new Error('manifest.json: evidenciaWindows.path invalido');
  }
  assertFileExists(path.resolve(process.cwd(), windowsEvidencePath), 'evidencia Windows referenciada');

  if (!timeline.includes('# Timeline Gate Estable')) {
    throw new Error('timeline.md: encabezado esperado no encontrado');
  }
  if (!timeline.includes('Resultado:')) {
    throw new Error('timeline.md: falta resumen de resultado');
  }

  const metricLines = metrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (metricLines.length === 0) {
    throw new Error('metrics_snapshot.txt: vacio');
  }

  if (typeof integrity !== 'object' || integrity === null || Array.isArray(integrity)) {
    throw new Error('integridad_sha256.json: formato invalido');
  }
  if (!integrity.csv || !integrity.docx) {
    throw new Error('integridad_sha256.json: faltan bloques csv/docx');
  }
  if (typeof integrity.csv.hashCalculado !== 'string' || typeof integrity.docx.hashCalculado !== 'string') {
    throw new Error('integridad_sha256.json: hashCalculado invalido');
  }

  if (typeof rollback.version !== 'string' || rollback.version.trim() !== manifest.version.trim()) {
    throw new Error('rollback_readiness.json: version invalida');
  }
  if (!['ready', 'activated', 'completed'].includes(String(rollback.status || ''))) {
    throw new Error('rollback_readiness.json: status invalido');
  }
  if (typeof rollback.previousStableVersion !== 'string' || !rollback.previousStableVersion.trim()) {
    throw new Error('rollback_readiness.json: previousStableVersion invalido');
  }
  if (!Array.isArray(rollback.activationCriteria) || rollback.activationCriteria.length === 0) {
    throw new Error('rollback_readiness.json: activationCriteria vacio');
  }
  if (!Array.isArray(rollback.rollbackSteps) || rollback.rollbackSteps.length === 0) {
    throw new Error('rollback_readiness.json: rollbackSteps vacio');
  }
  if (!Array.isArray(rollback.postRollbackChecks) || rollback.postRollbackChecks.length === 0) {
    throw new Error('rollback_readiness.json: postRollbackChecks vacio');
  }
  if (typeof rollback.approvedBy !== 'string' || !rollback.approvedBy.trim()) {
    throw new Error('rollback_readiness.json: approvedBy invalido');
  }
  if (typeof rollback.approvedAt !== 'string' || !rollback.approvedAt.trim()) {
    throw new Error('rollback_readiness.json: approvedAt invalido');
  }

  return {
    manifestPath,
    timelinePath,
    metricsPath,
    integrityPath,
    rollbackPath
  };
}

export async function main() {
  const version = getArg('version', '');
  const evidenceDirArg = getArg('evidence-dir', '');
  const evidenceDir = evidenceDirArg
    ? path.resolve(process.cwd(), evidenceDirArg)
    : path.resolve(process.cwd(), `docs/release/evidencias/${version}`);

  if (!version && !evidenceDirArg) {
    throw new Error('Falta --version=<semver> o --evidence-dir=<path>');
  }

  const files = validateEvidenceContract(evidenceDir);
  process.stdout.write(`[release:evidence] OK ${evidenceDir}\n`);
  process.stdout.write(`${JSON.stringify(files)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[release:evidence] ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
