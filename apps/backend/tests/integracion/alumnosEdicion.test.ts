/**
 * alumnosEdicion.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas de edicion de alumnos.
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

describe('alumnos (edicion)', () => {
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

  async function crearPeriodo(token: string, nombre: string) {
    const resp = await request(app)
      .post('/api/periodos')
      .set({ Authorization: `Bearer ${token}` })
      .send({ nombre, fechaInicio: '2025-01-01', fechaFin: '2025-01-30' })
      .expect(201);
    return resp.body.periodo._id as string;
  }

  it('permite actualizar datos del alumno (mismo docente)', async () => {
    const token = await registrar('docente-edit@local.test');
    const periodoId = await crearPeriodo(token, 'Materia A');

    const alumnoResp = await request(app)
      .post('/api/alumnos')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        periodoId,
        matricula: 'CUH512410168',
        nombres: 'Ana',
        apellidos: 'Gomez',
        grupo: 'A'
      })
      .expect(201);

    const alumnoId = alumnoResp.body.alumno._id as string;

    const actualizado = await request(app)
      .post(`/api/alumnos/${alumnoId}/actualizar`)
      .set({ Authorization: `Bearer ${token}` })
      .send({
        periodoId,
        matricula: 'CUH512410168',
        nombres: 'Ana Maria',
        apellidos: 'Gomez Ruiz',
        grupo: 'B'
      })
      .expect(200);

    expect(actualizado.body.alumno._id).toBe(alumnoId);
    expect(actualizado.body.alumno.grupo).toBe('B');
    expect(actualizado.body.alumno.nombreCompleto).toContain('Ana');

    const listado = await request(app)
      .get(`/api/alumnos?periodoId=${periodoId}`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);

    expect(listado.body.alumnos.length).toBe(1);
    expect(listado.body.alumnos[0]._id).toBe(alumnoId);
    expect(listado.body.alumnos[0].grupo).toBe('B');
  });
});
