import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo.js';

describe('reinscripción desde materia archivada', () => {
  const app = crearApp();

  beforeAll(async () => { await conectarMongoTest(); });
  beforeEach(async () => { await limpiarMongoTest(); });
  afterAll(async () => { await cerrarMongoTest(); });

  async function registrar(correo: string) {
    const respuesta = await request(app)
      .post('/api/autenticacion/registrar')
      .send({ nombreCompleto: 'Docente', correo, contrasena: 'Secreto123!' })
      .expect(201);
    return respuesta.body.token as string;
  }

  async function crearPeriodo(token: string, nombre: string) {
    const respuesta = await request(app)
      .post('/api/periodos')
      .set({ Authorization: `Bearer ${token}` })
      .send({ nombre, fechaInicio: '2025-01-01', fechaFin: '2025-01-30' })
      .expect(201);
    return respuesta.body.periodo._id as string;
  }

  async function crearAlumno(token: string, periodoId: string, matricula: string, grupo = 'G1', nombre = 'Estudiante Prueba') {
    const respuesta = await request(app)
      .post('/api/alumnos')
      .set({ Authorization: `Bearer ${token}` })
      .send({ periodoId, matricula, nombreCompleto: nombre, grupo });
    if (respuesta.status !== 201) throw new Error(`Crear alumno HTTP ${respuesta.status}: ${JSON.stringify(respuesta.body)}`);
  }

  it('copia el grupo a la materia activa, conserva origen e impide duplicar al reintentar', async () => {
    const token = await registrar('reinscripcion-grupo@local.test');
    const origenId = await crearPeriodo(token, 'Materia archivada');
    const destinoId = await crearPeriodo(token, 'Materia nueva');
    await crearAlumno(token, origenId, 'CUH111111111', 'G1', 'Ana Ejemplo');
    await crearAlumno(token, origenId, 'CUH222222222', 'G1', 'Luis Ejemplo');
    await crearAlumno(token, origenId, 'CUH333333333', 'G2', 'Otra estudiante');
    await crearAlumno(token, destinoId, 'CUH111111111', 'G1', 'Ana ya inscrita');
    await request(app).post(`/api/periodos/${origenId}/archivar`).set({ Authorization: `Bearer ${token}` }).expect(200);

    const payload = { periodoOrigenId: origenId, periodoDestinoId: destinoId, grupo: 'g1' };
    const primera = await request(app)
      .post('/api/alumnos/reinscribir-grupo-archivado')
      .set({ Authorization: `Bearer ${token}` })
      .send(payload);
    if (primera.status !== 200) throw new Error(`Reinscripcion HTTP ${primera.status}: ${JSON.stringify(primera.body)}`);

    expect(primera.body).toMatchObject({ ok: true, grupo: 'G1', totalSeleccionados: 2, reinscritos: 1, yaInscritos: 1 });

    const alumnosDestino = await request(app)
      .get(`/api/alumnos?periodoId=${destinoId}`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(alumnosDestino.body.alumnos).toHaveLength(2);
    expect(alumnosDestino.body.alumnos.find((alumno: { matricula: string }) => alumno.matricula === 'CUH222222222')).toMatchObject({
      nombreCompleto: 'Luis Ejemplo', grupo: 'G1', activo: true
    });
    expect(alumnosDestino.body.alumnos.find((alumno: { matricula: string }) => alumno.matricula === 'CUH111111111')?.nombreCompleto).toBe('Ana ya inscrita');

    const materiaDestino = await request(app).get('/api/periodos').set({ Authorization: `Bearer ${token}` }).expect(200);
    expect(materiaDestino.body.periodos.find((periodo: { _id: string; grupos: string[] }) => periodo._id === destinoId).grupos).toContain('G1');

    const segunda = await request(app)
      .post('/api/alumnos/reinscribir-grupo-archivado')
      .set({ Authorization: `Bearer ${token}` })
      .send(payload)
      .expect(200);
    expect(segunda.body).toMatchObject({ reinscritos: 0, yaInscritos: 2, totalSeleccionados: 2 });

    const alumnosOrigen = await request(app)
      .get(`/api/alumnos?periodoId=${origenId}`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(alumnosOrigen.body.alumnos).toHaveLength(3);
    expect(alumnosOrigen.body.alumnos.every((alumno: { activo: boolean }) => alumno.activo === false)).toBe(true);
  });

  it('rechaza una materia archivada que pertenece a otro docente', async () => {
    const tokenA = await registrar('docente-a-reinscripcion@local.test');
    const tokenB = await registrar('docente-b-reinscripcion@local.test');
    const origenAjeno = await crearPeriodo(tokenA, 'Materia de otra docente');
    const destino = await crearPeriodo(tokenB, 'Materia destino');
    await crearAlumno(tokenA, origenAjeno, 'CUH444444444');
    await request(app).post(`/api/periodos/${origenAjeno}/archivar`).set({ Authorization: `Bearer ${tokenA}` }).expect(200);

    await request(app)
      .post('/api/alumnos/reinscribir-grupo-archivado')
      .set({ Authorization: `Bearer ${tokenB}` })
      .send({ periodoOrigenId: origenAjeno, periodoDestinoId: destino, grupo: 'G1' })
      .expect(404);

    const origenActivo = await crearPeriodo(tokenB, 'Materia todavía activa');
    await request(app)
      .post('/api/alumnos/reinscribir-grupo-archivado')
      .set({ Authorization: `Bearer ${tokenB}` })
      .send({ periodoOrigenId: origenActivo, periodoDestinoId: destino, grupo: 'G1' })
      .expect(409);

    const destinoArchivado = await crearPeriodo(tokenB, 'Materia destino archivada');
    await request(app).post(`/api/periodos/${origenActivo}/archivar`).set({ Authorization: `Bearer ${tokenB}` }).expect(200);
    await request(app).post(`/api/periodos/${destinoArchivado}/archivar`).set({ Authorization: `Bearer ${tokenB}` }).expect(200);
    await request(app)
      .post('/api/alumnos/reinscribir-grupo-archivado')
      .set({ Authorization: `Bearer ${tokenB}` })
      .send({ periodoOrigenId: origenActivo, periodoDestinoId: destinoArchivado, grupo: 'G1' })
      .expect(409);
  });
});
