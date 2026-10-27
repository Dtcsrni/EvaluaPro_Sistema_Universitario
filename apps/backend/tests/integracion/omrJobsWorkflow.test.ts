/**
 * omrJobsWorkflow.test
 *
 * Responsabilidad: verificar el contrato HTTP del workflow OMR moderno.
 */
import request from 'supertest';
import express from 'express';
import QRCode from 'qrcode';
import { degrees, PDFDocument } from 'pdf-lib';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { resolverRutaPdfExamen } from '../../src/infraestructura/archivos/almacenLocal.js';
import { ErrorAplicacion } from '../../src/compartido/errores/errorAplicacion.js';
import { crearCargadorArchivosPdfOmr } from '../../src/modulos/modulo_escaneo_omr/rutasEscaneoOmr.js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';

const controlLectorQr = vi.hoisted(() => ({ forzarFalloLecturaDirecta: false }));
vi.mock('../../src/modulos/modulo_escaneo_omr/servicioOmr.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/modulos/modulo_escaneo_omr/servicioOmr.js')>();
  return {
    ...actual,
    leerQrDesdeImagen: vi.fn(async (imagenBase64: string) => (
      controlLectorQr.forzarFalloLecturaDirecta ? undefined : actual.leerQrDesdeImagen(imagenBase64)
    ))
  };
});

