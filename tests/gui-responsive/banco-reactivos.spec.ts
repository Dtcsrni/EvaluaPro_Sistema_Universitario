/**
 * E2E del banco de reactivos.
 *
 * Cubre el contrato observable de captura manual e importación IA desde la
 * interfaz: materia/tema canónicos, validación sin escritura, confirmación,
 * revisión, publicación e idempotencia observable en el banco legado.
 */
import { expect, test } from './visual-fixtures';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import { randomBytes } from 'node:crypto';

const docenteApiPort = process.env.E2E_DOCENTE_API_PORT || '4000';

function loteValido(periodoId: string, temaId: string, externalKey: string) {
  return {
    contract: 'evaluapro.reactivos.batch',
    schemaVersion: 1,
    batchId: `e2e-${externalKey}`,
    target: { periodoId, temaIds: [temaId] },
    source: {
      kind: 'ai_generated',
      generator: 'Playwright E2E',
      generatorModel: 'test-fixture',
      generatedAt: '2026-09-19T18:00:00Z',
      sourceDocumentSha256: null
    },
    items: [{
      externalKey,
      temaId,
      itemId: null,
      expectedVersion: null,
      format: 'omr.mcq5',
      stem: { format: 'richtext', value: '¿Qué caracteriza una decisión basada en datos?' },
      options: ['Evidencia', 'Rumor', 'Azar', 'Suposición', 'Preferencia'].map((value, index) => ({
        key: ['A', 'B', 'C', 'D', 'E'][index],
        value,
        isCorrect: index === 0
      })),
      metadata: { difficultyHypothesis: 'medium', tags: ['e2e', 'cultura-del-dato'] },
      provenance: { origin: 'generated', confidence: 0.95, notes: 'Fixture E2E del contrato IA.' }
    }]
  };
}

