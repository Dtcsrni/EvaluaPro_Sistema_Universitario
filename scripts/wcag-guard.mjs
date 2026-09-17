/**
 * Guardrail permanente de accesibilidad para el frontend.
 *
 * Responsabilidad: bloquear regresiones WCAG previsibles antes de build/CI.
 * Limites: no sustituye revisión humana con teclado, zoom, reflow o lector de pantalla.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policyPath = path.join(repoRoot, 'docs', 'WCAG_UI_POLICY.md');
const cssRoot = path.join(repoRoot, 'apps', 'frontend', 'src', 'styles');
const contrastAudit = path.join(repoRoot, 'scripts', 'tests', 'ui-contrast-audit.mjs');
const eslintConfig = path.join(repoRoot, 'apps', 'frontend', 'eslint.config.mjs');
// Baseline de los estilos de la instalación local sincronizada en v1.1.6.
// Este commit contiene también la migración CSS que introdujo el guardrail;
// solo evita reauditar ese historial y deja las adiciones posteriores bajo
// revisión WCAG.
const WCAG_CSS_BASELINE_COMMIT = '53e0590244c55e4ff7f9104c6ea4dd1c5c2a2e12';

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function runNode(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? 1;
}

function runFrontendLint() {
  const isWindows = process.platform === 'win32';
  const command = isWindows ? (process.env.ComSpec || 'cmd.exe') : 'npm';
  const args = isWindows
    ? ['/d', '/s', '/c', 'npm -C apps/frontend run lint']
    : ['-C', 'apps/frontend', 'run', 'lint'];
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

function gitAvailable(ref) {
  const result = spawnSync('git', ['rev-parse', '--verify', ref], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return result.status === 0;
}

function gitContainsFile(ref, relativePath) {
  const result = spawnSync('git', ['cat-file', '-e', `${ref}:${relativePath}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  return result.status === 0;
}

function wcagGuardIntroductionCommit() {
  const result = spawnSync('git', ['log', '--all', '--reverse', '--format=%H', '--', 'scripts/wcag-guard.mjs'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return (result.stdout || '').split(/\r?\n/).find(Boolean) || null;
}

function wcagCssBaselineCommit() {
  if (gitAvailable(WCAG_CSS_BASELINE_COMMIT)) {
    return WCAG_CSS_BASELINE_COMMIT;
  }
  return wcagGuardIntroductionCommit();
}

function cssDiff() {
  const args = ['diff', '--unified=0'];
  const baseSha = process.env.GITHUB_BASE_SHA;
  if (baseSha && gitAvailable(baseSha)) {
    const baselineCommit = wcagCssBaselineCommit();
    if (baselineCommit) {
      // El snapshot de v1.1.6 es la frontera estable de esta migración. La
      // historia previa puede venir de otra rama, así que no se decide por
      // ascendencia respecto de GITHUB_BASE_SHA; solo se audita CSS posterior
      // al snapshot y se conserva el fallback para ramas sin ese commit.
      args.push(baselineCommit + '...HEAD');
    } else if (gitContainsFile(baseSha, 'scripts/wcag-guard.mjs')) {
      args.push(baseSha + '...HEAD');
    } else {
      // La política se incorpora durante una migración que también sincroniza
      // estilos locales. Usa el baseline de esa migración para no reauditar
      // CSS histórico; las adiciones posteriores siguen sujetas al guardrail.
      args.push((baselineCommit || baseSha) + '...HEAD');
    }
  } else if (process.env.GITHUB_SHA && gitAvailable('HEAD^')) {
    args.push('HEAD^...HEAD');
  }
  args.push('--', 'apps/frontend/src/styles');
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(result.status, 0, 'git diff no pudo ejecutarse: ' + (result.stderr || 'error desconocido'));
  return result.stdout || '';
}

function isRawColorDeclaration(line) {
  return /(?:^|\s)(?:color|background(?:-color)?|border(?:-[\w-]+)?|outline(?:-[\w-]+)?|box-shadow|text-shadow|fill|stroke)\s*:[^;]*(?:#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\s*\()/i.test(line);
}

function addedRawColors(diff) {
  const violations = [];
  let currentFile = null;
  let currentLine = 0;
  for (const line of diff.split(/\r?\n/)) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      currentLine = 0;
      continue;
    }
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      currentLine = Number(hunkMatch[1]);
      continue;
    }
    if (!currentFile || currentLine <= 0) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const sourceLine = line.slice(1);
      if (isRawColorDeclaration(sourceLine)) {
        violations.push({ file: currentFile, line: currentLine, sourceLine });
      }
      currentLine += 1;
    } else if (!line.startsWith('-')) {
      currentLine += 1;
    }
  }
  return violations;
}

function hasNearbyWcagComment(file, lineNumber) {
  const lines = read(path.join(repoRoot, file)).split(/\r?\n/);
  const start = Math.max(0, lineNumber - 32);
  const context = lines.slice(start, lineNumber).join('\n');
  return /WCAG\s+AA/i.test(context);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^()|[\]\\]/g, '\\$&');
}

export function validatePolicyContract() {
  const policy = read(policyPath);
  const css = fs.readdirSync(cssRoot)
    .filter((name) => name.endsWith('.css'))
    .map((name) => read(path.join(cssRoot, name)))
    .join('\n');
  const eslint = read(eslintConfig);

  for (const token of [
    'WCAG-UI-POLICY: 2.2-AA',
    '4.5:1',
    '3:1',
    'WCAG AA',
    'prefers-reduced-motion',
    'revisión manual',
  ]) {
    assert.match(policy, new RegExp(escapeRegExp(token), 'i'), 'falta en la política: ' + token);
  }
  assert.match(eslint, /plugin:jsx-a11y\/recommended/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /--ui-text-primary/);
}

export function validateAddedCssColors(diff = cssDiff()) {
  const violations = addedRawColors(diff)
    .filter(({ file, line }) => !hasNearbyWcagComment(file, line));
  assert.deepEqual(
    violations,
    [],
    'hay colores CSS nuevos sin comentario WCAG AA cercano:\n' +
      violations.map((item) => item.file + ':' + item.line + ' ' + item.sourceLine).join('\n'),
  );
  return violations;
}

export function main({ skipLint = process.argv.includes('--skip-lint') } = {}) {
  validatePolicyContract();
  if (!skipLint) {
    const lintStatus = runFrontendLint();
    assert.equal(lintStatus, 0, 'falló ESLint con jsx-a11y');
  }
  const contrastStatus = runNode(contrastAudit);
  assert.equal(contrastStatus, 0, 'falló la auditoría de contraste WCAG');
  validateAddedCssColors();
  console.log('[wcag-guard] OK política, semántica base, contraste y diff CSS');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error('[wcag-guard] FAIL ' + error.message);
    process.exitCode = 1;
  }
}
