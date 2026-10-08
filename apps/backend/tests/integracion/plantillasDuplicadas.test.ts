/**
 * plantillasDuplicadas.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';
import { crearPreguntasPublicadas } from './_reactivosHelper.js';

describe('plantillas duplicadas', () => {
  const app = crearApp();

  beforeAll(async () => {
    await conectarSqliteTest();
  });

  beforeEach(async () => {
    await limpiarSqliteTest();
  });

  afterAll(async () => {
    await cerrarSqliteTest();
  });

  async function registrar(correo: string) {
    const respuesta = await request(app)
      .post('/api/autenticacion/registrar')
      .send({ nombreCompleto: 'Docente', correo, contrasena: 'Secreto123!' })
      .expect(201);
    return respuesta.body.token as string;
  }

  async function crearPeriodo(token: string, nombre: string) {
    const periodoResp = await request(app)
      .post('/api/periodos')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        nombre,
        fechaInicio: '2026-02-01',
        fechaFin: '2026-07-01',
        grupos: ['25']
      })
      .expect(201);
    return periodoResp.body.periodo._id as string;
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
    const periodoId = await crearPeriodo(token, 'Logica de Programacion');
    const [preguntaId] = await crearPreguntasPublicadas({
      app,
      auth: { Authorization: `Bearer ${token}` },
      periodoId,
      externalPrefix: 'plantilla-duplicada',
      preguntas: ['Pregunta base']
    });

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
    const periodoId = await crearPeriodo(token, 'Logica de Programacion');
    const [preguntaA, preguntaB] = await crearPreguntasPublicadas({
      app,
      auth: { Authorization: `Bearer ${token}` },
      periodoId,
      externalPrefix: 'plantilla-duplicada-update',
      preguntas: ['Pregunta A', 'Pregunta B']
    });

    await crearPlantilla(token, periodoId, 'Primer Parcial', [preguntaA]);
    const plantillaDosId = await crearPlantilla(token, periodoId, 'Segundo Parcial', [preguntaB]);

    const resp = await request(app)
      .post(`/api/examenes/plantillas/${encodeURIComponent(plantillaDosId)}`)
      .set({ Authorization: `Bearer ${token}` })
      .send({ titulo: 'primer parcial' })
      .expect(409);

    expect(resp.body.error?.codigo ?? resp.body.codigo).toBe('PLANTILLA_DUPLICADA');
  });

  it('permite el mismo titulo activo en materias distintas', async () => {
    const token = await registrar('same-title-different-subject@local.test');
    const periodoUnoId = await crearPeriodo(token, 'Logica de Programacion');
    const periodoDosId = await crearPeriodo(token, 'Inteligencia de Negocios');
    const [preguntaUnoId] = await crearPreguntasPublicadas({
      app,
      auth: { Authorization: `Bearer ${token}` },
      periodoId: periodoUnoId,
      externalPrefix: 'plantilla-materia-uno',
      preguntas: ['Pregunta materia uno']
    });
    const [preguntaDosId] = await crearPreguntasPublicadas({
      app,
      auth: { Authorization: `Bearer ${token}` },
      periodoId: periodoDosId,
      externalPrefix: 'plantilla-materia-dos',
      preguntas: ['Pregunta materia dos']
    });

    await crearPlantilla(token, periodoUnoId, 'Segundo Parcial', [preguntaUnoId]);
    const plantillaDosId = await crearPlantilla(token, periodoDosId, 'Segundo Parcial', [preguntaDosId]);

    expect(plantillaDosId).toBeTruthy();
  });
});

