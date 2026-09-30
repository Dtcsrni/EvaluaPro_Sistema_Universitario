import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo.js';

const portalState = vi.hoisted(() => ({ postJson: vi.fn() }));
vi.mock('../../src/modulos/modulo_sincronizacion_nube/infra/portalSyncClient.js', () => ({
  crearClientePortal: () => ({ postJson: portalState.postJson })
}));

describe('publicación de código de acceso vigente', () => {
  beforeAll(async () => { await conectarMongoTest(); });
  beforeEach(async () => {
    await limpiarMongoTest();
    portalState.postJson.mockReset().mockResolvedValue({ ok: true, status: 200, payload: {} });
  });
  afterAll(async () => { await cerrarMongoTest(); });

  it('omite códigos expirados y selecciona solo uno vigente', async () => {
    const docenteId = '6e19a319-852f-4a51-8edf-f91b411889ef';
    const periodoId = '4a74d504-a7b8-44a8-93be-64cfcc52a2e1';
    await prisma.docente.create({ data: {
      id: docenteId, correo: 'codigos-activos@prueba.test', nombreCompleto: 'Docente Prueba', roles: '["docente"]', activo: true
    } });
    await prisma.periodo.create({ data: {
      id: periodoId, docenteId, nombre: 'Periodo de prueba', nombreNormalizado: 'periodo de prueba',
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'), fechaFin: new Date('2026-06-30T00:00:00.000Z'), grupos: '[]'
    } });
    const ahora = Date.now();
    await prisma.codigoAcceso.create({ data: {
      docenteId, periodoId, codigo: 'SECRET-EXPIRED', expiraEn: new Date(ahora - 60_000)
    } });
    await prisma.codigoAcceso.create({ data: {
      docenteId, periodoId, codigo: 'SECRET-ACTIVE', expiraEn: new Date(ahora + 60_000)
    } });

    const { publicarResultadosUseCase } = await import('../../src/modulos/modulo_sincronizacion_nube/application/usecases/publicarResultados.js');
    await publicarResultadosUseCase({ docenteId, periodoId });

    const payload = portalState.postJson.mock.calls[0]?.[1] as { codigoAcceso?: { codigo?: string } | null };
    expect(payload.codigoAcceso?.codigo).toBe('SECRET-ACTIVE');
  });
});
