import request from 'supertest';
import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { construirBlueprintPlantilla, construirSnapshotVersionesBlueprint } from '../../src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.js';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo.js';

describe('ingesta contractual de reactivos', () => {
  const app = crearApp();

  beforeEach(async () => {
    await conectarMongoTest();
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  async function preparar() {
    const registro = await request(app).post('/api/autenticacion/registrar').send({
      nombreCompleto: 'Docente Reactivos',
      correo: `reactivos-${Date.now()}@local.test`,
      contrasena: 'Secreto123!'
    }).expect(201);
    const token = registro.body.token as string;
    const periodo = await request(app).post('/api/periodos').set('Authorization', `Bearer ${token}`).send({
      nombre: 'Inteligencia de Negocios',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      grupos: ['A']
    }).expect(201);
    const periodoId = periodo.body.periodo._id as string;
    const tema = await request(app).post('/api/banco-preguntas/temas').set('Authorization', `Bearer ${token}`).send({ periodoId, nombre: 'Segundo Parcial' }).expect(201);
    return { token, periodoId, temaId: tema.body.tema._id as string };
  }

  function lote(periodoId: string, temaId: string, sufijo = '001') {
    return {
      contract: 'evaluapro.reactivos.batch',
      schemaVersion: 1,
      batchId: `ia-bi-${sufijo}`,
      target: { periodoId, temaIds: [temaId] },
      source: { kind: 'ai_generated', generator: 'ChatGPT', generatorModel: 'test', generatedAt: '2026-09-19T18:00:00Z', sourceDocumentSha256: null },
      items: [{
        externalKey: `bi-${sufijo}`,
        itemId: null,
        expectedVersion: null,
        format: 'omr.mcq5',
        stem: { format: 'richtext', value: `Reactivo ${sufijo}` },
        options: ['A', 'B', 'C', 'D', 'E'].map((key, index) => ({ key, value: `Opción ${key}`, isCorrect: index === 0 })),
        metadata: { difficultyHypothesis: 'medium' },
        provenance: { origin: 'generated', confidence: 0.9, notes: 'fixture de integración' }
      }]
    };
  }

  async function archivoXlsx(batch: ReturnType<typeof lote>, opciones?: { enunciadoFormula?: boolean; hojaExtra?: boolean; encabezadoDuplicado?: boolean; encabezadoLegacy?: boolean }) {
    const workbook = new ExcelJS.Workbook();
    const loteSheet = workbook.addWorksheet('Lote');
    loteSheet.addRow(['campo', 'valor']);
    const metadata = [
      ['contract', batch.contract], ['schemaVersion', 1], ['batchId', batch.batchId],
      ['periodoId', batch.target.periodoId], ['temaIds', JSON.stringify(batch.target.temaIds)],
      ['generator', batch.source.generator], ['generatorModel', batch.source.generatorModel ?? ''],
      ['generatedAt', batch.source.generatedAt], ['sourceDocumentSha256', '']
    ];
    metadata.forEach((row) => loteSheet.addRow(row));
    const reactivos = workbook.addWorksheet('Reactivos');
    const headers = opciones?.encabezadoLegacy
      ? ['externalKey', 'itemId', 'expectedVersion', 'enunciado', 'opcionA', 'opcionB', 'opcionC', 'opcionD', 'opcionE', 'respuestaCorrecta', 'difficultyHypothesis', 'cognitiveLevel', 'competenciesJson', 'tagsJson', 'notes', 'confidence']
      : ['externalKey', 'itemId', 'expectedVersion', 'temaId', 'enunciado', 'opcionA', 'opcionB', 'opcionC', 'opcionD', 'opcionE', 'respuestaCorrecta', 'difficultyHypothesis', 'cognitiveLevel', 'competenciesJson', 'tagsJson', 'notes', 'confidence'];
    if (opciones?.encabezadoDuplicado) headers[4] = headers[3]!;
    reactivos.addRow(headers);
    if (opciones?.hojaExtra) workbook.addWorksheet('Notas');
    const item = batch.items[0]!;
    reactivos.addRow([
      item.externalKey, item.itemId, item.expectedVersion,
      ...(!opciones?.encabezadoLegacy ? [item.temaId ?? ''] : []),
      opciones?.enunciadoFormula ? { formula: '"Pregunta"' } : item.stem.value,
      ...item.options.map((option) => option.value),
      item.options.find((option) => option.isCorrect)?.key,
      item.metadata.difficultyHypothesis ?? '', item.metadata.cognitiveLevel ?? '',
      JSON.stringify(item.metadata.competencies ?? []), JSON.stringify(item.metadata.tags ?? []),
      item.provenance.notes, item.provenance.confidence
    ]);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  it('pagina el historial de importaciones por cursor, sin cargar filas de detalle, y aísla cursores por docente', async () => {
    const { token, periodoId } = await preparar();
    const docenteId = (await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId }, select: { docenteId: true } })).docenteId;
    const importIds = [
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003'
    ];
    await prisma.reactivoImportacion.createMany({ data: importIds.map((id, index) => ({
      id,
      docenteId,
      batchId: `historial-${index}`,
      inputSha256: createHash('sha256').update(`historial-${index}`).digest('hex'),
      planHash: createHash('sha256').update(`plan-${index}`).digest('hex'),
      payloadJson: JSON.stringify({ target: { periodoId } }),
      planJson: '{}',
      estado: 'preview',
      createdAt: new Date(`2026-09-28T12:00:0${index}.000Z`)
    })) });

    const primera = await request(app).get('/api/banco-preguntas/importaciones?limite=2')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(primera.body.importaciones.map((item: { importId: string }) => item.importId)).toEqual([importIds[2], importIds[1]]);
    expect(primera.body.nextCursor).toBe(importIds[1]);
    expect(primera.body.importaciones.every((item: { rows?: unknown }) => item.rows === undefined)).toBe(true);

    const segunda = await request(app)
      .get(`/api/banco-preguntas/importaciones?limite=2&cursor=${importIds[1]}`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(segunda.body.importaciones.map((item: { importId: string }) => item.importId)).toEqual([importIds[0]]);
    expect(segunda.body.nextCursor).toBeNull();

    const otro = await request(app).post('/api/autenticacion/registrar').send({
      nombreCompleto: 'Otro docente', correo: `reactivos-otro-${Date.now()}@local.test`, contrasena: 'Secreto123!'
    }).expect(201);
    await request(app).get(`/api/banco-preguntas/importaciones?limite=2&cursor=${importIds[1]}`)
      .set('Authorization', `Bearer ${otro.body.token}`).expect(400);
  });

  it('publica el schema, hace preview sin crear reactivos y confirma de forma idempotente', async () => {
    const { token, periodoId, temaId } = await preparar();
    const imageDataUrl = 'data:image/png;base64,aGVsbG8=';
    const batch = lote(periodoId, temaId);
    Object.assign(batch.items[0]!.metadata, { imageDataUrl });
    const esquema = await request(app).get('/api/banco-preguntas/importaciones/esquema').set('Authorization', `Bearer ${token}`).expect(200);
    expect(esquema.body.$id).toContain('reactivos-batch.v1.schema.json');

    const preview = await request(app).post('/api/banco-preguntas/importaciones/preview').set('Authorization', `Bearer ${token}`).send(batch).expect(200);
    expect(preview.body.summary).toMatchObject({ create: 1, conflict: 0 });
    expect(await prisma.reactivo.count()).toBe(0);
    expect(await prisma.reactivoAsset.count()).toBe(0);
    expect(await prisma.reactivoImportacion.count()).toBe(0);
    expect(await prisma.reactivoImportacionFila.count()).toBe(0);
    const previewRepetido = await request(app).post('/api/banco-preguntas/importaciones/preview').set('Authorization', `Bearer ${token}`).send(batch).expect(200);
    expect(previewRepetido.body.importId).toBe(preview.body.importId);
    expect(previewRepetido.body.planHash).toBe(preview.body.planHash);
    expect(await prisma.reactivoImportacion.count()).toBe(0);

    const confirmar = () => request(app).post(`/api/banco-preguntas/importaciones/${preview.body.importId}/confirmar`).set('Authorization', `Bearer ${token}`).send({ planHash: preview.body.planHash, payload: batch });
    const confirmado = await confirmar().expect(200);
    expect(confirmado.body.estado).toBe('confirmed');
    expect(await prisma.reactivo.count()).toBe(1);
    const historialImportaciones = await request(app).get('/api/banco-preguntas/importaciones?limite=10').set('Authorization', `Bearer ${token}`).expect(200);
    expect(historialImportaciones.body.importaciones[0]).toMatchObject({
      importId: preview.body.importId,
      periodoId,
      estado: 'confirmed',
      summary: { create: 1 }
    });
    const imageSha256 = createHash('sha256').update(Buffer.from('aGVsbG8=', 'base64')).digest('hex');
    const asset = await prisma.reactivoAsset.findUnique({ where: { docenteId_sha256: { docenteId: String((await prisma.reactivo.findUnique({ where: { id: String(confirmado.body.reactivoIds[0]) } }))?.docenteId), sha256: imageSha256 } } });
    expect(asset?.mediaType).toBe('image/png');
    expect(JSON.parse(String(asset?.metadataJson)).dataUrl).toBe(imageDataUrl);

    const repetido = await confirmar().expect(200);
    expect(repetido.body.reactivoIds).toEqual(confirmado.body.reactivoIds);

    const reactivoId = String(confirmado.body.reactivoIds[0]);
    const revision = await request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/revisar`).set('Authorization', `Bearer ${token}`).send({}).expect(200);
    expect(revision.body.reactivo.estado).toBe('review');
    const publicado = await request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/publicar`).set('Authorization', `Bearer ${token}`).send({}).expect(200);
    expect(publicado.body.legacyPreguntaId).toBeTruthy();
    const reactivoPublicado = await prisma.reactivo.findUnique({
      where: { id: reactivoId },
      include: { versiones: { include: { opciones: true } } }
    });
    expect(reactivoPublicado?.legacyPreguntaId).toBeTruthy();
    const preguntaLegacy = await prisma.bancoPregunta.findUnique({
      where: { id: String(reactivoPublicado?.legacyPreguntaId) },
      include: { versiones: { include: { opciones: true } } }
    });
    expect(preguntaLegacy).toBeTruthy();
    expect(preguntaLegacy?.versiones[0]?.imagenUrl).toBe(imageDataUrl);
    expect(JSON.parse(String(reactivoPublicado?.versiones[0]?.metadataJson))).toMatchObject({ imageAssetSha256: imageSha256 });
    const blueprint = await construirBlueprintPlantilla([{
      _id: preguntaLegacy!.id,
      id: preguntaLegacy!.id,
      versionActual: preguntaLegacy!.versionActual,
      versiones: preguntaLegacy!.versiones.map((version) => ({
        numeroVersion: version.numeroVersion,
        enunciado: version.enunciado,
        imagenUrl: version.imagenUrl ?? undefined,
        opciones: version.opciones.map((opcion) => ({ texto: opcion.texto, esCorrecta: opcion.esCorrecta }))
      }))
    }]);
    expect(blueprint.version).toBe(2);
    expect(blueprint.items[0]).toMatchObject({
      source: 'canonical',
      reactivoId,
      reactivoVersionId: reactivoPublicado!.versiones[0].id,
      contentHash: reactivoPublicado!.versiones[0].contentHash
    });
    const snapshot = construirSnapshotVersionesBlueprint({
      plantilla: {
        blueprintStatus: 'ready',
        blueprintJson: JSON.stringify(blueprint)
      }
    });
    expect(snapshot.versionSet[0]).toMatchObject({
      reactivoId,
      reactivoVersionId: reactivoPublicado!.versiones[0].id,
      contentHash: reactivoPublicado!.versiones[0].contentHash
    });
    expect(snapshot.questionMap[preguntaLegacy!.id]).toMatchObject({
      reactivoVersionId: reactivoPublicado!.versiones[0].id
    });
    const plantilla = await request(app).post('/api/examenes/plantillas').set('Authorization', `Bearer ${token}`).send({
      periodoId,
      tipo: 'parcial',
      titulo: 'Plantilla canónica de reactivos',
      numeroPaginas: 1,
      preguntasIds: [preguntaLegacy!.id]
    }).expect(201);
    const plantillaId = String(plantilla.body.plantilla._id);
    await request(app).get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`).set('Authorization', `Bearer ${token}`).expect(200);
    const plantillaPersistida = await prisma.examenPlantilla.findUnique({ where: { id: plantillaId } });
    const configuracionPlantilla = JSON.parse(String(plantillaPersistida?.bookletConfig ?? '{}')) as { blueprint?: typeof blueprint; blueprintStatus?: string };
    expect(configuracionPlantilla.blueprintStatus).toBe('ready');
    expect(configuracionPlantilla.blueprint?.items[0]).toMatchObject({
      reactivoId,
      reactivoVersionId: reactivoPublicado!.versiones[0].id,
      contentHash: reactivoPublicado!.versiones[0].contentHash
    });
    await request(app).post('/api/examenes/generados').set('Authorization', `Bearer ${token}`).send({ plantillaId }).expect(201);
    const examenGenerado = await prisma.examenGenerado.findFirst({ where: { plantillaId }, select: { id: true, versionSet: true, questionMap: true, mapaVariante: true } });
    expect(JSON.parse(String(examenGenerado?.versionSet ?? '[]'))[0]).toMatchObject({
      reactivoId,
      reactivoVersionId: reactivoPublicado!.versiones[0].id,
      contentHash: reactivoPublicado!.versiones[0].contentHash
    });
    expect(JSON.parse(String(examenGenerado?.questionMap ?? '{}'))[preguntaLegacy!.id]).toMatchObject({
      reactivoVersionId: reactivoPublicado!.versiones[0].id
    });
    const versiones = await request(app).get(`/api/banco-preguntas/reactivos/${reactivoId}/versiones`).set('Authorization', `Bearer ${token}`).expect(200);
    const reactivoVersionId = versiones.body.versiones[0].id as string;
    const mapaVariante = JSON.parse(String(examenGenerado?.mapaVariante ?? '{}')) as { ordenPreguntas: string[]; ordenOpcionesPorPregunta: Record<string, number[]> };
    const numeroPregunta = mapaVariante.ordenPreguntas.indexOf(preguntaLegacy!.id) + 1;
    const ordenOpciones = mapaVariante.ordenOpcionesPorPregunta[preguntaLegacy!.id];
    const indiceCorrecto = reactivoPublicado!.versiones[0].opciones.findIndex((opcion) => opcion.esCorrecta);
    const posicionCorrecta = ordenOpciones.indexOf(indiceCorrecto);
    const opcionCorrecta = String.fromCharCode(65 + posicionCorrecta);
    const opcionIncorrecta = ['A', 'B', 'C', 'D', 'E'].find((opcion) => opcion !== opcionCorrecta)!;
    const calificacionIds: string[] = [];
    for (let index = 0; index < 30; index += 1) {
      const alumno = await prisma.alumno.create({ data: {
        id: `alumno-calibracion-${index}`, periodoId, matricula: `CAL-${index}`,
        nombreCompleto: `Alumno calibración ${index}`, correo: `calibracion-${index}@local.test`, grupo: 'A'
      } });
      const correcta = index < 18;
      const calificacion = await prisma.calificacion.create({ data: {
        docenteId: reactivoPublicado!.docenteId,
        periodoId,
        examenGeneradoId: examenGenerado!.id,
        alumnoId: alumno.id,
        tipoExamen: 'parcial',
        totalReactivos: 1,
        aciertos: correcta ? 1 : 0,
        fraccion: JSON.stringify({ numerador: correcta ? 1 : 0, denominador: 1 }),
        calificacionExamenTexto: correcta ? '9' : '5',
        bonoTexto: '0',
        calificacionExamenFinalTexto: correcta ? '9' : '5',
        finalDecimal: correcta ? 9 : 5,
        respuestasDetectadas: JSON.stringify([{ numeroPregunta, opcion: correcta ? opcionCorrecta : opcionIncorrecta, estadoRespuesta: 'respondida' }]),
        omrAuditoria: JSON.stringify({ estadoAnalisis: 'ok', autoCalificableOmr: true, revisionConfirmada: false })
      } });
      calificacionIds.push(calificacion.id);
    }
    await request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/calibracion`).set('Authorization', `Bearer ${token}`).send({
      reactivoVersionId,
      cohorteKey: 'cohorte-test',
      calificacionIds
    }).expect(201);
    await request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/calibracion`).set('Authorization', `Bearer ${token}`).send({
      reactivoVersionId,
      cohorteKey: 'cohorte-no-confirmada',
      calificacionIds: ['calificacion-ajena']
    }).expect(404);
    const alumnoNoConfirmado = await prisma.alumno.create({ data: {
      id: 'alumno-calibracion-no-confirmado', periodoId, matricula: 'CAL-NO-OK',
      nombreCompleto: 'Alumno sin confirmar', correo: 'no-confirmado@local.test', grupo: 'A'
    } });
    const calificacionNoConfirmada = await prisma.calificacion.create({ data: {
      docenteId: reactivoPublicado!.docenteId, periodoId, examenGeneradoId: examenGenerado!.id, alumnoId: alumnoNoConfirmado.id,
      tipoExamen: 'parcial', totalReactivos: 1, aciertos: 1, fraccion: '{"numerador":1,"denominador":1}',
      calificacionExamenTexto: '9', bonoTexto: '0', calificacionExamenFinalTexto: '9',
      respuestasDetectadas: JSON.stringify([{ numeroPregunta, opcion: opcionCorrecta, estadoRespuesta: 'respondida' }]),
      omrAuditoria: JSON.stringify({ estadoAnalisis: 'requiere_revision', autoCalificableOmr: false, revisionConfirmada: false })
    } });
    await request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/calibracion`).set('Authorization', `Bearer ${token}`).send({
      reactivoVersionId,
      cohorteKey: 'cohorte-no-confirmada',
      calificacionIds: [calificacionNoConfirmada.id]
    }).expect(422);
    await request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/calibracion`).set('Authorization', `Bearer ${token}`).send({
      reactivoVersionId,
      cohorteKey: 'cohorte-forjada',
      respuestas: [{ correcta: true, puntajeTotal: 9, opcion: 'A', omrConfirmado: true }]
    }).expect(400);
    const calibracion = await request(app).get(`/api/banco-preguntas/reactivos/${reactivoId}/calibracion`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(calibracion.body.estado).toBe('calibrado');

    const nuevaVersion = lote(periodoId, temaId, 'ia-bi-version-2');
    nuevaVersion.items[0].externalKey = 'bi-001';
    nuevaVersion.items[0].itemId = reactivoId;
    nuevaVersion.items[0].expectedVersion = 1;
    nuevaVersion.items[0].stem.value = 'Reactivo actualizado después del preview';
    const previewNuevaVersion = await request(app).post('/api/banco-preguntas/importaciones/preview').set('Authorization', `Bearer ${token}`).send(nuevaVersion).expect(200);
    expect(previewNuevaVersion.body.summary.newVersion).toBe(1);
    await request(app).post(`/api/banco-preguntas/importaciones/${previewNuevaVersion.body.importId}/confirmar`).set('Authorization', `Bearer ${token}`).send({ planHash: previewNuevaVersion.body.planHash, payload: nuevaVersion }).expect(200);
    await request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/revisar`).set('Authorization', `Bearer ${token}`).send({}).expect(200);
    await request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/publicar`).set('Authorization', `Bearer ${token}`).send({}).expect(200);
    const generacionObsoleta = await request(app).post('/api/examenes/generados').set('Authorization', `Bearer ${token}`).send({ plantillaId });
    expect(generacionObsoleta.status).toBe(409);
    expect(generacionObsoleta.body?.error?.codigo ?? generacionObsoleta.body?.codigo).toBe('BLUEPRINT_OBSOLETO');
    const plantillaObsoleta = await prisma.examenPlantilla.findUnique({ where: { id: plantillaId } });
    const configuracionObsoleta = JSON.parse(String(plantillaObsoleta?.bookletConfig ?? '{}')) as { blueprintStatus?: string };
    expect(configuracionObsoleta.blueprintStatus).toBe('requires_repreview');
  });

  it('lista reactivos con versión vigente y restringe la lectura por docente', async () => {
    const docente = await preparar();
    const batch = lote(docente.periodoId, docente.temaId, 'lectura-api');
    const segundo = structuredClone(batch.items[0]!);
    segundo.externalKey = 'bi-lectura-api-002';
    segundo.stem.value = 'Segundo reactivo para paginación';
    batch.items.push(segundo);

    const preview = await request(app)
      .post('/api/banco-preguntas/importaciones/preview')
      .set('Authorization', `Bearer ${docente.token}`)
      .send(batch)
      .expect(200);
    const confirmacion = await request(app)
      .post(`/api/banco-preguntas/importaciones/${preview.body.importId}/confirmar`)
      .set('Authorization', `Bearer ${docente.token}`)
      .send({ planHash: preview.body.planHash, payload: batch })
      .expect(200);
    const ids = confirmacion.body.reactivoIds as string[];
    expect(ids).toHaveLength(2);

    const pagina1 = await request(app)
      .get(`/api/banco-preguntas/reactivos?periodoId=${docente.periodoId}&temaId=${docente.temaId}&limite=1`)
      .set('Authorization', `Bearer ${docente.token}`)
      .expect(200);
    expect(pagina1.body.reactivos).toHaveLength(1);
    expect(pagina1.body.reactivos[0].versionActual).toBe(1);
    expect(pagina1.body.reactivos[0].version).toMatchObject({
      numeroVersion: 1,
      opciones: expect.arrayContaining([
        expect.objectContaining({ clave: 'A', esCorrecta: true })
      ])
    });
    expect(ids).toContain(pagina1.body.reactivos[0].id);
    expect(pagina1.body.nextCursor).toBeTruthy();

    const pagina2 = await request(app)
      .get(`/api/banco-preguntas/reactivos?periodoId=${docente.periodoId}&temaId=${docente.temaId}&limite=1&cursor=${pagina1.body.nextCursor}`)
      .set('Authorization', `Bearer ${docente.token}`)
      .expect(200);
    expect(pagina2.body.reactivos).toHaveLength(1);
    expect(pagina2.body.reactivos[0].id).not.toBe(pagina1.body.reactivos[0].id);
    expect(pagina2.body.nextCursor).toBeNull();

    const cursorInvalido = await request(app)
      .get('/api/banco-preguntas/reactivos?cursor=bm90LWpzb24')
      .set('Authorization', `Bearer ${docente.token}`)
      .expect(400);
    expect(cursorInvalido.body.error.codigo).toBe('REACTIVO_CURSOR_INVALIDO');

    const detalle = await request(app)
      .get(`/api/banco-preguntas/reactivos/${ids[0]}`)
      .set('Authorization', `Bearer ${docente.token}`)
      .expect(200);
    expect(detalle.body.reactivo.versionActual).toBe(1);
    expect(detalle.body.reactivo.version).toMatchObject({ enunciado: expect.any(String), contentHash: expect.any(String) });

    const otroDocente = await preparar();
    await request(app)
      .get(`/api/banco-preguntas/reactivos/${ids[0]}`)
      .set('Authorization', `Bearer ${otroDocente.token}`)
      .expect(404);
    const listadoAjeno = await request(app)
      .get('/api/banco-preguntas/reactivos')
      .set('Authorization', `Bearer ${otroDocente.token}`)
      .expect(200);
    expect(listadoAjeno.body.reactivos).toEqual([]);
  });

  it('valida un XLSX canónico, no escribe en preview y confirma el payload normalizado', async () => {
    const { token, periodoId, temaId } = await preparar();
    const batch = lote(periodoId, temaId, 'xlsx');
    const archivo = await archivoXlsx(batch);
    const preview = await request(app)
      .post('/api/banco-preguntas/importaciones/preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('archivo', archivo, { filename: 'reactivos.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .expect(200);

    expect(preview.body.payload).toMatchObject({
      contract: 'evaluapro.reactivos.batch',
      target: { periodoId, temaIds: [temaId] },
      items: [{ externalKey: 'bi-xlsx', stem: { value: 'Reactivo xlsx' }, provenance: { origin: 'imported' } }]
    });
    expect(preview.body.summary).toMatchObject({ create: 1, conflict: 0 });
    expect(await prisma.reactivo.count()).toBe(0);
    expect(await prisma.reactivoImportacion.count()).toBe(0);

    const confirmado = await request(app)
      .post(`/api/banco-preguntas/importaciones/${preview.body.importId}/confirmar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planHash: preview.body.planHash, payload: preview.body.payload })
      .expect(200);
    expect(confirmado.body.draftReactivoIds).toHaveLength(1);
    expect(await prisma.reactivo.count()).toBe(1);
  });

  it('asigna un solo tema explícito por reactivo y bloquea lotes multitema ambiguos', async () => {
    const { token, periodoId, temaId } = await preparar();
    const segundoTema = await request(app).post('/api/banco-preguntas/temas')
      .set('Authorization', `Bearer ${token}`)
      .send({ periodoId, nombre: 'Analítica predictiva' })
      .expect(201);
    const segundoTemaId = String(segundoTema.body.tema._id);
    const batch = lote(periodoId, temaId, 'temas-por-reactivo');
    batch.target.temaIds = [temaId, segundoTemaId];
    Object.assign(batch.items[0]!, { temaId });
    const segundoItem = structuredClone(batch.items[0]!);
    Object.assign(segundoItem, { externalKey: 'bi-tema-2', temaId: segundoTemaId, stem: { format: 'richtext', value: 'Reactivo del segundo tema' } });
    batch.items.push(segundoItem);

    const preview = await request(app).post('/api/banco-preguntas/importaciones/preview')
      .set('Authorization', `Bearer ${token}`)
      .send(batch)
      .expect(200);
    expect(preview.body.rows.map((row: any) => row.detail.temaId)).toEqual([temaId, segundoTemaId]);
    const confirmado = await request(app).post(`/api/banco-preguntas/importaciones/${preview.body.importId}/confirmar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planHash: preview.body.planHash, payload: preview.body.payload })
      .expect(200);
    const guardados = await prisma.reactivo.findMany({
      where: { id: { in: confirmado.body.reactivoIds } },
      include: { asignaciones: { select: { temaId: true } } },
      orderBy: { externalKey: 'asc' }
    });
    expect(Object.fromEntries(guardados.map((reactivo) => [reactivo.externalKey, reactivo.asignaciones.map((asignacion) => asignacion.temaId)]))).toEqual({
      'bi-temas-por-reactivo': [temaId],
      'bi-tema-2': [segundoTemaId]
    });

    const itemCambiado = guardados.find((reactivo) => reactivo.externalKey === 'bi-tema-2')!;
    const reasignacion = lote(periodoId, temaId, 'reasignacion-tema');
    reasignacion.target.temaIds = [temaId, segundoTemaId];
    Object.assign(reasignacion.items[0]!, {
      externalKey: itemCambiado.externalKey,
      itemId: itemCambiado.id,
      expectedVersion: 1,
      temaId,
      stem: { format: 'richtext', value: 'Reactivo del segundo tema' }
    });
    const previewReasignacion = await request(app).post('/api/banco-preguntas/importaciones/preview')
      .set('Authorization', `Bearer ${token}`)
      .send(reasignacion)
      .expect(200);
    expect(previewReasignacion.body.summary.newVersion).toBe(1);
    expect(previewReasignacion.body.rows[0].detail.codigo).toBe('TEMA_CAMBIO');
    await request(app).post(`/api/banco-preguntas/importaciones/${previewReasignacion.body.importId}/confirmar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planHash: previewReasignacion.body.planHash, payload: previewReasignacion.body.payload })
      .expect(200);
    const reasignado = await prisma.reactivo.findUnique({ where: { id: itemCambiado.id }, include: { asignaciones: true } });
    expect(reasignado).toMatchObject({ versionActual: 2, estado: 'draft' });
    expect(reasignado?.asignaciones.map((asignacion) => asignacion.temaId)).toEqual([temaId]);

    const ambiguo = structuredClone(batch);
    delete (ambiguo.items[0] as { temaId?: string }).temaId;
    await request(app).post('/api/banco-preguntas/importaciones/preview')
      .set('Authorization', `Bearer ${token}`)
      .send(ambiguo)
      .expect(400);
    expect(await prisma.reactivo.count()).toBe(2);
  });

  it('conserva encabezados XLSX antiguos para lotes de un solo tema', async () => {
    const { token, periodoId, temaId } = await preparar();
    const archivo = await archivoXlsx(lote(periodoId, temaId, 'xlsx-legado'), { encabezadoLegacy: true });
    const preview = await request(app).post('/api/banco-preguntas/importaciones/preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('archivo', archivo, { filename: 'reactivos-legado.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .expect(200);
    expect(preview.body.payload.items[0]).not.toHaveProperty('temaId');
    expect(preview.body.rows[0].detail.temaId).toBe(temaId);
  });

  it('descarga una plantilla XLSX con las dos hojas del contrato v1', async () => {
    const { token } = await preparar();
    const respuesta = await request(app)
      .get('/api/banco-preguntas/importaciones/plantilla.xlsx')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(respuesta.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(respuesta.headers['content-disposition']).toContain('plantilla-reactivos-v1.xlsx');
    expect(Buffer.isBuffer(respuesta.body)).toBe(true);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(respuesta.body as Buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Lote', 'Reactivos']);
    expect(workbook.getWorksheet('Reactivos')?.getRow(1).values).toEqual([
      undefined, 'externalKey', 'itemId', 'expectedVersion', 'temaId', 'enunciado', 'opcionA', 'opcionB', 'opcionC', 'opcionD', 'opcionE',
      'respuestaCorrecta', 'difficultyHypothesis', 'cognitiveLevel', 'competenciesJson', 'tagsJson', 'notes', 'confidence'
    ]);
  });

  it('rechaza fórmulas dentro del XLSX antes de cualquier escritura', async () => {
    const { token, periodoId, temaId } = await preparar();
    const batch = lote(periodoId, temaId, 'formula');
    const archivo = await archivoXlsx(batch, { enunciadoFormula: true });
    const respuesta = await request(app)
      .post('/api/banco-preguntas/importaciones/preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('archivo', archivo, { filename: 'reactivos.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body?.error?.codigo ?? respuesta.body?.codigo).toBe('REACTIVOS_XLSX_TIPO_INVALIDO');
    expect(await prisma.reactivo.count()).toBe(0);
    expect(await prisma.reactivoImportacion.count()).toBe(0);
  });

  it.each([
    { caso: 'hoja adicional', opcion: { hojaExtra: true }, codigo: 'REACTIVOS_XLSX_HOJAS_INVALIDAS' },
    { caso: 'encabezado duplicado', opcion: { encabezadoDuplicado: true }, codigo: 'REACTIVOS_XLSX_ENCABEZADOS_INVALIDOS' }
  ])('rechaza XLSX con $caso antes de persistir', async ({ opcion, codigo }) => {
    const { token, periodoId, temaId } = await preparar();
    const archivo = await archivoXlsx(lote(periodoId, temaId, `estructura-${codigo}`), opcion);
    const respuesta = await request(app)
      .post('/api/banco-preguntas/importaciones/preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('archivo', archivo, { filename: 'reactivos.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body?.error?.codigo ?? respuesta.body?.codigo).toBe(codigo);
    expect(await prisma.reactivo.count()).toBe(0);
    expect(await prisma.reactivoImportacion.count()).toBe(0);
  });

  it('retira rutas de escritura legacy sin modificar ni borrar el banco', async () => {
    const { token, periodoId } = await preparar();
    const crear = await request(app).post('/api/banco-preguntas').set('Authorization', `Bearer ${token}`).send({
      periodoId,
      enunciado: 'Reactivo de prueba legacy',
      opciones: ['A', 'B', 'C', 'D', 'E'].map((texto, index) => ({ texto, esCorrecta: index === 0 }))
    });
    expect(crear.status).toBe(410);
    expect(crear.body?.error?.codigo ?? crear.body?.codigo).toBe('RUTA_ESCRITURA_LEGADA_RETIRADA');
    const actualizar = await request(app).post('/api/banco-preguntas/pregunta-antigua/actualizar').set('Authorization', `Bearer ${token}`).send({ enunciado: 'Actualización legacy bloqueada' });
    expect(actualizar.status).toBe(410);
    expect(await prisma.bancoPregunta.count()).toBe(0);
    expect(await prisma.reactivo.count()).toBe(0);
  });

  it('reporta conflicto explícito si un externalKey existente cambia de contenido', async () => {
    const { token, periodoId, temaId } = await preparar();
    const lotePrimero = lote(periodoId, temaId, 'same');
    const primero = await request(app).post('/api/banco-preguntas/importaciones/preview').set('Authorization', `Bearer ${token}`).send(lotePrimero).expect(200);
    const confirmado = await request(app).post(`/api/banco-preguntas/importaciones/${primero.body.importId}/confirmar`).set('Authorization', `Bearer ${token}`).send({ planHash: primero.body.planHash, payload: lotePrimero }).expect(200);
    const cambiado = lote(periodoId, temaId, 'same');
    cambiado.items[0].stem.value = 'Contenido diferente';
    const segundo = await request(app).post('/api/banco-preguntas/importaciones/preview').set('Authorization', `Bearer ${token}`).send(cambiado).expect(200);
    expect(segundo.body.summary.conflict).toBe(1);
    expect(segundo.body.rows[0].detail.codigo).toBe('EXTERNAL_KEY_CONFLICT');

    const versionado = lote(periodoId, temaId, 'same');
    versionado.items[0].itemId = String(confirmado.body.reactivoIds[0]);
    versionado.items[0].expectedVersion = 1;
    versionado.items[0].stem.value = 'Contenido versionado';
    const tercera = await request(app).post('/api/banco-preguntas/importaciones/preview').set('Authorization', `Bearer ${token}`).send(versionado).expect(200);
    expect(tercera.body.summary.newVersion).toBe(1);
    const versionConfirmada = await request(app).post(`/api/banco-preguntas/importaciones/${tercera.body.importId}/confirmar`).set('Authorization', `Bearer ${token}`).send({ planHash: tercera.body.planHash, payload: versionado }).expect(200);
    expect(versionConfirmada.body.draftReactivoIds).toEqual([String(confirmado.body.reactivoIds[0])]);

    const conflictoVersion = { ...versionado, batchId: 'ia-bi-same-stale', items: [{ ...versionado.items[0], stem: { format: 'richtext', value: 'Otra modificación' } }] };
    const cuarta = await request(app).post('/api/banco-preguntas/importaciones/preview').set('Authorization', `Bearer ${token}`).send(conflictoVersion).expect(200);
    expect(cuarta.body.summary.conflict).toBe(1);
    expect(cuarta.body.rows[0].detail.codigo).toBe('VERSION_CONFLICT');
  });

  it('retira reactivos sin borrar su identidad ni permitir re-publicarlos', async () => {
    const { token, periodoId, temaId } = await preparar();
    const batch = lote(periodoId, temaId, 'retirar');
    const preview = await request(app).post('/api/banco-preguntas/importaciones/preview').set('Authorization', `Bearer ${token}`).send(batch).expect(200);
    const confirmado = await request(app).post(`/api/banco-preguntas/importaciones/${preview.body.importId}/confirmar`).set('Authorization', `Bearer ${token}`).send({ planHash: preview.body.planHash, payload: batch }).expect(200);
    const reactivoId = String(confirmado.body.reactivoIds[0]);
    await request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/revisar`).set('Authorization', `Bearer ${token}`).send({}).expect(200);
    const [publicado, reintentoPublicacion] = await Promise.all([
      request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/publicar`).set('Authorization', `Bearer ${token}`).send({}).expect(200),
      request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/publicar`).set('Authorization', `Bearer ${token}`).send({}).expect(200)
    ]);
    const versionesLegadasAntesDelReintento = await prisma.versionPregunta.count({ where: { preguntaId: publicado.body.legacyPreguntaId } });
    expect(reintentoPublicacion.body).toMatchObject({ legacyPreguntaId: publicado.body.legacyPreguntaId });
    expect(await prisma.versionPregunta.count({ where: { preguntaId: publicado.body.legacyPreguntaId } })).toBe(versionesLegadasAntesDelReintento);

    const retirado = await request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/retirar`).set('Authorization', `Bearer ${token}`).send({}).expect(200);
    expect(retirado.body.reactivo.estado).toBe('retired');
    expect(await prisma.bancoPregunta.findUnique({ where: { id: publicado.body.legacyPreguntaId }, select: { activo: true, archivadoEn: true } })).toMatchObject({ activo: false });
    expect(await prisma.reactivoVersion.count({ where: { reactivoId } })).toBe(1);
    await request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/publicar`).set('Authorization', `Bearer ${token}`).send({}).expect(409);
  });

  it('rechaza objetivos por identificador inexistente sin crear una importación', async () => {
    const { token, periodoId, temaId } = await preparar();
    const invalido = lote(periodoId, temaId, 'objetivo-invalido');
    invalido.target.periodoId = 'periodo-no-existente';
    await request(app).post('/api/banco-preguntas/importaciones/preview').set('Authorization', `Bearer ${token}`).send(invalido).expect(404);
    expect(await prisma.reactivoImportacion.count()).toBe(0);
  });

  it('revierte toda la confirmación si una fila entra en conflicto después del preview', async () => {
    const { token, periodoId, temaId } = await preparar();
    const batch = lote(periodoId, temaId, 'rollback');
    const segunda = structuredClone(batch.items[0]);
    segunda.externalKey = 'bi-rollback-002';
    segunda.stem.value = 'Segundo reactivo del lote';
    batch.items.push(segunda);
    const preview = await request(app).post('/api/banco-preguntas/importaciones/preview').set('Authorization', `Bearer ${token}`).send(batch).expect(200);
    const docenteId = String((await prisma.periodo.findUnique({ where: { id: periodoId }, select: { docenteId: true } }))?.docenteId ?? '');
    await prisma.reactivo.create({ data: { docenteId, externalKey: segunda.externalKey, estado: 'draft', versionActual: 1 } });

    const confirmacion = await request(app).post(`/api/banco-preguntas/importaciones/${preview.body.importId}/confirmar`).set('Authorization', `Bearer ${token}`).send({ planHash: preview.body.planHash, payload: batch });
    expect(confirmacion.status).toBe(409);
    expect(confirmacion.body?.error?.codigo ?? confirmacion.body?.codigo).toBe('EXTERNAL_KEY_CONFLICT');
    expect(await prisma.reactivo.count({ where: { externalKey: batch.items[0].externalKey } })).toBe(0);
    expect(await prisma.reactivo.count({ where: { externalKey: segunda.externalKey } })).toBe(1);
    expect(await prisma.reactivoVersion.count()).toBe(0);
    expect(await prisma.reactivoImportacion.count()).toBe(0);
  });
});
