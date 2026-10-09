import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChangedCoverageArgs, buildCoveragePlan, buildDifferentialCoveragePlan, buildFocusedCoverageArgsForFiles, formatFailureExcerpt } from '../testing/run-backend-coverage-batches.mjs';

test('cobertura backend separa el lote pesado de aislamiento docente', () => {
  const plan = buildCoveragePlan();

  const payloadIndex = plan.batches.findIndex((batch) => batch.name === 'backend-calificacion-omr-payload');
  assert.ok(payloadIndex > 0);
  assert.equal(plan.batches.slice(0, payloadIndex).every((batch) => batch.name.startsWith('backend-root-')), true);
  assert.equal(plan.batches[payloadIndex].args.includes('tests/calificacion.omr.payload.test.ts'), true);
  assert.equal(plan.batches.some((batch) => batch.args.includes('tests/integracion/classroom.pull.test.ts')), true);
  assert.equal(plan.batches.some((batch) => batch.args.includes('tests/integracion/flujoDocenteGlobalE2E.test.ts')), true);
  assert.equal(plan.batches.some((batch) => batch.args.includes('tests/integracion/qrEscaneoOmr.test.ts')), true);
  assert.equal(plan.batches.some((batch) => batch.args.includes('tests/integracion/aislamientoDocente.test.ts')), true);
});

test('cobertura backend conserva umbrales solo en el merge final', () => {
  const plan = buildCoveragePlan();
  const batchArgs = plan.batches.flatMap((batch) => batch.args);

  assert.equal(batchArgs.includes('--coverage.thresholds.lines=0'), true);
  assert.equal(plan.merge.args.some((arg) => arg.startsWith('--coverage.thresholds.')), false);
  assert.equal(plan.merge.args.includes('--coverage'), true);
});

test('formatFailureExcerpt conserva solo el final del log y limita el tamaño de línea', () => {
  const lines = ['primero', 'segundo', 'x'.repeat(20), 'último'];

  assert.equal(formatFailureExcerpt(lines.join('\n'), 2, 8), `${'x'.repeat(8)}\núltimo`);
});

test('formatFailureExcerpt devuelve vacío para logs sin contenido', () => {
  assert.equal(formatFailureExcerpt(' \n\r\n'), '');
});
  
test('coverage diferencial ejecuta solo pruebas afectadas y reporta archivos modificados', () => {
  const args = buildChangedCoverageArgs('origin/main');

  assert.deepEqual(args.slice(0, 6), [
    'vitest',
    'run',
    '--coverage',
    '--changed=origin/main',
    '--pool=forks',
    '--reporter=default'
  ]);
  assert.equal(args.includes('--coverage.thresholds.lines=0'), true);
});

test('coverage diferencial rechaza una referencia vacía o una opción inyectada', () => {
  assert.throws(() => buildChangedCoverageArgs(''), /referencia Git válida/);
  assert.throws(() => buildChangedCoverageArgs('--run'), /referencia Git válida/);
});

test('coverage diferencial omite Vitest si el diff no contiene fuentes backend', () => {
  assert.deepEqual(buildDifferentialCoveragePlan('origin/main', []), {
    mode: 'sin-fuentes-backend',
    args: null,
    skipReason: 'no-backend-source-files'
  });
});

test('coverage diferencial conserva el perfil enfocado cuando sí cambian fuentes', () => {
  const plan = buildDifferentialCoveragePlan('origin/main', [
    'apps/backend/src/modulos/modulo_autenticacion/servicioGoogle.ts'
  ]);

  assert.equal(plan.mode, 'diferencial enfocado');
  assert.equal(plan.skipReason, null);
  assert.ok(plan.args.includes('tests/servicioGoogle.test.ts'));
});

test('coverage diferencial enfoca el test y el controlador OMR cuando solo cambia ese modulo', () => {
  const args = buildFocusedCoverageArgsForFiles([
    'apps/backend/src/modulos/modulo_escaneo_omr/controladorEscaneoOmr.ts'
  ]);

  assert.ok(args);
  assert.equal(args.includes('tests/omr.prevalidacion.test.ts'), true);
  assert.equal(
    args.includes('--coverage.include=src/modulos/modulo_escaneo_omr/controladorEscaneoOmr.ts'),
    true
  );
  assert.equal(args.some((arg) => arg.startsWith('--changed=')), false);
});

