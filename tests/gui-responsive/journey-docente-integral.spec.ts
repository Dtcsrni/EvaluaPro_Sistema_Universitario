/**
 * journey-docente-integral.spec
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const docenteApiPort = process.env.E2E_DOCENTE_API_PORT || '4000';
const alumnoWebPort = process.env.E2E_ALUMNO_WEB_PORT || '4174';

test.describe('Journey docente integral visual', () => {
  test.setTimeout(240_000);

  async function crearFixtureAcademico(page: import('@playwright/test').Page, request: import('@playwright/test').APIRequestContext) {
    const token = await page.evaluate(() => localStorage.getItem('tokenDocente'));
    if (!token) throw new Error('No hay token docente en el contexto visual');
    const base = `http://127.0.0.1:${docenteApiPort}/api`;
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    
    const periodosResp = await request.get(`${base}/periodos?activo=1`, { headers: { Authorization: `Bearer ${token}` } });
    const periodosCuerpo = await periodosResp.json();
    const periodo = (periodosCuerpo.periodos ?? periodosCuerpo.materias ?? [])[0];
    if (!periodo?._id) throw new Error('No se encontró la materia creada en el fixture visual');
    
    const alumnosResp = await request.get(`${base}/alumnos`, { headers: { Authorization: `Bearer ${token}` } });
    const alumnosCuerpo = await alumnosResp.json();
    const alumno = (alumnosCuerpo.alumnos ?? []).find((item: any) => item.periodoId === periodo._id) ?? alumnosCuerpo.alumnos?.[0];
    if (!alumno?._id) throw new Error('No se encontró el alumno creado en el fixture visual');

    const temaResp = await request.post(`${base}/banco-preguntas/temas`, { headers: auth, data: { periodoId: periodo._id, nombre: 'Tema E2E Integral' } });
    expect(temaResp.status()).toBe(201);
    const temaId = String((await temaResp.json()).tema._id);
    const batch = {
      contract: 'evaluapro.reactivos.batch',
      schemaVersion: 1,
      batchId: `e2e-integral-${Date.now()}`,
      target: { periodoId: String(periodo._id), temaIds: [temaId] },
      source: { kind: 'manual', generator: 'playwright-e2e', generatedAt: new Date().toISOString() },
      items: Array.from({ length: 20 }, (_, indice) => ({
        externalKey: `integral-${indice + 1}`,
        itemId: null,
        expectedVersion: null,
        format: 'omr.mcq5',
        stem: { format: 'richtext', value: `Reactivo integral ${indice + 1}` },
        options: ['A', 'B', 'C', 'D', 'E'].map((key, opcion) => ({ key, value: `Respuesta ${key} ${indice + 1}`, isCorrect: opcion === 0 })),
        metadata: { difficultyHypothesis: 'medium' },
        provenance: { origin: 'authored', confidence: 1, notes: 'fixture E2E aislado' }
      }))
    };
    const previewResp = await request.post(`${base}/banco-preguntas/importaciones/preview`, { headers: auth, data: batch });
    expect(previewResp.status()).toBe(200);
    const preview = await previewResp.json();
    expect(preview.summary.create).toBe(20);
    const confirmarResp = await request.post(`${base}/banco-preguntas/importaciones/${preview.importId}/confirmar`, {
      headers: auth,
      data: { planHash: preview.planHash, payload: batch }
    });
    expect(confirmarResp.status()).toBe(200);
    const confirmado = await confirmarResp.json();
    expect(confirmado.reactivoIds).toHaveLength(20);
    for (const reactivoId of confirmado.reactivoIds as string[]) {
      const revisarResp = await request.post(`${base}/banco-preguntas/reactivos/${reactivoId}/revisar`, { headers: auth, data: {} });
      expect(revisarResp.status()).toBe(200);
      const publicarResp = await request.post(`${base}/banco-preguntas/reactivos/${reactivoId}/publicar`, { headers: auth, data: {} });
      expect(publicarResp.status()).toBe(200);
    }
    return { periodoId: String(periodo._id), alumnoId: String(alumno._id), alumnoMatricula: String(alumno.matricula) };
  }

  test('persiste y reabre el pase de lista entre navegador, API y resumen', async ({ page, request }) => {
    const sufijo = String(Date.now()) + '-' + String(Math.floor(Math.random() * 1000));
    const nombreMateria = 'Materia E2E Asistencias ' + sufijo;
    const matricula = 'CUH' + String(Math.floor(100000000 + Math.random() * 899999999));
    const nombreAlumno = 'Alumno Asistencia ' + sufijo;
    const temaAsistencia = 'Pase persistencia E2E ' + sufijo;
    const apiBase = 'http://127.0.0.1:' + docenteApiPort + '/api';

    await page.goto('/acceso');
    await page.getByRole('button', { name: 'Registrar', exact: true }).dispatchEvent('click');
    const registrarCorreo = page.getByRole('button', { name: /Registrar con correo/i });
    if (await registrarCorreo.isVisible().catch(() => false)) await registrarCorreo.click();
    await page.fill('input[placeholder="Ej. Juan Carlos"]', 'Docente');
    await page.getByLabel('Apellidos', { exact: true }).fill('Asistencias');
    await page.fill('input[type="email"]', 'asistencia_' + sufijo + '@evaluapro.local');
    await page.fill('input[type="password"]', 'P@ssword123');
    await page.getByRole('button', { name: /Crear cuenta/i }).click({ noWaitAfter: true });
    await expect(page.getByRole('button', { name: 'Banco', exact: true })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Materias', exact: true }).click();
    const mostrarFormularioMateria = page.getByRole('button', { name: /Mostrar formulario/i });
    if (await mostrarFormularioMateria.isVisible().catch(() => false)) await mostrarFormularioMateria.click();
    await expect(page.getByRole('button', { name: 'Crear materia', exact: true })).toBeVisible({ timeout: 15_000 });
    await page.locator('label:has-text("Nombre de la materia") >> input').fill(nombreMateria);
    await page.locator('label:has-text("Fecha inicio") >> input').fill('2026-01-01');
    await page.locator('label:has-text("Fecha fin") >> input').fill('2026-12-31');
    await page.locator('label:has-text("Grupos") >> input').fill('Grupo A');
    await page.getByRole('button', { name: 'Crear materia', exact: true }).click();
    await expect(page.getByRole('button', { name: /Abrir grupo Grupo A de Materia E2e Asistencias/i })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Alumnos', exact: true }).click();
    await page.locator('label:has-text("Matricula") >> input').fill(matricula);
    await page.locator('label:has-text("Nombres") >> input').fill(nombreAlumno);
    await page.locator('label:has-text("Apellidos") >> input').fill('E2E');
    await page.locator('label:has-text("Materia") >> select').first().selectOption({ index: 1 });
    await page.locator('label:has-text("Grupo") >> input').fill('Grupo A');
    await page.getByRole('button', { name: /Crear alumno/i }).click();
    await expect(page.getByText(nombreAlumno, { exact: false }).first()).toBeVisible({ timeout: 20_000 });

    const token = await page.evaluate(() => localStorage.getItem('tokenDocente'));
    if (!token) throw new Error('No hay token docente en el contexto E2E');
    const auth = { Authorization: 'Bearer ' + token };
    const [periodosResponse, alumnosResponse] = await Promise.all([
      request.get(apiBase + '/periodos?activo=1', { headers: auth }),
      request.get(apiBase + '/alumnos', { headers: auth })
    ]);
    expect(periodosResponse.status()).toBe(200);
    expect(alumnosResponse.status()).toBe(200);
    const cuerpoPeriodos = await periodosResponse.json();
    const cuerpoAlumnos = await alumnosResponse.json();
    const periodo = (cuerpoPeriodos.periodos ?? cuerpoPeriodos.materias ?? []).find((item: any) => item.nombre?.toLocaleLowerCase('es-MX') === nombreMateria.toLocaleLowerCase('es-MX'));
    const alumno = (cuerpoAlumnos.alumnos ?? []).find((item: any) => item.matricula === matricula);
    expect(periodo?._id).toBeTruthy();
    expect(alumno?._id).toBeTruthy();
    const nombreCompletoAlumno = String(alumno.nombreCompleto);

    await page.getByRole('button', { name: 'Asistencias', exact: true }).click();
    await page.getByLabel('Materia o Periodo Académico').selectOption(periodo._id);
    await page.getByLabel('Filtrar por Grupo').selectOption('Grupo A');
    await page.getByPlaceholder(/Unidad 2: Modelado dimensional/).fill(temaAsistencia);

    const crearSesionResponse = page.waitForResponse((response) =>
      response.url().includes('/asistencias/sesiones') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Crear e Iniciar Pase de Lista', exact: true }).click();
    const sesionResponse = await crearSesionResponse;
    expect(sesionResponse.status()).toBe(201);
    const { sesion } = await sesionResponse.json();
    expect(sesion?._id).toBeTruthy();
    expect(sesion?.periodoId).toBe(periodo._id);
    expect(sesion?.grupo).toBe('Grupo A');

    const marcarFalta = page.getByRole('button', { name: 'Marcar a ' + nombreCompletoAlumno + ' como Falta', exact: true });
    await expect(marcarFalta).toBeVisible();
    await marcarFalta.click();
    await expect(marcarFalta).toHaveAttribute('aria-pressed', 'true');

    const guardarAsistenciaResponse = page.waitForResponse((response) =>
      response.url().includes('/asistencias/sesiones/' + sesion._id + '/registros') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Guardar lista', exact: true }).click();
    const guardado = await guardarAsistenciaResponse;
    expect(guardado.status()).toBeLessThan(300);
    await expect(page.getByRole('button', { name: 'Resumen General', exact: true })).toHaveClass(/activo/);

    const resumenAlumno = page.getByRole('row').filter({ hasText: nombreCompletoAlumno });
    await expect(resumenAlumno.locator('td').nth(2)).toHaveText('Grupo A');
    await expect(resumenAlumno.locator('td').nth(4)).toHaveText('1');
    await expect(resumenAlumno).toContainText('0%');

    await page.reload();
    await expect(page.getByRole('button', { name: 'Banco', exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Asistencias', exact: true }).click();
    await page.getByLabel('Materia o Periodo Académico').selectOption(periodo._id);
    const sesionGuardada = page.getByRole('button', { name: new RegExp(temaAsistencia) });
    await expect(sesionGuardada).toBeVisible({ timeout: 20_000 });
    await sesionGuardada.click();
    const faltaReabierta = page.getByRole('button', { name: 'Marcar a ' + nombreCompletoAlumno + ' como Falta', exact: true });
    await expect(faltaReabierta).toHaveAttribute('aria-pressed', 'true');

    const registrosPersistidos = await request.get(apiBase + '/asistencias/sesiones/' + sesion._id + '/registros', {
      headers: auth
    });
    expect(registrosPersistidos.status()).toBe(200);
    const cuerpoPersistido = await registrosPersistidos.json();
    expect(cuerpoPersistido.registros).toHaveLength(1);
    expect(cuerpoPersistido.registros).toEqual(expect.arrayContaining([
      expect.objectContaining({ alumnoId: alumno._id, estado: 'F', periodoId: periodo._id, grupo: 'Grupo A' })
    ]));

    await page.getByRole('button', { name: 'Resumen General', exact: true }).click();
    const resumenTrasReapertura = page.getByRole('row').filter({ hasText: nombreCompletoAlumno });
    await expect(resumenTrasReapertura.locator('td').nth(2)).toHaveText('Grupo A');
    await expect(resumenTrasReapertura.locator('td').nth(4)).toHaveText('1');
    await expect(resumenTrasReapertura).toContainText('0%');
  });

  test('recorre diseño, generación, entrega, evaluación, calificación y publicación', async ({ page, request }) => {
    const sufijo = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const outputDir = process.env.E2E_SCREENSHOT_DIR || path.join(process.cwd(), 'docs', 'assets', 'ui');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // Paso 1: Acceso / Login
    await page.goto('/acceso');
    await expect(page.getByRole('button', { name: 'Registrar', exact: true })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '07_acceso_login.png'), fullPage: true, animations: 'disabled' });

    await page.getByRole('button', { name: 'Registrar', exact: true }).dispatchEvent('click');
    const registrarCorreo = page.getByRole('button', { name: /Registrar con correo/i });
    if (await registrarCorreo.isVisible().catch(() => false)) await registrarCorreo.click();
    await page.fill('input[placeholder="Ej. Juan Carlos"]', 'Docente');
    await page.getByLabel('Apellidos', { exact: true }).fill('Journey');
    await page.fill('input[type="email"]', `journey_${sufijo}@evaluapro.local`);
    await page.fill('input[type="password"]', 'P@ssword123');
    await page.screenshot({ path: path.join(outputDir, '08_acceso_registro_form.png'), fullPage: true });

    await page.getByRole('button', { name: /Crear cuenta/i }).click({ noWaitAfter: true });
    await expect(page.getByRole('button', { name: 'Banco', exact: true })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '10_tablero_inicial.png'), fullPage: true });

    // Paso 2: Materias
    const nombreMateria = `Materia E2E Integral ${sufijo}`;
    await page.getByRole('button', { name: 'Materias', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Materias', exact: true })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '11_materia_seccion.png'), fullPage: true });

    const mostrarFormularioMateria = page.getByRole('button', { name: /Mostrar formulario/i });
    if (await mostrarFormularioMateria.isVisible().catch(() => false)) {
      await mostrarFormularioMateria.click();
    }
    await expect(page.getByRole('button', { name: 'Crear materia', exact: true })).toBeVisible({ timeout: 15_000 });
    await page.locator('label:has-text("Nombre de la materia") >> input').fill(nombreMateria);
    await page.locator('label:has-text("Fecha inicio") >> input').fill('2026-01-01');
    await page.locator('label:has-text("Fecha fin") >> input').fill('2026-12-31');
    await page.locator('label:has-text("Grupos") >> input').fill('Grupo A');
    await page.screenshot({ path: path.join(outputDir, '12_materia_formulario_llenado.png'), fullPage: true });

    await page.getByRole('button', { name: 'Crear materia', exact: true }).click();
    await expect(page.getByText(new RegExp(nombreMateria, 'i')).first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '13_materia_creada_lista.png'), fullPage: true });

    const btnArchivadas = page.getByRole('button', { name: /Ver archivadas/i });
    if (await btnArchivadas.isVisible().catch(() => false)) {
      await btnArchivadas.click();
      await page.screenshot({ path: path.join(outputDir, '14_materia_archivadas_vista.png'), fullPage: true });
      await page.getByRole('button', { name: /Ver activas/i }).click();
    }

    // Paso 3: Alumnos
    await page.getByRole('button', { name: 'Alumnos', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Alumnos', exact: true })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '15_alumno_seccion.png'), fullPage: true });

    const matricula = `CUH${Math.floor(100000000 + Math.random() * 899999999)}`;
    await page.locator('label:has-text("Matricula") >> input').fill(matricula);
    await page.locator('label:has-text("Nombres") >> input').fill('Alumno');
    await page.locator('label:has-text("Apellidos") >> input').fill('Integral');
    await page.locator('label:has-text("Materia") >> select').first().selectOption({ index: 1 });
    await page.locator('label:has-text("Grupo") >> input').fill('Grupo A');
    await page.screenshot({ path: path.join(outputDir, '16_alumno_datos_llenados.png'), fullPage: true });

    await page.getByRole('button', { name: /Crear alumno/i }).click();
    await expect(page.getByText(/Alumno Integral/i).first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '17_alumno_creado_lista.png'), fullPage: true });

    // Paso 3b: Asistencias y Temarios
    const tabAsistencias = page.getByRole('button', { name: 'Asistencias', exact: true });
    if (await tabAsistencias.isVisible().catch(() => false)) {
      await tabAsistencias.click();
      await expect(page.getByRole('heading', { name: 'Asistencias', exact: true })).toBeVisible({ timeout: 20_000 });
      await page.screenshot({ path: path.join(outputDir, '18_asistencias_seccion.png'), fullPage: true, animations: 'disabled' });
    }
    const tabTemarios = page.getByRole('button', { name: 'Temarios', exact: true });
    if (await tabTemarios.isVisible().catch(() => false)) {
      await tabTemarios.click();
      await expect(page.getByRole('heading', { name: 'Temarios', exact: true })).toBeVisible({ timeout: 20_000 });
      await page.screenshot({ path: path.join(outputDir, '19_temarios_seccion.png'), fullPage: true, animations: 'disabled' });
    }

    const fixture = await crearFixtureAcademico(page, request);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Banco', exact: true })).toBeVisible({ timeout: 20_000 });

    // Paso 4: Banco
    await page.getByRole('button', { name: 'Banco', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Banco de preguntas/i })).toBeVisible();
    await expect(page.getByText('Reactivo integral 1', { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '20_banco_seccion.png'), fullPage: true });

    // Paso 5: Plantillas
    await page.getByRole('button', { name: 'Diseño de Exámenes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Diseño de Exámenes', exact: true })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '24_plantilla_seccion.png'), fullPage: true, animations: 'disabled' });

    const formularioPlantilla = page.getByRole('region', { name: 'Formulario de plantilla' });
    await formularioPlantilla.getByLabel('Titulo', { exact: false }).fill(`Plantilla E2E Integral ${sufijo}`);
    await formularioPlantilla.getByLabel('Materia', { exact: false }).selectOption(fixture.periodoId);
    const temaIntegral = page.getByRole('button', { name: /Tema E2E Integral/i });
    await expect(temaIntegral).toBeVisible({ timeout: 20_000 });
    await temaIntegral.click();
    await expect(temaIntegral).toHaveClass(/plantillas-tema-chip--selected/);
    await page.screenshot({ path: path.join(outputDir, '25_plantilla_formulario.png'), fullPage: true });

    await formularioPlantilla.getByRole('button', { name: 'Crear plantilla', exact: true }).click();
    await expect(formularioPlantilla.getByText('Plantilla creada', { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '26_plantilla_creada_exito.png'), fullPage: true });

    const previewPlantilla = page.getByRole('button', { name: 'Previsualizar PDF', exact: true }).first();
    await expect(previewPlantilla).toBeVisible({ timeout: 20_000 });
    const previewResponse = page.waitForResponse((response) => response.url().includes('/previsualizar/pdf') && response.status() === 200);
    await previewPlantilla.click();
    await previewResponse;
    await page.screenshot({ path: path.join(outputDir, '26a_plantilla_preview_pdf.png'), fullPage: true });

    await page.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }).click();
    const generacion = page.getByRole('tabpanel', { name: 'Generar Paquete PDF/OMR' });
    await expect(generacion).toBeVisible({ timeout: 20_000 });
    const plantillaSelect = generacion.locator('select').first();
    const plantillaOption = plantillaSelect.locator('option', { hasText: `Plantilla E2E Integral ${sufijo}` });
    await expect(plantillaOption).toBeAttached({ timeout: 20_000 });
    const plantillaId = await plantillaOption.getAttribute('value');
    expect(plantillaId).toBeTruthy();
    await plantillaSelect.selectOption(plantillaId!);
    await generacion.getByRole('button', { name: /Examen Individual de Muestra/i }).click();
    await page.screenshot({ path: path.join(outputDir, '27_plantilla_panel_generar.png'), fullPage: true });

    const generarResponse = page.waitForResponse((response) => response.url().includes('/examenes/generados') && response.request().method() === 'POST');
    await page.getByRole('button', { name: /Generar examen individual/i }).click();
    expect((await generarResponse).status()).toBeLessThan(400);
    await expect(generacion.getByRole('status')).toContainText(/Examen generado/i, { timeout: 30_000 });
    await expect(generacion.getByRole('button', { name: /Ver historial de lotes/i })).toBeVisible();
    await generacion.getByRole('button', { name: /Ver historial de lotes/i }).click();
    const historial = page.getByRole('tabpanel', { name: 'Historial de Lotes' });
    await expect(historial).toBeVisible({ timeout: 20_000 });
    await expect(historial.getByText(/Folio:/).first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(outputDir, '28_examen_generado_pdf.png'), fullPage: true });

    // Paso 6: OMR
    await expect(page.getByRole('button', { name: 'Descargar hoja OMR', exact: true })).toBeVisible({ timeout: 30_000 });
    const descargaOmr = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar hoja OMR', exact: true }).click();
    const omrDownload = await descargaOmr;
    const omrPath = await omrDownload.path();
    if (!omrPath) throw new Error('La descarga de la hoja OMR no produjo ruta temporal');
    await page.screenshot({ path: path.join(outputDir, '29_omr_descarga_hoja.png'), fullPage: true });

    const omrInput = historial.locator('.plantillas-omr input[type="file"]');
    await omrInput.setInputFiles(omrPath);
    await page.screenshot({ path: path.join(outputDir, '30_omr_panel_carga.png'), fullPage: true });

    await page.getByRole('button', { name: 'Procesar capturas', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Job OMR', exact: true })).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: path.join(outputDir, '31_omr_job_procesando.png'), fullPage: true });

    const finalizarOmr = page.getByRole('button', { name: 'Finalizar job', exact: true });
    if (await finalizarOmr.isEnabled()) await finalizarOmr.click();
    await expect(page.getByRole('heading', { name: 'Job OMR', exact: true })).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(outputDir, '32_omr_job_finalizado.png'), fullPage: true });

    const examen = await page.evaluate(async ({ plantillaTitulo, apiPort }) => {
      const token = localStorage.getItem('tokenDocente');
      const base = `http://127.0.0.1:${apiPort}/api`;
      const respuesta = await fetch(`${base}/examenes/plantillas`, { headers: { Authorization: `Bearer ${token}` } });
      const plantillas = await respuesta.json();
      const plantilla = (plantillas.plantillas ?? []).find((item: any) => item.titulo === plantillaTitulo);
      const generados = await fetch(`${base}/examenes/generados?plantillaId=${encodeURIComponent(plantilla._id)}&limite=10`, { headers: { Authorization: `Bearer ${token}` } });
      const cuerpo = await generados.json();
      const item = cuerpo.examenes?.[0];
      if (!item?.folio || !item?._id) throw new Error('No se encontró el examen generado para el journey');
      return { examenId: String(item._id), folio: String(item.folio) };
    }, { plantillaTitulo: `Plantilla E2E Integral ${sufijo}`, apiPort: docenteApiPort });

    // Paso 7: Entrega
    await page.getByRole('button', { name: 'Entrega', exact: true }).click();
    await page.screenshot({ path: path.join(outputDir, '33_entrega_seccion.png'), fullPage: true });

    await page.getByLabel('Folio impreso del examen', { exact: true }).fill(examen.folio);
    await page.getByRole('combobox', { name: 'Alumno receptor', exact: true }).selectOption(fixture.alumnoId);
    await page.screenshot({ path: path.join(outputDir, '34_entrega_folio_llenado.png'), fullPage: true });

    const entregaResponse = page.waitForResponse((response) => response.url().includes('/entregas/vincular-folio'));
    await page.getByRole('button', { name: 'Vincular examen', exact: true }).click();
    expect((await entregaResponse).status()).toBeLessThan(400);
    await expect(page.getByText(/Entregados/i).first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '35_entrega_vinculada_exito.png'), fullPage: true });

    // Paso 8: Evaluaciones
    await page.getByRole('button', { name: 'Evaluaciones', exact: true }).click();
    await page.screenshot({ path: path.join(outputDir, '36_evaluaciones_seccion.png'), fullPage: true });

    const evaluaciones = page.locator('.evaluaciones-panel');
    await evaluaciones.getByRole('combobox', { name: 'Periodo', exact: true }).selectOption(fixture.periodoId);
    await evaluaciones.getByRole('combobox', { name: 'Alumno', exact: true }).selectOption(fixture.alumnoId);
    await evaluaciones.getByRole('button', { name: 'Guardar política', exact: true }).click();
    await expect(evaluaciones).toContainText(/guardada|política/i, { timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '37_evaluaciones_politica_guardada.png'), fullPage: true });

    await page.getByRole('button', { name: 'Evidencias', exact: true }).click();
    await evaluaciones.getByLabel('Evidencia título').fill('Evidencia visual integral');
    await evaluaciones.getByLabel('Calificación').fill('4.5');
    await evaluaciones.getByLabel('Ponderación').fill('2');
    const evidenciaResponse = page.waitForResponse((response) => response.url().includes('/evaluaciones/v2/evidencias') && response.request().method() === 'POST');
    await evaluaciones.getByRole('button', { name: 'Guardar evidencia', exact: true }).click();
    expect((await evidenciaResponse).status()).toBeLessThan(400);
    await expect(evaluaciones).toContainText(/guardada|evidencia/i, { timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '38_evaluaciones_evidencia_guardada.png'), fullPage: true });

    // Paso 9: Calificaciones
    await page.getByRole('button', { name: 'Calificaciones', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Calificaciones', exact: true })).toBeVisible({ timeout: 20_000 });
    const listaFisica = page.locator('.calificaciones-consulta');
    await listaFisica.locator('.calificaciones-consulta__subject select').selectOption(fixture.periodoId);
    const filaListaFisica = listaFisica.locator('tbody tr').filter({ hasText: fixture.alumnoMatricula });
    await expect(filaListaFisica).toBeVisible({ timeout: 20_000 });
    await filaListaFisica.getByRole('button', { name: /Ver detalle de/ }).click();
    await expect(page.getByText('Exámen 2do Parcial automático · referencia')).toBeVisible();
    await page.getByRole('spinbutton', { name: 'Practica 2do Parcial · 0–10' }).fill('7.5');
    const practicaListaResponse = page.waitForResponse((response) => response.url().includes('/analiticas/lista-academica/calificaciones') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Guardar práctica' }).click();
    expect((await practicaListaResponse).status()).toBe(201);
    await expect(page.getByRole('spinbutton', { name: 'Practica 2do Parcial · 0–10' })).toHaveValue('7.5');
    await page.getByRole('spinbutton', { name: 'Exámen 2do Parcial · 0–5.25' }).fill('5.25');
    const examenListaResponse = page.waitForResponse((response) => response.url().includes('/analiticas/lista-academica/calificaciones') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Guardar examen' }).click();
    expect((await examenListaResponse).status()).toBe(201);
    await expect(page.getByRole('spinbutton', { name: 'Exámen 2do Parcial · 0–5.25' })).toHaveValue('5.25');
    const themeButton = page.locator('button.boton--tema');
    for (let attempt = 0; attempt < 3 && await themeButton.getAttribute('aria-label') !== 'Tema: Claro'; attempt += 1) {
      await themeButton.click();
    }
    await expect(themeButton).toHaveAttribute('aria-label', 'Tema: Claro');
    await expect(page.locator('.calificaciones-consulta__detail')).toHaveCSS('color', 'rgb(16, 32, 51)');
    await expect(page.locator('.calificaciones-consulta__manual-editors label > span').first()).toHaveCSS('color', 'rgb(51, 78, 104)');
    const fieldContrast = await page.locator('.calificaciones-consulta__subject select').evaluate((element) => {
      const context = document.createElement('canvas').getContext('2d');
      if (!context) throw new Error('Canvas 2D no disponible para verificar contraste.');
      const readComposite = (foreground: string) => {
        context.fillStyle = '#fff';
        context.fillRect(0, 0, 1, 1);
        context.fillStyle = foreground;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
      };
      const luminance = (color: number[]) => color.reduce((sum, channel, index) => {
        const linear = channel / 255 <= 0.04045 ? channel / 255 / 12.92 : ((channel / 255 + 0.055) / 1.055) ** 2.4;
        return sum + linear * [0.2126, 0.7152, 0.0722][index];
      }, 0);
      const style = getComputedStyle(element);
      const background = luminance(readComposite(style.backgroundColor));
      const foreground = luminance(readComposite(style.color));
      return {
        theme: document.documentElement.dataset.theme,
        ratio: (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05)
      };
    });
    expect(fieldContrast.theme).toBe('light');
    expect(fieldContrast.ratio).toBeGreaterThanOrEqual(4.5);
    await expect(page.locator('.calificaciones-workspace-nav button.is-active strong')).toHaveCSS('color', 'rgb(16, 32, 51)');
    await expect(page.locator('.calificaciones-workspace-nav button.is-active small')).toHaveCSS('color', 'rgb(51, 78, 104)');
    const captionAccesible = page.locator('.calificaciones-consulta__table caption.sr-only');
    await expect(captionAccesible).toBeAttached({ timeout: 20_000 });
    await expect(captionAccesible).toHaveCSS('position', 'absolute');
    await expect(page.locator('.toast')).toHaveCount(0, { timeout: 20_000 });
    await page.mouse.move(0, 0);
    await page.screenshot({ path: path.join(outputDir, '39_calificaciones_seccion.png'), fullPage: true, animations: 'disabled' });

    await page.getByRole('button', { name: /Revisión y captura/i }).click();
    const panelManual = page.locator('.calificaciones-manual-panel');
    await panelManual.getByLabel('Alumno').selectOption(fixture.alumnoId);
    await expect(panelManual.getByLabel('Examen entregado').locator('option')).toHaveCount(2, { timeout: 20_000 });
    await panelManual.getByLabel('Examen entregado').selectOption(examen.examenId);
    await panelManual.getByRole('button', { name: 'Usar examen para calificación manual', exact: true }).click();
    await expect(page.getByText(/Modo manual activo/i)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('checkbox', { name: 'Bono por guía de estudio (+0.25)', exact: true }).check();
    await expect(page.getByText(/Calificación final: 0\.25 \/ 5\.00/i)).toBeVisible();
    await page.screenshot({ path: path.join(outputDir, '40_calificaciones_modo_manual.png'), fullPage: true });

    const guardarCalificacion = page.getByRole('button', { name: 'Guardar calificación', exact: true });
    const calificarResponse = page.waitForResponse((response) => response.url().includes('/calificaciones/calificar') && response.request().method() === 'POST');
    await guardarCalificacion.click();
    const calificarResponseReal = await calificarResponse;
    expect(calificarResponseReal.status()).toBeLessThan(400);
    const calificacionGuardada = await calificarResponseReal.json();
    expect(calificacionGuardada.calificacion.bonoTexto).toBe('0.25');
    expect(calificacionGuardada.calificacion.calificacionExamenFinalTexto).toBe('0.25');
    await expect(page.getByLabel('Panel de calificación').getByText('Calificacion guardada', { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(outputDir, '41_calificaciones_guardada_exito.png'), fullPage: true });

    // Paso 10: Reportes
    await page.getByRole('button', { name: /Actas y exportación/i }).click();
    const reportes = page.locator('.calif-deck-card--reports');
    await reportes.getByRole('combobox', { name: 'Materia del reporte', exact: true }).selectOption(fixture.periodoId);
    await page.screenshot({ path: path.join(outputDir, '42_reportes_seccion.png'), fullPage: true });

    const descargaCsv = page.waitForEvent('download');
    await reportes.getByRole('button', { name: 'Descargar CSV', exact: true }).click();
    const csvDownload = await descargaCsv;
    expect(await csvDownload.path()).toBeTruthy();
    await page.screenshot({ path: path.join(outputDir, '43_reportes_descarga_csv.png'), fullPage: true });

    const descargaXlsx = page.waitForEvent('download');
    await reportes.getByRole('button', { name: 'Descargar XLSX', exact: true }).click();
    const xlsxDownload = await descargaXlsx;
    expect(await xlsxDownload.path()).toBeTruthy();
    await page.screenshot({ path: path.join(outputDir, '44_reportes_descarga_xlsx.png'), fullPage: true });

    // Paso 11: Sincronización & Backup
    await page.getByRole('button', { name: 'Sincronización', exact: true }).click();
    await page.screenshot({ path: path.join(outputDir, '45_sincronizacion_seccion.png'), fullPage: true });

    const backupPanel = page.getByRole('heading', { name: 'Backups y exportaciones', exact: true }).locator('..');
    const descargaBackup = page.waitForEvent('download');
    await backupPanel.getByRole('button', { name: 'Exportar backup', exact: true }).click();
    const backupDownload = await descargaBackup;
    const backupPath = await backupDownload.path();
    if (!backupPath) throw new Error('La exportación de backup no produjo ruta temporal');
    await expect(backupPanel).toContainText('Cifrado autenticado', { timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '46_backup_exportar_cifrado.png'), fullPage: true });

    await backupPanel.locator('input[type="file"]').setInputFiles(backupPath);
    await expect(page.getByRole('button', { name: 'Sí, importar paquete', exact: true })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '47_backup_importar_paquete.png'), fullPage: true });
    await page.getByRole('button', { name: 'Sí, importar paquete', exact: true }).click();
    await expect(backupPanel).toContainText('Paquete importado', { timeout: 30_000 });

    // Paso 12: Publicación
    const publicar = page.getByRole('heading', { name: 'Publicar en portal', exact: true }).locator('..');
    await publicar.getByRole('combobox', { name: 'Materia', exact: true }).selectOption(fixture.periodoId);
    await page.screenshot({ path: path.join(outputDir, '48_publicacion_publicar.png'), fullPage: true });

    const codigoResponse = page.waitForResponse((response) => response.url().includes('/sincronizaciones/codigo-acceso') && response.request().method() === 'POST');
    await publicar.getByRole('button', { name: 'Generar codigo', exact: true }).click();
    expect((await codigoResponse).status()).toBeLessThan(400);
    await expect(publicar).toContainText('Código generado:', { timeout: 30_000 });
    await page.screenshot({ path: path.join(outputDir, '49_publicacion_codigo_generado.png'), fullPage: true });

    // El código de acceso se incluye en la sincronización; publicar después de generarlo.
    const publicarResponse = page.waitForResponse((response) => response.url().includes('/sincronizaciones/publicar') && response.request().method() === 'POST');
    await publicar.getByRole('button', { name: 'Publicar', exact: true }).click();
    const respuestaPublicacion = await publicarResponse;
    expect(respuestaPublicacion.status(), `Respuesta de publicación: ${await respuestaPublicacion.text()}`).toBeLessThan(400);

    const codigoTexto = await publicar.getByText(/Código generado:/i).textContent();
    const codigoAcceso = codigoTexto?.split('Código generado:')[1]?.trim()?.split(' ')[0];
    if (!codigoAcceso) throw new Error(`No se pudo extraer el código de acceso visible: ${codigoTexto ?? ''}`);

    // Paso 13: Portal Alumno
    await page.goto(`http://127.0.0.1:${alumnoWebPort}/acceso`);
    await page.screenshot({ path: path.join(outputDir, '50_portal_alumno_acceso.png'), fullPage: true });

    await page.getByLabel('Codigo de acceso').fill(codigoAcceso);
    await page.getByLabel('Matricula').fill(fixture.alumnoMatricula);
    await page.screenshot({ path: path.join(outputDir, '51_portal_alumno_credenciales.png'), fullPage: true });

    await page.getByRole('button', { name: /Consultar/i }).click();
    await expect(page.getByText(/Resultados disponibles/i)).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(outputDir, '52_portal_alumno_resultados_lista.png'), fullPage: true });

    const resultadoAlumno = page.getByRole('listitem').filter({ hasText: examen.folio });
    await resultadoAlumno.getByRole('button', { name: /Ver detalle/i }).click();
    await expect(resultadoAlumno).toContainText(/Comparativa|Detalle|Respuesta/i, { timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '53_portal_alumno_detalle.png'), fullPage: true });

    // Paso 14: Cuenta
    await page.goto('/acceso');
    await page.getByRole('button', { name: 'Cuenta', exact: true }).click();
    await expect(page.locator('.cuenta-panel')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Cuenta', exact: true })).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(outputDir, '54_docente_cuenta_perfil.png'), fullPage: true });

    // Classroom aislado: valida interfaz y consentimiento sin OAuth ni escritura real en Google.
    const corsHeaders = {
      'access-control-allow-origin': `http://127.0.0.1:${process.env.E2E_DOCENTE_WEB_PORT || '4000'}`,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'Authorization, Content-Type, If-None-Match'
    };
    await page.route('**/api/autenticacion/capacidades-integraciones', (route) => route.fulfill({
      status: 200,
      headers: corsHeaders,
      contentType: 'application/json',
      body: JSON.stringify({ capacidadesIntegraciones: { classroomBackend: true, passwordLoginAllowed: true } })
    }));
    await page.route('**/api/evaluaciones/v2/classroom/**', async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      const url = new URL(request.url());
      if (url.pathname.endsWith('/estado')) {
        return route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify({ estado: { conectado: true, correoGoogle: 'classroom-fixture@evaluapro.local' } }) });
      }
      if (url.pathname.endsWith('/cursos')) {
        return route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify({ cursos: [{ id: 'curso-classroom-e2e', name: 'Curso Classroom E2E', courseState: 'ACTIVE' }] }) });
      }
      if (url.pathname.includes('/actividades')) {
        return route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify({ actividades: [{
          id: 'cw-classroom-e2e', title: 'Ejercicios vencidos E2E', maxPoints: 100, state: 'PUBLISHED',
          mapeo: { corte: 2, destinoColumna: 'Tareas y Ejercicios 2do Parcial', activo: true }
        }] }) });
      }
      if (url.pathname.includes('/alumnos')) {
        return route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify({ alumnosLocales: [], alumnosClassroom: [] }) });
      }
      if (url.pathname.endsWith('/importaciones/preview') || url.pathname.endsWith('/importaciones/ejecutar')) {
        const body = request.postDataJSON() as { actividades?: Array<{ faltantesConfirmados?: string[] }> };
        const confirmado = body.actividades?.[0]?.faltantesConfirmados?.includes('submission-classroom-e2e') === true;
        const resultado = {
          tipo: url.pathname.endsWith('/ejecutar') ? 'ejecucion' : 'preview',
          totalActividades: 1, submissionsProcesadas: 2, importadas: confirmado && url.pathname.endsWith('/ejecutar') ? 2 : 0,
          actualizadas: 0, omitidas: 0, errores: [],
          actividades: [{
            courseWorkId: 'cw-classroom-e2e', courseWorkTitle: 'Ejercicios vencidos E2E', corte: 2,
            destinoColumna: 'Tareas y Ejercicios 2do Parcial', submissions: [{
              submissionId: 'submission-classroom-e2e', alumnoId: fixture.alumnoId, alumnoNombre: 'Alumno E2E',
              estadoClassroom: 'CREATED', vencida: true, puedeConfirmarFaltante: true,
              faltanteExplicito: confirmado, fechaVencimiento: '2026-09-20T23:59:00.000Z'
            }]
          }],
          acumuladoTareasSegundoParcial: [{
            alumnoId: fixture.alumnoId, alumnoNombre: 'Alumno E2E', puntosObtenidos: 90,
            puntosPosibles: confirmado ? 200 : 100, promedio: confirmado ? 4.5 : 9,
            actividadesCalificadas: 1, actividadesFaltantesConfirmadas: confirmado ? 1 : 0
          }]
        };
        return route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify(resultado) });
      }
      return route.fulfill({ status: 404, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify({ error: 'Ruta Classroom E2E no prevista' }) });
    });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Classroom', exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Classroom', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Google Classroom', exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('checkbox', { name: 'Seleccionar Ejercicios vencidos E2E' }).check();
    await page.getByRole('button', { name: 'Previsualizar importación' }).click();
    await expect(page.getByText('9.00 / 10')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('checkbox', { name: /Confirmar faltante vencido: Alumno E2E/ }).check();
    await expect(page.getByText('4.50 / 10')).toBeVisible({ timeout: 20_000 });
    const resultsBox = await page.locator('.classroom-sync-results').boundingBox();
    const missingBox = await page.locator('section[aria-labelledby="classroom-faltantes-heading"]').boundingBox();
    expect(resultsBox && missingBox && missingBox.width).toBeGreaterThan((resultsBox?.width ?? 0) * 0.85);
    await expect(page.locator('.toast')).toHaveCount(0, { timeout: 15_000 });
    await page.screenshot({ path: path.join(outputDir, '55_classroom_faltante_confirmado.png'), fullPage: true, animations: 'disabled' });
    const classroomExecute = page.waitForResponse((response) => response.url().includes('/importaciones/ejecutar') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Ejecutar Sincronización a EvaluaPro' }).click();
    expect((await classroomExecute).status()).toBe(200);
    await expect(page.getByText('4.50 / 10')).toBeVisible({ timeout: 20_000 });
  });
});
