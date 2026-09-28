import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    alumno: { findFirst: vi.fn() },
    examenPlantilla: { findUnique: vi.fn() },
    preguntaPlantilla: { findMany: vi.fn() },
    omrScanJob: { findFirst: vi.fn(), findMany: vi.fn() },
    entrega: { findFirst: vi.fn(), findMany: vi.fn() }
  }
}));

vi.mock('../src/infraestructura/baseDatos/sqlite.js', () => ({ prisma: mocks.prisma }));

import rutasAlumnos from '../src/modulos/modulo_alumnos/rutasAlumnos.js';
import rutasGeneracionPdf from '../src/modulos/modulo_generacion_pdf/rutasGeneracionPdf.js';
import rutasEscaneoOmr from '../src/modulos/modulo_escaneo_omr/rutasEscaneoOmr.js';
import rutasEntregas from '../src/modulos/modulo_vinculacion_entrega/rutasVinculacionEntrega.js';

function crearAppLecturas() {
  const app = express();
  app.use((req, _res, next) => {
    Object.assign(req, { docenteId: req.header('x-docente-id') ?? 'docente-1', docenteRoles: ['docente'] });
    next();
  });
  app.use('/api/alumnos', rutasAlumnos);
  app.use('/api/examenes', rutasGeneracionPdf);
  app.use('/api/omr', rutasEscaneoOmr);
  app.use('/api/entregas', rutasEntregas);
  app.use((error: Error & { codigo?: string; estadoHttp?: number; statusHttp?: number }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(error);
    return res.status(error.estadoHttp ?? error.statusHttp ?? 500).json({ error: { codigo: error.codigo ?? 'ERROR', mensaje: error.message } });
  });
  return app;
}

const job = (id: string, createdAt: Date, assessmentId = 'assessment-1') => ({
  id,
  estado: 'completed',
  totalHojas: 1,
  procesadas: 1,
  createdAt,
  metadata: JSON.stringify({
    version: 1,
    assessmentId,
    folio: 'FOLIO-1',
    sourceType: 'image_batch',
    pages: [{
      sheetSerial: 'FOLIO-1-P1',
      pageIndex: 1,
      scanStatus: 'accepted',
      confidence: 0.9,
      autoGradable: true,
      manualReviewRequired: false,
      responses: [],
      exceptions: []
    }],
    errors: [],
    reviewResolutions: []
  })
});