test('coverage diferencial enfoca SQLite y las dos rutas de autenticacion con sus pruebas directas', () => {
  const args = buildFocusedCoverageArgsForFiles([
    'apps/backend/src/infraestructura/baseDatos/sqlite.ts',
    'apps/backend/src/modulos/modulo_autenticacion/controladorAutenticacion.ts',
    'apps/backend/src/modulos/modulo_autenticacion/servicioGoogle.ts'
  ]);

  assert.ok(args);
  assert.ok(args.includes('tests/integracion/periodosPortada.test.ts'));
  assert.ok(args.includes('tests/integracion/autenticacion.googleOnly.test.ts'));
  assert.ok(args.includes('tests/servicioGoogle.test.ts'));
  assert.ok(args.includes('--coverage.include=src/infraestructura/baseDatos/sqlite.ts'));
  assert.ok(args.includes('--coverage.include=src/modulos/modulo_autenticacion/controladorAutenticacion.ts'));
  assert.ok(args.includes('--coverage.include=src/modulos/modulo_autenticacion/servicioGoogle.ts'));
  assert.equal(args.some((arg) => arg.startsWith('--changed=')), false);
});

test('coverage diferencial enfoca la previsualizacion extraordinaria en su flujo E2E directo', () => {
  const plan = buildDifferentialCoveragePlan('origin/main', [
    'apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/previsualizacionPlantillas.ts'
  ]);

  assert.equal(plan.mode, 'diferencial enfocado');
  assert.ok(plan.args.includes('tests/integracion/flujoExamen.test.ts'));
  assert.ok(plan.args.includes('--coverage.include=src/modulos/modulo_generacion_pdf/application/usecases/previsualizacionPlantillas.ts'));
  assert.equal(plan.args.some((arg) => arg.startsWith('--changed=')), false);
});

test('coverage diferencial enfoca seguridad backend en pruebas directas de los nueve archivos', () => {
  const changedFiles = [
    'apps/backend/src/app.ts',
    'apps/backend/src/configuracion.ts',
    'apps/backend/src/modulos/modulo_banco_preguntas/controladorBancoPreguntas.ts',
    'apps/backend/src/modulos/modulo_banco_preguntas/sanitizarContenidoRico.ts',
    'apps/backend/src/modulos/modulo_banco_preguntas/servicioReactivos.ts',
    'apps/backend/src/modulos/modulo_escaneo_omr/archivoTemporalOmr.ts',
    'apps/backend/src/modulos/modulo_escaneo_omr/controladorIngestaPdfOmr.ts',
    'apps/backend/src/modulos/modulo_escaneo_omr/rutasEscaneoOmr.ts',
    'apps/backend/src/modulos/modulo_generacion_pdf/infra/pdfKitRenderer.ts'
  ];
  const plan = buildDifferentialCoveragePlan('origin/main', changedFiles);

  assert.equal(plan.mode, 'diferencial enfocado');
  assert.equal(plan.skipReason, null);
  for (const testFile of [
    'tests/app.cors.test.ts',
    'tests/configuracion.produccion.test.ts',
    'tests/sanitizarContenidoRico.test.ts',
    'tests/integracion/reactivosIngesta.test.ts',
    'tests/archivoTemporalOmr.test.ts',
    'tests/integracion/omrJobsWorkflow.test.ts',
    'tests/pdfKitRenderer.security.test.ts'
  ]) {
    assert.ok(plan.args.includes(testFile), `falta prueba directa: ${testFile}`);
  }
  for (const changedFile of changedFiles) {
    const coveragePath = `--coverage.include=${changedFile.replace('apps/backend/', '')}`;
    assert.ok(plan.args.includes(coveragePath), `falta cobertura de fuente: ${coveragePath}`);
  }
  assert.equal(plan.args.some((arg) => arg.startsWith('--changed=')), false);
});

test('coverage diferencial cae a seleccion automatica ante fuentes sin perfil validado', () => {
  assert.equal(buildFocusedCoverageArgsForFiles([
    'apps/backend/src/modulos/modulo_calificacion/controlador.ts'
  ]), null);
});
