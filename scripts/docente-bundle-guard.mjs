/**
 * Guardias de integridad para el bundle docente-local.
 * Evita iniciar o publicar una salida anterior, incompleta o sin el contrato
 * visual vigente del portal docente.
 */
import fs from 'node:fs';
import path from 'node:path';

export const DOCENTE_UI_CONTRACT = 'docente-frosted-editorial-v2';

function assetReferences(indexHtml) {
  return [...indexHtml.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)]
    .map((match) => match[1])
    .filter(Boolean);
}

export function assertDocenteBundle({ distRoot }) {
  const root = path.resolve(String(distRoot || ''));
  const indexPath = path.join(root, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Bundle docente inválido: falta ${indexPath}`);
  }

  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  const metaContract = new RegExp(
    `<meta\\s+name=["']evaluapro-ui-contract["']\\s+content=["']${DOCENTE_UI_CONTRACT}["']`,
    'i'
  );
  if (!metaContract.test(indexHtml)) {
    throw new Error(
      `Bundle docente obsoleto o incompatible: falta el contrato ${DOCENTE_UI_CONTRACT}. ` +
      'Ejecuta nuevamente el build docente antes de iniciar el servicio.'
    );
  }

  const references = assetReferences(indexHtml);
  if (references.length === 0) {
    throw new Error('Bundle docente inválido: index.html no referencia assets compilados.');
  }

  const missing = references
    .map((reference) => path.resolve(root, reference.slice(1)))
    .filter((assetPath) => !assetPath.startsWith(root) || !fs.existsSync(assetPath));
  if (missing.length > 0) {
    throw new Error(`Bundle docente incompleto: faltan assets: ${missing.join(', ')}`);
  }

  const cssFiles = references
    .filter((reference) => reference.toLowerCase().endsWith('.css'))
    .map((reference) => path.resolve(root, reference.slice(1)));
  const css = cssFiles.map((filePath) => fs.readFileSync(filePath, 'utf8')).join('\n');
  const styleContract = new RegExp(
    `--docente-style-contract\\s*:\\s*${DOCENTE_UI_CONTRACT}`,
    'i'
  );
  if (!styleContract.test(css)) {
    throw new Error(
      `Bundle docente sin identidad visual vigente: falta --docente-style-contract:${DOCENTE_UI_CONTRACT}.`
    );
  }

  return Object.freeze({ root, indexPath, references, cssFiles, contract: DOCENTE_UI_CONTRACT });
}
