/**
 * Prueba de integración para el módulo de Asistencias, Reglas y Excepciones.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';
import { registrarDocente } from './_flujoDocenteHelper';

describe('Integración: Asistencias, Reglas y Excepciones', () => {
  const app = crearApp();
  let auth: { Authorization: string };
  let periodoId: string;
  let alumnoId: string;

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();

    // 1. Registrar docente y obtener token
    const token = await registrarDocente(app, 'docente-asistencias@prueba.test');
    auth = { Authorization: `Bearer ${token}` };

    // 2. Crear un periodo
    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({
        nombre: 'Periodo Asistencia 2026',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-06-01',
        grupos: ['A']
      })
      .expect(201);
    periodoId = periodoResp.body.periodo._id;

    // 3. Crear un alumno
    const alumnoResp = await request(app)
      .post('/api/alumnos')
      .set(auth)
      .send({
        periodoId,
        matricula: 'CUH512410170',
        nombreCompleto: 'Juan Perez',
        correo: 'juan.perez@prueba.test',
        grupo: 'A'
      })
      .expect(201);
    alumnoId = alumnoResp.body.alumno._id;
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('debe gestionar sesiones de asistencia, pases de lista, reglas y excepciones', async () => {
    // 1. Crear sesión de asistencia
    const fechaSesion = new Date('2026-02-15T10:00:00.000Z').toISOString();
    const crearSesionResp = await request(app)
      .post('/api/asistencias/sesiones')
      .set(auth)
      .send({
        periodoId,
        fecha: fechaSesion,
        grupo: 'A',
        temaNombre: 'Introducción a Algoritmos'
      })
      .expect(201);

    const sesionId = crearSesionResp.body.sesion._id;
    expect(sesionId).toBeDefined();
    expect(crearSesionResp.body.sesion.grupo).toBe('A');

    // 2. Realizar pase de lista (alumno tiene Falta)
    await request(app)
      .post(`/api/asistencias/sesiones/${sesionId}/registros`)
      .set(auth)
      .send({
        registros: [
          {
            alumnoId,
            estado: 'F',
            justificacion: 'No se presentó'
          }
        ]
      })
      .expect(200);

    // 3. Obtener registros de la sesión
    const registrosResp = await request(app)
      .get(`/api/asistencias/sesiones/${sesionId}/registros`)
      .set(auth)
      .expect(200);

    expect(registrosResp.body.registros).toHaveLength(1);
    expect(registrosResp.body.registros[0].alumnoId).toBe(alumnoId);
    expect(registrosResp.body.registros[0].estado).toBe('F');

    // 4. Crear regla de asistencia: máx 0 faltas (para gatillar bloqueo con 1 falta)
    await request(app)
      .post('/api/asistencias/reglas')
      .set(auth)
      .send({
        periodoId,
        grupo: 'A',
        maxFaltas: 0,
        accion: 'bloquear_examen',
        excepcionPermitida: true
      })
      .expect(200);

    // 5. Verificar derecho a examen: debe estar bloqueado
    const derechoResp = await request(app)
      .get(`/api/asistencias/derecho-examen/${alumnoId}?periodoId=${periodoId}`)
      .set(auth)
      .expect(200);

    expect(derechoResp.body.superaLimite).toBe(true);
    expect(derechoResp.body.tieneDerecho).toBe(false);
    expect(derechoResp.body.tieneExcepcion).toBe(false);

    // 6. Crear excepción individual para devolverle el derecho
    const crearExcepcionResp = await request(app)
      .post('/api/asistencias/excepciones')
      .set(auth)
      .send({
        alumnoId,
        periodoId,
        motivo: 'Falta justificada por salud'
      })
      .expect(200); // Mongoose findOneAndUpdate returns 200

    const excepcionId = crearExcepcionResp.body.excepcion._id;
    expect(excepcionId).toBeDefined();

    // 7. Verificar derecho a examen nuevamente: no debe estar bloqueado gracias a la excepción
    const derecho2Resp = await request(app)
      .get(`/api/asistencias/derecho-examen/${alumnoId}?periodoId=${periodoId}`)
      .set(auth)
      .expect(200);

    expect(derecho2Resp.body.superaLimite).toBe(true);
    expect(derecho2Resp.body.tieneDerecho).toBe(true);
    expect(derecho2Resp.body.tieneExcepcion).toBe(true);

    // 8. Eliminar la excepción
    await request(app)
      .post(`/api/asistencias/excepciones/${excepcionId}/eliminar`)
      .set(auth)
      .send()
      .expect(200);

    // 9. Verificar derecho a examen de nuevo: debe estar bloqueado otra vez
    const derecho3Resp = await request(app)
      .get(`/api/asistencias/derecho-examen/${alumnoId}?periodoId=${periodoId}`)
      .set(auth)
      .expect(200);

    expect(derecho3Resp.body.tieneDerecho).toBe(false);

    // 10. Actualizar regla para no permitir excepciones
    await request(app)
      .post('/api/asistencias/reglas')
      .set(auth)
      .send({
        periodoId,
        grupo: 'A',
        maxFaltas: 0,
        accion: 'bloquear_examen',
        excepcionPermitida: false
      })
      .expect(200);

    // 11. Intentar crear excepción, debe rechazar por límite de regla
    await request(app)
      .post('/api/asistencias/excepciones')
      .set(auth)
      .send({
        alumnoId,
        periodoId,
        motivo: 'Falta justificada pero no permitida'
      })
      .expect(403);
  });
});
