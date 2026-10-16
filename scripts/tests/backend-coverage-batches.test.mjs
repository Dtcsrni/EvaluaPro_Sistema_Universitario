import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildChangedCoverageArgs, buildCoveragePlan, buildDifferentialCoveragePlan, buildFocusedCoverageArgsForFiles, buildRegenerarExamenIsolationDiagnostic, formatFailureExcerpt, runBatches, runCoverageFailureDiagnostics } from '../testing/run-backend-coverage-batches.mjs';

test('cobertura backend separa el lote pesado de aislamiento docente', () => {
  const plan = buildCoveragePlan();

  const payloadIndex = plan.batches.findIndex((batch) => batch.name === 'backend-calificacion-omr-payload');
  assert.ok(payloadIndex > 0);
  assert.equal(plan.batches.slice(0, payloadIndex).every((batch) => batch.name.startsWith('backend-root-')), true);
  assert.equal(plan.batches[payloadIndex].args.includes('tests/calificacion.omr.payload.test.ts'), true);
  assert.equal(plan.batches.some((batch) => batch.args.includes('tests/integracion/classroom.pull.test.ts')), true);
  assert.equal(plan.batches.some((batch) => batch.args.includes('tests/integracion/flujoDocenteGlobalE2E.test.ts')), true);
  assert.equal(plan.batches.some((batch) => batch.args.includes('tests/integracion/qrEscaneoOmr.test.ts')), true);
  assert.equal(plan.batches.some((batch) => batch.args.includes('tests/integracion/omrDatasetExportApi.test.ts')), true);
  assert.equal(plan.batches.some((batch) => batch.args.includes('tests/integracion/aislamientoDocente.test.ts')), true);

  const integrationFiles = plan.batches.flatMap((batch) => batch.args.filter((arg) => arg.startsWith('tests/integracion/')));
  assert.equal(new Set(integrationFiles).size, integrationFiles.length, 'hay suites de integración duplicadas entre lotes');

  const omrWorkflowBatch = plan.batches.find((batch) => batch.args.includes('tests/integracion/omrJobsWorkflow.test.ts'));
  assert.ok(omrWorkflowBatch, 'falta el lote aislado de omrJobsWorkflow');
  assert.deepEqual(
    omrWorkflowBatch.args.filter((arg) => arg.startsWith('tests/')),
    ['tests/integracion/omrJobsWorkflow.test.ts']
  );

  const examFlowBatch = plan.batches.find((batch) => batch.args.includes('tests/integracion/flujoExamen.test.ts'));
  assert.ok(examFlowBatch, 'falta la suite completa de flujo de examen');
  assert.equal(examFlowBatch.exclusive, true, 'el flujo intensivo debe correr sin otros lotes del scheduler');
  assert.deepEqual(
    examFlowBatch.args.filter((arg) => arg.startsWith('tests/')),
    ['tests/integracion/flujoExamen.test.ts']
  );

  const omrJobsBatch = plan.batches.find((batch) => batch.args.includes('tests/integracion/omrJobsWorkflow.test.ts'));
  assert.ok(omrJobsBatch, 'falta el lote OMR por jobs');
  assert.equal(omrJobsBatch.exclusive, true, 'el flujo OMR intensivo debe correr sin otros lotes del scheduler');
  assert.equal(omrJobsBatch.timeoutMs, 2_100_000, 'el límite específico debe superar la duración aislada medida con margen');
  assert.deepEqual(
    omrJobsBatch.args.filter((arg) => arg.startsWith('tests/')),
    ['tests/integracion/omrJobsWorkflow.test.ts']
  );

  const pdfLayoutBatch = plan.batches.find((batch) => batch.args.includes('tests/pdf.layout.visual.guard.test.ts'));
  assert.ok(pdfLayoutBatch, 'falta la suite visual de PDF en el plan de cobertura');
  assert.equal(pdfLayoutBatch.exclusive, true, 'la suite visual costosa debe correr sin otros lotes del scheduler');
  assert.equal(pdfLayoutBatch.timeoutMs, 2_100_000, 'el límite específico debe dejar margen sobre la duración aislada medida');
  assert.deepEqual(
    pdfLayoutBatch.args.filter((arg) => arg.startsWith('tests/')),
    ['tests/pdf.layout.visual.guard.test.ts']
  );
  assert.ok(pdfLayoutBatch.args.includes('--maxWorkers=1'), 'la suite visual exclusiva no debe competir entre workers de Vitest');

  const regenerarBatch = plan.batches.find((batch) => batch.args.includes('tests/integracion/regenerarExamenGenerado.test.ts'));
  assert.ok(regenerarBatch, 'falta la suite de regeneración de examen en cobertura');
  assert.equal(regenerarBatch.name, 'backend-integracion-regenerar-examen');
  assert.equal(regenerarBatch.exclusive, true, 'la suite afectada por contención debe esperar a que drenen los workers');
  assert.ok(regenerarBatch.args.includes('--coverage'));
  assert.ok(regenerarBatch.args.includes('--maxWorkers=1'));
  assert.deepEqual(
    regenerarBatch.args.filter((arg) => arg.startsWith('tests/')),
    ['tests/integracion/regenerarExamenGenerado.test.ts']
  );
});

