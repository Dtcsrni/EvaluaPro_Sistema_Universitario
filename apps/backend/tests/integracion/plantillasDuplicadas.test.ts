import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

describe('plantillas duplicadas', () => {
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
      .send({ nombreCompleto: 'Docente', correo, contrasena: 'Secreto123!' })
      .expect(201);
    return respuesta.body.token as string;
  }

  async function crearPeriodo(token: string) {
    const periodoResp = await request(app)
      .post('/api/periodos')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        nombre: 'Logica de Programacion',
        fechaInicio: '2026-02-01',
        fechaFin: '2026-07-01',
        grupos: ['25']
      })
      .expect(201);
    return periodoResp.body.periodo._id as string;
  }

  async function crearPregunta(token: string, periodoId: string, sufijo: string) {
    const preguntaResp = await request(app)
      .post('/api/banco-preguntas')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        periodoId,
        enunciado: `Pregunta ${sufijo}`,
        opciones: [
          { texto: 'A', esCorrecta: true },
          { texto: 'B', esCorrecta: false },
          { texto: 'C', esCorrecta: false },
          { texto: 'D', esCorrecta: false },
          { texto: 'E', esCorrecta: false }
        ]
      })
      .expect(201);
    return preguntaResp.body.pregunta._id as string;
  }

  async function crearPlantilla(token: string, periodoId: string, titulo: string, preguntasIds: string[]) {
    const resp = await request(app)
      .post('/api/examenes/plantillas')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        periodoId,
        tipo: 'parcial',
        titulo,
        numeroPaginas: 2,
        preguntasIds
      })
      .expect(201);
    return resp.body.plantilla._id as string;
  }

  it('rechaza crear plantilla duplicada por nombre (case/espacios-insensitive)', async () => {
    const token = await registrar('dup-plantilla@local.test');
    const periodoId = await crearPeriodo(token);
    const preguntaId = await crearPregunta(token, periodoId, 'base');

    await crearPlantilla(token, periodoId, 'Primer Parcial', [preguntaId]);

    const resp = await request(app)
      .post('/api/examenes/plantillas')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        periodoId,
        tipo: 'parcial',
        titulo: '  primer   parcial  ',
        numeroPaginas: 2,
        preguntasIds: [preguntaId]
      })
      .expect(409);

    expect(resp.body.error?.codigo ?? resp.body.codigo).toBe('PLANTILLA_DUPLICADA');
  });

  it('rechaza actualizar plantilla si el nuevo titulo ya existe', async () => {
    const token = await registrar('dup-plantilla-update@local.test');
    const periodoId = await crearPeriodo(token);
    const preguntaA = await crearPregunta(token, periodoId, 'A');
    const preguntaB = await crearPregunta(token, periodoId, 'B');

    await crearPlantilla(token, periodoId, 'Primer Parcial', [preguntaA]);
    const plantillaDosId = await crearPlantilla(token, periodoId, 'Segundo Parcial', [preguntaB]);

    const resp = await request(app)
      .post(`/api/examenes/plantillas/${encodeURIComponent(plantillaDosId)}`)
      .set({ Authorization: `Bearer ${token}` })
      .send({ titulo: 'primer parcial' })
      .expect(409);

    expect(resp.body.error?.codigo ?? resp.body.codigo).toBe('PLANTILLA_DUPLICADA');
  });
});

