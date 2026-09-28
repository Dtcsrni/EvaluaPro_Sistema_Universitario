import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    codigoAcceso: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    eventoCumplimiento: { create: vi.fn() },
    $transaction: vi.fn()
  }
}));

vi.mock('../src/infraestructura/baseDatos/sqlite.js', () => ({ prisma: mocks.prisma }));
vi.mock('../src/modulos/modulo_sincronizacion_nube/application/usecases/listarSincronizaciones.js', () => ({ listarSincronizacionesUseCase: vi.fn() }));
vi.mock('../src/modulos/modulo_sincronizacion_nube/application/usecases/generarCodigoAcceso.js', () => ({ generarCodigoAccesoUseCase: vi.fn() }));
vi.mock('../src/modulos/modulo_sincronizacion_nube/application/usecases/publicarResultados.js', () => ({ publicarResultadosUseCase: vi.fn() }));
vi.mock('../src/modulos/modulo_sincronizacion_nube/application/usecases/exportarPaquete.js', () => ({ exportarPaqueteUseCase: vi.fn() }));
vi.mock('../src/modulos/modulo_sincronizacion_nube/application/usecases/importarPaquete.js', () => ({ importarPaqueteUseCase: vi.fn() }));
vi.mock('../src/modulos/modulo_sincronizacion_nube/application/usecases/enviarPaqueteServidor.js', () => ({ enviarPaqueteServidorUseCase: vi.fn() }));
vi.mock('../src/modulos/modulo_sincronizacion_nube/application/usecases/traerPaquetesServidor.js', () => ({ traerPaquetesServidorUseCase: vi.fn() }));
vi.mock('../src/modulos/modulo_sincronizacion_nube/domain/instantaneaLocal.js', () => ({ exportarInstantaneaLocal: vi.fn(), importarInstantaneaLocal: vi.fn() }));
vi.mock('../src/modulos/modulo_sincronizacion_nube/domain/leaseSincronizacion.js', () => ({
  adquirirLease: vi.fn(), descargarInstantaneaNube: vi.fn(), importarInstantaneaNube: vi.fn(), liberarLease: vi.fn(),
  obtenerEstadoLease: vi.fn(), publicarInstantaneaNube: vi.fn(), renovarLease: vi.fn()
}));
vi.mock('../src/modulos/modulo_sincronizacion_nube/domain/preferenciasSincronizacion.js', () => ({ configurarDirectorioSincronizacion: vi.fn(), obtenerConfiguracionSincronizacion: vi.fn() }));

import rutasSincronizacionNube from '../src/modulos/modulo_sincronizacion_nube/rutasSincronizacionNube.js';

function crearApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { docenteId: req.header('x-docente-id') ?? 'docente-1', docenteRoles: ['docente'] });
    next();
  });
  app.use('/api/sincronizaciones', rutasSincronizacionNube);
  app.use((error: Error & { codigo?: string; estadoHttp?: number; statusHttp?: number }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(error);
    return res.status(error.estadoHttp ?? error.statusHttp ?? 500).json({ error: { codigo: error.codigo ?? 'ERROR', mensaje: error.message } });
  });
  return app;
}

describe('API de códigos de acceso', () => {
  beforeEach(() => vi.resetAllMocks());

  it('pagina y consulta metadatos sin exponer el secreto; expira una sola vez y audita en transacción', async () => {
    const app = crearApp();
    const fecha = new Date('2026-09-28T12:00:00.000Z');
    const codigo = {
      id: 'codigo-1', docenteId: 'docente-1', periodoId: 'periodo-1', codigo: 'SECRETO-123', expiraEn: new Date(Date.now() + 60_000),
      usado: false, createdAt: fecha, updatedAt: fecha
    };
    const codigoPublico = {
      id: codigo.id, docenteId: codigo.docenteId, periodoId: codigo.periodoId, expiraEn: codigo.expiraEn,
      usado: codigo.usado, createdAt: codigo.createdAt, updatedAt: codigo.updatedAt
    };
    mocks.prisma.codigoAcceso.findMany.mockResolvedValue([codigoPublico]);
    mocks.prisma.codigoAcceso.findFirst.mockResolvedValueOnce(codigoPublico).mockResolvedValueOnce(null).mockResolvedValueOnce(codigo).mockResolvedValueOnce({ ...codigo, usado: true });
    mocks.prisma.codigoAcceso.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.eventoCumplimiento.create.mockResolvedValue({ id: 'evento-1' });
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: typeof mocks.prisma) => Promise<unknown>) => callback(mocks.prisma));

    const pagina = await request(app)
      .get('/api/sincronizaciones/codigo-acceso?periodoId=periodo-1&estado=vigente&limite=1')
      .set('x-docente-id', 'docente-1')
      .expect(200);
    expect(pagina.body.codigosAcceso).toHaveLength(1);
    expect(pagina.body.codigosAcceso[0]).not.toHaveProperty('codigo');
    expect(mocks.prisma.codigoAcceso.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ docenteId: 'docente-1', periodoId: 'periodo-1', usado: false }),
      select: expect.not.objectContaining({ codigo: true }),
      take: 2,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    }));
    await request(app).get('/api/sincronizaciones/codigo-acceso?cursor=YWJj').set('x-docente-id', 'docente-1').expect(400);

    const detalle = await request(app).get('/api/sincronizaciones/codigo-acceso/codigo-1').set('x-docente-id', 'docente-1').expect(200);
    expect(detalle.body.codigoAcceso).not.toHaveProperty('codigo');
    expect(mocks.prisma.codigoAcceso.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: 'codigo-1', docenteId: 'docente-1' } }));
    await request(app).get('/api/sincronizaciones/codigo-acceso/codigo-1').set('x-docente-id', 'docente-2').expect(404);

    const expiracion = await request(app).post('/api/sincronizaciones/codigo-acceso/codigo-1/expirar').set('x-docente-id', 'docente-1').expect(200);
    expect(expiracion.body).toMatchObject({ actualizado: true, estado: 'expirado' });
    expect(mocks.prisma.codigoAcceso.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'codigo-1', docenteId: 'docente-1', usado: false }),
      data: { expiraEn: expect.any(Date) }
    }));
    expect(mocks.prisma.eventoCumplimiento.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tipo: 'codigo_acceso_expirado', accion: 'expirar' })
    }));

    const segundaExpiracion = await request(app).post('/api/sincronizaciones/codigo-acceso/codigo-1/expirar').set('x-docente-id', 'docente-1').expect(200);
    expect(segundaExpiracion.body).toMatchObject({ actualizado: false, estado: 'usado' });
    expect(mocks.prisma.eventoCumplimiento.create).toHaveBeenCalledTimes(1);
  });
});
