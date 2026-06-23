/**
 * sync-readmes-context
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const START = '<!-- AUTO:COMMERCIAL-CONTEXT:START -->';
const END = '<!-- AUTO:COMMERCIAL-CONTEXT:END -->';

function listReadmes(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listReadmes(abs, out);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase() === 'readme.md') out.push(abs);
  }
  return out;
}

function contextFor(relPath) {
  if (relPath === 'README.md') return 'Presentacion comercial del producto y decision de compra/licencia.';
  if (relPath.startsWith('apps/backend')) return 'Referencia tecnica del backend docente y sus contratos API.';
  if (relPath.startsWith('apps/frontend')) return 'Referencia tecnica de UX web docente/alumno.';
  if (relPath.startsWith('apps/portal_alumno_cloud')) return 'Referencia tecnica del portal cloud de consulta del alumno.';
  if (relPath.startsWith('docs/')) return 'Documentacion funcional/operativa para despliegue, seguridad y cumplimiento.';
  if (relPath.startsWith('scripts/')) return 'Automatizaciones de operacion, QA, release y cumplimiento.';
  return 'Referencia local del modulo/carpeta dentro del monorepo.';
}

function toPosix(p) {
  return p.replace(/\\/g, '/');
}

function buildBlock(filePath, relPath) {
  const date = new Date().toISOString().slice(0, 10);
  const fromDir = path.dirname(filePath);
  const featuresRel = toPosix(path.relative(fromDir, path.join(repoRoot, 'docs', 'comercial', 'FEATURE_CATALOG.md')));
  const licenseRel = toPosix(path.relative(fromDir, path.join(repoRoot, 'docs', 'comercial', 'LICENSING_TIERS.md')));
  return [
    START,
    '## Contexto Comercial y Soporte',
    '',
    `- Rol de este documento: ${contextFor(relPath)}`,
    '- Edicion Comunitaria (AGPL): flujo operativo base para uso real.',
    '- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.',
    `- Catalogo dinamico de capacidades: [FEATURE_CATALOG](${featuresRel}).`,
    `- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](${licenseRel}).`,
    `- Ultima sincronizacion automatica: ${date}.`,
    END
  ].join('\n');
}

function upsertBlock(filePath) {
  const rel = path.relative(repoRoot, filePath).replace(/\\/g, '/');
  const source = fs.readFileSync(filePath, 'utf8');
  const block = buildBlock(filePath, rel);
  let next = source;
  if (source.includes(START) && source.includes(END)) {
    next = source.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
  } else {
    next = `${source.trim()}\n\n${block}\n`;
  }
  fs.writeFileSync(filePath, next, 'utf8');
}

function main() {
  const readmes = listReadmes(repoRoot);
  for (const readme of readmes) upsertBlock(readme);
  console.log(`[docs:readmes:sync] sincronizados ${readmes.length} README.md`);
}

main();
