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

test('los recorridos de banco/reactivos y PDF producen evidencia visual inspeccionable', () => {
  const bank = read('tests/gui-responsive/banco-reactivos.spec.ts');
  assert.match(bank, /banco-reactivos-importar\.png/);
  assert.match(bank, /banco-reactivos-publicado\.png/);
  const pdf = read('tests/gui-responsive/plantillas-pdf-edge.spec.ts');
  assert.match(pdf, /pdf-descarga-disponible\.png/);
  assert.match(pdf, /await expect\(enlaceDescarga\)\.toBeVisible\(\)/);
  assert.match(pdf, /application\/pdf/);
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
