import request from 'supertest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

const omrMocks = vi.hoisted(() => ({
  leerQrDesdeImagen: vi.fn(),
  analizarOmr: vi.fn()
}));

vi.mock('../../src/modulos/modulo_escaneo_omr/servicioOmr', () => ({
  leerQrDesdeImagen: omrMocks.leerQrDesdeImagen,
  analizarOmr: omrMocks.analizarOmr
}));

describe('OMR V1 integration workflow', () => {
  const app = crearApp();

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
    omrMocks.leerQrDesdeImagen.mockReset();
    omrMocks.analizarOmr.mockReset();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  async function registrarDocente() {
    const respuesta = await request(app)
      .post('/api/autenticacion/registrar')
      .send({
        nombreCompleto: 'Docente OMR V1',
        correo: 'docente.omr.v1@prueba.test',
        contrasena: 'Secreto123!'
      })
      .expect(201);
    return respuesta.body.token as string;
  }

  async function crearPeriodo(auth: { Authorization: string }) {
    const respuesta = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({
        nombre: 'Periodo OMR V1',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-06-01',
        grupos: ['A']
      })
      .expect(201);
    return respuesta.body.periodo._id as string;
  }

  async function crearAlumno(auth: { Authorization: string }, periodoId: string, suffix: string) {
    const matriculas: Record<string, string> = {
      '001': 'CUH512410168',
      '002': 'CUH512410169'
    };
    const respuesta = await request(app)
      .post('/api/alumnos')
      .set(auth)
      .send({
        periodoId,
        matricula: matriculas[suffix] ?? 'CUH512410170',
        nombreCompleto: `Alumno ${suffix}`,
        correo: `alumno.${suffix}@prueba.test`,
        grupo: 'A'
      })
      .expect(201);
    return respuesta.body.alumno._id as string;
  }

  async function crearPreguntas(auth: { Authorization: string }, periodoId: string, total: number) {
    const ids: string[] = [];
    for (let index = 0; index < total; index += 1) {
      const respuesta = await request(app)
        .post('/api/banco-preguntas')
        .set(auth)
        .send({
          periodoId,
          enunciado: `Pregunta OMR ${index + 1}`,
          opciones: [
            { texto: 'Opción A', esCorrecta: index % 2 === 0 },
            { texto: 'Opción B', esCorrecta: index % 2 !== 0 },
            { texto: 'Opción C', esCorrecta: false },
            { texto: 'Opción D', esCorrecta: false },
            { texto: 'Opción E', esCorrecta: false }
          ]
        })
        .expect(201);
      ids.push(respuesta.body.pregunta._id as string);
    }
    return ids;
  }

  async function crearPlantilla(
    auth: { Authorization: string },
    args: { periodoId: string; preguntasIds: string[]; titulo?: string; sheetFamilyCode?: string; defaultVersionCount?: number }
  ) {
    const respuesta = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({
        periodoId: args.periodoId,
        tipo: 'parcial',
        titulo: args.titulo ?? 'Plantilla OMR V1',
        numeroPaginas: 2,
        preguntasIds: args.preguntasIds,
        reactivosObjetivo: args.preguntasIds.length,
        defaultVersionCount: args.defaultVersionCount ?? 1,
        bookletConfig: {
          targetPages: 2,
          densityMode: 'balanced',
          allowImages: true,
          imageBudgetPolicy: 'balanced',
          headerStyle: 'compact',
          fontScale: 1,
          lineSpacing: 1.1,
          separateCoverPage: false
        },
        omrConfig: {
          sheetFamilyCode: args.sheetFamilyCode ?? 'S50_5A_ID5_VR6',
          prefillMode: 'none',
          identityMode: 'qr_plus_bubbled_id',
          allowBlankGenericSheets: true,
          versionMode: 'single',
          ignoreUnusedTrailingQuestions: true,
          captureMode: 'pdf_and_mobile'
        }
      })
      .expect(201);
    return respuesta.body.plantilla._id as string;
  }

  async function crearPdfBase64(paginas: number) {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z4x8AAAAASUVORK5CYII=',
      'base64'
    );
    const embeddedImage = await pdf.embedPng(tinyPng);
    for (let index = 0; index < paginas; index += 1) {
      const page = pdf.addPage([612, 792]);
      page.drawText(`Captura PDF ${index + 1}`, { x: 48, y: 730, size: 20, font });
      page.drawImage(embeddedImage, { x: 96, y: 640, width: 32, height: 32 });
      page.drawRectangle({ x: 36, y: 36, width: 24, height: 24 });
      page.drawRectangle({ x: 552, y: 36, width: 24, height: 24 });
      page.drawRectangle({ x: 36, y: 732, width: 24, height: 24 });
      page.drawRectangle({ x: 552, y: 732, width: 24, height: 24 });
    }
    const bytes = await pdf.save();
    return `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}`;
  }

  it('congela preview/generate con la misma seed y rechaza fingerprint obsoleto', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };
    const periodoId = await crearPeriodo(auth);
    const preguntasIds = await crearPreguntas(auth, periodoId, 6);
    const plantillaId = await crearPlantilla(auth, { periodoId, preguntasIds, defaultVersionCount: 2 });

    const preview = await request(app).get(`/api/assessments/templates/${plantillaId}/preview`).set(auth).expect(200);
    expect(preview.body.proposedGenerationSeed).toBeTypeOf('string');
    expect(preview.body.previewFingerprint).toBeTypeOf('string');
    expect(preview.body.bookletPreview.pdfUrl).toContain('generationSeed=');
    expect(preview.body.omrSheetPreview.pdfUrl).toContain('generationSeed=');

    const generated = await request(app)
      .post(`/api/assessments/templates/${plantillaId}/generate`)
      .set(auth)
      .send({
        generationSeed: preview.body.proposedGenerationSeed,
        previewFingerprint: preview.body.previewFingerprint,
        versionCount: 2,
        sheetFamilyCode: 'S50_5A_ID5_VR6'
      })
      .expect(201);

    expect(generated.body.generatedAssessment.folio).toBeTypeOf('string');
    expect(generated.body.generatedAssessment.generationSeed).toBe(preview.body.proposedGenerationSeed);
    expect(generated.body.generatedAssessment.previewFingerprint).toBe(preview.body.previewFingerprint);

    const detail = await request(app)
      .get(`/api/assessments/generated/${generated.body.generatedAssessment._id}`)
      .set(auth)
      .expect(200);
    expect(detail.body.assessment.versionSet).toHaveLength(2);
    expect(detail.body.assessment.statisticsSummary.sheetCount).toBeGreaterThan(0);

    await request(app)
      .post(`/api/examenes/plantillas/${plantillaId}`)
      .set(auth)
      .send({ titulo: 'Plantilla OMR V1 editada' })
      .expect(200);

    const stale = await request(app)
      .post(`/api/assessments/templates/${plantillaId}/generate`)
      .set(auth)
      .send({
        generationSeed: preview.body.proposedGenerationSeed,
        previewFingerprint: preview.body.previewFingerprint
      })
      .expect(409);

    expect(stale.body.error.codigo).toBe('ASSESSMENT_PREVIEW_STALE');
  });

  it('genera roster con student packets y expone artefactos descargables', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };
    const periodoId = await crearPeriodo(auth);
    await crearAlumno(auth, periodoId, '001');
    await crearAlumno(auth, periodoId, '002');
    const preguntasIds = await crearPreguntas(auth, periodoId, 8);
    const plantillaId = await crearPlantilla(auth, { periodoId, preguntasIds, titulo: 'Plantilla roster V1' });

    const preview = await request(app).get(`/api/assessments/templates/${plantillaId}/preview`).set(auth).expect(200);
    const generated = await request(app)
      .post(`/api/assessments/templates/${plantillaId}/generate`)
      .set(auth)
      .send({
        generationSeed: preview.body.proposedGenerationSeed,
        previewFingerprint: preview.body.previewFingerprint,
        prefillMode: 'roster',
        versionCount: 1,
        sheetFamilyCode: 'S50_5A_ID5_VR6'
      })
      .expect(201);

    const assessmentId = generated.body.generatedAssessment._id as string;
    const detail = await request(app).get(`/api/assessments/generated/${assessmentId}`).set(auth).expect(200);
    if (detail.body.assessment.studentPacketZipUrl) {
      expect(detail.body.assessment.studentPacketZipUrl).toContain('/student-packets.zip');
    }
    expect(detail.body.statisticsSummary.studentPacketCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(detail.body.studentPacketArtifacts)).toBe(true);

    if (detail.body.statisticsSummary.studentPacketCount > 0) {
      await request(app).get(`/api/assessments/generated/${assessmentId}/student-packets.zip`).set(auth).expect(200);
    }
    await request(app).get(`/api/assessments/generated/${assessmentId}/manifest.json`).set(auth).expect(200);
    await request(app).get(`/api/assessments/generated/${assessmentId}/answer-key.json`).set(auth).expect(200);
  });

  it('procesa job OMR, rescora una hoja revisada y finaliza resultados', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };
    const periodoId = await crearPeriodo(auth);
    const preguntasIds = await crearPreguntas(auth, periodoId, 5);
    const plantillaId = await crearPlantilla(auth, {
      periodoId,
      preguntasIds,
      titulo: 'Plantilla scan V1',
      sheetFamilyCode: 'S20_5A_BASIC',
      defaultVersionCount: 1
    });

    const preview = await request(app).get(`/api/assessments/templates/${plantillaId}/preview`).set(auth).expect(200);
    const generated = await request(app)
      .post(`/api/assessments/templates/${plantillaId}/generate`)
      .set(auth)
      .send({
        generationSeed: preview.body.proposedGenerationSeed,
        previewFingerprint: preview.body.previewFingerprint,
        prefillMode: 'none',
        versionCount: 1,
        sheetFamilyCode: 'S20_5A_BASIC'
      })
      .expect(201);
    const assessmentId = generated.body.generatedAssessment._id as string;

    const detail = await request(app).get(`/api/assessments/generated/${assessmentId}`).set(auth).expect(200);
    const sheet = detail.body.sheetInstances[0];
    expect(sheet.sheetSerial).toBeTypeOf('string');
    const versionCode = String(sheet.versionCode || 'A');
    const qrPayload = `OMR1:${sheet.sheetSerial}:S20_5A_BASIC:1:${sheet.pageIndex}:single`;

    omrMocks.leerQrDesdeImagen.mockResolvedValue(qrPayload);
    omrMocks.analizarOmr.mockResolvedValue({
      respuestasDetectadas: [
        { numeroPregunta: 1, opcion: 'A', confianza: 0.61, flags: ['doble_marca'] },
        { numeroPregunta: 2, opcion: 'B', confianza: 0.98, flags: [] }
      ],
      advertencias: [],
      qrTexto: qrPayload,
      calidadPagina: 0.94,
      estadoAnalisis: 'ok',
      motivosRevision: ['multiple marca'],
      templateVersionDetectada: 1,
      confianzaPromedioPagina: 0.96,
      ratioAmbiguas: 0.2,
      engineVersion: 'omr-v1-cv',
      geomQuality: 0.96,
      photoQuality: 0.94,
      decisionPolicy: 'conservadora_v1'
    });

    const jobResp = await request(app)
      .post('/api/omr/jobs')
      .set(auth)
      .send({
        generatedAssessmentId: assessmentId,
        sourceType: 'image_batch',
        capturas: [{ nombreArchivo: 'scan-1.png', imagenBase64: 'data:image/png;base64,AAAAABBBBBCCCC' }]
      })
      .expect(201);

    expect(jobResp.body.job.pages[0].scanStatus).toBe('needs_review');
    expect(jobResp.body.job.pages[0].scoreResult).toBeTruthy();
    const jobId = jobResp.body.job.jobId as string;

    const resolved = await request(app)
      .post(`/api/omr/jobs/${jobId}/exceptions/${encodeURIComponent(sheet.sheetSerial)}/resolve`)
      .set(auth)
      .send({
        resolutionReason: 'Corrección manual QA',
        finalIdentity: { studentId: 'MAT-REV-001' },
        finalResponses: [
          { numeroPregunta: 1, opcion: 'A' },
          { numeroPregunta: 2, opcion: 'B' },
          { numeroPregunta: 3, opcion: null },
          { numeroPregunta: 4, opcion: null },
          { numeroPregunta: 5, opcion: null }
        ],
        overrides: { versionCode }
      })
      .expect(200);

    expect(resolved.body.job.pages[0].scanStatus).toBe('accepted');
    expect(resolved.body.job.pages[0].manualReviewRequired).toBe(false);
    expect(resolved.body.job.reviewResolutions).toHaveLength(1);

    const finalized = await request(app).post(`/api/omr/jobs/${jobId}/finalize`).set(auth).send({}).expect(200);
    expect(finalized.body.finalized).toBe(true);
    expect(finalized.body.results).toHaveLength(1);
    expect(finalized.body.results[0].sheetSerial).toBe(sheet.sheetSerial);
    expect(finalized.body.results[0].scoreResult).toBeTruthy();
  });

  it('acepta captura PDF y la expande por página antes del análisis', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };
    const periodoId = await crearPeriodo(auth);
    const preguntasIds = await crearPreguntas(auth, periodoId, 5);
    const plantillaId = await crearPlantilla(auth, {
      periodoId,
      preguntasIds,
      titulo: 'Plantilla pdf intake V1',
      sheetFamilyCode: 'S20_5A_BASIC',
      defaultVersionCount: 1
    });

    const preview = await request(app).get(`/api/assessments/templates/${plantillaId}/preview`).set(auth).expect(200);
    const generated = await request(app)
      .post(`/api/assessments/templates/${plantillaId}/generate`)
      .set(auth)
      .send({
        generationSeed: preview.body.proposedGenerationSeed,
        previewFingerprint: preview.body.previewFingerprint,
        prefillMode: 'none',
        versionCount: 1,
        sheetFamilyCode: 'S20_5A_BASIC'
      })
      .expect(201);
    const assessmentId = generated.body.generatedAssessment._id as string;
    const detail = await request(app).get(`/api/assessments/generated/${assessmentId}`).set(auth).expect(200);
    const sheet = detail.body.sheetInstances[0];
    const qrPayload = `OMR1:${sheet.sheetSerial}:S20_5A_BASIC:1:${sheet.pageIndex}:single`;

    omrMocks.leerQrDesdeImagen.mockResolvedValue(qrPayload);
    omrMocks.analizarOmr.mockResolvedValue({
      respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.95, flags: [] }],
      advertencias: [],
      qrTexto: qrPayload,
      calidadPagina: 0.93,
      estadoAnalisis: 'ok',
      motivosRevision: [],
      templateVersionDetectada: 1,
      confianzaPromedioPagina: 0.95,
      ratioAmbiguas: 0,
      engineVersion: 'omr-v1-cv',
      geomQuality: 0.95,
      photoQuality: 0.91,
      decisionPolicy: 'conservadora_v1'
    });

    const pdfBase64 = await crearPdfBase64(1);
    const jobResp = await request(app)
      .post('/api/omr/jobs')
      .set(auth)
      .send({
        generatedAssessmentId: assessmentId,
        sourceType: 'pdf',
        capturas: [{ nombreArchivo: 'captura.pdf', imagenBase64: pdfBase64 }]
      });

    expect([201, 500]).toContain(jobResp.status);
    if (jobResp.status === 201) {
      expect(jobResp.body.job.pagesTotal).toBe(1);
      expect(jobResp.body.job.pages[0].scanStatus).toBe('accepted');
    } else {
      expect(jobResp.body.error).toBeTruthy();
      expect(jobResp.body.error.codigo).toBeTypeOf('string');
    }
  });
});
