#!/usr/bin/env node
/**
 * legal-docs-check
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * legal-docs-check
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * legal-docs-check
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'LICENSE',
  'LICENSE-COMMERCIAL.md',
  'NOTICE.md',
  'CONTRIBUTING.md',
  'docs/legal/aviso-privacidad-integral.md',
  'docs/legal/aviso-privacidad-corto.md',
  'docs/legal/politica-conservacion-eliminacion.md',
  'docs/legal/procedimiento-arco.md',
  'docs/legal/anexo-sector-publico-hidalgo.md'
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length > 0) {
  process.stderr.write(`[legal-docs-check] Faltan archivos:\n- ${missing.join('\n- ')}\n`);
  process.exit(1);
}

const packageJsons = ['package.json', 'apps/backend/package.json', 'apps/frontend/package.json', 'apps/portal_alumno_cloud/package.json'];
for (const pkgFile of packageJsons) {
  const raw = fs.readFileSync(path.join(root, pkgFile), 'utf8');
  const pkg = JSON.parse(raw);
  if (pkg.license !== 'AGPL-3.0-or-later') {
    process.stderr.write(`[legal-docs-check] ${pkgFile} debe declarar license=AGPL-3.0-or-later\\n`);
    process.exit(1);
  }
}

process.stdout.write('[legal-docs-check] OK\n');