describe('límite agregado multipart OMR', () => {
  it('corta la escritura al superar el tamaño total y limpia los temporales', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-omr-limit-test-'));
    const appCarga = express();
    appCarga.post('/ingesta', crearCargadorArchivosPdfOmr(10, root), async (req, res) => {
      const cargados = req.files as Record<string, Express.Multer.File[]> | undefined;
      const files = cargados ? Object.values(cargados).flat() : [];
      await Promise.all(files.map((file) => fs.rm(path.dirname(file.path), { recursive: true, force: true })));
      res.status(201).json({ sizes: files.map((file) => file.size) });
    });
    appCarga.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (error instanceof ErrorAplicacion) {
        res.status(error.estadoHttp).json({ error: { codigo: error.codigo } });
        return;
      }
      next(error);
    });

    try {
      const dentroDelLimite = await request(appCarga)
        .post('/ingesta')
        .attach('archivos', Buffer.from('12345'), { filename: 'a.pdf', contentType: 'application/pdf' })
        .attach('archivos', Buffer.from('67890'), { filename: 'b.pdf', contentType: 'application/pdf' })
        .expect(201);
      expect(dentroDelLimite.body.sizes).toEqual([5, 5]);

      const referenciaIncluida = await request(appCarga)
        .post('/ingesta')
        .attach('archivos', Buffer.from('12345'), { filename: 'capturas.pdf', contentType: 'application/pdf' })
        .attach('referencia', Buffer.from('67890'), { filename: 'referencia.pdf', contentType: 'application/pdf' })
        .expect(201);
      expect(referenciaIncluida.body.sizes).toEqual([5, 5]);

      const excedido = await request(appCarga)
        .post('/ingesta')
        .attach('archivos', Buffer.from('123456'), { filename: 'a.pdf', contentType: 'application/pdf' })
        .attach('archivos', Buffer.from('78901'), { filename: 'b.pdf', contentType: 'application/pdf' })
        .expect(413);
      expect(excedido.body.error.codigo).toBe('OMR_PDF_TAMANO_INVALIDO');
      expect(await fs.readdir(root)).toEqual([]);

      const excedidoConReferencia = await request(appCarga)
        .post('/ingesta')
        .attach('archivos', Buffer.from('123456'), { filename: 'capturas.pdf', contentType: 'application/pdf' })
        .attach('referencia', Buffer.from('78901'), { filename: 'referencia.pdf', contentType: 'application/pdf' })
        .expect(413);
      expect(excedidoConReferencia.body.error.codigo).toBe('OMR_PDF_TAMANO_INVALIDO');
      expect(await fs.readdir(root)).toEqual([]);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

function parsearBinario(res: NodeJS.ReadableStream, cb: (error: Error | null, body?: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

function extraerEntradasZip(buffer: Buffer) {
  const entries = new Map<string, Buffer>();
  let offset = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  while (offset >= 0 && offset + 46 <= buffer.length && buffer.readUInt32LE(offset) === 0x02014b50) {
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const name = buffer.toString('utf8', nameStart, nameStart + nameLength);
    if (method !== 0) throw new Error(`Método ZIP inesperado: ${method}`);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    entries.set(name, buffer.subarray(dataStart, dataStart + compressedSize));
    offset = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), offset + 46 + nameLength + extraLength + commentLength);
  }
  return entries;
}

describe('workflow OMR por jobs', () => {
  let app: import('express').Express;
  let recuperarIngestasPdfOmrInterrumpidas: () => Promise<number>;
  let directorioGatePiloto: string | undefined;
  const preguntasPorEscenario = 5;

  beforeAll(async () => {
    vi.stubEnv('EVALUAPRO_OMR_TV4_REAL_PILOT_REPORT', '');
    vi.resetModules();
    const { OMR_RUNTIME_CONFIG_SHA256 } = await import('../../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js');
    directorioGatePiloto = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-omr-test-gate-'));
    const reporteGatePath = path.join(directorioGatePiloto, 'pilot-report.json');
    // Reporte sintético de fixture para habilitar las rutas de integración; nunca se usa en runtime.
    await fs.writeFile(reporteGatePath, JSON.stringify({
      datasetType: 'tv4_pilot_real',
      status: 'passed',
      ok: true,
      checks: {
        precision: true,
        falsePositiveRate: true,
        invalidDetectionRate: true,
        pagePassRate: true,
        autoGradeTrustRate: true,
        autoCoverageRate: true,
        gradeConsistencyObserved: true,
        bonusConsistencyObserved: true
      },
      thresholds: { gradeConsistencyObservedMin: 1, autoCoverageMin: 1 },
      metrics: {
        totalCaptures: 24,
        pagePassRate: 1,
        autoGradeTrustRate: 1,
        gradeComparisons: 12,
        bonusComparisons: 12,
        gradeConsistency: 1,
        bonusConsistency: 1,
        gradeConsistencyLower95: 0.779078,
        bonusConsistencyLower95: 0.779078,
        autoCoverageRate: 1,
        humanReviewedRows: 24,
        humanReviewerCount: 2
      },
      evidenceHashes: {
        manifestSha256: 'a'.repeat(64),
        groundTruthSha256: 'b'.repeat(64),
        answerKeySha256: 'c'.repeat(64),
        captureAssetsSha256: 'd'.repeat(64),
        evaluatorCodeSha256: 'e'.repeat(64),
        omrRuntimeConfigSha256: OMR_RUNTIME_CONFIG_SHA256
      }
    }), 'utf8');
    vi.stubEnv('EVALUAPRO_OMR_TV4_REAL_PILOT_REPORT', reporteGatePath);
    await conectarSqliteTest();
    vi.resetModules();
    const [{ crearApp }, controladorIngesta] = await Promise.all([
      import('../../src/app.js'),
      import('../../src/modulos/modulo_escaneo_omr/controladorIngestaPdfOmr.js')
    ]);
    app = crearApp();
    recuperarIngestasPdfOmrInterrumpidas = controladorIngesta.recuperarIngestasPdfOmrInterrumpidas;
  });

  beforeEach(async () => {
    controlLectorQr.forzarFalloLecturaDirecta = false;
    await limpiarSqliteTest();
  });

  afterEach(() => {
    controlLectorQr.forzarFalloLecturaDirecta = false;
  });

  afterAll(async () => {
    await cerrarSqliteTest();
    vi.unstubAllEnvs();
    if (directorioGatePiloto) await fs.rm(directorioGatePiloto, { recursive: true, force: true });
  });

  async function registrar(correo: string) {
    const respuesta = await request(app)
      .post('/api/autenticacion/registrar')
      .send({ nombreCompleto: 'Docente OMR', correo, contrasena: 'Secreto123!' })
      .expect(201);
    return respuesta.body.token as string;
  }

  async function prepararExamen(auth: { Authorization: string }) {
    const periodo = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({ nombre: 'Periodo OMR', fechaInicio: '2025-01-01', fechaFin: '2025-06-01', grupos: ['A'] })
      .expect(201);
    const periodoId = periodo.body.periodo._id as string;
    const tema = await request(app)
      .post('/api/banco-preguntas/temas')
      .set(auth)
      .send({ periodoId, nombre: 'OMR jobs' })
      .expect(201);
    const temaId = String(tema.body.tema._id);
    const sufijo = Date.now();
    const lote = {
      contract: 'evaluapro.reactivos.batch',
      schemaVersion: 1,
      batchId: `omr-jobs-${sufijo}`,
      target: { periodoId, temaIds: [temaId] },
      source: {
        kind: 'manual',
        generator: 'integracion-backend',
        generatedAt: '2026-09-24T00:00:00Z',
        sourceDocumentSha256: null
      },
      items: Array.from({ length: preguntasPorEscenario }, (_, index) => ({
        externalKey: `omr-jobs-${sufijo}-${index + 1}`,
        itemId: null,
        expectedVersion: null,
        format: 'omr.mcq5',
        stem: { format: 'richtext', value: `Pregunta OMR ${index + 1}` },
        options: ['A', 'B', 'C', 'D', 'E'].map((key, optionIndex) => ({
          key,
          value: key,
          isCorrect: optionIndex === 0
        })),
        metadata: { difficultyHypothesis: 'medium' },
        provenance: { origin: 'authored', confidence: 1, notes: 'fixture OMR jobs' }
      }))
    };
    const preview = await request(app)
      .post('/api/banco-preguntas/importaciones/preview')
      .set(auth)
      .send(lote)
      .expect(200);
    const confirmado = await request(app)
      .post(`/api/banco-preguntas/importaciones/${preview.body.importId}/confirmar`)
      .set(auth)
      .send({ planHash: preview.body.planHash, payload: lote })
      .expect(200);
    const preguntasIds: string[] = [];
    for (const reactivoId of confirmado.body.reactivoIds as string[]) {
      await request(app)
        .post(`/api/banco-preguntas/reactivos/${reactivoId}/revisar`)
        .set(auth)
        .send({})
        .expect(200);
      const publicado = await request(app)
        .post(`/api/banco-preguntas/reactivos/${reactivoId}/publicar`)
        .set(auth)
        .send({})
        .expect(200);
      preguntasIds.push(String(publicado.body.legacyPreguntaId));
    }
    const plantilla = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({ periodoId, tipo: 'parcial', titulo: 'Plantilla OMR jobs', numeroPaginas: 1, preguntasIds })
      .expect(201);
    await request(app)
      .get(`/api/examenes/plantillas/${plantilla.body.plantilla._id}/previsualizar/pdf/visual`)
      .set(auth)
      .expect(200);
    const examen = await request(app)
      .post('/api/examenes/generados')
      .set(auth)
      .send({ plantillaId: plantilla.body.plantilla._id })
      .expect(201);
    return {
      examenId: examen.body.examenGenerado._id as string,
      plantillaId: plantilla.body.plantilla._id as string,
      periodoId,
      folio: examen.body.examenGenerado.folio as string,
      qrTexto: String(examen.body.examenGenerado.paginas?.[0]?.qrTexto ?? '')
    };
  }

  it('publica huellas de clave y variante y distingue el estado del manifiesto firmado', async () => {
    const token = await registrar('omr-jobs-manifest-candidate@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const escenario = await prepararExamen(auth);
    const exam = await prisma.examenGenerado.findUniqueOrThrow({
      where: { id: escenario.examenId },
      include: { alumno: { select: { id: true, nombreCompleto: true, grupo: true } } }
    });
    const { candidatosIngestaOmr } = await import('../../src/modulos/modulo_escaneo_omr/controladorIngestaPdfOmr.js');
    const [candidate] = candidatosIngestaOmr([exam as never]);

    expect(escenario.qrTexto).toContain(':LI:');
    expect(candidate?.variantHashes).toHaveLength(1);
    expect(candidate?.variantHashes[0]).toMatch(/^[A-Z0-9]{12}$/);
    expect(candidate?.answerKeyHashes).toHaveLength(1);
    expect(candidate?.answerKeyHashes[0]).toMatch(/^[A-Z0-9]{12}$/);
    expect(candidate?.answerKeySnapshotQuestions).toBe(preguntasPorEscenario);
    expect(candidate?.variantVerified).toBe(true);
    expect(candidate?.answerKeySnapshotVerified).toBe(true);

    const manifest = JSON.parse(String(exam.recoveryManifest)) as Record<string, unknown>;
    const invalidExam = { ...exam, recoveryManifest: JSON.stringify({ ...manifest, answerKeyHash: 'INVALIDO' }) };
    const [invalidCandidate] = candidatosIngestaOmr([invalidExam as never]);
    expect(invalidCandidate?.variantHashes).toHaveLength(0);
    expect(invalidCandidate?.answerKeyHashes).toHaveLength(0);
    expect(invalidCandidate?.variantVerified).toBe(false);
    expect(invalidCandidate?.answerKeySnapshotVerified).toBe(false);

    const variantMap = JSON.parse(String(exam.mapaVariante)) as { ordenPreguntas: string[]; ordenOpcionesPorPregunta: Record<string, number[]> };
    const firstQuestionId = variantMap.ordenPreguntas[0]!;
    const alteredOptions = [...variantMap.ordenOpcionesPorPregunta[firstQuestionId]!].reverse();
    const inconsistentExam = { ...exam, mapaVariante: JSON.stringify({
      ...variantMap,
      ordenOpcionesPorPregunta: { ...variantMap.ordenOpcionesPorPregunta, [firstQuestionId]: alteredOptions }
    }) };
    const [inconsistentCandidate] = candidatosIngestaOmr([inconsistentExam as never]);
    expect(inconsistentCandidate?.variantVerified).toBe(false);
    expect(inconsistentCandidate?.answerKeySnapshotVerified).toBe(false);
  }, 300_000);

  it('carga detalle, procesa captura, resuelve hoja, finaliza y aísla por docente', async () => {
    const token = await registrar('omr-jobs-a@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const escenario = await prepararExamen(auth);

    const detalle = await request(app)
      .get(`/api/examenes/generados/${escenario.examenId}`)
      .set(auth)
      .expect(200);
    expect(detalle.body.assessment._id).toBe(escenario.examenId);
    expect(detalle.body.assessment.omrSheetPdfUrl).toContain(`/examenes/generados/${escenario.examenId}/pdf`);

    const imagenBase64 = await QRCode.toDataURL(escenario.qrTexto, { margin: 1, width: 512 });
    const creado = await request(app)
      .post('/api/omr/jobs')
      .set(auth)
      .send({
        generatedAssessmentId: escenario.examenId,
        clientRequestId: 'c0d2d9b4-a7b5-4c87-9b9d-2ab9be381238',
        sourceType: 'image_batch',
        capturas: [{ nombreArchivo: 'hoja.png', imagenBase64 }]
      })
      .expect(201);
    expect(creado.body.job.status).toBe('completed');
    expect(creado.body.job.pages).toHaveLength(1);
    expect(creado.body.job.pages[0].responses[0]).toMatchObject({
      numeroPregunta: 1,
      estadoRespuesta: expect.any(String),
      flags: expect.any(Array),
      candidatas: expect.any(Array)
    });
    expect(creado.body.job.pages[0].responses[0]).toHaveProperty('opcionDetectada');
    expect(creado.body.job.pages[0].responses[0].candidatas).toHaveLength(3);
    const sheetSerial = creado.body.job.pages[0].sheetSerial as string;
    const jobId = creado.body.job.jobId as string;

    const reintentado = await request(app)
      .post('/api/omr/jobs')
      .set(auth)
      .send({
        generatedAssessmentId: escenario.examenId,
        clientRequestId: 'c0d2d9b4-a7b5-4c87-9b9d-2ab9be381238',
        sourceType: 'image_batch',
        capturas: [{ nombreArchivo: 'hoja.png', imagenBase64 }]
      })
      .expect(200);
    expect(reintentado.body.job.jobId).toBe(jobId);
    await request(app)
      .post('/api/omr/jobs')
      .set(auth)
      .send({
        generatedAssessmentId: escenario.examenId,
        clientRequestId: 'c0d2d9b4-a7b5-4c87-9b9d-2ab9be381238',
        sourceType: 'image_batch',
        capturas: [{ nombreArchivo: 'otro.png', imagenBase64 }]
      })
      .expect(409);

    const recuperado = await request(app)
      .get(`/api/omr/jobs/${jobId}`)
      .set(auth)
      .expect(200);
    expect(recuperado.body.job).toMatchObject({ jobId, status: 'completed', pagesTotal: 1 });
    const listado = await request(app)
      .get(`/api/omr/jobs?generatedAssessmentId=${encodeURIComponent(escenario.examenId)}&status=completed&limite=1`)
      .set(auth)
      .expect(200);
    expect(listado.body.jobs).toHaveLength(1);
    expect(listado.body.jobs[0]).toMatchObject({ jobId, assessmentId: escenario.examenId, workflow: 'scan' });
    expect(listado.body.jobs[0]).not.toHaveProperty('pages');
    await request(app).get('/api/omr/jobs?cursor=invalid').set(auth).expect(400);

    const resuelto = await request(app)
      .post(`/api/omr/jobs/${jobId}/exceptions/${encodeURIComponent(sheetSerial)}/resolve`)
      .set(auth)
      .send({
        resolutionReason: 'Validación manual de la hoja',
        finalIdentity: { studentId: 'ALUMNO-OMR' },
        finalResponses: [{ numeroPregunta: 1, opcion: 'A' }],
        overrides: { versionCode: 'A' }
      })
      .expect(200);
    expect(resuelto.body.job.pages[0].scanStatus).toBe('accepted');
    expect(resuelto.body.job.pages[0].identityResult.studentId).toBe('ALUMNO-OMR');
    expect(resuelto.body.job.pages[0].responses[0]).toMatchObject({
      opcion: 'A',
      estadoRespuesta: 'manual_review',
      flags: expect.any(Array),
      candidatas: expect.any(Array)
    });

    const finalizado = await request(app)
      .post(`/api/omr/jobs/${jobId}/finalize`)
      .set(auth)
      .send({})
      .expect(200);
    expect(finalizado.body.job.status).toBe('finalized');

    const segundoToken = await registrar('omr-jobs-b@prueba.test');
    const listaSegundoDocente = await request(app)
      .get('/api/omr/jobs')
      .set({ Authorization: `Bearer ${segundoToken}` })
      .expect(200);
    expect(listaSegundoDocente.body.jobs).toEqual([]);
    await request(app)
      .get(`/api/examenes/generados/${escenario.examenId}`)
      .set({ Authorization: `Bearer ${segundoToken}` })
      .expect(404);
    await request(app)
      .post(`/api/omr/jobs/${jobId}/finalize`)
      .set({ Authorization: `Bearer ${segundoToken}` })
      .send({})
      .expect(404);
    await request(app)
      .get(`/api/omr/jobs/${jobId}`)
      .set({ Authorization: `Bearer ${segundoToken}` })
      .expect(404);
  }, 300_000);

  it('ingresa PDFs grandes por multipart, conserva páginas sin QR y clasifica sin escribir calificaciones', async () => {
    const token = await registrar('omr-jobs-ingesta@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const escenario = await prepararExamen(auth);
    const referencia = await request(app)
      .get(`/api/examenes/generados/${escenario.examenId}/pdf`)
      .set(auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);
    const documentoRespuesta = await PDFDocument.create();
    const [paginaRespuesta] = await documentoRespuesta.copyPages(await PDFDocument.load(referencia.body as Buffer), [0]);
    paginaRespuesta?.setRotation(degrees(270));
    if (paginaRespuesta) documentoRespuesta.addPage(paginaRespuesta);
    const scan = Buffer.from(await documentoRespuesta.save());
    const documentoPaginaVacia = await PDFDocument.create();
    documentoPaginaVacia.addPage([612, 792]);
    const scanPaginaVacia = Buffer.from(await documentoPaginaVacia.save());
    const calificacionesAntes = await prisma.calificacion.count({ where: { examenGeneradoId: escenario.examenId } });

    controlLectorQr.forzarFalloLecturaDirecta = true;
    const creado = await request(app)
      .post('/api/omr/ingestas')
      .set(auth)
      .field('generatedAssessmentId', escenario.examenId)
      .field('clientRequestId', '0ed65266-1404-4293-95a9-6262694f8c21')
      .attach('archivos', scan, { filename: 'respuestas-global.pdf', contentType: 'application/pdf' })
      .attach('archivos', scanPaginaVacia, { filename: 'respuestas-global-continuacion.pdf', contentType: 'application/pdf' })
      .expect(202);
    const jobId = String(creado.body.job.jobId);
    expect(creado.body.job.status).toBe('processing');

    let job = creado.body.job;
    const limite = Date.now() + 600_000;
    while (job.status === 'processing' && Date.now() < limite) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const estado = await request(app).get(`/api/omr/ingestas/${jobId}`).set(auth).expect(200);
      job = estado.body.job;
    }

    controlLectorQr.forzarFalloLecturaDirecta = false;
    expect(job.status).toBe('completed');
    expect(job.pagesTotal).toBe(2);
    expect(job.pages).toHaveLength(2);
    const historial = await request(app)
      .get(`/api/omr/jobs?generatedAssessmentId=${encodeURIComponent(escenario.examenId)}&limite=10`)
      .set(auth)
      .expect(200);
    expect(historial.body.jobs).toEqual(expect.arrayContaining([
      expect.objectContaining({ jobId, assessmentId: escenario.examenId, workflow: 'pdf_ingesta', pagesTotal: 2, status: 'completed' })
    ]));
    expect(historial.body.jobs[0]).not.toHaveProperty('pages');
    expect(historial.body.jobs[0]).not.toHaveProperty('responses');
    expect(historial.body.jobs[0]).not.toHaveProperty('studentName');
    expect(historial.body.jobs[0]).not.toHaveProperty('student');
    expect(job.blindReviewMode).toBe(true);
    expect(job.summary).toEqual({ blindReviewRequired: 2, packages: 1 });
    expect(job.pages[0].examId).toBe(escenario.examenId);
    expect(job.pages[0].scanStatus).toBe('needs_review');
    for (const page of job.pages) {
      expect(page.responses.every((answer: { opcion: string | null; opcionDetectada: string | null; confianza: number; candidatas: unknown[] }) =>
        answer.opcion === null && answer.opcionDetectada === null && answer.confianza === 0 && answer.candidatas.length === 0)).toBe(true);
      expect(page).not.toHaveProperty('ocrSuggestion');
      expect(page).not.toHaveProperty('identityResult');
      expect(page).not.toHaveProperty('exceptions');
    }
    const manifestCiego = await request(app)
      .get(`/api/omr/ingestas/${jobId}/manifiesto`)
      .set(auth)
      .expect(200);
    expect(manifestCiego.body.pages).toHaveLength(2);
    for (const page of manifestCiego.body.pages) {
      expect(page).not.toHaveProperty('status');
      expect(page).not.toHaveProperty('confidence');
      expect(page).not.toHaveProperty('exceptionCodes');
      expect(page).not.toHaveProperty('responses');
    }
    const metadataInternaIngesta = await prisma.omrScanJob.findUniqueOrThrow({ where: { id: jobId } });
    const paginasInternasIngesta = (JSON.parse(String(metadataInternaIngesta.metadata)) as { pages: Array<{ exceptions: Array<{ code: string }> }> }).pages;
    expect(paginasInternasIngesta[0].exceptions.map((item) => item.code)).not.toContain('OMR_QR_NO_VALIDO_O_FUERA_DE_LOTE');
    expect(paginasInternasIngesta[1].exceptions.map((item) => item.code)).toContain('OMR_QR_NO_VALIDO_O_FUERA_DE_LOTE');
    expect(job.packages).toHaveLength(1);
    expect(job.packages[0].fileName).toBe(`alumno-sin-registro-${escenario.folio.toLowerCase()}-${escenario.examenId}.pdf`);
    const categoriasPaquete = String(job.packages[0].relativePath).replace(/\\/g, '/').split('/').slice(-7, -1);
    expect(categoriasPaquete).toEqual(['periodo-omr', 'plantilla-om', 'parcial', 'docente-omr', 'alumno-sin-r', 'sin-grupo']);
    expect(job.files).toHaveLength(2);
    expect(job.files.map((file: { nombre: string }) => file.nombre)).toEqual(['respuestas-global.pdf', 'respuestas-global-continuacion.pdf']);
    expect(job.files[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(job.files.map((file: { pages: number }) => file.pages)).toEqual([1, 1]);
    expect(job.reference.pagesWithQr).toBe(1);
    const recuperado = await request(app)
      .get('/api/omr/ingestas/por-clave/0ed65266-1404-4293-95a9-6262694f8c21')
      .set(auth)
      .expect(200);
    expect(recuperado.body.job.jobId).toBe(jobId);
    const original = await request(app).get(`/api/omr/ingestas/${jobId}/originales/${job.files[0].id}`).set(auth).buffer(true).parse(parsearBinario).expect(200);
    expect(original.body).toEqual(scan);
    const originalContinuacion = await request(app).get(`/api/omr/ingestas/${jobId}/originales/${job.files[1].id}`).set(auth).buffer(true).parse(parsearBinario).expect(200);
    expect(originalContinuacion.body).toEqual(scanPaginaVacia);
    const referenciaVisual = await request(app)
      .get(`/api/omr/ingestas/${jobId}/paginas/${job.pages[0].pageIndex}/reference-preview?generatedAssessmentId=${encodeURIComponent(escenario.examenId)}&examPage=1`)
      .set(auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);
    expect(referenciaVisual.headers['content-type']).toContain('image/png');
    expect(referenciaVisual.headers['cache-control']).toBe('private, no-store');
    expect((referenciaVisual.body as Buffer).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const referenciaVinculada = await request(app)
      .get(`/api/omr/ingestas/${jobId}/paginas/${job.pages[0].pageIndex}/reference-preview`)
      .set(auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);
    expect(referenciaVinculada.body).toEqual(referenciaVisual.body);
    await request(app)
      .get(`/api/omr/ingestas/${jobId}/paginas/${job.pages[0].pageIndex}/reference-preview?generatedAssessmentId=otro-examen&examPage=1`)
      .set(auth)
      .expect(422);
    const referenciaManual = await request(app)
      .get(`/api/omr/ingestas/${jobId}/paginas/${job.pages[1].pageIndex}/reference-preview?generatedAssessmentId=${encodeURIComponent(escenario.examenId)}&examPage=1`)
      .set(auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);
    expect(referenciaManual.body).toEqual(referenciaVisual.body);
    await request(app)
      .get(`/api/omr/ingestas/${jobId}/paginas/${job.pages[1].pageIndex}/reference-preview?generatedAssessmentId=${encodeURIComponent(escenario.examenId)}`)
      .set(auth)
      .expect(400);
    await request(app)
      .get(`/api/omr/ingestas/${jobId}/paginas/${job.pages[1].pageIndex}/reference-preview?generatedAssessmentId=${encodeURIComponent(escenario.examenId)}&examPage=2`)
      .set(auth)
      .expect(422);
    const examenAjenoAlLote = await request(app)
      .get(`/api/omr/ingestas/${jobId}/paginas/${job.pages[1].pageIndex}/reference-preview?generatedAssessmentId=otro-examen&examPage=1`)
      .set(auth)
      .expect(422);
    expect(examenAjenoAlLote.body.error.codigo).toBe('OMR_EXAMEN_FUERA_DE_LOTE');

    const storedJob = await prisma.omrScanJob.findUniqueOrThrow({ where: { id: jobId } });
    const legacyMetadata = JSON.parse(String(storedJob.metadata)) as { reference: { pageMap?: Record<string, number[]> } };
    delete legacyMetadata.reference.pageMap;
    await prisma.omrScanJob.update({ where: { id: jobId }, data: { metadata: JSON.stringify(legacyMetadata) } });
    const legacyReferencePreview = await request(app)
      .get(`/api/omr/ingestas/${jobId}/paginas/${job.pages[0].pageIndex}/reference-preview`)
      .set(auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);
    expect(legacyReferencePreview.body).toEqual(referenciaVisual.body);

    const otroDocente = { Authorization: `Bearer ${await registrar('omr-jobs-otro@prueba.test')}` };
    await request(app)
      .get(`/api/omr/ingestas/${jobId}/paginas/${job.pages[0].pageIndex}/reference-preview?generatedAssessmentId=${encodeURIComponent(escenario.examenId)}&examPage=1`)
      .set(otroDocente)
      .expect(404);

    const manifiesto = await request(app)
      .get(`/api/omr/ingestas/${jobId}/manifiesto`)
      .set(auth)
      .expect(200);
    expect(manifiesto.body.pages).toHaveLength(2);
    const paquete = await request(app)
      .get(`/api/omr/ingestas/${jobId}/paquetes/${job.packages[0].id}`)
      .set(auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);
    expect((await PDFDocument.load(paquete.body as Buffer)).getPageCount()).toBe(1);
    const paqueteAntesDeResolver = job.packages[0];
    const clasificacionManual = await request(app)
      .post(`/api/omr/ingestas/${jobId}/paginas/${job.pages[0].pageIndex}/resolver`)
      .set(auth)
      .send({ generatedAssessmentId: escenario.examenId, examPage: 1, resolutionReason: 'Revisión manual de reemplazo del paquete.' })
      .expect(200);
    const paqueteReclasificado = clasificacionManual.body.job.packages[0];
    expect(paqueteReclasificado.id).toBe(paqueteAntesDeResolver.id);
    expect(paqueteReclasificado.relativePath).not.toBe(paqueteAntesDeResolver.relativePath);
    expect(String(paqueteReclasificado.relativePath).replace(/\\/g, '/').split('/').slice(-7, -1))
      .toEqual(['periodo-omr', 'plantilla-om', 'parcial', 'docente-omr', 'alumno-sin-r', 'sin-grupo']);
    expect((await PDFDocument.load((await request(app)
      .get(`/api/omr/ingestas/${jobId}/paquetes/${paqueteReclasificado.id}`)
      .set(auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200)).body as Buffer)).getPageCount()).toBe(1);
    expect(await prisma.calificacion.count({ where: { examenGeneradoId: escenario.examenId } })).toBe(calificacionesAntes);

    const repetido = await request(app)
      .post('/api/omr/ingestas')
      .set(auth)
      .field('generatedAssessmentId', escenario.examenId)
      .field('clientRequestId', '0ed65266-1404-4293-95a9-6262694f8c21')
      .attach('archivos', scan, { filename: 'respuestas-global.pdf', contentType: 'application/pdf' })
      .attach('archivos', scanPaginaVacia, { filename: 'respuestas-global-continuacion.pdf', contentType: 'application/pdf' })
      .expect(200);
    expect(repetido.body.job.jobId).toBe(jobId);
    expect(await prisma.omrScanJob.count({ where: { id: jobId } })).toBe(1);

    const distinto = Buffer.from(await (await PDFDocument.create()).save());
    const conflicto = await request(app)
      .post('/api/omr/ingestas')
      .set(auth)
      .field('generatedAssessmentId', escenario.examenId)
      .field('clientRequestId', '0ed65266-1404-4293-95a9-6262694f8c21')
      .attach('archivos', distinto, { filename: 'otro.pdf', contentType: 'application/pdf' })
      .expect(409);
    expect(conflicto.body.error.codigo).toBe('OMR_INGESTA_IDEMPOTENCY_CONFLICT');
  }, 600_000);

  it('localiza por QR el lote exacto cotejando solo el PDF de referencia y no crea jobs ni calificaciones', async () => {
    const token = await registrar('omr-referencia-prevalidar@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const base = await prepararExamen(auth);
    for (const [index, matricula] of ['CUH512410191', 'CUH512410192'].entries()) {
      await request(app)
        .post('/api/alumnos')
        .set(auth)
        .send({ periodoId: base.periodoId, matricula, nombreCompleto: `Alumno OMR Referencia ${index + 1}`, grupo: 'A' })
        .expect(201);
    }
    const loteId = `OMRREF${Date.now().toString().slice(-8)}`;
    const lote = await request(app)
      .post('/api/examenes/generados/lote')
      .set(auth)
      .send({ plantillaId: base.plantillaId, loteId, confirmarMasivo: true })
      .expect(201);
    const examenes = lote.body.examenesGenerados as Array<{ _id: string }>;
    expect(examenes.length).toBeGreaterThan(1);
    const pdf = await request(app)
      .get(`/api/examenes/generados/lote/${loteId}/pdf`)
      .set(auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);
    const paginasPdfReferencia = (await PDFDocument.load(pdf.body as Buffer)).getPageCount();
    const jobsAntes = await prisma.omrScanJob.count();
    const calificacionesAntes = await prisma.calificacion.count({ where: { examenGeneradoId: { in: examenes.map((examen) => examen._id) } } });
    const idsCandidatos = [
      ...Array.from({ length: 21 }, (_unused, index) => `assessment-candidato-ausente-${String(index + 1).padStart(2, '0')}`),
      examenes[0]!._id,
      examenes[1]!._id,
      base.examenId
    ];
    expect(Buffer.byteLength(JSON.stringify(idsCandidatos))).toBeGreaterThan(200);

    const coincidencia = await request(app)
      .post('/api/omr/ingestas/prevalidar-referencia')
      .set(auth)
      .field('assessmentIds', JSON.stringify(idsCandidatos))
      .attach('referencia', pdf.body as Buffer, { filename: 'referencia-lote.pdf', contentType: 'application/pdf' })
      .expect('Cache-Control', 'private, no-store')
      .expect(200);

    expect(coincidencia.body.candidatesEvaluated).toBe(idsCandidatos.length);
    expect(coincidencia.body.reference.pages).toBe(paginasPdfReferencia);
    expect(coincidencia.body.reference.pagesWithSignedQr).toBe(paginasPdfReferencia);
    expect(coincidencia.body.reference.pagesWithExpectedQrPattern).toBe(paginasPdfReferencia);
    expect(coincidencia.body.reference.pagesWithAmbiguousExpectedQrPatterns).toBe(0);
    expect(coincidencia.body.reference.pagesWithInvalidSignature).toBe(0);
    expect(coincidencia.body.candidateDiagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        loteId,
        structureValid: true,
        expectedPages: paginasPdfReferencia,
        reasons: expect.objectContaining({ qrAusente: 0, qrMalformado: 0, firmaInvalida: 0, geometriaAusente: 0, qrDuplicado: 0 })
      })
    ]));
    expect(coincidencia.body.matches).toEqual([expect.objectContaining({
      assessmentId: examenes[0]!._id,
      loteId,
      examCount: examenes.length,
      expectedPages: paginasPdfReferencia,
      matchedPages: paginasPdfReferencia
    })]);
    expect(JSON.stringify(coincidencia.body)).not.toContain('Alumno OMR Referencia');
    expect(JSON.stringify(coincidencia.body)).not.toContain('payloadSignature');
    expect(await prisma.omrScanJob.count()).toBe(jobsAntes);
    expect(await prisma.calificacion.count({ where: { examenGeneradoId: { in: examenes.map((examen) => examen._id) } } })).toBe(calificacionesAntes);

    const loteAjenoId = `OMRREF${Date.now().toString().slice(-8)}AJ`;
    await request(app)
      .post('/api/examenes/generados/lote')
      .set(auth)
      .send({ plantillaId: base.plantillaId, loteId: loteAjenoId, confirmarMasivo: true })
      .expect(201);
    const pdfAjeno = await request(app)
      .get(`/api/examenes/generados/lote/${loteAjenoId}/pdf`)
      .set(auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);
    const referenciaAjena = await request(app)
      .post('/api/omr/ingestas/prevalidar-referencia')
      .set(auth)
      .field('assessmentIds', JSON.stringify([examenes[0]!._id]))
      .attach('referencia', pdfAjeno.body as Buffer, { filename: 'referencia-otro-lote.pdf', contentType: 'application/pdf' })
      .expect(200);
    expect(referenciaAjena.body.matches).toEqual([]);
    expect(referenciaAjena.body.reference.pagesWithExpectedQrPattern).toBe(0);
    expect(referenciaAjena.body.candidateDiagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ loteId, structureValid: true, expectedPages: paginasPdfReferencia })
    ]));
    expect(await prisma.omrScanJob.count()).toBe(jobsAntes);
    expect(await prisma.calificacion.count({ where: { examenGeneradoId: { in: examenes.map((examen) => examen._id) } } })).toBe(calificacionesAntes);

    const referenciaIncompleta = await PDFDocument.create();
    const documentoReferenciaCompleta = await PDFDocument.load(pdf.body as Buffer);
    if (paginasPdfReferencia > 1) {
      const paginasRecortadas = await referenciaIncompleta.copyPages(documentoReferenciaCompleta, Array.from({ length: paginasPdfReferencia - 1 }, (_unused, index) => index));
      paginasRecortadas.forEach((pagina) => referenciaIncompleta.addPage(pagina));
    } else {
      referenciaIncompleta.addPage([612, 792]);
    }
    const resultadoIncompleto = await request(app)
      .post('/api/omr/ingestas/prevalidar-referencia')
      .set(auth)
      .field('assessmentIds', JSON.stringify([examenes[0]!._id]))
      .attach('referencia', Buffer.from(await referenciaIncompleta.save()), { filename: 'referencia-parcial.pdf', contentType: 'application/pdf' })
      .expect(200);
    expect(resultadoIncompleto.body.matches).toEqual([]);
    expect(resultadoIncompleto.body.reference.pagesWithExpectedQrPattern).toBe(paginasPdfReferencia - 1);
    expect(await prisma.omrScanJob.count()).toBe(jobsAntes);
    expect(await prisma.calificacion.count({ where: { examenGeneradoId: { in: examenes.map((examen) => examen._id) } } })).toBe(calificacionesAntes);
  }, 180_000);

  it('usa el PDF consolidado del lote cuando falta el manifiesto del artefacto', async () => {
    const token = await registrar('omr-jobs-lote-sin-manifiesto@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const base = await prepararExamen(auth);
    for (const [index, matricula] of ['CUH512410181', 'CUH512410182'].entries()) {
      await request(app)
        .post('/api/alumnos')
        .set(auth)
        .send({ periodoId: base.periodoId, matricula, nombreCompleto: `Alumno OMR ${index + 1}`, grupo: 'A' })
        .expect(201);
    }
    const loteId = `OMRREF${Date.now().toString().slice(-8)}`;
    const lote = await request(app)
      .post('/api/examenes/generados/lote')
      .set(auth)
      .send({ plantillaId: base.plantillaId, loteId, confirmarMasivo: true })
      .expect(201);
    const examenes = lote.body.examenesGenerados as Array<{ _id: string }>;
    expect(examenes).toHaveLength(2);
    const pdfLote = await request(app)
      .get(`/api/examenes/generados/lote/${loteId}/pdf`)
      .set(auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);
    const hashLote = String(pdfLote.headers['x-evaluapro-pdf-sha256']);
    await prisma.examenLoteArtefactoPdf.deleteMany({ where: { loteId } });

    const prevalidada = await request(app)
      .post('/api/omr/ingestas/prevalidar-referencia')
      .set(auth)
      .field('assessmentIds', JSON.stringify([examenes[0]!._id]))
      .attach('referencia', pdfLote.body as Buffer, { filename: 'referencia-global.pdf', contentType: 'application/pdf' })
      .expect(200);
    expect(prevalidada.body.matches).toEqual([
      expect.objectContaining({ loteId, expectedPages: 2, matchedPages: 2 })
    ]);

    const creado = await request(app)
      .post('/api/omr/ingestas')
      .set(auth)
      .field('generatedAssessmentId', examenes[0]!._id)
      .field('clientRequestId', '63f39840-8ba4-4de5-b7bd-91a6b4c61f14')
      .attach('archivos', pdfLote.body as Buffer, { filename: 'capturas-globales.pdf', contentType: 'application/pdf' })
      .attach('referencia', pdfLote.body as Buffer, { filename: 'referencia-global.pdf', contentType: 'application/pdf' })
      .expect(202);
    let job = creado.body.job;
    const limite = Date.now() + 600_000;
    while (job.status === 'processing' && Date.now() < limite) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      job = (await request(app).get(`/api/omr/ingestas/${job.jobId}`).set(auth).expect(200)).body.job;
    }

    expect(job.status).toBe('completed');
    expect(job.reference).toMatchObject({ sha256: hashLote, pages: 2, pagesWithQr: 2, origen: 'aportada' });
    expect(job.pages).toHaveLength(2);
    expect(new Set(job.pages.map((page: { examId?: string }) => page.examId))).toEqual(new Set(examenes.map((examen) => examen._id)));
    expect(job.pages.every((page: { examPage?: number; autoGradable?: boolean }) => page.examPage === 1 && page.autoGradable === false)).toBe(true);
    expect(await prisma.calificacion.count({ where: { examenGeneradoId: { in: examenes.map((examen) => examen._id) } } })).toBe(0);

    const pdfParcial = await PDFDocument.create();
    const referenciaCompleta = await PDFDocument.load(pdfLote.body as Buffer);
    const [primeraPagina] = await pdfParcial.copyPages(referenciaCompleta, [0]);
    pdfParcial.addPage(primeraPagina!);
    const referenciaIncompleta = Buffer.from(await pdfParcial.save());
    const incompleto = await request(app)
      .post('/api/omr/ingestas')
      .set(auth)
      .field('generatedAssessmentId', examenes[0]!._id)
      .field('clientRequestId', 'e3260c81-4ae3-4dba-8e44-6ae14799e4e1')
      .attach('archivos', pdfLote.body as Buffer, { filename: 'capturas-globales.pdf', contentType: 'application/pdf' })
      .attach('referencia', referenciaIncompleta, { filename: 'referencia-incompleta.pdf', contentType: 'application/pdf' })
      .expect(202);
    job = incompleto.body.job;
    const limiteIncompleto = Date.now() + 30_000;
    while (job.status === 'processing' && Date.now() < limiteIncompleto) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      job = (await request(app).get(`/api/omr/ingestas/${job.jobId}`).set(auth).expect(200)).body.job;
    }
    expect(job.status).toBe('failed');
    expect(job.errors).toContainEqual(expect.objectContaining({ code: 'OMR_REFERENCIA_NO_COINCIDE_LOTE' }));
    expect(await prisma.calificacion.count({ where: { examenGeneradoId: { in: examenes.map((examen) => examen._id) } } })).toBe(0);
  }, 600_000);

  it('usa el PDF individual cuando el examen tiene loteId pero su origen es individual', async () => {
    const token = await registrar('omr-jobs-pdf-individual@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const escenario = await prepararExamen(auth);
    const examen = await prisma.examenGenerado.findUniqueOrThrow({ where: { id: escenario.examenId } });
    expect(examen.origenGeneracion).toBe('individual');
    expect(examen.loteId).toBeTruthy();

    const pdf = await request(app)
      .get(`/api/examenes/generados/${escenario.examenId}/pdf`)
      .set(auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);
    const creado = await request(app)
      .post('/api/omr/ingestas')
      .set(auth)
      .field('generatedAssessmentId', escenario.examenId)
      .field('clientRequestId', 'f3b5ac5e-6a74-42a4-a7cb-70651c403dbb')
      .attach('archivos', pdf.body as Buffer, { filename: 'captura-individual.pdf', contentType: 'application/pdf' })
      .expect(202);

    let job = creado.body.job;
    const limite = Date.now() + 600_000;
    while (job.status === 'processing' && Date.now() < limite) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      job = (await request(app).get(`/api/omr/ingestas/${job.jobId}`).set(auth).expect(200)).body.job;
    }

    expect(job.status).toBe('completed');
    expect(job.reference.pages).toBe(1);
    expect(job.pages).toHaveLength(1);
    expect(await prisma.calificacion.count({ where: { examenGeneradoId: escenario.examenId } })).toBe(0);
  }, 600_000);

  it('reprocesa una ingesta fallida desde originales verificados sin duplicar páginas ni calificaciones', async () => {
    const token = await registrar('omr-jobs-pdf-retry@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const escenario = await prepararExamen(auth);
    const pdf = await request(app)
      .get(`/api/examenes/generados/${escenario.examenId}/pdf`)
      .set(auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);
    const creado = await request(app)
      .post('/api/omr/ingestas')
      .set(auth)
      .field('generatedAssessmentId', escenario.examenId)
      .field('clientRequestId', '80bce8d8-f415-494a-9a31-a7f7335907d2')
      .attach('archivos', pdf.body as Buffer, { filename: 'captura-reintentable.pdf', contentType: 'application/pdf' })
      .expect(202);

    let job = creado.body.job;
    const limite = Date.now() + 600_000;
    while (job.status === 'processing' && Date.now() < limite) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      job = (await request(app).get(`/api/omr/ingestas/${job.jobId}`).set(auth).expect(200)).body.job;
    }
    expect(job.status).toBe('completed');
    expect(job.pages).toHaveLength(1);
    expect(job.packages).toHaveLength(1);

    const registro = await prisma.omrScanJob.findUniqueOrThrow({ where: { id: job.jobId } });
    const metadata = JSON.parse(String(registro.metadata));
    await prisma.omrScanJob.update({ where: { id: job.jobId }, data: { estado: 'processing', completadoEn: null, metadata: JSON.stringify({ ...metadata, status: 'processing', completedAt: undefined, errors: [] }) } });
    expect(await recuperarIngestasPdfOmrInterrumpidas()).toBe(1);
    job = (await request(app).get(`/api/omr/ingestas/${job.jobId}`).set(auth).expect(200)).body.job;
    expect(job.status).toBe('failed');
    expect(job.errors).toContainEqual(expect.objectContaining({ code: 'OMR_INGESTA_PROCESO_INTERRUMPIDO' }));
    await request(app)
      .get(`/api/omr/ingestas/${job.jobId}/originales/${job.files[0].id}`)
      .set(auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);

    const retryId = '02bc53df-64bb-43bf-a99c-21529a97ae33';
    const reintento = await request(app)
      .post(`/api/omr/ingestas/${job.jobId}/reintentar`)
      .set(auth)
      .send({ clientRequestId: retryId })
      .expect(202);
    job = reintento.body.job;
    expect(job.pagesProcessed).toBe(1);
    expect(job.pages).toHaveLength(1);
    const limiteReintento = Date.now() + 600_000;
    while (job.status === 'processing' && Date.now() < limiteReintento) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      job = (await request(app).get(`/api/omr/ingestas/${job.jobId}`).set(auth).expect(200)).body.job;
    }
    expect(job.status).toBe('completed');
    expect(job.pages).toHaveLength(1);
    expect(job.packages).toHaveLength(1);
    expect(await prisma.calificacion.count({ where: { examenGeneradoId: escenario.examenId } })).toBe(0);

    const recuperado = await request(app)
      .post(`/api/omr/ingestas/${job.jobId}/reintentar`)
      .set(auth)
      .send({ clientRequestId: retryId })
      .expect(200);
    expect(recuperado.body.job.status).toBe('completed');
    expect(recuperado.body.job.pages).toHaveLength(1);
    expect(recuperado.body.job.packages).toHaveLength(1);
    await request(app)
      .post(`/api/omr/ingestas/${job.jobId}/reintentar`)
      .set(auth)
      .send({ clientRequestId: '59f7d702-f577-4be2-8224-e9c5ea1763f0' })
      .expect(409);
  }, 600_000);

  it('rasteriza PDF por página y conserva errores de una captura sin ocultar las demás', async () => {
    const token = await registrar('omr-jobs-pdf@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const escenario = await prepararExamen(auth);
    const pdf = await request(app)
      .get(`/api/examenes/generados/${escenario.examenId}/pdf`)
      .set(auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);
    const pdfDataUrl = `data:application/pdf;base64,${(pdf.body as Buffer).toString('base64')}`;

    const pdfJob = await request(app)
      .post('/api/omr/jobs')
      .set(auth)
      .send({
        generatedAssessmentId: escenario.examenId,
        sourceType: 'pdf',
        capturas: [{ nombreArchivo: 'examen.pdf', imagenBase64: pdfDataUrl }]
      })
      .expect(201);
    expect(pdfJob.body.job.sourceType).toBe('pdf');
    const paginasPdf = Number(pdfJob.body.job.pagesTotal);
    expect(paginasPdf).toBeGreaterThan(0);
    expect(pdfJob.body.job.pages).toHaveLength(paginasPdf);
    expect(pdfJob.body.job.errors).toEqual([]);

    const loteMixto = await request(app)
      .post('/api/omr/jobs')
      .set(auth)
      .send({
        generatedAssessmentId: escenario.examenId,
        sourceType: 'image_batch',
        capturas: [
          { nombreArchivo: 'examen-valido.pdf', imagenBase64: pdfDataUrl },
          { nombreArchivo: 'examen-corrupto.pdf', imagenBase64: 'data:application/pdf;base64,bm90LWEtcGRm' }
        ]
      })
      .expect(201);
    expect(loteMixto.body.job.status).toBe('completed');
    expect(loteMixto.body.job.pagesTotal).toBe(paginasPdf + 1);
    expect(loteMixto.body.job.pages).toHaveLength(paginasPdf + 1);
    expect(loteMixto.body.job.errors).toEqual([
      { pageIndex: paginasPdf + 1, message: 'No se pudo rasterizar el PDF de capturas OMR', nombreArchivo: 'examen-corrupto.pdf' }
    ]);
    const paginaInvalida = loteMixto.body.job.pages[paginasPdf];
    expect(paginaInvalida.scanStatus).toBe('rejected');
    expect(paginaInvalida.exceptions[0]).toMatchObject({
      code: 'OMR_PDF_INVALIDO',
      severity: 'blocking'
    });
    expect(paginaInvalida.sourceFileName).toBe('examen-corrupto.pdf');
    expect(loteMixto.body.job.pages[0].sheetSerial).not.toBe(paginaInvalida.sheetSerial);
  }, 600_000);

  it('permite asociar manualmente una página sin QR, preserva el original y mantiene revisión sin calificar', async () => {
    const token = await registrar('omr-jobs-manual-ingesta@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const escenario = await prepararExamen(auth);
    const paginaEnBlanco = await PDFDocument.create();
    paginaEnBlanco.addPage([612, 792]);
    const scan = Buffer.from(await paginaEnBlanco.save());
    const calificacionesAntes = await prisma.calificacion.count({ where: { examenGeneradoId: escenario.examenId } });
    const creado = await request(app)
      .post('/api/omr/ingestas')
      .set(auth)
      .field('generatedAssessmentId', escenario.examenId)
      .field('clientRequestId', '241ced62-6719-4d98-87d9-037c46ca5b62')
      .attach('archivos', scan, { filename: 'pagina-sin-qr.pdf', contentType: 'application/pdf' })
      .expect(202);
    const jobId = String(creado.body.job.jobId);
    let job = creado.body.job;
    const limite = Date.now() + 600_000;
    while (job.status === 'processing' && Date.now() < limite) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      job = (await request(app).get(`/api/omr/ingestas/${jobId}`).set(auth).expect(200)).body.job;
    }
    expect(job.status).toBe('completed');
    expect(job.pages[0].scanStatus).toBe('needs_review');
    const preview = await request(app)
      .get(`/api/omr/ingestas/${jobId}/paginas/${job.pages[0].pageIndex}/preview`)
      .set(auth).buffer(true).parse(parsearBinario).expect(200);
    expect(preview.headers['content-type']).toMatch(/^image\/png/);
    expect(preview.headers['cache-control']).toBe('private, no-store');
    expect(preview.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.from(preview.body).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    await request(app).get(`/api/omr/ingestas/${jobId}/paginas/2/preview`).set(auth).expect(404);
    const otroDocente = await registrar('omr-preview-otro-docente@prueba.test');
    await request(app).get(`/api/omr/ingestas/${jobId}/paginas/1/preview`).set({ Authorization: `Bearer ${otroDocente}` }).expect(404);
    const originalAntes = await request(app)
      .get(`/api/omr/ingestas/${jobId}/originales/${job.files[0].id}`)
      .set(auth).buffer(true).parse(parsearBinario).expect(200);
    expect(originalAntes.body).toEqual(scan);
    const revisionCiega = await request(app)
      .get(`/api/omr/ingestas/${jobId}`)
      .set(auth)
      .expect(200);
    expect(revisionCiega.body.job.blindReviewMode).toBe(true);
    expect(revisionCiega.body.job.summary).toEqual({ blindReviewRequired: 1, packages: 0 });
    expect(revisionCiega.body.job.pages[0]).toMatchObject({ scanStatus: 'needs_review', confidence: 0, autoGradable: false });
    expect(revisionCiega.body.job.pages[0]).not.toHaveProperty('ocrSuggestion');
    expect(revisionCiega.body.job.pages[0]).not.toHaveProperty('identityResult');
    expect(revisionCiega.body.job.pages[0]).not.toHaveProperty('versionResult');
    expect(revisionCiega.body.job.pages[0].responses).toEqual([]);
    const respuestasManuales = Array.from({ length: preguntasPorEscenario }, (_, index) => ({
      numeroPregunta: index + 1,
      opcion: null,
      tipoMarcaManual: 'blank',
      selectedOptions: [] as string[]
    }));

    await request(app)
      .post(`/api/omr/ingestas/${jobId}/paginas/${job.pages[0].pageIndex}/resolver`)
      .set(auth)
      .send({
        generatedAssessmentId: escenario.examenId,
        examPage: 1,
        resolutionReason: 'Asociación confirmada visualmente contra el original.',
        finalResponses: respuestasManuales
      })
      .expect(400);

    const resuelto = await request(app)
      .post(`/api/omr/ingestas/${jobId}/paginas/${job.pages[0].pageIndex}/resolver`)
      .set(auth)
      .send({
        generatedAssessmentId: escenario.examenId,
        examPage: 1,
        resolutionReason: 'Asociación confirmada visualmente contra el original.',
        confirmOriginalVisualReview: true,
        confirmBlindOmrReview: true,
        finalResponses: respuestasManuales
      });
    expect(resuelto.status, JSON.stringify(resuelto.body)).toBe(200);
    expect(resuelto.body.job.pages[0]).toMatchObject({
      scanStatus: 'needs_review', autoGradable: false, manualReviewRequired: true,
      examId: escenario.examenId, examPage: 1, identitySource: 'manual'
    });
    expect(resuelto.body.job.pages[0].humanReview).toMatchObject({
      method: 'visual_original_capture', independentOfOmr: true, omrPredictionsHidden: true,
      reviewerAttested: true,
      reviewerIdHash: expect.stringMatching(/^[a-f0-9]{64}$/i),
      reviewedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    });
    expect(resuelto.body.job.pages[0].responses[0]).toMatchObject({
      numeroPregunta: 1,
      opcion: null,
      estadoRespuesta: 'manual_review',
      confianza: 0,
      candidatas: []
    });
    expect(resuelto.body.job.pages[0].responses[0]).toHaveProperty('opcionDetectada', null);
    expect(resuelto.body.job.packages).toHaveLength(1);
    expect(resuelto.body.job.packages[0].status).toBe('needs_review');
    expect(resuelto.body.job.packages[0].fileName).toMatch(new RegExp(`^alumno-sin-registro-${escenario.folio.toLowerCase()}-${escenario.examenId}-[0-9a-f-]{36}\\.pdf$`));
    expect(String(resuelto.body.job.packages[0].relativePath).replace(/\\/g, '/').split('/').slice(-7, -1))
      .toEqual(['periodo-omr', 'plantilla-om', 'parcial', 'docente-omr', 'alumno-sin-r', 'sin-grupo']);
    const estadoPersistidoAntesDeEtiqueta = await prisma.omrScanJob.findUniqueOrThrow({ where: { id: jobId } });
    const prediccionesAntesDeEtiqueta = (JSON.parse(String(estadoPersistidoAntesDeEtiqueta.metadata)) as { pages: Array<{ responses: unknown[] }> }).pages[0].responses;
    const paquetesAntesDeEtiqueta = structuredClone(resuelto.body.job.packages);
    await request(app)
      .post(`/api/omr/ingestas/${jobId}/paginas/${job.pages[0].pageIndex}/verdad-terreno`)
      .set(auth)
      .send({ confirmOriginalVisualReview: true, confirmBlindOmrReview: true, finalResponses: respuestasManuales })
      .expect(422);
    const etiquetaCiega = await request(app)
      .post(`/api/omr/ingestas/${jobId}/paginas/${job.pages[0].pageIndex}/verdad-terreno`)
      .set(auth)
      .send({
        bonusVisible: false,
        confirmOriginalVisualReview: true,
        confirmBlindOmrReview: true,
        finalResponses: respuestasManuales
      })
      .expect(200);
    expect(etiquetaCiega.body.job.pages[0].groundTruthReview).toMatchObject({
      humanReview: {
        method: 'visual_original_capture', independentOfOmr: true, omrPredictionsHidden: true,
        reviewerAttested: true,
        reviewerIdHash: expect.stringMatching(/^[a-f0-9]{64}$/i),
        reviewedAt: expect.stringMatching(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T/)
      },
      responses: expect.arrayContaining([expect.objectContaining({ numeroPregunta: 1, opcion: null, tipoMarcaManual: 'blank', estadoRespuesta: 'manual_review' })])
    });
    expect(etiquetaCiega.body.job.pages[0].responses).toEqual(resuelto.body.job.pages[0].responses);
    expect(etiquetaCiega.body.job.pages[0].groundTruthReview.bonusVisible).toBe(false);
    expect(etiquetaCiega.body.job.pages[0].scanStatus).toBe(resuelto.body.job.pages[0].scanStatus);
    expect(etiquetaCiega.body.job.packages).toEqual(paquetesAntesDeEtiqueta);
    const estadoPersistidoDespuesDeEtiqueta = await prisma.omrScanJob.findUniqueOrThrow({ where: { id: jobId } });
    expect((JSON.parse(String(estadoPersistidoDespuesDeEtiqueta.metadata)) as { pages: Array<{ responses: unknown[] }> }).pages[0].responses)
      .toEqual(prediccionesAntesDeEtiqueta);
    const reintentoEtiquetaCiega = await request(app)
      .post(`/api/omr/ingestas/${jobId}/paginas/${job.pages[0].pageIndex}/verdad-terreno`)
      .set(auth)
      .send({ bonusVisible: false, confirmOriginalVisualReview: true, confirmBlindOmrReview: true, finalResponses: respuestasManuales })
      .expect(200);
    expect(reintentoEtiquetaCiega.body.repeated).toBe(true);
    await request(app)
      .post(`/api/omr/ingestas/${jobId}/paginas/${job.pages[0].pageIndex}/verdad-terreno`)
      .set(auth)
      .send({ bonusVisible: true, confirmOriginalVisualReview: true, confirmBlindOmrReview: true, finalResponses: respuestasManuales })
      .expect(409);
    await request(app)
      .post(`/api/omr/ingestas/${jobId}/paginas/${job.pages[0].pageIndex}/verdad-terreno`)
      .set(auth)
      .send({
        bonusVisible: false,
        confirmOriginalVisualReview: true,
        confirmBlindOmrReview: true,
        finalResponses: respuestasManuales.map((answer, index) => index === 0 ? { numeroPregunta: answer.numeroPregunta, opcion: 'B', tipoMarcaManual: 'valid', selectedOptions: ['B'] } : answer)
      })
      .expect(409);
    const originalDespues = await request(app)
      .get(`/api/omr/ingestas/${jobId}/originales/${job.files[0].id}`)
      .set(auth).buffer(true).parse(parsearBinario).expect(200);
    expect(originalDespues.body).toEqual(scan);
    expect(await prisma.calificacion.count({ where: { examenGeneradoId: escenario.examenId } })).toBe(calificacionesAntes);
    const exportado = await request(app)
      .post(`/api/omr/ingestas/${jobId}/dataset-export`)
      .set(auth)
      .send({ pageIndexes: [job.pages[0].pageIndex], confirmarDatosIdentificables: true })
      .buffer(true).parse(parsearBinario).expect(200);
    const entradas = extraerEntradasZip(exportado.body);
    const importJson = JSON.parse(entradas.get('pilot-real/pilot_import.json')?.toString('utf8') ?? '{}') as {
      datasetType?: string;
      answerKeyByFolio?: Record<string, Record<string, string>>;
      captures?: Array<{ imageSourcePath: string; mapaOmrSourcePath: string; truthRows: Array<{ markType: string; sourceEvidence: { detector: string } }> }>;
    };
    const captura = importJson.captures?.[0];
    const examenFirmado = await prisma.examenGenerado.findUniqueOrThrow({ where: { id: escenario.examenId } });
    const manifestFirmado = JSON.parse(String(examenFirmado.recoveryManifest)) as { answerKeySnapshot: { entries: Array<{ visibleNumber: number; correctLetterVisible: string }> } };
    const claveFirmada = Object.fromEntries(manifestFirmado.answerKeySnapshot.entries.map((entry) => [entry.visibleNumber, entry.correctLetterVisible]));
    expect(importJson.datasetType).toBe('tv4_pilot_real_import');
    expect(importJson.answerKeyByFolio?.[escenario.folio]).toEqual(claveFirmada);
    expect(captura?.truthRows).toHaveLength(preguntasPorEscenario);
    expect(captura?.truthRows.every((row) => row.markType === 'blank' && row.sourceEvidence.detector === 'manual_visual_review')).toBe(true);
    expect(entradas.get(`pilot-real/${captura?.imageSourcePath}`)?.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(entradas.has(`pilot-real/${captura?.mapaOmrSourcePath}`)).toBe(true);
    const importRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-omr-export-import-'));
    try {
      for (const [entryName, bytes] of entradas) {
        if (!entryName.startsWith('pilot-real/')) continue;
        const target = path.join(importRoot, entryName.slice('pilot-real/'.length));
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, bytes);
      }
      const { buildFromImportManifest } = await import('../../scripts/omr-tv4-build-pilot-real.js');
      const builtRoot = path.join(importRoot, 'built');
      await fs.mkdir(builtRoot, { recursive: true });
      const built = await buildFromImportManifest(builtRoot, path.join(importRoot, 'pilot_import.json'));
      expect(built).toMatchObject({ captures: 1, questions: preguntasPorEscenario, imported: true });
      const pilotManifest = JSON.parse(await fs.readFile(path.join(builtRoot, 'manifest.json'), 'utf8')) as { capturas: unknown[]; answerKeyByFolioPath?: string };
      expect(pilotManifest.capturas).toHaveLength(1);
      expect(pilotManifest.answerKeyByFolioPath).toBe('answer_key_by_folio.json');
    } finally {
      await fs.rm(importRoot, { recursive: true, force: true });
    }
  }, 600_000);

  it('sugiere identidad local por OCR del pie sin validar QR ni asignar identidad automáticamente', async () => {
    const token = await registrar('omr-jobs-ocr-pie@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const escenario = await prepararExamen(auth);
    // Folios hex aleatorios hacen variable la legibilidad sintética; usar dígitos
    // mantiene reproducible la prueba del flujo (la confusión OCR se prueba aparte).
    const folioPrueba = Date.now().toString();
    await prisma.examenGenerado.update({ where: { id: escenario.examenId }, data: { folio: folioPrueba } });
    escenario.folio = folioPrueba;
    const pdfSinQr = await PDFDocument.create();
    const pagina = pdfSinQr.addPage([612, 792]);
    pagina.drawText(`${escenario.folio} · Pagina 1`, { x: 61, y: 27, size: 7 });
    pagina.drawText(`${escenario.folio} · Pagina 1`, { x: 318, y: 27, size: 7 });
    const scan = Buffer.from(await pdfSinQr.save());
    const calificacionesAntes = await prisma.calificacion.count({ where: { examenGeneradoId: escenario.examenId } });

    const creado = await request(app)
      .post('/api/omr/ingestas')
      .set(auth)
      .field('generatedAssessmentId', escenario.examenId)
      .field('clientRequestId', 'b2bf7a40-47bd-47f8-84ea-dfb514c41ba0')
      .attach('archivos', scan, { filename: 'pagina-sin-qr-pie-legible.pdf', contentType: 'application/pdf' })
      .expect(202);
    const jobId = String(creado.body.job.jobId);
    let job = creado.body.job;
    const limite = Date.now() + 120_000;
    while (job.status === 'processing' && Date.now() < limite) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      job = (await request(app).get(`/api/omr/ingestas/${jobId}`).set(auth).expect(200)).body.job;
    }

    expect(job.status).toBe('completed');
    expect(job.pages[0]).toMatchObject({ scanStatus: 'needs_review', autoGradable: false, manualReviewRequired: true });
    expect(job.pages[0]).not.toHaveProperty('ocrSuggestion');
    expect(job.pages[0]).not.toHaveProperty('exceptions');
    const estadoInternoOcr = await prisma.omrScanJob.findUniqueOrThrow({ where: { id: jobId } });
    const metadataInternaOcr = JSON.parse(String(estadoInternoOcr.metadata)) as { pages: Array<{ ocrSuggestion?: unknown; exceptions: Array<{ code: string }> }> };
    expect(metadataInternaOcr.pages[0].ocrSuggestion).toMatchObject({
      generatedAssessmentId: escenario.examenId,
      folio: escenario.folio,
      examPage: 1,
      source: 'ocr_two_position_consensus',
      matchingPositions: 2,
      confidence: expect.any(Number)
    });
    expect(job.pages[0]).not.toHaveProperty('exceptions');
    expect(metadataInternaOcr.pages[0].exceptions.map((item) => item.code)).toEqual([
      'OMR_QR_NO_VALIDO_O_FUERA_DE_LOTE', 'OMR_OCR_IDENTIDAD_SUGERIDA'
    ]);
    expect(job.pages[0].examId).toBeUndefined();
    expect(job.pages[0].examPage).toBeUndefined();
    expect(await prisma.calificacion.count({ where: { examenGeneradoId: escenario.examenId } })).toBe(calificacionesAntes);
  }, 180_000);

  it('rechaza los límites de cantidad de PDF y páginas antes de crear un job', async () => {
    const token = await registrar('omr-jobs-limites@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const escenario = await prepararExamen(auth);
    const documento = await PDFDocument.create();
    documento.addPage([612, 792]);
    const pdfUnaPagina = Buffer.from(await documento.save());
    const jobsAntes = await prisma.omrScanJob.count();

    const demasiadosArchivos = request(app)
      .post('/api/omr/ingestas')
      .set(auth)
      .field('generatedAssessmentId', escenario.examenId)
      .field('clientRequestId', '94de8c06-a2d1-4a4b-9f7e-8a44cd35eaae');
    for (let index = 0; index < 11; index += 1) {
      demasiadosArchivos.attach('archivos', pdfUnaPagina, { filename: `scan-${index + 1}.pdf`, contentType: 'application/pdf' });
    }
    const respuestaDemasiados = await demasiadosArchivos.expect(413);
    expect(respuestaDemasiados.body.error.codigo).toBe('OMR_PDF_CANTIDAD_INVALIDA');
    expect(await prisma.omrScanJob.count()).toBe(jobsAntes);

    const documentoExcedido = await PDFDocument.create();
    for (let index = 0; index < 601; index += 1) documentoExcedido.addPage([612, 792]);
    const pdf601Paginas = Buffer.from(await documentoExcedido.save());
    const respuestaDemasiadasPaginas = await request(app)
      .post('/api/omr/ingestas')
      .set(auth)
      .field('generatedAssessmentId', escenario.examenId)
      .field('clientRequestId', '0ec0df14-227f-4680-aa7d-a2d2412871a4')
      .attach('archivos', pdf601Paginas, { filename: 'scan-601-paginas.pdf', contentType: 'application/pdf' })
      .expect(413);
    expect(respuestaDemasiadasPaginas.body.error.codigo).toBe('OMR_PDF_PAGINAS_INVALIDAS');
    expect(await prisma.omrScanJob.count()).toBe(jobsAntes);
  }, 120_000);

  it('hace idempotente la escritura de calificación y rechaza reusar la clave con otro resultado', async () => {
    const token = await registrar('omr-jobs-grade-idempotency@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const escenario = await prepararExamen(auth);
    const alumno = await request(app)
      .post('/api/alumnos')
      .set(auth)
      .send({ periodoId: escenario.periodoId, matricula: 'CUH512410168', nombreCompleto: 'Alumno de prueba', grupo: 'A' })
      .expect(201);
    const payload = {
      examenGeneradoId: escenario.examenId,
      alumnoId: alumno.body.alumno._id,
      aciertos: 3,
      totalReactivos: preguntasPorEscenario,
      clientRequestId: 'a359e1ab-bce1-4e3a-95d2-6c0f91c7d7f9'
    };
    const countAntes = await prisma.calificacion.count({ where: { examenGeneradoId: escenario.examenId } });
    const primera = await request(app).post('/api/calificaciones/calificar').set(auth).send(payload).expect(201);
    const reintento = await request(app).post('/api/calificaciones/calificar').set(auth).send(payload).expect(200);
    expect(reintento.body.calificacion.id).toBe(primera.body.calificacion.id);
    await request(app)
      .post('/api/calificaciones/calificar')
      .set(auth)
      .send({ ...payload, aciertos: 4 })
      .expect(409);
    expect(await prisma.calificacion.count({ where: { examenGeneradoId: escenario.examenId } })).toBe(countAntes + 1);
  }, 120_000);

  it('se abstiene de calificar automáticamente una plantilla inline y no escribe una nota', async () => {
    const token = await registrar('omr-jobs-autograding@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const escenario = await prepararExamen(auth);
    const alumno = await request(app)
      .post('/api/alumnos')
      .set(auth)
      .send({ periodoId: escenario.periodoId, matricula: 'CUH512410168', nombreCompleto: 'Alumno OMR', grupo: 'A' })
      .expect(201);
    await prisma.examenGenerado.update({
      where: { id: escenario.examenId },
      data: { alumnoId: alumno.body.alumno._id }
    });
    const examen = await prisma.examenGenerado.findUniqueOrThrow({ where: { id: escenario.examenId } });
    const mapaOmr = JSON.parse(String(examen.mapaOmr)) as any;
    const paginasEsperadas = mapaOmr.paginas.filter((pagina: any) => pagina.tipoPagina !== 'reverso-vacio');
    const jobId = 'job-lote-elegible-omr';
    const pdfDescargado = await request(app)
      .get(`/api/examenes/generados/${examen.id}/pdf`)
      .set(auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);
    const pdfBytes = pdfDescargado.body as Buffer;
    expect(pdfBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    const packageRelativePath = path.join('omr-ingestas', jobId, 'paquetes', 'examen.pdf');
    const packageAbsolutePath = resolverRutaPdfExamen(packageRelativePath);
    await fs.mkdir(path.dirname(packageAbsolutePath), { recursive: true });
    await fs.writeFile(packageAbsolutePath, pdfBytes);
    const metadata = {
      version: 1,
      assessmentId: examen.id,
      loteId: examen.loteId,
      status: 'completed',
      reference: { nombre: 'referencia.pdf', relativePath: 'referencia.pdf', sha256: 'a'.repeat(64), pages: paginasEsperadas.length, pagesWithQr: paginasEsperadas.length },
      files: [],
      pages: paginasEsperadas.map((pagina: any, indice: number) => ({
        sheetSerial: `${examen.folio}-P${pagina.numeroPagina}`,
        pageIndex: indice + 1,
        sourceFileId: 'source-1',
        sourceFileName: 'capturas.pdf',
        sourcePage: indice + 1,
        scanStatus: 'accepted',
        confidence: 0.99,
        autoGradable: false,
        manualReviewRequired: false,
        examId: examen.id,
        folio: examen.folio,
        examPage: Number(pagina.numeroPagina),
        identityResult: { studentId: alumno.body.alumno._id, studentName: alumno.body.alumno.nombreCompleto },
        responses: [],
        exceptions: []
      })),
      packages: [{
        id: 'package-1', examId: examen.id, fileName: 'examen.pdf', relativePath: packageRelativePath,
        sha256: createHash('sha256').update(pdfBytes).digest('hex'), pageCount: paginasEsperadas.length, status: 'complete',
        course: 'Periodo OMR', subject: 'Plantilla OMR jobs', partial: 'parcial', teacher: 'Docente OMR',
        student: 'Alumno OMR', group: 'A', folio: examen.folio
      }],
      errors: [],
      startedAt: new Date().toISOString()
    };
    await prisma.omrScanJob.create({
      data: { id: jobId, docenteId: examen.docenteId, periodoId: examen.periodoId, plantillaId: examen.plantillaId, estado: 'completed', totalHojas: paginasEsperadas.length, procesadas: paginasEsperadas.length, metadata: JSON.stringify(metadata) }
    });

    try {
      const response = await request(app)
        .post(`/api/omr/ingestas/${jobId}/calificar`)
        .set(auth)
        .send({ clientRequestId: '1f031cf2-f525-4fe4-8484-21e44ed7ff07' })
        .expect(200);
      expect(response.body.autoGrading).toMatchObject({
        status: 'partial',
        results: [{ examId: examen.id, status: 'requires_review', code: 'OMR_REQUIERE_REVISION_MANUAL' }]
      });
      expect(await prisma.calificacion.count({ where: { examenGeneradoId: examen.id } })).toBe(0);
    } finally {
      await fs.rm(path.dirname(path.dirname(packageAbsolutePath)), { recursive: true, force: true });
    }
  }, 120_000);
});