describe('lecturas de recursos docentes por API', () => {
  beforeEach(() => vi.resetAllMocks());

  it('lee alumno por ID dentro del periodo del docente y no revela IDs ajenos', async () => {
    const app = crearAppLecturas();
    mocks.prisma.alumno.findFirst.mockResolvedValueOnce({ id: 'alumno-1', nombreCompleto: 'Ana' }).mockResolvedValueOnce(null);

    await request(app).get('/api/alumnos/alumno-1').set('x-docente-id', 'docente-1').expect(200, {
      alumno: { id: 'alumno-1', nombreCompleto: 'Ana' }
    });
    expect(mocks.prisma.alumno.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: 'alumno-1', periodo: { docenteId: 'docente-1' } }
    });
    await request(app).get('/api/alumnos/alumno-1').set('x-docente-id', 'docente-2').expect(404);
  });

  it('lee detalle de plantilla por el servicio canónico y conserva preguntas ordenadas', async () => {
    const app = crearAppLecturas();
    mocks.prisma.examenPlantilla.findUnique.mockResolvedValue({
      id: 'plantilla-1', docenteId: 'docente-1', periodoId: 'periodo-1', tipo: 'parcial', titulo: 'Parcial',
      tituloNormalizado: 'parcial', instrucciones: null, numeroPaginas: 1, reactivosObjetivo: 2,
      defaultVersionCount: 1, answerKeyMode: 'digital', archivadoEn: null, bookletConfig: '{}',
      omrConfig: '{}', configuracionPdf: '{}', temas: '[]', createdAt: new Date(), updatedAt: new Date()
    });
    mocks.prisma.preguntaPlantilla.findMany.mockResolvedValue([{ preguntaId: 'reactivo-2' }, { preguntaId: 'reactivo-1' }]);

    const response = await request(app).get('/api/examenes/plantillas/plantilla-1').set('x-docente-id', 'docente-1').expect(200);
    expect(response.body.plantilla).toMatchObject({ id: 'plantilla-1', preguntasIds: ['reactivo-2', 'reactivo-1'] });
    expect(mocks.prisma.examenPlantilla.findUnique).toHaveBeenCalledWith({ where: { id: 'plantilla-1' } });

    mocks.prisma.examenPlantilla.findUnique.mockResolvedValueOnce({ id: 'plantilla-1', docenteId: 'docente-1' });
    await request(app).get('/api/examenes/plantillas/plantilla-1').set('x-docente-id', 'docente-2').expect(403);
  });

  it('pagina y detalla jobs OMR por docente sin exponer capturas fuente', async () => {
    const app = crearAppLecturas();
    const primero = job('job-2', new Date('2026-09-02T00:00:00.000Z'));
    const segundo = job('job-1', new Date('2026-09-01T00:00:00.000Z'));
    mocks.prisma.omrScanJob.findMany.mockResolvedValue([primero, segundo]);
    mocks.prisma.omrScanJob.findFirst.mockResolvedValueOnce(primero).mockResolvedValueOnce(null);

    const pagina = await request(app)
      .get('/api/omr/jobs?generatedAssessmentId=assessment-1&status=completed&limite=1')
      .set('x-docente-id', 'docente-1');
    expect(pagina.status, JSON.stringify(pagina.body)).toBe(200);
    expect(pagina.body.jobs).toHaveLength(1);
    expect(pagina.body.jobs[0].jobId).toBe('job-2');
    expect(pagina.body.jobs[0].pages[0].responses).toEqual([]);
    expect(pagina.body.jobs[0]).not.toHaveProperty('capturas');
    expect(pagina.body.nextCursor).toEqual(expect.any(String));
    expect(mocks.prisma.omrScanJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        docenteId: 'docente-1',
        estado: 'completed',
        metadata: { contains: '"assessmentId":"assessment-1"' }
      }),
      take: 2,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    }));

    const detalle = await request(app).get('/api/omr/jobs/job-2').set('x-docente-id', 'docente-1').expect(200);
    expect(detalle.body.job.jobId).toBe('job-2');
    expect(mocks.prisma.omrScanJob.findFirst).toHaveBeenNthCalledWith(1, { where: { id: 'job-2', docenteId: 'docente-1' } });
    await request(app).get('/api/omr/jobs/job-2').set('x-docente-id', 'docente-2').expect(404);
  });

  it('pagina y detalla entregas aisladas por docente con filtros de examen', async () => {
    const app = crearAppLecturas();
    const fecha = new Date('2026-09-02T00:00:00.000Z');
    const entrega = {
      id: 'entrega-1', docenteId: 'docente-1', alumnoId: 'alumno-1', examenGeneradoId: 'examen-1', estado: 'entregado',
      fechaEntrega: fecha, createdAt: fecha, updatedAt: fecha, acordeonEntregado: false, bonoAcordeon: 0, motivoDeshacer: null,
      alumno: { id: 'alumno-1', nombreCompleto: 'Ana', matricula: 'A1' },
      examenGenerado: { id: 'examen-1', folio: 'F-1', estado: 'entregado', periodoId: 'periodo-1', plantillaId: 'plantilla-1', loteId: 'lote-1', generadoEn: fecha }
    };
    mocks.prisma.entrega.findMany.mockResolvedValue([entrega, { ...entrega, id: 'entrega-0', createdAt: new Date('2026-09-01T00:00:00Z') }]);
    mocks.prisma.entrega.findFirst.mockResolvedValueOnce(entrega).mockResolvedValueOnce(null);

    const pagina = await request(app)
      .get('/api/entregas?periodoId=periodo-1&loteId=lote-1&estado=entregado&limite=1')
      .set('x-docente-id', 'docente-1')
      .expect(200);
    expect(pagina.body.entregas).toHaveLength(1);
    expect(pagina.body.nextCursor).toEqual(expect.any(String));
    expect(mocks.prisma.entrega.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        docenteId: 'docente-1', estado: 'entregado',
        examenGenerado: { is: { periodoId: 'periodo-1', loteId: 'lote-1' } }
      }),
      take: 2,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    }));
    const cursor = JSON.parse(Buffer.from(pagina.body.nextCursor, 'base64url').toString('utf8')) as { id: string; createdAt: string };
    mocks.prisma.entrega.findMany.mockResolvedValueOnce([{ ...entrega, id: 'entrega-0' }]);
    await request(app)
      .get(`/api/entregas?limite=1&cursor=${pagina.body.nextCursor}`)
      .set('x-docente-id', 'docente-1')
      .expect(200);
    expect(mocks.prisma.entrega.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({
        docenteId: 'docente-1',
        OR: [
          { createdAt: { lt: new Date(cursor.createdAt) } },
          { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } }
        ]
      })
    }));
    await request(app).get('/api/entregas?cursor=***').set('x-docente-id', 'docente-1').expect(400);

    const detalle = await request(app).get('/api/entregas/entrega-1').set('x-docente-id', 'docente-1').expect(200);
    expect(detalle.body.entrega.examenGenerado.folio).toBe('F-1');
    expect(mocks.prisma.entrega.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: 'entrega-1', docenteId: 'docente-1' }
    }));
    await request(app).get('/api/entregas/entrega-1').set('x-docente-id', 'docente-2').expect(404);
  });

});