async function crearXlsxReactivos(batch: ReturnType<typeof loteValido>) {
  const workbook = new ExcelJS.Workbook();
  const lote = workbook.addWorksheet('Lote');
  lote.addRow(['campo', 'valor']);
  [
    ['contract', batch.contract], ['schemaVersion', 1], ['batchId', batch.batchId],
    ['periodoId', batch.target.periodoId], ['temaIds', JSON.stringify(batch.target.temaIds)],
    ['generator', batch.source.generator], ['generatorModel', batch.source.generatorModel],
    ['generatedAt', batch.source.generatedAt], ['sourceDocumentSha256', '']
  ].forEach((row) => lote.addRow(row));
  const reactivos = workbook.addWorksheet('Reactivos');
  reactivos.addRow(['externalKey', 'itemId', 'expectedVersion', 'temaId', 'enunciado', 'opcionA', 'opcionB', 'opcionC', 'opcionD', 'opcionE', 'respuestaCorrecta', 'difficultyHypothesis', 'cognitiveLevel', 'competenciesJson', 'tagsJson', 'notes', 'confidence']);
  const item = batch.items[0]!;
  reactivos.addRow([
    item.externalKey, item.itemId, item.expectedVersion, item.temaId ?? '', item.stem.value,
    ...item.options.map((option) => option.value), item.options.find((option) => option.isCorrect)?.key,
    item.metadata.difficultyHypothesis ?? '', item.metadata.cognitiveLevel ?? '',
    JSON.stringify(item.metadata.competencies ?? []), JSON.stringify(item.metadata.tags ?? []),
    item.provenance.notes, item.provenance.confidence
  ]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function auditarYPublicarReactivo(page: import('@playwright/test').Page) {
  const flujo = page.getByRole('region', { name: 'Flujo de revisión manual' });
  await flujo.getByRole('button', { name: 'Enviar a revisión (1)', exact: true }).click();
  const revision = flujo.locator('.banco-manual-audit').filter({ hasText: 'Auditar contenido en revisión (1)' });
  await expect(revision).toBeVisible();
  if (!await revision.locator(':scope > ol').isVisible()) await revision.locator(':scope > summary').click();
  const reactivo = revision.locator('ol > li').first().locator('details');
  await reactivo.locator(':scope > summary').click();
  const opciones = reactivo.locator('ol[type="A"] > li');
  await expect(opciones).toHaveCount(5);
  await expect(opciones.filter({ hasText: 'Clave oficial' })).toHaveCount(1);
  const publicar = flujo.getByRole('button', { name: 'Publicar revisados (1)', exact: true });
  await expect(publicar).toBeDisabled();
  await reactivo.getByRole('checkbox', { name: /Confirmo que revisé este enunciado/i }).check();
  await expect(publicar).toBeEnabled();
  await publicar.click();
  await expect(page.getByText('Reactivos revisados y publicados.', { exact: true })).toBeVisible({ timeout: 20_000 });
}

test.describe('Banco de reactivos', () => {
  test.setTimeout(120_000);

  test('banco manual/IA conserva reactivos hasta blueprint, masivo y calificación', async ({ page, request }) => {
    await page.goto('/acceso');
    await page.getByRole('button', { name: 'Registrar', exact: true }).dispatchEvent('click');
    const registrarCorreo = page.getByRole('button', { name: /Registrar con correo/i });
    if (await registrarCorreo.isVisible().catch(() => false)) await registrarCorreo.click();

    const sufijo = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await page.fill('input[placeholder="Ej. Juan Carlos"]', 'Docente');
    await page.getByLabel('Apellidos', { exact: true }).fill('Banco E2E');
    await page.fill('input[type="email"]', `banco-e2e-${sufijo}@evaluapro.local`);
    const passwordEfimero = `Aa1!${randomBytes(18).toString('base64url')}`;
    await page.fill('input[type="password"]', passwordEfimero);
    await page.getByRole('button', { name: /Crear cuenta/i }).click({ noWaitAfter: true });
    await expect(page.getByRole('button', { name: 'Banco', exact: true })).toBeVisible({ timeout: 20_000 });

    const token = await page.evaluate(() => localStorage.getItem('tokenDocente'));
    expect(token).toBeTruthy();
    const base = `http://127.0.0.1:${docenteApiPort}/api`;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const periodoResponse = await request.post(`${base}/periodos`, {
      headers,
      data: { nombre: `Inteligencia de Negocios E2E ${sufijo}`, fechaInicio: '2026-01-01', fechaFin: '2026-12-31', grupos: ['A'] }
    });
    expect(periodoResponse.status()).toBe(201);
    const periodoId = String((await periodoResponse.json()).periodo._id);
    const temaResponse = await request.post(`${base}/banco-preguntas/temas`, {
      headers,
      data: { periodoId, nombre: 'Segundo Parcial' }
    });
    expect(temaResponse.status()).toBe(201);
    const temaId = String((await temaResponse.json()).tema._id);
    const alumnoResponse = await request.post(`${base}/alumnos`, {
      headers,
      data: {
        periodoId,
        matricula: `CUH${Date.now().toString().slice(-9)}`,
        nombreCompleto: 'Alumno Banco E2E',
        correo: `alumno-banco-e2e-${sufijo}@evaluapro.local`,
        grupo: 'A'
      }
    });
    expect(alumnoResponse.status()).toBe(201);
    const alumnoId = String((await alumnoResponse.json()).alumno._id);

    await page.reload();
    await page.getByRole('button', { name: 'Banco', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Banco de preguntas/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Importar reactivos', exact: true })).toBeVisible();
    const importacion = page.getByRole('region', { name: 'Importar reactivos' });
    await page.screenshot({ path: test.info().outputPath('banco-reactivos-importar.png'), fullPage: true });
    const [plantillaXlsx] = await Promise.all([
      page.waitForEvent('download'),
      importacion.getByRole('button', { name: 'Descargar formato XLSX' }).click()
    ]);
    expect(plantillaXlsx.suggestedFilename()).toBe('plantilla-reactivos-v1.xlsx');
    await page.locator('#banco-select-materia').selectOption(periodoId);
    await page.locator('#banco-select-tema').selectOption(temaId);

    const enunciado = page.getByPlaceholder('Redacta una pregunta clara y directa.');
    await enunciado.fill('¿Qué caracteriza mejor a una organización con cultura del dato?');
    const opciones = page.getByRole('textbox', { name: /^Texto de la opción [A-E]$/ });
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 480, height: 800 },
      { width: 714, height: 354 },
      { width: 860, height: 600 },
      { width: 1280, height: 800 }
    ]) {
      await page.setViewportSize(viewport);
      const opcionE = page.locator('.banco-opcion-card--e');
      const controlOpcionE = opcionE.locator('.banco-opcion-pill');
      await expect(opcionE.getByRole('textbox', { name: 'Texto de la opción E' })).toBeVisible();
      await expect(controlOpcionE).toContainText('Opción');
      const tarjeta = await opcionE.boundingBox();
      const control = await controlOpcionE.boundingBox();
      const editor = await opcionE.getByRole('textbox', { name: 'Texto de la opción E' }).boundingBox();
      expect(tarjeta).not.toBeNull();
      expect(control).not.toBeNull();
      expect(editor).not.toBeNull();
      expect(control!.x).toBeGreaterThanOrEqual(tarjeta!.x);
      expect(control!.x + control!.width).toBeLessThanOrEqual(tarjeta!.x + tarjeta!.width + 1);
      expect(editor!.x).toBeGreaterThanOrEqual(tarjeta!.x);
      expect(editor!.x + editor!.width).toBeLessThanOrEqual(tarjeta!.x + tarjeta!.width + 1);
      expect(await opcionE.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      const toolbar = opcionE.locator('.rich-editor__toolbar');
      expect(await toolbar.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    for (const [index, value] of ['Usa evidencia para decidir', 'Ignora las métricas', 'Decide solo por intuición', 'Evita medir resultados', 'Oculta sus datos'].entries()) {
      await opciones.nth(index).fill(value);
    }
    await page.getByRole('button', { name: 'Validar y guardar borrador', exact: true }).click();
    await expect(page.getByText('Reactivo validado y guardado como borrador. Envíalo a revisión antes de publicarlo.', { exact: true })).toBeVisible({ timeout: 20_000 });
    await auditarYPublicarReactivo(page);
    await page.screenshot({ path: test.info().outputPath('banco-reactivos-publicado.png'), fullPage: true });

    const listadoManual = await request.get(`${base}/banco-preguntas?periodoId=${encodeURIComponent(periodoId)}`, { headers });
    expect(listadoManual.status()).toBe(200);
    let preguntasManuales = (await listadoManual.json()).preguntas ?? [];
    expect(preguntasManuales.some((pregunta: { enunciado?: string; versiones?: Array<{ enunciado?: string }> }) =>
      pregunta.enunciado === '¿Qué caracteriza mejor a una organización con cultura del dato?' ||
      pregunta.versiones?.some((version) => version.enunciado === '¿Qué caracteriza mejor a una organización con cultura del dato?')
    )).toBe(true);

    const tarjetaManual = page.locator('.banco-listado__item').filter({ hasText: '¿Qué caracteriza mejor a una organización con cultura del dato?' });
    await tarjetaManual.getByRole('button', { name: /^Editar pregunta:/ }).click();
    const formularioEdicion = page.locator('.banco-form__surface--edit');
    await formularioEdicion.getByRole('textbox', { name: 'Enunciado de la pregunta en edición' }).fill('¿Cómo decide una organización con cultura del dato?');
    await formularioEdicion.getByRole('textbox', { name: 'Texto de la opción A' }).fill('Con evidencia verificable');
    await formularioEdicion.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect(page.getByText('Nueva versión guardada como borrador; requiere revisión antes de publicarse.', { exact: true })).toBeVisible({ timeout: 20_000 });
    await auditarYPublicarReactivo(page);
    const listadoEditado = await request.get(`${base}/banco-preguntas?periodoId=${encodeURIComponent(periodoId)}`, { headers });
    preguntasManuales = (await listadoEditado.json()).preguntas ?? [];
    const manualEditado = preguntasManuales.find((pregunta: { reactivoId?: string; enunciado?: string; versiones?: Array<{ enunciado?: string }> }) =>
      pregunta.enunciado === '¿Cómo decide una organización con cultura del dato?' ||
      pregunta.versiones?.some((version) => version.enunciado === '¿Cómo decide una organización con cultura del dato?')
    );
    expect(manualEditado?.reactivoId).toBeTruthy();
    const historialManual = await request.get(`${base}/banco-preguntas/reactivos/${manualEditado.reactivoId}/versiones`, { headers });
    expect(historialManual.status()).toBe(200);
    const historialManualJson = await historialManual.json();
    expect(historialManualJson.versiones).toHaveLength(2);
    expect(historialManualJson.versiones[0].enunciado).toBe('¿Cómo decide una organización con cultura del dato?');
    const tarjetaEditada = page.locator('.banco-listado__item').filter({ hasText: '¿Cómo decide una organización con cultura del dato?' });
    await tarjetaEditada.getByRole('button', { name: /^Versiones del reactivo:/ }).click();
    const comparador = page.getByRole('region', { name: 'Comparar versiones' });
    await expect(comparador).toBeVisible();
    await expect(comparador).toContainText('¿Qué caracteriza mejor a una organización con cultura del dato?');
    await expect(comparador).toContainText('¿Cómo decide una organización con cultura del dato?');
    await comparador.getByRole('button', { name: 'Cerrar historial' }).click();

    const invalidBatch = loteValido(periodoId, temaId, 'e2e-invalid-001') as any;
    invalidBatch.items[0].options[4].isCorrect = true;
    await page.locator('#reactivos-json-file').setInputFiles({
      name: 'reactivos-invalidos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(invalidBatch))
    });
    await importacion.getByRole('button', { name: 'Validar archivo', exact: true }).click();
    await expect(importacion.getByRole('alert')).toContainText(/No se pudo validar|incidencias|no cumple el contrato|formato no compatible/i, { timeout: 20_000 });
    const listadoTrasError = await request.get(`${base}/banco-preguntas?periodoId=${encodeURIComponent(periodoId)}`, { headers });
    expect((await listadoTrasError.json()).preguntas ?? []).toHaveLength(preguntasManuales.length);

    const validBatch = loteValido(periodoId, temaId, 'e2e-valid-001');
    const validXlsx = await crearXlsxReactivos(validBatch);
    let importedReactivoId = '';
    page.on('response', async (response) => {
      if (!response.url().includes('/importaciones/') || !response.url().endsWith('/confirmar') || response.status() !== 200) return;
      try {
        const body = await response.json() as { reactivoIds?: string[] };
        importedReactivoId = String(body.reactivoIds?.[0] ?? '');
      } catch {
        // La aserción posterior reporta si la confirmación no devolvió identidad.
      }
    });
    await page.locator('#reactivos-json-file').setInputFiles({
      name: 'reactivos-validos.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: validXlsx
    });
    await importacion.getByRole('button', { name: 'Validar archivo', exact: true }).click();
    await expect(importacion.locator('.banco-reactivos-import__message')).toContainText('Validación lista', { timeout: 20_000 });
    await expect(page.getByText('1 reactivo nuevo', { exact: true })).toBeVisible();
    await importacion.getByRole('button', { name: 'Confirmar importación', exact: true }).click();
    const resultadoImportacion = importacion.locator('.banco-reactivos-import__message');
    await expect(resultadoImportacion).toContainText('Importación confirmada: 1 reactivo(s) quedaron en borrador.', { timeout: 20_000 });
    await page.reload();
    await page.getByRole('button', { name: 'Banco', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Banco de preguntas/i })).toBeVisible();
    const flujoRevision = page.getByRole('region', { name: 'Flujo de revisión manual' });
    await expect(flujoRevision).toContainText('1 borrador y 0 reactivos en revisión', { timeout: 20_000 });
    await expect(page.getByText('Disponibles', { exact: true })).toBeVisible();
    const auditoriaBorrador = flujoRevision.locator('.banco-manual-audit').filter({ hasText: 'Auditar contenido en borrador (1)' });
    await auditoriaBorrador.locator(':scope > summary').click();
    await expect(auditoriaBorrador).toContainText('¿Qué caracteriza una decisión basada en datos?', { timeout: 20_000 });
    await auditarYPublicarReactivo(page);

    expect(importedReactivoId).toBeTruthy();
    const versiones = await request.get(`${base}/banco-preguntas/reactivos/${importedReactivoId}/versiones`, { headers });
    expect(versiones.status()).toBe(200);
    const versionId = String((await versiones.json()).versiones?.[0]?.id ?? '');
    expect(versionId).toBeTruthy();
    const respuestasForjadas = Array.from({ length: 30 }, (_, index) => ({
      correcta: index < 18,
      puntajeTotal: index < 18 ? 9 : 5,
      opcion: index < 18 ? 'A' : 'B',
      omrConfirmado: true
    }));
    const calibracion = await request.post(`${base}/banco-preguntas/reactivos/${importedReactivoId}/calibracion`, {
      headers,
      data: { reactivoVersionId: versionId, cohorteKey: 'e2e-forged', respuestas: respuestasForjadas }
    });
    expect(calibracion.status()).toBe(400);
    const calibracionActual = await request.get(`${base}/banco-preguntas/reactivos/${importedReactivoId}/calibracion`, { headers });
    expect(calibracionActual.status()).toBe(200);
    expect((await calibracionActual.json()).estado).toBe('sin_evidencia');

    const listadoFinal = await request.get(`${base}/banco-preguntas?periodoId=${encodeURIComponent(periodoId)}`, { headers });
    const preguntasFinales = (await listadoFinal.json()).preguntas ?? [];
    expect(preguntasFinales.length).toBeGreaterThanOrEqual(preguntasManuales.length + 1);
    expect(preguntasFinales.some((pregunta: { enunciado?: string; versiones?: Array<{ enunciado?: string }> }) =>
      pregunta.enunciado === '¿Qué caracteriza una decisión basada en datos?' ||
      pregunta.versiones?.some((version) => version.enunciado === '¿Qué caracteriza una decisión basada en datos?')
    )).toBe(true);

    // Extiende el mismo recorrido hasta la selección congelada y la producción.
    const plantillaResponse = await request.post(`${base}/examenes/plantillas`, {
      headers,
      data: {
        periodoId,
        tipo: 'parcial',
        titulo: `Segundo Parcial Banco E2E ${sufijo}`,
        numeroPaginas: 2,
        reactivosObjetivo: 1,
        temas: ['Segundo Parcial']
      }
    });
    expect(plantillaResponse.status(), JSON.stringify(await plantillaResponse.json())).toBe(201);
    const plantillaId = String((await plantillaResponse.json()).plantilla._id);
    const snapshot = await request.get(`${base}/examenes/plantillas/${plantillaId}/previsualizar`, { headers });
    expect(snapshot.status()).toBe(200);
    // La selección por capacidad aprovecha la plantilla parcial de 2 páginas;
    // ambos reactivos elegibles caben, aunque reactivosObjetivo sea 1.
    expect((await snapshot.json()).totalUsados).toBe(2);
    const preview = await request.get(`${base}/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`, { headers });
    expect(
      preview.status(),
      `preview PDF devolvió HTTP ${preview.status()} (requestId ${preview.headers()['x-request-id'] ?? 'sin request-id'})`
    ).toBe(200);
    const previewPayload = await preview.json();
    const previewPdf = Buffer.from(String(previewPayload.pdfBase64 ?? ''), 'base64');
    expect(previewPdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    const documentoPreview = await PDFDocument.load(previewPdf);
    expect(previewPayload.paginasTotales).toBe(documentoPreview.getPageCount());
    expect(documentoPreview.getPageCount()).toBe(2);
    expect(previewPayload.paginas).toHaveLength(documentoPreview.getPageCount());
    for (const pagina of previewPayload.paginas as Array<{ width: number; height: number; dataUrl: string }>) {
      expect(pagina.width).toBeGreaterThan(0);
      expect(pagina.height).toBeGreaterThan(0);
      expect(pagina.dataUrl).toMatch(/^data:image\/png;base64,/);
      const png = Buffer.from(pagina.dataUrl.split(',', 2)[1] ?? '', 'base64');
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(png.readUInt32BE(16)).toBe(pagina.width);
      expect(png.readUInt32BE(20)).toBe(pagina.height);
    }

    const loteId = `BANCO${Date.now().toString().slice(-8)}`;
    const paquete = await request.post(`${base}/examenes/generados/lote`, {
      headers,
      data: { plantillaId, loteId }
    });
    expect(paquete.status(), JSON.stringify(await paquete.json())).toBe(201);
    const paqueteJson = await paquete.json();
    expect(paqueteJson.loteId).toBe(loteId);
    const examenesGenerados = paqueteJson.examenesGenerados ?? [];
    expect(examenesGenerados).toHaveLength(1);
    const examen = examenesGenerados[0];
    expect(examen._id).toBeTruthy();
    const detalleExamen = await request.get(`${base}/examenes/generados/${examen._id}`, { headers });
    expect(detalleExamen.status()).toBe(200);
    const assessment = (await detalleExamen.json()).assessment;
    expect(assessment.previewFingerprint).toMatch(/^[a-f0-9]{64}$/i);
    const examenPdf = await request.get(`${base}/examenes/generados/${examen._id}/pdf`, { headers });
    expect(examenPdf.status()).toBe(200);
    expect(examenPdf.headers()['content-type']).toContain('application/pdf');

    const vinculacion = await request.post(`${base}/entregas/vincular-folio`, {
      headers,
      data: { folio: examen.folio, alumnoId }
    });
    expect(vinculacion.status()).toBe(201);
    const calificacion = await request.post(`${base}/calificaciones/calificar`, {
      headers,
      data: {
        examenGeneradoId: String(examen._id),
        alumnoId,
        aciertos: 1,
        totalReactivos: 1,
        bonoSolicitado: 0,
        evaluacionContinua: 5
      }
    });
    expect(calificacion.status(), JSON.stringify(await calificacion.json())).toBe(201);
  });
});
