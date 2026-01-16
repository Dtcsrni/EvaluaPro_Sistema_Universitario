// La app ya no soporta preguntas "sin materia" (legacy).
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

describe('banco preguntas - legacy sin materia', () => {
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

  it('ya no expone sinMateria ni asignar-materia', async () => {
    const token = await registrar('docente-legacy@local.test');

    await request(app)
      .get('/api/banco-preguntas?sinMateria=1')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);

    // La query sinMateria ya no debe cambiar el comportamiento; el endpoint de asignacion ya no existe.
    await request(app)
      .post('/api/banco-preguntas/000000000000000000000000/asignar-materia')
      .set({ Authorization: `Bearer ${token}` })
      .send({ periodoId: '000000000000000000000000' })
      .expect(404);
  });
});
