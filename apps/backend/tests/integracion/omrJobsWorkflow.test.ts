/**
 * omrJobsWorkflow.test
 *
 * Responsabilidad: verificar el contrato HTTP del workflow OMR moderno.
 */
import request from 'supertest';
import QRCode from 'qrcode';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo.js';

function parsearBinario(res: NodeJS.ReadableStream, cb: (error: Error | null, body?: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

describe('workflow OMR por jobs', () => {
  const app = crearApp();

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
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
    const preguntasIds: string[] = [];
    for (let index = 0; index < 20; index += 1) {
      const pregunta = await request(app)
        .post('/api/banco-preguntas')
        .set(auth)
        .send({
          periodoId,
          enunciado: `Pregunta OMR ${index + 1}`,
          opciones: [
            { texto: 'A', esCorrecta: true },
            { texto: 'B', esCorrecta: false },
            { texto: 'C', esCorrecta: false },
            { texto: 'D', esCorrecta: false },
            { texto: 'E', esCorrecta: false }
          ]
        })
        .expect(201);
      preguntasIds.push(pregunta.body.pregunta._id as string);
    }
    const plantilla = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({ periodoId, tipo: 'parcial', titulo: 'Plantilla OMR jobs', numeroPaginas: 1, preguntasIds })
      .expect(201);
    const examen = await request(app)
      .post('/api/examenes/generados')
      .set(auth)
      .send({ plantillaId: plantilla.body.plantilla._id })
      .expect(201);
    return {
      examenId: examen.body.examenGenerado._id as string,
      folio: examen.body.examenGenerado.folio as string,
      qrTexto: String(examen.body.examenGenerado.paginas?.[0]?.qrTexto ?? '')
    };
  }

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
        sourceType: 'image_batch',
        capturas: [{ nombreArchivo: 'hoja.png', imagenBase64 }]
      })
      .expect(201);
    expect(creado.body.job.status).toBe('completed');
    expect(creado.body.job.pages).toHaveLength(1);
    const sheetSerial = creado.body.job.pages[0].sheetSerial as string;
    const jobId = creado.body.job.jobId as string;

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

    const finalizado = await request(app)
      .post(`/api/omr/jobs/${jobId}/finalize`)
      .set(auth)
      .send({})
      .expect(200);
    expect(finalizado.body.job.status).toBe('finalized');

    const segundoToken = await registrar('omr-jobs-b@prueba.test');
    await request(app)
      .get(`/api/examenes/generados/${escenario.examenId}`)
      .set({ Authorization: `Bearer ${segundoToken}` })
      .expect(404);
    await request(app)
      .post(`/api/omr/jobs/${jobId}/finalize`)
      .set({ Authorization: `Bearer ${segundoToken}` })
      .send({})
      .expect(404);
  }, 60_000);

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
  }, 60_000);
});
