/**
 * sync-readmes-context
 *
 * Retira el bloque comercial heredado que se inyectaba en todos los README.
 * Los documentos de ingeniería no deben presentar planes como oferta vigente.
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

function removeLegacyBlock(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const markerStart = source.indexOf(START);
  const markerEnd = source.indexOf(END, markerStart + START.length);
  if (markerStart < 0 || markerEnd < 0) return false;

  const before = source.slice(0, markerStart).trimEnd();
  const after = source.slice(markerEnd + END.length).trimStart();
  const next = `${before}${before && after ? '\n\n' : ''}${after}`.trimEnd() + '\n';
  fs.writeFileSync(filePath, next, 'utf8');
  return true;
}

function main() {
  const readmes = listReadmes(repoRoot);
  const changed = readmes.filter(removeLegacyBlock).length;
  console.log(`[docs:readmes:sync] revisados ${readmes.length} README.md; retirados ${changed} bloques comerciales heredados`);
}

main();
