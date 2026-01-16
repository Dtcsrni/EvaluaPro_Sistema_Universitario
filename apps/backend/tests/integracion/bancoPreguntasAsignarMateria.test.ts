// Asignacion de preguntas legacy sin materia.
import request from 'supertest';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

describe('banco preguntas - asignar materia', () => {
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

  async function crearMateria(token: string, nombre: string) {
    const periodoResp = await request(app)
      .post('/api/periodos')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        nombre,
        fechaInicio: '2025-01-01',
        fechaFin: '2025-06-01'
      })
      .expect(201);
    return periodoResp.body.periodo._id as string;
  }

  async function crearPregunta(token: string, periodoId: string) {
    const preguntaResp = await request(app)
      .post('/api/banco-preguntas')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        periodoId,
        enunciado: 'Pregunta legacy',
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

  it('permite asignar a una materia una pregunta sin periodoId', async () => {
    const token = await registrar('docente-legacy@local.test');
    const materiaA = await crearMateria(token, 'Materia A');
    const materiaB = await crearMateria(token, 'Materia B');

    const preguntaId = await crearPregunta(token, materiaA);

    // Simula pregunta legacy sin materia.
    await mongoose.connection
      .collection('bancoPreguntas')
      .updateOne({ _id: new mongoose.Types.ObjectId(preguntaId) }, { $unset: { periodoId: '' } });

    const sinMateria = await request(app)
      .get('/api/banco-preguntas?sinMateria=1')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);

    expect(sinMateria.body.preguntas).toHaveLength(1);
    expect(sinMateria.body.preguntas[0]._id).toBe(preguntaId);
    expect(sinMateria.body.preguntas[0].periodoId).toBeUndefined();

    const asignar = await request(app)
      .post(`/api/banco-preguntas/${preguntaId}/asignar-materia`)
      .set({ Authorization: `Bearer ${token}` })
      .send({ periodoId: materiaB })
      .expect(200);

    expect(String(asignar.body.pregunta.periodoId)).toBe(materiaB);

    const despues = await request(app)
      .get(`/api/banco-preguntas?periodoId=${materiaB}`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);

    expect(despues.body.preguntas.map((p: { _id: string }) => p._id)).toContain(preguntaId);
  });
});
