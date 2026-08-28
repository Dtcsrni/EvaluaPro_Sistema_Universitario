#!/usr/bin/env node
/**
 * generar-qa-manifest
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * generar-qa-manifest
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * generar-qa-manifest
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const outPath = path.resolve(process.cwd(), 'reports/qa/latest/manifest.json');

const artefactos = [
  'reports/qa/latest/dataset-prodlike.json',
  'reports/qa/latest/e2e-docente-alumno.json',
  'reports/qa/latest/global-grade.json',
  'reports/qa/latest/evaluaciones-policy.json',
  'reports/qa/latest/evaluaciones-e2e.json',
  'reports/qa/latest/pdf-print.json',
  'reports/qa/latest/ux-visual.json',
  'reports/qa/latest/clean-architecture.json'
];

async function getInfo(file) {
  const abs = path.resolve(process.cwd(), file);
  try {
    const stat = await fs.stat(abs);
    return {
      archivo: file,
      existe: true,
      bytes: stat.size,
      actualizadoEn: stat.mtime.toISOString()
    };
  } catch {
    return {
      archivo: file,
      existe: false
    };
  }
}

async function main() {
  const items = [];
  for (const file of artefactos) {
    items.push(await getInfo(file));
  }
  const faltantes = items.filter((item) => !item.existe).map((item) => item.archivo);
  const payload = {
    version: '1',
    generadoEn: new Date().toISOString(),
    artefactos: items,
    resumen: {
      total: items.length,
      presentes: items.length - faltantes.length,
      faltantes: faltantes.length,
      estado: faltantes.length === 0 ? 'ok' : 'missing-artifacts'
    }
  };
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  if (faltantes.length > 0) {
    process.stderr.write(`[qa-manifest] ERROR missing artifacts (${faltantes.length}): ${faltantes.join(', ')}\n`);
    process.stderr.write(`[qa-manifest] Manifest generated -> ${outPath}\n`);
    process.exit(1);
  }
  process.stdout.write(`[qa-manifest] OK -> ${outPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`[qa-manifest] ERROR: ${String(error?.message || error)}\n`);
  process.exit(1);
});