test('scheduler ejecuta lotes exclusivos después de drenar los workers paralelos', async () => {
  let activos = 0;
  let maxActivos = 0;
  const eventos = [];
  const result = await runBatches([
    { name: 'normal-a' },
    { name: 'normal-b' },
    { name: 'exclusive', exclusive: true }
  ], 2, async ({ name, exclusive }) => {
    activos += 1;
    maxActivos = Math.max(maxActivos, activos);
    eventos.push(`start:${name}:${activos}`);
    await Promise.resolve();
    activos -= 1;
    eventos.push(`end:${name}:${activos}`);
    if (exclusive) assert.equal(activos, 0, 'un lote exclusivo inició con otro worker activo');
    return 0;
  });

  assert.equal(result.exitCode, 0);
  assert.equal(maxActivos, 2, 'los lotes ordinarios conservan su concurrencia');
  assert.ok(eventos.indexOf('start:exclusive:1') > eventos.indexOf('end:normal-a:0'));
  assert.ok(eventos.indexOf('start:exclusive:1') > eventos.indexOf('end:normal-b:0'));
});

test('scheduler informa recuperación como inestable y mantiene el código de salida fallido', async () => {
  const result = await runBatches([
    { name: 'recovered' },
    { name: 'exclusive', exclusive: true }
  ], 1, async ({ name }) => ({
    exitCode: 0,
    recovered: name === 'recovered',
    attempts: name === 'recovered' ? [{ attempt: 1, exitCode: 124 }, { attempt: 2, exitCode: 0 }] : [{ attempt: 1, exitCode: 0 }]
  }));

  assert.equal(result.recoveredAttempt, true);
  assert.equal(result.exitCode, 1, 'un lote que requirió retry no es una pasada estable');
  assert.equal(result.results.find(({ name }) => name === 'exclusive').exitCode, 0);
});

test('diagnóstico aislado de regeneración conserva cobertura y una sola suite, sin ser un retry del gate', () => {
  const diagnostic = buildRegenerarExamenIsolationDiagnostic({
    args: [
      'vitest', 'run', '--coverage',
      'tests/integracion/regenerarExamenGenerado.test.ts',
      'tests/integracion/rolesPermisos.test.ts'
    ]
  });

  assert.ok(diagnostic);
  assert.equal(diagnostic.args.includes('--coverage'), true);
  assert.equal(diagnostic.args.includes('--maxWorkers=1'), true);
  assert.deepEqual(
    diagnostic.args.filter((arg) => arg.startsWith('tests/')),
    ['tests/integracion/regenerarExamenGenerado.test.ts']
  );
  assert.equal(buildRegenerarExamenIsolationDiagnostic({ args: ['tests/integracion/rolesPermisos.test.ts'] }), null);

  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts/testing/run-backend-coverage-batches.mjs'), 'utf8');
  assert.match(runner, /diagnostics,\s*recoveredAttempt: batches\.recoveredAttempt,\s*failed: true/);
  assert.match(runner, /process\.exit\(failureCode\)/);
});

