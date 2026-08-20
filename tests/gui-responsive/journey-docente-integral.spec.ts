import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Journey docente integral visual', () => {
  test.setTimeout(240_000);

  async function crearFixtureAcademico(page: import('@playwright/test').Page) {
    return page.evaluate(async () => {
      const token = localStorage.getItem('tokenDocente');
      if (!token) throw new Error('No hay token docente en el contexto visual');
      const base = 'http://127.0.0.1:4000/api';
      const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const enviar = async (ruta: string, payload: unknown) => {
        const respuesta = await fetch(`${base}${ruta}`, { method: 'POST', headers: auth, body: JSON.stringify(payload) });
        const texto = await respuesta.text();
        let cuerpo: any = {};
        try { cuerpo = texto ? JSON.parse(texto) : {}; } catch { cuerpo = { texto }; }
        if (!respuesta.ok) throw new Error(`${ruta} ${respuesta.status}: ${texto.slice(0, 500)}`);
        return cuerpo;
      };
      const periodosResp = await fetch(`${base}/periodos?activo=1`, { headers: { Authorization: `Bearer ${token}` } });
      const periodosCuerpo = await periodosResp.json();
      const periodo = (periodosCuerpo.periodos ?? periodosCuerpo.materias ?? [])[0];
      if (!periodo?._id) throw new Error('No se encontró la materia creada en el fixture visual');
      const alumnosResp = await fetch(`${base}/alumnos`, { headers: { Authorization: `Bearer ${token}` } });
      const alumnosCuerpo = await alumnosResp.json();
      const alumno = (alumnosCuerpo.alumnos ?? []).find((item: any) => item.periodoId === periodo._id) ?? alumnosCuerpo.alumnos?.[0];
      if (!alumno?._id) throw new Error('No se encontró el alumno creado en el fixture visual');

      await enviar('/banco-preguntas/temas', { periodoId: periodo._id, nombre: 'Tema E2E Integral' });
      for (let indice = 1; indice <= 20; indice += 1) {
        await enviar('/banco-preguntas', {
          periodoId: periodo._id,
          enunciado: `Reactivo integral ${indice}`,
          tema: 'Tema E2E Integral',
          opciones: [
            { texto: `Respuesta A ${indice}`, esCorrecta: true },
            { texto: `Respuesta B ${indice}`, esCorrecta: false },
            { texto: `Respuesta C ${indice}`, esCorrecta: false },
            { texto: `Respuesta D ${indice}`, esCorrecta: false },
            { texto: `Respuesta E ${indice}`, esCorrecta: false }
          ]
        });
      }
      return { periodoId: String(periodo._id), alumnoId: String(alumno._id), alumnoMatricula: String(alumno.matricula) };
    });
  }

  test('recorre diseño, generación, entrega, evaluación, calificación y publicación', async ({ page }) => {
    const sufijo = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const outputDir = path.join(process.cwd(), 'docs', 'assets', 'ui');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // Paso 1: Acceso / Login
    await page.goto('/acceso');
    await page.screenshot({ path: path.join(outputDir, '07_acceso_login.png'), fullPage: true });

    await page.getByRole('button', { name: 'Registrar', exact: true }).dispatchEvent('click');
    const registrarCorreo = page.getByRole('button', { name: /Registrar con correo/i });
    if (await registrarCorreo.isVisible().catch(() => false)) await registrarCorreo.click();
    await page.fill('input[placeholder="Ej. Juan Carlos"]', 'Docente');
    await page.fill('input[placeholder="Ej. Perez Lopez"]', 'Journey');
    await page.fill('input[type="email"]', `journey_${sufijo}@evaluapro.local`);
    await page.fill('input[type="password"]', 'P@ssword123');
    await page.screenshot({ path: path.join(outputDir, '08_acceso_registro_form.png'), fullPage: true });

    await page.getByRole('button', { name: /Crear cuenta/i }).click({ noWaitAfter: true });
    await expect(page.getByRole('button', { name: 'Banco', exact: true })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '10_tablero_inicial.png'), fullPage: true });

    // Paso 2: Materias
    const nombreMateria = `Materia E2E Integral ${sufijo}`;
    await page.getByRole('button', { name: 'Materias', exact: true }).click();
    await page.screenshot({ path: path.join(outputDir, '11_materia_seccion.png'), fullPage: true });

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
    await page.screenshot({ path: path.join(outputDir, '15_alumno_seccion.png'), fullPage: true });

    const matricula = `CUH${Math.floor(100000000 + Math.random() * 899999999)}`;
    await page.locator('label:has-text("Matricula") >> input').fill(matricula);
    await page.locator('label:has-text("Nombres") >> input').fill('Alumno');
    await page.locator('label:has-text("Apellidos") >> input').fill('Integral');
    await page.locator('label:has-text("Materia") >> select').first().selectOption({ index: 1 });
    await page.locator('label:has-text("Grupo") >> input').fill('Grupo A');
    await page.screenshot({ path: path.join(outputDir, '16_alumno_datos_llenados.png'), fullPage: true });

    await page.getByRole('button', { name: 'Crear alumno', exact: true }).click();
    await expect(page.getByText(/Alumno Integral/i).first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '17_alumno_creado_lista.png'), fullPage: true });

    // Paso 3b: Asistencias y Temarios
    const tabAsistencias = page.getByRole('button', { name: 'Asistencias', exact: true });
    if (await tabAsistencias.isVisible().catch(() => false)) {
      await tabAsistencias.click();
      await page.screenshot({ path: path.join(outputDir, '18_asistencias_seccion.png'), fullPage: true });
    }
    const tabTemarios = page.getByRole('button', { name: 'Temarios', exact: true });
    if (await tabTemarios.isVisible().catch(() => false)) {
      await tabTemarios.click();
      await page.screenshot({ path: path.join(outputDir, '19_temarios_seccion.png'), fullPage: true });
    }

    const fixture = await crearFixtureAcademico(page);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Banco', exact: true })).toBeVisible({ timeout: 20_000 });

    // Paso 4: Banco
    await page.getByRole('button', { name: 'Banco', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Banco de preguntas/i })).toBeVisible();
    await expect(page.getByText('Reactivo integral 1', { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '20_banco_seccion.png'), fullPage: true });

    // Paso 5: Plantillas
    await page.getByRole('button', { name: 'Plantillas', exact: true }).click();
    await page.screenshot({ path: path.join(outputDir, '24_plantilla_seccion.png'), fullPage: true });

    const formularioPlantilla = page.locator('.plantillas-panel--form');
    await formularioPlantilla.locator('input').first().fill(`Plantilla E2E Integral ${sufijo}`);
    await formularioPlantilla.locator('select').selectOption(fixture.periodoId);
    await formularioPlantilla.getByRole('checkbox').first().check();
    await page.screenshot({ path: path.join(outputDir, '25_plantilla_formulario.png'), fullPage: true });

    await formularioPlantilla.getByRole('button', { name: 'Crear plantilla', exact: true }).click();
    await expect(formularioPlantilla.getByRole('status')).toContainText('Plantilla creada', { timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '26_plantilla_creada_exito.png'), fullPage: true });

    const generacion = page.locator('.plantillas-panel--generar');
    const plantillaSelect = generacion.locator('select').first();
    await plantillaSelect.selectOption({ label: `Plantilla E2E Integral ${sufijo}` });
    await generacion.getByRole('button', { name: 'Individual', exact: true }).click();
    await page.screenshot({ path: path.join(outputDir, '27_plantilla_panel_generar.png'), fullPage: true });

    const generarResponse = page.waitForResponse((response) => response.url().includes('/assessments/templates/') && response.request().method() === 'POST');
    await page.getByRole('button', { name: /Generar examen individual/i }).click();
    expect((await generarResponse).status()).toBeLessThan(400);
    await expect(page.getByText(/Ultimo examen generado/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Folio:/).first()).toBeVisible();
    await page.screenshot({ path: path.join(outputDir, '28_examen_generado_pdf.png'), fullPage: true });

    // Paso 6: OMR
    await expect(page.getByRole('button', { name: 'Descargar hoja OMR', exact: true })).toBeVisible({ timeout: 30_000 });
    const descargaOmr = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar hoja OMR', exact: true }).click();
    const omrDownload = await descargaOmr;
    const omrPath = await omrDownload.path();
    if (!omrPath) throw new Error('La descarga de la hoja OMR no produjo ruta temporal');
    await page.screenshot({ path: path.join(outputDir, '29_omr_descarga_hoja.png'), fullPage: true });

    const omrInput = page.locator('.plantillas-omr-v1 input[type="file"]');
    await omrInput.setInputFiles(omrPath);
    await page.screenshot({ path: path.join(outputDir, '30_omr_panel_carga.png'), fullPage: true });

    await page.getByRole('button', { name: 'Procesar capturas', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Job OMR', exact: true })).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: path.join(outputDir, '31_omr_job_procesando.png'), fullPage: true });

    const finalizarOmr = page.getByRole('button', { name: 'Finalizar job', exact: true });
    if (await finalizarOmr.isEnabled()) await finalizarOmr.click();
    await expect(page.getByRole('heading', { name: 'Job OMR', exact: true })).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(outputDir, '32_omr_job_finalizado.png'), fullPage: true });

    const examen = await page.evaluate(async (plantillaTitulo) => {
      const token = localStorage.getItem('tokenDocente');
      const base = 'http://127.0.0.1:4000/api';
      const respuesta = await fetch(`${base}/examenes/plantillas`, { headers: { Authorization: `Bearer ${token}` } });
      const plantillas = await respuesta.json();
      const plantilla = (plantillas.plantillas ?? []).find((item: any) => item.titulo === plantillaTitulo);
      const generados = await fetch(`${base}/examenes/generados?plantillaId=${encodeURIComponent(plantilla._id)}&limite=10`, { headers: { Authorization: `Bearer ${token}` } });
      const cuerpo = await generados.json();
      const item = cuerpo.examenes?.[0];
      if (!item?.folio || !item?._id) throw new Error('No se encontró el examen generado para el journey');
      return { examenId: String(item._id), folio: String(item.folio) };
    }, `Plantilla E2E Integral ${sufijo}`);

    // Paso 7: Entrega
    await page.getByRole('button', { name: 'Entrega', exact: true }).click();
    await page.screenshot({ path: path.join(outputDir, '33_entrega_seccion.png'), fullPage: true });

    await page.locator('.entregas-vinculacion input').fill(examen.folio);
    await page.locator('.entregas-vinculacion select').selectOption(fixture.alumnoId);
    await page.screenshot({ path: path.join(outputDir, '34_entrega_folio_llenado.png'), fullPage: true });

    const entregaResponse = page.waitForResponse((response) => response.url().includes('/entregas/vincular-folio'));
    await page.getByRole('button', { name: 'Vincular', exact: true }).click();
    expect((await entregaResponse).status()).toBeLessThan(400);
    await expect(page.getByText(/Entregados/i).first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(outputDir, '35_entrega_vinculada_exito.png'), fullPage: true });

    // Paso 8: Evaluaciones
    await page.getByRole('button', { name: 'Evaluaciones', exact: true }).click();
    await page.screenshot({ path: path.join(outputDir, '36_evaluaciones_seccion.png'), fullPage: true });

    const evaluaciones = page.getByRole('heading', { name: 'Evaluaciones y políticas' }).locator('..');
    await evaluaciones.locator('select').nth(0).selectOption(fixture.periodoId);
    await evaluaciones.locator('select').nth(1).selectOption(fixture.alumnoId);
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
    await page.screenshot({ path: path.join(outputDir, '39_calificaciones_seccion.png'), fullPage: true });

    const panelManual = page.locator('.calificaciones-manual-panel');
    await panelManual.getByLabel('Alumno').selectOption(fixture.alumnoId);
    await expect(panelManual.getByLabel('Examen entregado').locator('option')).toHaveCount(2, { timeout: 20_000 });
    await panelManual.getByLabel('Examen entregado').selectOption(examen.examenId);
    await panelManual.getByRole('button', { name: 'Usar examen para calificación manual', exact: true }).click();
    await expect(page.getByText(/Modo manual activo/i)).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(outputDir, '40_calificaciones_modo_manual.png'), fullPage: true });

    const guardarCalificacion = page.getByRole('button', { name: 'Guardar calificación', exact: true });
    const calificarResponse = page.waitForResponse((response) => response.url().includes('/calificaciones/calificar') && response.request().method() === 'POST');
    await guardarCalificacion.click();
    expect((await calificarResponse).status()).toBeLessThan(400);
    await expect(page.getByLabel('Panel de calificación').getByText('Calificacion guardada', { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(outputDir, '41_calificaciones_guardada_exito.png'), fullPage: true });

    // Paso 10: Reportes
    const reportes = page.getByLabel('Reportes de calificaciones');
    await reportes.getByLabel('Materia del reporte').selectOption(fixture.periodoId);
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
    const publicar = page.locator('.sincronizacion-grid').getByRole('heading', { name: 'Publicar en portal' }).locator('..');
    await publicar.locator('select').selectOption(fixture.periodoId);
    await page.screenshot({ path: path.join(outputDir, '48_publicacion_publicar.png'), fullPage: true });

    const publicarResponse = page.waitForResponse((response) => response.url().includes('/sincronizaciones/publicar') && response.request().method() === 'POST');
    await publicar.getByRole('button', { name: 'Publicar', exact: true }).click();
    expect((await publicarResponse).status()).toBeLessThan(400);

    const codigoResponse = page.waitForResponse((response) => response.url().includes('/sincronizaciones/codigo-acceso') && response.request().method() === 'POST');
    await publicar.getByRole('button', { name: 'Generar codigo', exact: true }).click();
    expect((await codigoResponse).status()).toBeLessThan(400);
    await expect(publicar).toContainText('Código generado:', { timeout: 30_000 });
    await page.screenshot({ path: path.join(outputDir, '49_publicacion_codigo_generado.png'), fullPage: true });

    const codigoTexto = await publicar.getByText(/Código generado:/i).textContent();
    const codigoAcceso = codigoTexto?.split('Código generado:')[1]?.trim()?.split(' ')[0];
    if (!codigoAcceso) throw new Error(`No se pudo extraer el código de acceso visible: ${codigoTexto ?? ''}`);

    // Paso 13: Portal Alumno
    await page.goto('http://127.0.0.1:4174/acceso');
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
    await page.screenshot({ path: path.join(outputDir, '54_docente_cuenta_perfil.png'), fullPage: true });
  });
});
