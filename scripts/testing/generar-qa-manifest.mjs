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

const artefactosBase = [
  'reports/qa/latest/dataset-prodlike.json',
  'reports/qa/latest/e2e-docente-alumno.json',
  'reports/qa/latest/global-grade.json',
  'reports/qa/latest/evaluaciones-policy.json',
  'reports/qa/latest/evaluaciones-e2e.json',
  'reports/qa/latest/pdf-print.json',
  'reports/qa/latest/ux-visual.json',
  'reports/qa/latest/clean-architecture.json'
];

const artefactosVisuales = [
  'reports/qa/latest/gui-screen-matrix.json',
  ...[
    'gui-admin-dashboard-desktop-lg.png',
    'gui-admin-dashboard-mobile.png',
    'gui-admin-tenants-desktop-lg.png',
    'gui-admin-tenants-mobile.png',
    'gui-alumno-login-desktop-lg.png',
    'gui-alumno-login-mobile.png',
    'gui-alumno-resultados-desktop-lg.png',
    'gui-alumno-resultados-mobile.png',
    'gui-docente-alumnos-desktop-lg.png',
    'gui-docente-alumnos-mobile.png',
    'gui-docente-banco-desktop-lg.png',
    'gui-docente-banco-mobile.png',
    'gui-docente-calificaciones-desktop-lg.png',
    'gui-docente-calificaciones-mobile.png',
    'gui-docente-cuenta-desktop-lg.png',
    'gui-docente-cuenta-mobile.png',
    'gui-docente-entrega-desktop-lg.png',
    'gui-docente-entrega-mobile.png',
    'gui-docente-evaluaciones-desktop-lg.png',
    'gui-docente-evaluaciones-mobile.png',
    'gui-docente-login-desktop-lg.png',
    'gui-docente-login-mobile.png',
    'gui-docente-periodos-desktop-lg.png',
    'gui-docente-periodos-mobile.png',
    'gui-docente-plantillas-desktop-lg.png',
    'gui-docente-plantillas-mobile.png',
    'gui-docente-rehidratacion-desktop-lg.png',
    'gui-docente-rehidratacion-mobile.png',
    'gui-docente-sincronizacion-desktop-lg.png',
    'gui-docente-sincronizacion-mobile.png'
  ].map((name) => `reports/qa/latest/${name}`)
];

const artefactos = [...artefactosBase, ...artefactosVisuales];

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
