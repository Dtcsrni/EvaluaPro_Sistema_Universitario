import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

describe('contrato (portal)', () => {
  it('rechaza ingresar sin codigo/matricula', async () => {
    const { crearApp } = await import('../../src/app');
    const app = crearApp();

    const respuesta = await request(app).post('/api/portal/ingresar').send({}).expect(400);
    expect(respuesta.body.error.codigo).toBe('DATOS_INVALIDOS');
  });

  it('rechaza ingresar con campos extra', async () => {
    const { crearApp } = await import('../../src/app');
    const app = crearApp();

    const respuesta = await request(app)
      .post('/api/portal/ingresar')
      .send({ codigo: 'ABC123', matricula: 'A001', extra: 'NO' })
      .expect(400);

    expect(respuesta.body.error.codigo).toBe('DATOS_INVALIDOS');
  });

  it('protege limpiar con x-api-key y normaliza dias', async () => {
    const anterior = { PORTAL_API_KEY: process.env.PORTAL_API_KEY };
    process.env.PORTAL_API_KEY = 'SECRETA_TEST';

    vi.resetModules();
    vi.doMock('../../src/modelos/modeloResultadoAlumno', () => {
      return {
        ResultadoAlumno: {
          deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 })
        }
      };
    });
    const { crearApp } = await import('../../src/app');
    const app = crearApp();

    const respuesta = await request(app)
      .post('/api/portal/limpiar')
      .set('x-api-key', 'SECRETA_TEST')
      .send({ dias: -5 })
      .expect(200);

    expect(respuesta.body.diasRetencion).toBe(1);

    process.env.PORTAL_API_KEY = anterior.PORTAL_API_KEY;
    vi.resetModules();
  });
});
