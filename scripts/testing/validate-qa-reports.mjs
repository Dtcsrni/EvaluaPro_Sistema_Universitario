import fs from 'node:fs';
import path from 'node:path';
import { REQUIRED_QA_ARTIFACTS } from '../release/required-qa-artifacts.mjs';

export const REQUIRED_QA_REPORTS = REQUIRED_QA_ARTIFACTS;

function readJson(filePath, label, errors) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    errors.push(`${label}: JSON ausente o inválido (${error.message})`);
    return null;
  }
}

export function validateQaReports(manifestPath) {
  const resolvedManifestPath = path.resolve(manifestPath);
  const root = path.resolve(path.dirname(resolvedManifestPath), '..', '..', '..');
  const errors = [];
  const manifest = readJson(resolvedManifestPath, 'reports/qa/latest/manifest.json', errors);
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, errors };
  }

  const artifacts = Array.isArray(manifest.artefactos) ? manifest.artefactos : [];
  if (manifest.resumen?.estado !== 'ok' || manifest.resumen?.faltantes !== 0) {
    errors.push(`manifest.json: resumen.estado=${manifest.resumen?.estado ?? 'ausente'}, faltantes=${manifest.resumen?.faltantes ?? 'ausente'}`);
  }

  for (const id of REQUIRED_QA_REPORTS) {
    const matches = artifacts.filter((item) => {
      const artifactPath = String(item?.archivo ?? '').replace(/\\/g, '/');
      return artifactPath === `reports/qa/latest/${id}.json`;
    });
    if (matches.length !== 1 || matches[0]?.existe !== true) {
      errors.push(`${id}: el manifiesto debe incluir exactamente un reporte existente`);
      continue;
    }

    const artifactPath = matches[0].archivo;
    const absolutePath = path.resolve(root, artifactPath);
    const relativePath = path.relative(root, absolutePath);
    if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
      errors.push(`${id}: ruta de reporte fuera del checkout (${artifactPath})`);
      continue;
    }

    const report = readJson(absolutePath, `${id} (${artifactPath})`, errors);
    if (!report || typeof report !== 'object' || Array.isArray(report)) continue;
    if (Object.hasOwn(report, 'ok') && report.ok !== true) {
      errors.push(`${id} (${artifactPath}): ok debe ser true; recibido ${String(report.ok)}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