test('diagnóstico corre tras drenar los lotes y su aprobación nunca convierte cobertura fallida en verde', async () => {
  const plan = buildCoveragePlan();
  const loteRegeneracion = plan.batches.find((batch) => batch.args.includes('tests/integracion/regenerarExamenGenerado.test.ts'));
  assert.ok(loteRegeneracion);
  assert.equal(loteRegeneracion.exclusive, true);
  assert.equal(await runCoverageFailureDiagnostics({
    batches: { exitCode: 0, results: [{ name: loteRegeneracion.name, exitCode: 0 }] },
    plan,
    compareIsolated: true,
    executeDiagnostic: async () => { throw new Error('no debe repetir una suite que ya corre aislada'); }
  }).then((items) => items.length), 0);

  const planComparativo = {
    ...plan,
    batches: plan.batches.map((batch) => batch === loteRegeneracion ? { ...batch, exclusive: false } : batch)
  };

  let ejecuciones = 0;
  const batches = {
    exitCode: 1,
    results: [{
      name: loteRegeneracion.name,
      exitCode: 1,
      attempts: [{
        failureReason: 'timeout-de-prueba',
        log: 'backend-integracion-n-z-09 1/1.log'
      }]
    }]
  };
  const diagnosticos = await runCoverageFailureDiagnostics({
    batches,
    plan: planComparativo,
    readFailureLog: async () => 'tests/integracion/regenerarExamenGenerado.test.ts > regenerar examen generado > regenera PDF y recalcula paginas (requiere forzar si ya fue descargado) timed out in 60000ms',
    executeDiagnostic: async ({ name }) => {
      ejecuciones += 1;
      assert.equal(name, 'backend-diagnostico-aislado-regenerar-examen');
      return 0;
    }
  });

  assert.equal(ejecuciones, 1);
  assert.equal(diagnosticos[0].comparison.isolatedExitCode, 0);
  assert.equal(diagnosticos[0].exitCode, 1, 'el diagnóstico aislado exitoso no puede borrar el fallo original');
  assert.equal(batches.exitCode, 1);
  assert.equal((await runCoverageFailureDiagnostics({
    batches,
    plan: planComparativo,
    readFailureLog: async () => 'tests/integracion/rolesPermisos.test.ts > assertion failed',
    executeDiagnostic: async () => { throw new Error('no debe diagnosticar otra suite'); }
  })).length, 0);
  assert.equal((await runCoverageFailureDiagnostics({
    batches: { exitCode: 0, results: [] }, plan: planComparativo, executeDiagnostic: async () => { throw new Error('no debe correr'); }
  })).length, 0);
});

test('comparación forzada conserva ambas mediciones y bloquea si falla cualquiera', async () => {
  const plan = buildCoveragePlan();
  const batch = plan.batches.find((item) => item.args.includes('tests/integracion/regenerarExamenGenerado.test.ts'));
  const planCompartido = { ...plan, batches: plan.batches.map((item) => item === batch ? { ...item, exclusive: false } : item) };
  const result = await runCoverageFailureDiagnostics({
    batches: { exitCode: 0, results: [{ name: batch.name, exitCode: 0, durationMs: 42_000 }] },
    plan: planCompartido,
    compareIsolated: true,
    executeDiagnostic: async () => 1
  });

  assert.equal(result[0].comparison.sharedExitCode, 0);
  assert.equal(result[0].comparison.sharedDurationMs, 42_000);
  assert.equal(result[0].comparison.isolatedExitCode, 1);
  assert.equal(result[0].exitCode, 1, 'el aislamiento fallido debe bloquear aunque el lote compartido pase');
});

test('el runner integral limita cada lote a una pasada y conserva el diagnóstico de falla', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts/testing/run-backend-coverage-batches.mjs'), 'utf8');
  assert.match(runner, /const batchAttempts = 1/);
  assert.match(runner, /failureReason: code === 0 \? null : await classifyAttemptFailure/);
  assert.match(runner, /attemptLogPath/);
});

test('cada intento deja duración, timestamps, causa de fallo y log en el resumen auditable', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts/testing/run-backend-coverage-batches.mjs'), 'utf8');
  for (const field of ['startedAt:', 'finishedAt:', 'durationMs:', 'failureReason:', 'log:']) {
    assert.ok(runner.includes(field), `falta registrar ${field}`);
  }
  assert.match(runner, /runBatch\(batch\)[\s\S]*?attemptLogPath[\s\S]*?JSON\.stringify\(\{ name: batch\.name, exclusive: Boolean\(batch\.exclusive\), attempts \}/);
  assert.match(runner, /const timeoutMs = batch\.timeoutMs \?\? batchTimeoutMs/);
  assert.match(runner, /durationMs,\s*timeoutMs,/);
  assert.match(runner, /runVitest\(batch\.args,[\s\S]*?timeoutMs\)/);
  assert.match(runner, /recoveredAttempt \? 1 : 0/);
  assert.match(runner, /recovered: attempts\.some\(\(\{ exitCode \}\) => exitCode !== 0\)/);
});

test('coverage diferencial enfoca la exportación de dataset OMR en sus pruebas directas', () => {
  const args = buildFocusedCoverageArgsForFiles([
    'apps/backend/src/modulos/modulo_escaneo_omr/exportadorDatasetOmr.ts',
    'apps/backend/src/modulos/modulo_escaneo_omr/controladorIngestaPdfOmr.ts'
  ]);

  assert.ok(args);
  assert.ok(args.includes('tests/omrDatasetExport.test.ts'));
  assert.ok(args.includes('tests/integracion/omrDatasetExportApi.test.ts'));
  assert.ok(args.includes('--coverage.include=src/modulos/modulo_escaneo_omr/exportadorDatasetOmr.ts'));
  assert.ok(args.includes('--coverage.include=src/modulos/modulo_escaneo_omr/controladorIngestaPdfOmr.ts'));
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

