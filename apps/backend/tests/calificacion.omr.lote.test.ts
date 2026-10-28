import type { Response } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/infraestructura/baseDatos/sqlite.js';
import { calificarIngestaPdfOmr, coincideLecturaCalificacionOmr } from '../src/modulos/modulo_escaneo_omr/controladorIngestaPdfOmr.js';
import type { SolicitudDocente } from '../src/modulos/modulo_autenticacion/middlewareAutenticacion.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from './utils/sqliteTestDatabase.js';

function crearRespuesta() {
  const body: { value?: unknown } = {};
  let statusCode = 0;
  const response = {
    status: vi.fn((value: number) => { statusCode = value; return response; }),
    json: vi.fn((value: unknown) => { body.value = value; return response; })
  } as unknown as Response;
  return { response, body, statusCode: () => statusCode };
}

describe('autocalificación OMR por lote', () => {
  beforeAll(async () => { await conectarSqliteTest(); });
  beforeEach(async () => { await limpiarSqliteTest(); });
  afterAll(async () => { await cerrarSqliteTest(); });

  it('confirma la lectura posterior solo si coinciden nota, bono, aciertos, total y fracción persistida', () => {
    const respuesta = {
      id: 'grade-1', aciertos: 19, totalReactivos: 19, bonoTexto: '0.25',
      calificacionExamenTexto: '5', calificacionExamenFinalTexto: '5',
      fraccion: { numerador: '95', denominador: '19' }
    };
    const persistida = { ...respuesta, fraccion: JSON.stringify(respuesta.fraccion) };

    expect(coincideLecturaCalificacionOmr(respuesta, persistida)).toBe(true);
    expect(coincideLecturaCalificacionOmr(respuesta, { ...persistida, calificacionExamenFinalTexto: '4.9' })).toBe(false);
    expect(coincideLecturaCalificacionOmr(respuesta, { ...persistida, bonoTexto: '0' })).toBe(false);
    expect(coincideLecturaCalificacionOmr(respuesta, { ...persistida, fraccion: '{"numerador":"90","denominador":"18"}' })).toBe(false);
  });

  it('aísla una hoja pendiente y no escribe calificación para ese examen', async () => {
    const docenteId = 'docente-lote-omr';
    const periodoId = 'periodo-lote-omr';
    const alumnoId = 'alumno-lote-omr';
    const plantillaId = 'plantilla-lote-omr';
    const examenId = 'examen-lote-omr';
    const loteId = 'LOTE-AUTOGRADE-01';
    const jobId = 'job-lote-omr';
    await prisma.docente.create({ data: { id: docenteId, nombreCompleto: 'Docente OMR', correo: 'omr-lote@evaluapro.local' } });
    await prisma.periodo.create({ data: {
      id: periodoId, docenteId, nombre: 'Periodo OMR', nombreNormalizado: 'periodo omr',
      fechaInicio: new Date('2026-01-01T00:00:00Z'), fechaFin: new Date('2026-12-31T00:00:00Z'), grupos: '["A"]'
    } });
    await prisma.alumno.create({ data: {
      id: alumnoId, periodoId, matricula: 'MAT-OMR-01', nombreCompleto: 'Alumno OMR', correo: 'alumno-omr@evaluapro.local', grupo: 'A'
    } });
    await prisma.examenPlantilla.create({ data: {
      id: plantillaId, docenteId, periodoId, tipo: 'parcial', titulo: 'Parcial OMR', tituloNormalizado: 'parcial omr',
      numeroPaginas: 1, bookletConfig: '{}', omrConfig: '{}', configuracionPdf: '{}'
    } });
    const examen = await prisma.examenGenerado.create({ data: {
      id: examenId, docenteId, periodoId, plantillaId, alumnoId, loteId, folio: 'FOL-OMR-01', estado: 'entregado',
      mapaVariante: JSON.stringify({ ordenPreguntas: ['pregunta-1'], ordenOpcionesPorPregunta: { 'pregunta-1': [0, 1, 2, 3, 4] } }),
      mapaOmr: JSON.stringify({ templateId: 'omr-canonical-v4', templateVersion: 4, paginas: [{ numeroPagina: 1, tipoPagina: 'respuestas' }] })
    } });
    await prisma.omrScanJob.create({ data: {
      id: jobId, docenteId, periodoId, plantillaId, estado: 'completed', totalHojas: 1, procesadas: 1,
      metadata: JSON.stringify({
        version: 1, assessmentId: examen.id, loteId, status: 'completed',
        reference: { nombre: 'referencia.pdf', relativePath: 'referencia.pdf', sha256: 'a'.repeat(64), pages: 1, pagesWithQr: 1 },
        files: [], packages: [], errors: [], startedAt: new Date().toISOString(),
        pages: [{
          sheetSerial: 'FOL-OMR-01-P1', pageIndex: 1, sourceFileId: '1', sourceFileName: 'captura.pdf', sourcePage: 1,
          scanStatus: 'needs_review', confidence: 0.7, autoGradable: false, manualReviewRequired: true,
          examId: examen.id, folio: examen.folio, examPage: 1, identityResult: { studentId: alumnoId, studentName: 'Alumno OMR' }, responses: [], exceptions: []
        }]
      })
    } });

    const req = { docenteId, params: { jobId }, body: { clientRequestId: '7bb8429c-38d6-4972-b38e-85f1629f10b4' } } as unknown as SolicitudDocente;
    const res = crearRespuesta();
    await calificarIngestaPdfOmr(req, res.response);

    expect(res.statusCode()).toBe(200);
    expect((res.body.value as any).autoGrading).toMatchObject({
      status: 'partial',
      results: [{ examId: examen.id, status: 'requires_review', code: 'OMR_PAGINAS_REQUIEREN_REVISION' }]
    });
    expect(await prisma.calificacion.count({ where: { docenteId, examenGeneradoId: examenId } })).toBe(0);
  });

  it('reclama de forma atómica un job ante solicitudes concurrentes con IDs distintos', async () => {
    const docenteId = 'docente-lote-concurrente';
    const periodoId = 'periodo-lote-concurrente';
    const alumnoId = 'alumno-lote-concurrente';
    const plantillaId = 'plantilla-lote-concurrente';
    const examenId = 'examen-lote-concurrente';
    const loteId = 'LOTE-AUTOGRADE-CONCURRENT';
    const jobId = 'job-lote-concurrente';
    await prisma.docente.create({ data: { id: docenteId, nombreCompleto: 'Docente OMR', correo: 'omr-concurrente@evaluapro.local' } });
    await prisma.periodo.create({ data: {
      id: periodoId, docenteId, nombre: 'Periodo OMR', nombreNormalizado: 'periodo omr',
      fechaInicio: new Date('2026-01-01T00:00:00Z'), fechaFin: new Date('2026-12-31T00:00:00Z'), grupos: '["A"]'
    } });
    await prisma.alumno.create({ data: {
      id: alumnoId, periodoId, matricula: 'MAT-OMR-CONCURRENT', nombreCompleto: 'Alumno OMR', correo: 'alumno-concurrente@evaluapro.local', grupo: 'A'
    } });
    await prisma.examenPlantilla.create({ data: {
      id: plantillaId, docenteId, periodoId, tipo: 'parcial', titulo: 'Parcial OMR', tituloNormalizado: 'parcial omr',
      numeroPaginas: 1, bookletConfig: '{}', omrConfig: '{}', configuracionPdf: '{}'
    } });
    const examen = await prisma.examenGenerado.create({ data: {
      id: examenId, docenteId, periodoId, plantillaId, alumnoId, loteId, folio: 'FOL-OMR-CONCURRENT', estado: 'entregado',
      mapaVariante: JSON.stringify({ ordenPreguntas: ['pregunta-1'], ordenOpcionesPorPregunta: { 'pregunta-1': [0, 1, 2, 3, 4] } }),
      mapaOmr: JSON.stringify({ templateId: 'omr-canonical-v4', templateVersion: 4, paginas: [{ numeroPagina: 1, tipoPagina: 'respuestas' }] })
    } });
    const metadata = JSON.stringify({
      version: 1, assessmentId: examen.id, loteId, status: 'completed',
      reference: { nombre: 'referencia.pdf', relativePath: 'referencia.pdf', sha256: 'a'.repeat(64), pages: 1, pagesWithQr: 1 },
      files: [], packages: [], errors: [], startedAt: new Date().toISOString(),
      pages: [{
        sheetSerial: 'FOL-OMR-CONCURRENT-P1', pageIndex: 1, sourceFileId: '1', sourceFileName: 'captura.pdf', sourcePage: 1,
        scanStatus: 'needs_review', confidence: 0.7, autoGradable: false, manualReviewRequired: true,
        examId: examen.id, folio: examen.folio, examPage: 1, identityResult: { studentId: alumnoId, studentName: 'Alumno OMR' }, responses: [], exceptions: []
      }]
    });
    await prisma.omrScanJob.create({ data: {
      id: jobId, docenteId, periodoId, plantillaId, estado: 'completed', totalHojas: 1, procesadas: 1, metadata
    } });

    const originalFindFirst = prisma.examenGenerado.findFirst.bind(prisma.examenGenerado);
    let arrivals = 0;
    let release!: () => void;
    const bothArrived = new Promise<void>((resolve) => { release = resolve; });
    const spy = vi.spyOn(prisma.examenGenerado, 'findFirst').mockImplementation(async (args: any) => {
      if (args?.where?.id === examenId) {
        arrivals += 1;
        if (arrivals === 2) release();
        await bothArrived;
      }
      return originalFindFirst(args);
    });
    try {
      const requests = ['7bb8429c-38d6-4972-b38e-85f1629f10b4', '84e61c6e-e54f-4a31-b7b3-e2adab24f1d0'].map((clientRequestId) => {
        const res = crearRespuesta();
        const req = { docenteId, params: { jobId }, body: { clientRequestId } } as unknown as SolicitudDocente;
        return calificarIngestaPdfOmr(req, res.response).then(() => ({ res }));
      });
      const results = await Promise.allSettled(requests);
      const fulfillments = results.filter((result) => result.status === 'fulfilled');
      const rejections = results.filter((result) => result.status === 'rejected');
      expect(arrivals).toBe(2);
      expect(fulfillments).toHaveLength(1);
      expect(rejections).toHaveLength(1);
      expect((rejections[0] as PromiseRejectedResult).reason).toMatchObject({ codigo: 'OMR_CALIFICACION_EN_CURSO' });
      expect(await prisma.calificacion.count({ where: { docenteId, examenGeneradoId: examenId } })).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('recupera como parcial una calificación interrumpida para permitir reintento idempotente', async () => {
    const docenteId = 'docente-lote-recuperacion';
    const periodoId = 'periodo-lote-recuperacion';
    const plantillaId = 'plantilla-lote-recuperacion';
    await prisma.docente.create({ data: { id: docenteId, nombreCompleto: 'Docente OMR', correo: 'omr-recuperacion@evaluapro.local' } });
    await prisma.periodo.create({ data: {
      id: periodoId, docenteId, nombre: 'Periodo OMR', nombreNormalizado: 'periodo omr',
      fechaInicio: new Date('2026-01-01T00:00:00Z'), fechaFin: new Date('2026-12-31T00:00:00Z'), grupos: '["A"]'
    } });
    await prisma.examenPlantilla.create({ data: {
      id: plantillaId, docenteId, periodoId, tipo: 'parcial', titulo: 'Parcial OMR', tituloNormalizado: 'parcial omr',
      numeroPaginas: 1, bookletConfig: '{}', omrConfig: '{}', configuracionPdf: '{}'
    } });
    const jobId = 'job-lote-recuperacion';
    await prisma.omrScanJob.create({ data: {
      id: jobId, docenteId, periodoId, plantillaId, estado: 'completed', totalHojas: 0, procesadas: 0,
      metadata: JSON.stringify({
        version: 1, assessmentId: 'assessment-recuperacion', loteId: 'LOTE-RECUPERACION', status: 'completed',
        reference: { nombre: 'referencia.pdf', relativePath: 'referencia.pdf', sha256: 'a'.repeat(64), pages: 0, pagesWithQr: 0 },
        files: [], pages: [], packages: [], errors: [], startedAt: new Date().toISOString(),
        autoGrading: { clientRequestId: '7bb8429c-38d6-4972-b38e-85f1629f10b4', status: 'processing', startedAt: new Date().toISOString(), results: [] }
      })
    } });

    const { recuperarIngestasPdfOmrInterrumpidas } = await import('../src/modulos/modulo_escaneo_omr/controladorIngestaPdfOmr.js');
    expect(await recuperarIngestasPdfOmrInterrumpidas()).toBe(1);
    const recuperado = await prisma.omrScanJob.findUnique({ where: { id: jobId } });
    const autoGrading = JSON.parse(String(recuperado?.metadata)).autoGrading;
    expect(autoGrading).toMatchObject({ status: 'partial', results: [{ code: 'OMR_CALIFICACION_BATCH_INTERRUPTED' }] });
  });
});
