/**
 * gui-design-contract.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cssFiles = [
  'apps/frontend/src/styles/foundations.css',
  'apps/frontend/src/styles/components.css',
  'apps/frontend/src/styles/screens.css'
];

function readCss(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('tokens visuales evitan decoracion radial y tracking negativo', () => {
  for (const file of cssFiles) {
    const css = readCss(file);
    assert.doesNotMatch(css, /radial-gradient/i, `${file} no debe usar orbes/decoracion radial`);
    assert.doesNotMatch(css, /letter-spacing:\s*-/i, `${file} no debe usar letter-spacing negativo`);
  }
});

test('superficies principales usan radios contenidos', () => {
  for (const file of cssFiles) {
    const css = readCss(file);
    const radiusValues = [...css.matchAll(/(?:border-radius|--radius-lg):\s*(\d+)px/gi)].map((match) => Number(match[1]));
    const oversized = radiusValues.filter((value) => value > 23 && value !== 999);
    assert.deepEqual(oversized, [], `${file} no debe usar radios grandes en paneles`);
  }
});
