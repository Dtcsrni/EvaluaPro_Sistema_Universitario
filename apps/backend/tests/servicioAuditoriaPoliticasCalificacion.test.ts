import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/infraestructura/baseDatos/sqlite.js';
import { ejecutarMutacionPoliticaAuditable } from '../src/modulos/modulo_evaluaciones/servicioAuditoriaPoliticasCalificacion.js';

const parametros = {
  docenteId: 'docente-1',
  codigo: 'POLITICA-1',
  accion: 'crear' as const,
  clientRequestId: 'request-1',
  payload: { foo: 'bar' },
  mutar: async () => ({ resultado: { id: 'politica-1' }, version: 1, antes: null, despues: { id: 'politica-1' } })
};

const hashSolicitud = createHash('sha256')
  .update('{"accion":"crear","payload":{"foo":"bar"}}')
  .digest('hex');

describe('ejecutarMutacionPoliticaAuditable', () => {
  it('rechaza el uso de una clave con otra acción o contenido dentro de la transacción', async () => {
    vi.spyOn(prisma, '$transaction').mockImplementation((async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        $queryRawUnsafe: async () => [{ requestHash: 'otro-hash', despues: '{"id":"politica-existente"}' }]
      })
    ) as never);

    await expect(ejecutarMutacionPoliticaAuditable(parametros)).rejects.toMatchObject({
      codigo: 'IDEMPOTENCIA_CONFLICTO',
      estadoHttp: 409
    });
  });

  it('propaga errores de base de datos que no son conflictos únicos', async () => {
    const error = new Error('fallo de base de datos');
    vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(error);

    await expect(ejecutarMutacionPoliticaAuditable(parametros)).rejects.toBe(error);
  });

  it('recupera el resultado cuando el conflicto único corresponde a la misma solicitud', async () => {
    vi.spyOn(prisma, '$transaction').mockRejectedValueOnce({ code: 'P2002' });
    vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValueOnce([
      { requestHash: hashSolicitud, despues: '{"id":"politica-ganadora"}' }
    ] as never);

    await expect(ejecutarMutacionPoliticaAuditable(parametros)).resolves.toEqual({
      resultado: { id: 'politica-ganadora' },
      repetida: true
    });
  });

  it('rechaza una clave reutilizada con otro contenido después del conflicto único', async () => {
    vi.spyOn(prisma, '$transaction').mockRejectedValueOnce({ code: 'P2002' });
    vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValueOnce([
      { requestHash: 'otro-hash', despues: '{"id":"politica-ganadora"}' }
    ] as never);

    await expect(ejecutarMutacionPoliticaAuditable(parametros)).rejects.toMatchObject({
      codigo: 'IDEMPOTENCIA_CONFLICTO',
      estadoHttp: 409
    });
  });

  it('devuelve conflicto de versión si la clave no aparece después del conflicto único', async () => {
    vi.spyOn(prisma, '$transaction').mockRejectedValueOnce({ code: 'P2002' });
    vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValueOnce([] as never);

    await expect(ejecutarMutacionPoliticaAuditable(parametros)).rejects.toMatchObject({
      codigo: 'POLITICA_VERSION_CONFLICTO',
      estadoHttp: 409
    });
  });
});
