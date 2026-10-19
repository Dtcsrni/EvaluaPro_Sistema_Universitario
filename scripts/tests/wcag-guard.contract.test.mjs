import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cssDiff, validateAddedCssColors, validatePolicyContract } from '../wcag-guard.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('la política WCAG y el contrato base del frontend existen', () => {
  validatePolicyContract();
  const policy = fs.readFileSync(path.join(repoRoot, 'docs', 'WCAG_UI_POLICY.md'), 'utf8');
  assert.match(policy, /WCAG-UI-POLICY: 2\.2-AA/);
  assert.match(policy, /No se aceptan excepciones silenciosas/);
});

test('un color CSS nuevo requiere evidencia WCAG AA cercana', () => {
  const cssLines = fs.readFileSync(path.join(repoRoot, 'apps', 'frontend', 'src', 'styles', 'cards.css'), 'utf8').split(/\r?\n/);
  const colorWithEvidence = cssLines.findIndex((line, index) =>
    /color:\s*#f8fbff\s*!important;/.test(line)
    && cssLines.slice(Math.max(0, index - 32), index).some((nearby) => /WCAG\s+AA/i.test(nearby))
  );
  assert.notEqual(colorWithEvidence, -1, 'la hoja debe conservar una declaración de color con evidencia WCAG cercana');
  const fixtureLine = colorWithEvidence + 1 - 2;
  const cleanDiff = [
    'diff --git a/apps/frontend/src/styles/cards.css b/apps/frontend/src/styles/cards.css',
    '+++ b/apps/frontend/src/styles/cards.css',
    `@@ -0,0 +${fixtureLine},3 @@`,
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

test('los colores agregados en KPI y paneles de formato tienen comentario WCAG y pares auditados', () => {
  const css = fs.readFileSync(path.join(repoRoot, 'apps', 'frontend', 'src', 'styles', 'cards.css'), 'utf8');
  const screensCss = fs.readFileSync(path.join(repoRoot, 'apps', 'frontend', 'src', 'styles', 'screens.css'), 'utf8');
  const contrastAudit = fs.readFileSync(path.join(repoRoot, 'scripts', 'tests', 'ui-contrast-audit.mjs'), 'utf8');

  assert.match(css, /WCAG AA:[\s\S]{0,800}\.banco-mini-kpi--temas \.banco-mini-kpi__num/);
  assert.match(screensCss, /WCAG AA:[\s\S]{0,500}\.plantillas-formato-box\s*\{/);
  assert.match(screensCss, /WCAG AA:[\s\S]{0,500}\.plantillas-form--panoramico \.plantillas-formato-box\s*\{/);
  for (const color of ['#7e22ce', '#0369a1', '#047857', '#4338ca', '#e2e8f0', '#f8fafc', '#cbd5e1', '#67e8f9']) {
    assert.ok(contrastAudit.includes(`foreground: '${color}'`), `falta auditar foreground ${color}`);
  }
});

test('el preflight valida los cambios WCAG del árbol de trabajo contra la base configurada', () => {
  const baseSha = process.env.EVALUAPRO_WCAG_BASE_SHA || process.env.GITHUB_BASE_SHA;
  if (!baseSha) return;
  validateAddedCssColors(cssDiff(baseSha));
});
