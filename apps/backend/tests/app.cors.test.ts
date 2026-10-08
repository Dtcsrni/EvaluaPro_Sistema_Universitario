import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import { configuracion } from '../src/configuracion.js';

describe('CORS del backend', () => {
  const app = crearApp();
  const origenPermitido = configuracion.corsOrigenes[0]!;

  it('refleja únicamente el origen configurado y conserva credenciales', async () => {
    const respuesta = await request(app)
      .options('/api/autenticacion/registrar')
      .set('Origin', origenPermitido)
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);

    expect(respuesta.headers['access-control-allow-origin']).toBe(origenPermitido);
    expect(respuesta.headers['access-control-allow-credentials']).toBe('true');
  });

  it('no concede cabeceras CORS a un origen ajeno', async () => {
    const respuesta = await request(app)
      .options('/api/autenticacion/registrar')
      .set('Origin', 'https://origen-no-autorizado.invalid')
      .set('Access-Control-Request-Method', 'POST');

    expect(respuesta.headers['access-control-allow-origin']).toBeUndefined();
    expect(respuesta.headers['access-control-allow-credentials']).toBeUndefined();
  });
});
