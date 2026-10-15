import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('todos los recorridos GUI principales instrumentan cada screenshot con auditoría visual', () => {
  const guiFiles = [
    'tests/gui-responsive/responsive-docente.spec.ts',
    'tests/gui-responsive/responsive-alumno.spec.ts',
    'tests/gui-responsive/responsive-admin.spec.ts',
    'tests/gui-responsive/ciclo-completo.spec.ts',
    'tests/gui-responsive/journey-docente-integral.spec.ts',
    'tests/gui-responsive/banco-reactivos.spec.ts'
  ];
  for (const file of guiFiles) assert.match(read(file), /from ['"]\.\/visual-fixtures['"]/);

  const fixture = read('tests/gui-responsive/visual-fixtures.ts');
  assert.match(fixture, /page\.screenshot = async/);
  assert.match(fixture, /overflow horizontal/);
  assert.match(fixture, /controles interactivos sin nombre/);
  assert.match(fixture, /controles interactivos solapados/);
  assert.match(fixture, /ancho PNG no coincide con el viewport/);
  assert.match(fixture, /encabezado PNG inválido/);
  assert.match(fixture, /createHash\('sha256'\)/);
  assert.match(fixture, /gui-visual-evidence-manifest\.json/);
  assert.match(fixture, /testInfo\.attach/);
});

test('la vista de resultados del alumno conserva sus aserciones UX activas antes de capturar', () => {
  const alumno = read('tests/gui-responsive/responsive-alumno.spec.ts');
  assert.match(alumno, /heading', \{ name: \/Resultados disponibles\/i \}\)\)\.toBeVisible\(\)/);
  assert.match(alumno, /await assertNoHorizontalOverflow\(page, `Alumno resultados \$\{viewport\.name\}`\)/);
  assert.match(alumno, /await assertInteractiveControlsAreNamed\(page, `Alumno resultados \$\{viewport\.name\}`\)/);
  assert.doesNotMatch(alumno, /\/\/\s*await assertNoHorizontalOverflow\(page, `Alumno resultados/);
  assert.doesNotMatch(alumno, /\/\/\s*await assertInteractiveControlsAreUsable\(page, `Alumno resultados/);
});

test('los recorridos de banco/reactivos y PDF producen evidencia visual inspeccionable', () => {
  const bank = read('tests/gui-responsive/banco-reactivos.spec.ts');
  assert.match(bank, /banco-reactivos-importar\.png/);
  assert.match(bank, /banco-reactivos-publicado\.png/);
  const pdf = read('tests/gui-responsive/plantillas-pdf-edge.spec.ts');
  assert.match(pdf, /pdf-descarga-disponible\.png/);
  assert.match(pdf, /iframe title="Vista previa del PDF" src="\/visualizacion\.pdf"/);
  assert.match(pdf, /respuestaInlinePromise = page\.waitForResponse/);
  assert.match(pdf, /content-disposition'\]\)\.toContain\('inline'\)/);
  assert.match(pdf, /await expect\(page\.getByTitle\('Vista previa del PDF'\)\)\.toBeVisible\(\)/);
  assert.match(pdf, /await expect\(enlaceDescarga\)\.toBeVisible\(\)/);
  assert.match(pdf, /PDFDocument\.load\(bytesDescargados\)/);
});

test('la aceptación estable ejecuta E2E visuales de ciclo completo y conserva su evidencia', () => {
  const workflow = read('.github/workflows/release-stable-gate.yml');
  assert.match(workflow, /npm run test:gui:responsive:e2e:ci/);
  assert.match(workflow, /npm run test:gui:cycle:e2e:ci/);
  assert.match(workflow, /npm run test:gui:pdf:e2e:ci/);
  assert.match(workflow, /E2E_BROWSER_CHANNEL=chromium/);
  assert.match(workflow, /candidate\/test-results\/\*\*/);
  assert.match(workflow, /E2E_PLAYWRIGHT_OUTPUT_DIR="\$RUNNER_TEMP\/evaluapro-e2e-playwright-results"/);
  assert.match(workflow, /evaluapro-pdf-edge-results/);
  assert.match(workflow, /runner\.temp \}\}\/evaluapro-e2e-playwright-results/);
});

test('el Installer Hub ejecuta el recorrido PDF GUI en Microsoft Edge y lo conserva en su artefacto', () => {
  const workflow = read('.github/workflows/ci-installer-windows.yml');
  assert.match(workflow, /npx playwright install msedge/);
  assert.match(workflow, /E2E visual de vista y descarga PDF en Edge/);
  assert.match(workflow, /E2E_BROWSER_CHANNEL: msedge/);
  assert.match(workflow, /E2E_REPORT_DIR: \$\{\{ steps\.preparar_reporte_e2e\.outputs\.report_dir \}\}/);
});

test('la captura visual del instalador diferencia App Host y Web docente con contratos UX propios', () => {
  const capture = read('scripts/tests/capture-installer-web.mjs');
  assert.match(capture, /\['apphost', 'docente'\]\.includes\(surface\)/);
  assert.match(capture, /page\.getByRole\('main'\)/);
  assert.match(capture, /getByText\('Dashboard - Sistema EvaluaPro'/);
  assert.match(capture, /getByRole\('tab', \{ name: 'Principal', exact: true \}\)/);
  assert.match(capture, /requiredCardLabels = \[/);
  assert.match(capture, /'Modo actual'/);
  assert.match(capture, /'Entornos activos'/);
  assert.match(capture, /'Tareas gestionadas'/);
  assert.match(capture, /'Última actualización'/);
  assert.match(capture, /'Servicios activos'/);
  assert.match(capture, /'Servicios caidos'/);
  assert.match(capture, /'Eventos recientes \(inicio\/detención\)'/);
  assert.match(capture, /'Tiempo de sesion'/);
  assert.match(capture, /missingCardLabels\.length/);
  assert.match(capture, /card\.width < 140/);
  assert.match(capture, /layout\.surface !== surface/);
  assert.match(capture, /document\.querySelector\('main, \[role="main"\]'\)/);
  assert.match(capture, /mainLandmarkCount:/);
  assert.match(capture, /mainCandidates:/);
  assert.match(capture, /iframeCount:/);
  assert.doesNotMatch(capture, /main\.page/);
  const runner = read('scripts/tests/installer-hub-e2e-docente.ps1');
  assert.match(runner, /-Surface 'apphost'/);
  assert.match(runner, /-Surface 'docente'/);
  assert.equal((runner.match(/-Surface 'apphost'/g) ?? []).length, 1);
  assert.equal((runner.match(/-Surface 'docente'/g) ?? []).length, 2);
});

test('los indicadores del dashboard usan columnas que conservan ancho legible en contenedores estrechos', () => {
  const dashboard = read('scripts/dashboard.html');
  const desktopRule = dashboard.match(/\.summary-grid\s*\{\s*grid-template-columns:\s*([^;]+);/g) ?? [];
  assert.ok(desktopRule.some((rule) => /auto-fit/.test(rule)), 'summary-grid debe adaptar las columnas a su ancho real');
  assert.doesNotMatch(dashboard, /\.summary-grid\s*\{\s*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
});
