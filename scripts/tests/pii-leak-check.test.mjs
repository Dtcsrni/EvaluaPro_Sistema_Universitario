import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const checker = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../compliance/pii-leak-check.mjs');

function crearRepositorioTemporal() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-pii-check-'));
  execFileSync('git', ['init', '--quiet'], { cwd });
  execFileSync('git', ['config', 'user.name', 'EvaluaPro CI'], { cwd });
  execFileSync('git', ['config', 'user.email', 'ci@example.invalid'], { cwd });
  return cwd;
}

function registrar(cwd, rel) {
  execFileSync('git', ['add', '--', rel], { cwd });
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture'], { cwd });
}

function ejecutar(cwd) {
  return spawnSync(process.execPath, [checker], { cwd, encoding: 'utf8' });
}

test('omite archivos ausentes solo cuando sparse checkout los marca skip-worktree', (t) => {
  const cwd = crearRepositorioTemporal();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const rel = 'reports/qa/gui-ux/2026-10-25/review-notes.md';
  const abs = path.join(cwd, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, 'Evidencia local sin datos personales.\n');
  registrar(cwd, rel);
  execFileSync('git', ['update-index', '--skip-worktree', '--', rel], { cwd });
  fs.rmSync(abs);

  const resultado = ejecutar(cwd);
  assert.equal(resultado.status, 0, resultado.stderr);
  assert.match(resultado.stdout, /archivos sparse omitidos: 1/);
});

test('falla explícitamente si falta un archivo rastreado fuera de sparse checkout', (t) => {
  const cwd = crearRepositorioTemporal();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const rel = 'reports/qa/missing.md';
  const abs = path.join(cwd, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, 'Reporte de fixture.\n');
  registrar(cwd, rel);
  fs.rmSync(abs);

  const resultado = ejecutar(cwd);
  assert.equal(resultado.status, 1);
  assert.match(resultado.stderr, /archivo_ausente/);
  assert.match(resultado.stderr, /reports\/qa\/missing\.md/);
});
