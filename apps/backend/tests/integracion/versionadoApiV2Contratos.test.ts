/**
 * versionadoApiV2Contratos.test
 *
 * Verifica contrato canonizado:
 * - API canonica /api/* operativa.
 * - Rutas no soportadas /api/v2/* retiradas (404 esperado).
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';
import { prepararEscenarioFlujo } from './_flujoDocenteHelper';

const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+WmVQAAAAASUVORK5CYII=';

describe('API canonica sin versionado en path', () => {
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

  it('mantiene /api/* y rechaza /api/v2/*', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'parcial', 'docente-versionado-v2@prueba.test');

    const plantillasCanonico = await request(app).get('/api/examenes/plantillas').set(escenario.auth).expect(200);
    expect(Array.isArray(plantillasCanonico.body.plantillas)).toBe(true);

    const prevalidacionCanonica = await request(app)
      .post('/api/omr/prevalidar-lote')
      .set(escenario.auth)
      .send({
        capturas: [{ nombreArchivo: 'captura-v2.png', imagenBase64: PNG_1X1_BASE64 }]
      })
      .expect(200);
    expect(prevalidacionCanonica.body.total).toBe(1);

    await request(app).get('/api/v2/examenes/plantillas').set(escenario.auth).expect(404);
    await request(app)
      .post('/api/v2/omr/prevalidar-lote')
      .set(escenario.auth)
      .send({ capturas: [{ nombreArchivo: 'captura-v2.png', imagenBase64: PNG_1X1_BASE64 }] })
      .expect(404);
  });
});

