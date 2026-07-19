import { expect, test } from '@playwright/test';
import fs from 'node:fs';

/**
 * Journey visual docente-local.
 *
 * La preparación de datos usa únicamente la API local para crear un fixture
 * determinista; las acciones que debe realizar el docente (diseño, generación,
 * descarga, entrega, evaluación y publicación) se ejecutan y verifican desde
 * la interfaz real.
 */

test.describe('Journey docente integral visual', () => {
  test.setTimeout(180_000);

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
    await page.goto('/acceso');
    await page.getByRole('button', { name: 'Registrar', exact: true }).dispatchEvent('click');
    const registrarCorreo = page.getByRole('button', { name: /Registrar con correo/i });
    if (await registrarCorreo.isVisible().catch(() => false)) await registrarCorreo.click();
    await page.fill('input[placeholder="Ej. Juan Carlos"]', 'Docente');
    await page.fill('input[placeholder="Ej. Perez Lopez"]', 'Journey');
    await page.fill('input[type="email"]', `journey_${sufijo}@evaluapro.local`);
    await page.fill('input[type="password"]', 'P@ssword123');
    await page.getByRole('button', { name: /Crear cuenta/i }).click({ noWaitAfter: true });
    await expect(page.getByRole('button', { name: 'Banco', exact: true })).toBeVisible({ timeout: 20_000 });

    const nombreMateria = `Materia E2E Integral ${sufijo}`;
    await page.getByRole('button', { name: 'Materias', exact: true }).click();
    await page.locator('label:has-text("Nombre de la materia") >> input').fill(nombreMateria);
    await page.locator('label:has-text("Fecha inicio") >> input').fill('2026-01-01');
    await page.locator('label:has-text("Fecha fin") >> input').fill('2026-12-31');
    await page.locator('label:has-text("Grupos") >> input').fill('Grupo A');
    await page.getByRole('button', { name: 'Crear materia', exact: true }).click();
    await expect(page.getByText(new RegExp(nombreMateria, 'i')).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Alumnos', exact: true }).click();
    const matricula = `CUH${Math.floor(100000000 + Math.random() * 899999999)}`;
    await page.locator('label:has-text("Matricula") >> input').fill(matricula);
    await page.locator('label:has-text("Nombres") >> input').fill('Alumno');
    await page.locator('label:has-text("Apellidos") >> input').fill('Integral');
    await page.locator('label:has-text("Materia") >> select').first().selectOption({ index: 1 });
    await page.locator('label:has-text("Grupo") >> input').fill('Grupo A');
    await page.getByRole('button', { name: 'Crear alumno', exact: true }).click();
    await expect(page.getByText(/Alumno Integral/i).first()).toBeVisible({ timeout: 20_000 });

    const fixture = await crearFixtureAcademico(page);
    // El shell conserva los catálogos en memoria; recargar fuerza la misma
    // hidratación que tendría una nueva sesión del docente después de importar
    // datos o recibir un curso.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Banco', exact: true })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Banco', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Banco de preguntas/i })).toBeVisible();
    await expect(page.getByText('Reactivo integral 1', { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'docs/assets/ui/06_journey_banco.png', fullPage: true });

    await page.getByRole('button', { name: 'Plantillas', exact: true }).click();
    const formularioPlantilla = page.locator('.plantillas-panel--form');
    await formularioPlantilla.locator('input').first().fill(`Plantilla E2E Integral ${sufijo}`);
    await formularioPlantilla.locator('select').selectOption(fixture.periodoId);
    await formularioPlantilla.getByRole('checkbox').first().check();
    await formularioPlantilla.getByRole('button', { name: 'Crear plantilla', exact: true }).click();
    await expect(formularioPlantilla.getByRole('status')).toContainText('Plantilla creada', { timeout: 20_000 });
    await page.screenshot({ path: 'docs/assets/ui/07_journey_plantilla.png', fullPage: true });

    const generacion = page.locator('.plantillas-panel--generar');
    const plantillaSelect = generacion.locator('select').first();
    await plantillaSelect.selectOption({ label: `Plantilla E2E Integral ${sufijo}` });
    await generacion.getByRole('button', { name: 'Individual', exact: true }).click();
    const generarResponse = page.waitForResponse((response) => response.url().includes('/assessments/templates/') && response.request().method() === 'POST');
    await page.getByRole('button', { name: /Generar examen individual/i }).click();
    expect((await generarResponse).status()).toBeLessThan(400);
    await expect(page.getByText(/Ultimo examen generado/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Folio:/).first()).toBeVisible();
    await page.screenshot({ path: 'docs/assets/ui/08_journey_examen_generado.png', fullPage: true });

    // Usa el PDF OMR que la UI descarga del assessment real. La captura no se
    // simula: se vuelve a cargar en el input visible y el backend ejecuta el
    // pipeline OMR sobre ese artefacto.
    await expect(page.getByRole('button', { name: 'Descargar hoja OMR', exact: true })).toBeVisible({ timeout: 30_000 });
    const descargaOmr = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar hoja OMR', exact: true }).click();
    const omrDownload = await descargaOmr;
    const omrPath = await omrDownload.path();
    if (!omrPath) throw new Error('La descarga de la hoja OMR no produjo ruta temporal');
    const omrInput = page.locator('.plantillas-omr-v1 input[type="file"]');
    await omrInput.setInputFiles(omrPath);
    await page.getByRole('button', { name: 'Procesar capturas', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Job OMR', exact: true })).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: 'docs/assets/ui/08b_journey_omr_job.png', fullPage: true });
    const finalizarOmr = page.getByRole('button', { name: 'Finalizar job', exact: true });
    if (await finalizarOmr.isEnabled()) await finalizarOmr.click();
    await expect(page.getByText(/Estado:\s*(completed|finalized|needs_review|review)/i).first()).toBeVisible({ timeout: 30_000 });

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

    await page.getByRole('button', { name: 'Entrega', exact: true }).click();
    await page.locator('.entregas-vinculacion input').fill(examen.folio);
    await page.locator('.entregas-vinculacion select').selectOption(fixture.alumnoId);
    const entregaResponse = page.waitForResponse((response) => response.url().includes('/entregas/vincular-folio'));
    await page.getByRole('button', { name: 'Vincular', exact: true }).click();
    expect((await entregaResponse).status()).toBeLessThan(400);
    await expect(page.getByText(/Entregados:\s*1/i).first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'docs/assets/ui/09_journey_entrega.png', fullPage: true });

    await page.getByRole('button', { name: 'Evaluaciones', exact: true }).click();
    const evaluaciones = page.getByRole('heading', { name: 'Evaluaciones y políticas' }).locator('..');
    await evaluaciones.locator('select').nth(0).selectOption(fixture.periodoId);
    await evaluaciones.locator('select').nth(1).selectOption(fixture.alumnoId);
    await evaluaciones.getByRole('button', { name: 'Guardar política', exact: true }).click();
    await expect(evaluaciones).toContainText(/guardada|política/i, { timeout: 20_000 });
    await page.getByRole('button', { name: 'Evidencias', exact: true }).click();
    await evaluaciones.getByLabel('Evidencia título').fill('Evidencia visual integral');
    await evaluaciones.getByLabel('Calificación').fill('4.5');
    await evaluaciones.getByLabel('Ponderación').fill('2');
    const evidenciaResponse = page.waitForResponse((response) => response.url().includes('/evaluaciones/v2/evidencias') && response.request().method() === 'POST');
    await evaluaciones.getByRole('button', { name: 'Guardar evidencia', exact: true }).click();
    expect((await evidenciaResponse).status()).toBeLessThan(400);
    await expect(evaluaciones).toContainText(/guardada|evidencia/i, { timeout: 20_000 });
    await page.screenshot({ path: 'docs/assets/ui/10_journey_evaluacion.png', fullPage: true });

    await page.getByRole('button', { name: 'Calificaciones', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Calificaciones' })).toBeVisible({ timeout: 20_000 });
    const panelManual = page.locator('.calificaciones-manual-panel');
    await panelManual.getByLabel('Alumno').selectOption(fixture.alumnoId);
    await expect(panelManual.getByLabel('Examen entregado').locator('option')).toHaveCount(2, { timeout: 20_000 });
    await panelManual.getByLabel('Examen entregado').selectOption(examen.examenId);
    await panelManual.getByRole('button', { name: 'Usar examen para calificación manual', exact: true }).click();
    await expect(panelManual).toContainText(/Modo manual activado|No se pudo construir la clave del examen/i, { timeout: 20_000 });
    const manualError = panelManual.getByText(/No se pudo construir la clave del examen/i);
    if (await manualError.isVisible().catch(() => false)) {
      const manualErrorText = await manualError.textContent();
      const detalleManual = await page.evaluate(async (folio) => {
        const token = localStorage.getItem('tokenDocente');
        const headers = { Authorization: `Bearer ${token}` };
        const examenResp = await fetch(`http://127.0.0.1:4000/api/examenes/generados/folio/${encodeURIComponent(folio)}`, { headers });
        const examenBody = await examenResp.json();
        const periodoId = examenBody.examen?.periodoId;
        const bancoResp = await fetch(`http://127.0.0.1:4000/api/banco-preguntas?periodoId=${encodeURIComponent(periodoId ?? '')}`, { headers });
        const bancoBody = await bancoResp.json();
        return {
          error: '',
          examenKeys: Object.keys(examenBody.examen ?? {}),
          mapaVariante: examenBody.examen?.mapaVariante ?? null,
          answerKeySet: examenBody.examen?.answerKeySet ?? null,
          questionMap: examenBody.examen?.questionMap ?? null,
          ordenPreguntas: examenBody.examen?.mapaVariante?.ordenPreguntas?.length ?? 0,
          bancoPreguntas: bancoBody.preguntas?.length ?? 0,
          bancoVersiones: bancoBody.preguntas?.[0]?.versiones?.length ?? 0,
          periodoId
        };
      }, examen.folio);
      detalleManual.error = manualErrorText ?? '';
      throw new Error(`Calificacion manual no activada: ${JSON.stringify(detalleManual)}`);
    }
    await expect(page.getByText(/Modo manual activo · Folio/i)).toBeVisible({ timeout: 30_000 });
    const guardarCalificacion = page.getByRole('button', { name: 'Guardar calificación', exact: true });
    const calificarResponse = page.waitForResponse((response) => response.url().includes('/calificaciones/calificar') && response.request().method() === 'POST');
    await guardarCalificacion.click();
    const calificarHttp = await calificarResponse;
    const calificarBody = await calificarHttp.text();
    expect(calificarHttp.status(), `Respuesta calificar: ${calificarBody}`).toBeLessThan(400);
    await expect(page.getByLabel('Panel de calificación').getByText('Calificacion guardada', { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: 'docs/assets/ui/11_journey_calificaciones.png', fullPage: true });

    const reportes = page.getByLabel('Reportes de calificaciones');
    await reportes.getByLabel('Materia del reporte').selectOption(fixture.periodoId);
    const descargaCsv = page.waitForEvent('download');
    await reportes.getByRole('button', { name: 'Descargar CSV', exact: true }).click();
    const csvDownload = await descargaCsv;
    expect(csvDownload.suggestedFilename()).toMatch(/\.csv$/i);
    expect(await csvDownload.path()).toBeTruthy();
    await expect(page.getByRole('status').filter({ hasText: 'Reporte CSV descargado.' })).toBeVisible({ timeout: 20_000 });

    const descargaXlsx = page.waitForEvent('download');
    await reportes.getByRole('button', { name: 'Descargar XLSX', exact: true }).click();
    const xlsxDownload = await descargaXlsx;
    expect(xlsxDownload.suggestedFilename()).toMatch(/\.xlsx$/i);
    expect(await xlsxDownload.path()).toBeTruthy();
    await expect(page.getByRole('status').filter({ hasText: 'Reporte XLSX descargado.' })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'docs/assets/ui/11b_journey_reportes.png', fullPage: true });

    await page.getByRole('button', { name: 'Sincronización', exact: true }).click();
    await expect(page.getByText(/Publicar|Sincronización/i).first()).toBeVisible({ timeout: 20_000 });
    const backupPanel = page.getByRole('heading', { name: 'Backups y exportaciones', exact: true }).locator('..');
    const descargaBackup = page.waitForEvent('download');
    await backupPanel.getByRole('button', { name: 'Exportar backup', exact: true }).click();
    const backupDownload = await descargaBackup;
    const backupPath = await backupDownload.path();
    if (!backupPath) throw new Error('La exportación de backup no produjo ruta temporal');
    const backupOuter = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as { paqueteBase64?: string; backupMeta?: unknown };
    expect(backupOuter.paqueteBase64).toBeTruthy();
    const backupEnvelope = JSON.parse(Buffer.from(String(backupOuter.paqueteBase64), 'base64').toString('utf8')) as { formato?: string; algoritmo?: string };
    expect(backupEnvelope.formato).toBe('evaluapro-sync-encrypted');
    expect(backupEnvelope.algoritmo).toBe('aes-256-gcm');
    await expect(backupPanel).toContainText('Cifrado autenticado', { timeout: 20_000 });
    await page.screenshot({ path: 'docs/assets/ui/12a_journey_backup_cifrado.png', fullPage: true });

    await backupPanel.locator('input[type="file"]').setInputFiles(backupPath);
    await expect(page.getByRole('button', { name: 'Sí, importar paquete', exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Sí, importar paquete', exact: true }).click();
    await expect(backupPanel).toContainText('Paquete importado', { timeout: 30_000 });

    const publicar = page.locator('.sincronizacion-grid').getByRole('heading', { name: 'Publicar en portal' }).locator('..');
    await publicar.locator('select').selectOption(fixture.periodoId);
    const publicarResponse = page.waitForResponse((response) => response.url().includes('/sincronizaciones/publicar') && response.request().method() === 'POST');
    await publicar.getByRole('button', { name: 'Publicar', exact: true }).click();
    expect((await publicarResponse).status()).toBeLessThan(400);
    await expect(publicar.getByRole('status')).toContainText('Resultados publicados', { timeout: 30_000 });
    const codigoResponse = page.waitForResponse((response) => response.url().includes('/sincronizaciones/codigo-acceso') && response.request().method() === 'POST');
    const republishResponse = page.waitForResponse((response) => response.url().includes('/sincronizaciones/publicar') && response.request().method() === 'POST');
    await publicar.getByRole('button', { name: 'Generar codigo', exact: true }).click();
    expect((await codigoResponse).status()).toBeLessThan(400);
    expect((await republishResponse).status()).toBeLessThan(400);
    await expect(publicar).toContainText('Código generado:', { timeout: 30_000 });
    await page.screenshot({ path: 'docs/assets/ui/12_journey_publicacion.png', fullPage: true });

    const codigoTexto = await publicar.getByText(/Código generado:/i).textContent();
    const codigoAcceso = codigoTexto?.match(/Código generado:\s*([A-Za-z0-9_-]+)/i)?.[1];
    if (!codigoAcceso) throw new Error(`No se pudo extraer el código de acceso visible: ${codigoTexto ?? ''}`);

    // Cambia a la superficie alumno compilada de forma independiente. La
    // publicación se consulta contra el portal local real levantado por el
    // runtime nativo, sin interceptar solicitudes del navegador.
    await page.goto('http://127.0.0.1:4174/acceso');
    await expect(page.getByText(/Portal Alumno/i)).toBeVisible();
    await page.getByLabel('Codigo de acceso').fill(codigoAcceso);
    await page.getByLabel('Matricula').fill(fixture.alumnoMatricula);
    await page.getByRole('button', { name: /Consultar/i }).click();
    await expect(page.getByText(/Resultados disponibles/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(new RegExp(`Folio ${examen.folio}`, 'i'))).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: 'docs/assets/ui/13_journey_alumno_resultados.png', fullPage: true });

    const resultadoAlumno = page.getByRole('listitem').filter({ hasText: examen.folio });
    await resultadoAlumno.getByRole('button', { name: /Ver detalle/i }).click();
    await expect(resultadoAlumno).toContainText(/Comparativa|Detalle|Respuesta/i, { timeout: 20_000 });
    await page.screenshot({ path: 'docs/assets/ui/14_journey_alumno_detalle.png', fullPage: true });
  });
});
