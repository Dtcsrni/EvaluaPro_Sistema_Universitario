import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const matrixJsonPath = path.join(root, 'reports', 'qa', 'latest', 'gui-screen-matrix.json');
const matrixMarkdownPath = path.join(root, 'docs', 'release', 'manual', 'gui-screen-matrix-2026-05-27.md');

function runMatrixGenerator(extraArgs = []) {
  return execFileSync(
    process.execPath,
    ['scripts/testing/generate-gui-screen-matrix.mjs', ...extraArgs],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
}

test('genera matriz canonica exhaustiva de pantallas GUI', () => {
  runMatrixGenerator(['--write']);

  assert.equal(fs.existsSync(matrixJsonPath), true, 'debe escribir JSON de matriz GUI');
  assert.equal(fs.existsSync(matrixMarkdownPath), true, 'debe escribir checklist Markdown manual');

  const matrix = JSON.parse(fs.readFileSync(matrixJsonPath, 'utf8'));
  assert.equal(matrix.version, 1);
  assert.equal(matrix.generatedBy, 'scripts/testing/generate-gui-screen-matrix.mjs');
  const removedExternalDesignDoc = ['docs', `GUI_REDISENO_${'FIG'}${'MA'}.md`].join('/');
  assert.equal(matrix.designSources.includes(removedExternalDesignDoc), false, 'la matriz no debe depender de herramienta externa');
  assert.equal(matrix.acceptance.simplicityAndEleganceRequired, true, 'debe exigir simplicidad/elegancia funcional');
  assert.equal(matrix.acceptance.primaryActionPerScreenRequired, true, 'debe exigir accion primaria clara');
  assert.equal(matrix.acceptance.interactiveControlsNoOverlapRequired, true, 'debe exigir controles sin solapes materiales');
  assert.ok(Array.isArray(matrix.screens));
  assert.ok(matrix.screens.length >= 18, 'debe cubrir pantallas web, dashboard e installer hub');

  const ids = new Set(matrix.screens.map((screen) => screen.id));
  for (const required of [
    'docente:login',
    'docente:periodos',
    'docente:alumnos',
    'docente:banco',
    'docente:plantillas',
    'docente:entrega',
    'docente:calificaciones',
    'docente:rehidratacion',
    'docente:evaluaciones',
    'docente:sincronizacion',
    'docente:cuenta',
    'alumno:login',
    'alumno:resultados',
    'admin-negocio:dashboard',
    'dashboard-local:estado',
    'installer-hub:bienvenida',
    'installer-hub:revisar',
    'installer-hub:resultado'
  ]) {
    assert.ok(ids.has(required), `falta pantalla requerida ${required}`);
  }

  const byId = new Map(matrix.screens.map((screen) => [screen.id, screen]));
  assert.equal(byId.get('docente:login').uxReview.primaryAction, 'Iniciar sesion docente');
  assert.equal(byId.get('docente:periodos').uxReview.primaryAction, 'Crear o editar materia/periodo');
  assert.equal(byId.get('docente:calificaciones').uxReview.primaryAction, 'Revisar y publicar calificacion');
  assert.equal(byId.get('installer-hub:revisar').uxReview.primaryAction, 'Revisar equipo o remediar requisito');

  for (const screen of matrix.screens) {
    assert.ok(screen.title, `pantalla ${screen.id} debe tener titulo`);
    assert.ok(Array.isArray(screen.components) && screen.components.length > 0, `${screen.id} debe listar componentes`);
    assert.equal(screen.componentChecks.length, screen.components.length, `${screen.id} debe revisar sentido de cada componente`);
    for (const check of screen.componentChecks) {
      assert.ok(check.purpose.length > 20, `${screen.id}/${check.component} debe explicar proposito UX`);
    }
    assert.ok(screen.uxReview.primaryAction, `${screen.id} debe declarar accion primaria`);
    assert.doesNotMatch(screen.uxReview.primaryAction, /estado permisos|version\/update|mensajes inline/i, `${screen.id} no debe usar componentes auxiliares como accion primaria`);
    assert.match(screen.uxReview.simplicity, /jerarquia clara/i, `${screen.id} debe declarar criterio de simplicidad`);
    assert.ok(Array.isArray(screen.states) && screen.states.includes('success'), `${screen.id} debe incluir estados`);
    assert.deepEqual(screen.viewports, ['desktop', 'tablet', 'mobile'], `${screen.id} debe cubrir viewports`);
    assert.ok(screen.evidence.command, `${screen.id} debe declarar comando de evidencia`);
    assert.ok(screen.evidence.artifacts.length > 0, `${screen.id} debe declarar artefactos`);
    assert.equal(
      new Set(screen.evidence.artifacts).size,
      screen.evidence.artifacts.length,
      `${screen.id} no debe declarar artefactos duplicados`
    );

    for (const artifact of screen.evidence.artifacts) {
      const artifactPath = path.join(root, artifact);
      assert.equal(fs.existsSync(artifactPath), true, `${screen.id} declara artefacto inexistente: ${artifact}`);
      const stats = fs.statSync(artifactPath);
      if (stats.isDirectory()) {
        assert.ok(fs.readdirSync(artifactPath).length > 0, `${screen.id} declara directorio de evidencia vacio: ${artifact}`);
      } else {
        assert.ok(stats.size > 0, `${screen.id} declara artefacto vacio: ${artifact}`);
      }
      if (artifact.endsWith('.png')) {
        assert.ok(stats.size > 10_000, `${screen.id} screenshot demasiado pequeno o invalido: ${artifact}`);
      }
    }

    if (screen.surface.startsWith('frontend-')) {
      assert.ok(
        screen.evidence.artifacts.some((artifact) => artifact.endsWith('.png')),
        `${screen.id} debe declarar screenshots PNG como evidencia visual`
      );
    }
  }

  const markdown = fs.readFileSync(matrixMarkdownPath, 'utf8');
  assert.match(markdown, /# Matriz GUI Exhaustiva/);
  assert.match(markdown, /docente:plantillas/);
  assert.match(markdown, /installer-hub:resultado/);
  const removedExternalDesignPattern = new RegExp(['FIG', 'MA|GUI_REDISENO_FIG', 'MA'].join(''), 'i');
  assert.doesNotMatch(markdown, removedExternalDesignPattern);
  assert.match(markdown, /Jerarquia visual simple, elegante y funcional/);
  assert.match(markdown, /Controles interactivos visibles sin solapes materiales/);
});
