/**
 * regenerarExamenGenerado.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo.js';
import { crearPreguntasPublicadas } from './_reactivosHelper.js';

describe('regenerar examen generado', () => {
  const preguntasPorEscenario = 20;
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

  async function registrarDocente() {
    const respuesta = await request(app)
      .post('/api/autenticacion/registrar')
      .send({
        nombreCompleto: 'Docente Prueba',
        correo: 'docente@prueba.test',
        contrasena: 'Secreto123!'
      })
      .expect(201);
    return respuesta.body.token as string;
  }

  it('regenera PDF y recalcula paginas (requiere forzar si ya fue descargado)', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };

    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({
        nombre: 'Periodo 2025',
        fechaInicio: '2025-01-01',
        fechaFin: '2025-06-01',
        grupos: ['A']
      })
      .expect(201);
    const periodoId = periodoResp.body.periodo._id as string;

    const preguntasIds = await crearPreguntasPublicadas({
      app,
      auth,
      periodoId,
      externalPrefix: 'regenerar-examen',
      preguntas: Array.from({ length: preguntasPorEscenario }, (_, index) => `Pregunta ${index + 1}`)
    });

    const plantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({
        periodoId,
        tipo: 'parcial',
        titulo: 'Parcial 1',
        numeroPaginas: 2,
        preguntasIds
      })
      .expect(201);
    const plantillaId = plantillaResp.body.plantilla._id as string;

    await request(app)
      .get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`)
      .set(auth)
      .expect(200);

    const examenResp = await request(app)
      .post('/api/examenes/generados')
      .set(auth)
      .send({ plantillaId })
      .expect(201);
    const examenId = examenResp.body.examenGenerado._id as string;

    // Marca descargadoEn para activar el guardrail.
    await request(app).get(`/api/examenes/generados/${examenId}/pdf`).set(auth).expect(200);

    await request(app)
      .post(`/api/examenes/generados/${examenId}/regenerar`)
      .set(auth)
      .send({})
      .expect(409);

    const regen = await request(app)
      .post(`/api/examenes/generados/${examenId}/regenerar`)
      .set(auth)
      .send({ forzar: true })
      .expect(200);

    const paginas = regen.body?.examenGenerado?.paginas as Array<{ preguntasDel?: number; preguntasAl?: number }>;
    expect(Array.isArray(paginas)).toBe(true);
    expect(paginas.length).toBeGreaterThan(0);
    expect(paginas.some((p) => Number(p.preguntasDel ?? 0) > 0 && Number(p.preguntasAl ?? 0) > 0)).toBe(true);
  });
});
