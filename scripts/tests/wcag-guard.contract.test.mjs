import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAddedCssColors, validatePolicyContract } from '../wcag-guard.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('la política WCAG y el contrato base del frontend existen', () => {
  validatePolicyContract();
  const policy = fs.readFileSync(path.join(repoRoot, 'docs', 'WCAG_UI_POLICY.md'), 'utf8');
  assert.match(policy, /WCAG-UI-POLICY: 2\.2-AA/);
  assert.match(policy, /No se aceptan excepciones silenciosas/);
});

test('un color CSS nuevo requiere evidencia WCAG AA cercana', () => {
  const cleanDiff = [
    'diff --git a/apps/frontend/src/styles/cards.css b/apps/frontend/src/styles/cards.css',
    '+++ b/apps/frontend/src/styles/cards.css',
    '@@ -0,0 +5775,3 @@',
    '+/* WCAG AA: 4.5:1 sobre la superficie del componente. */',
    '+.example {',
    '+  color: #f8fbff;',
    '+}',
  ].join('\n');
  assert.doesNotThrow(() => validateAddedCssColors(cleanDiff));

  const unsafeDiff = [
    'diff --git a/apps/frontend/src/styles/cards.css b/apps/frontend/src/styles/cards.css',
    '+++ b/apps/frontend/src/styles/cards.css',
    '@@ -0,0 +1,3 @@',
    '+.example {',
    '+  color: #aabbcc;',
    '+}',
  ].join('\n');
  assert.throws(() => validateAddedCssColors(unsafeDiff), /colores CSS nuevos/);
});
