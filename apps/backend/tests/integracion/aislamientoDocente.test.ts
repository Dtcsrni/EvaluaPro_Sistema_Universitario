// Pruebas de aislamiento por docente.
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

describe('aislamiento por docente', () => {
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
        nombre: 'Periodo A',
        fechaInicio: '2025-01-01',
        fechaFin: '2025-06-01'
      })
      .expect(201);
    return periodoResp.body.periodo._id as string;
  }

  async function crearAlumno(token: string, periodoId: string) {
    const alumnoResp = await request(app)
      .post('/api/alumnos')
      .set({ Authorization: `Bearer ${token}` })
      .send({ periodoId, matricula: 'CUH512410168', nombreCompleto: 'Alumno A', grupo: 'G1' })
      .expect(201);
    return alumnoResp.body.alumno._id as string;
  }

  async function crearPregunta(token: string, periodoId: string) {
    const preguntaResp = await request(app)
      .post('/api/banco-preguntas')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        periodoId,
        enunciado: 'Pregunta A',
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

  async function crearPlantilla(token: string, periodoId: string, preguntaId: string) {
    const plantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        periodoId,
        tipo: 'parcial',
        titulo: 'Plantilla A',
        totalReactivos: 1,
        preguntasIds: [preguntaId]
      })
      .expect(201);
    return plantillaResp.body.plantilla._id as string;
  }

  async function generarExamen(token: string, plantillaId: string) {
    const examenResp = await request(app)
      .post('/api/examenes/generados')
      .set({ Authorization: `Bearer ${token}` })
      .send({ plantillaId })
      .expect(201);
    return {
      examenGeneradoId: examenResp.body.examenGenerado._id as string,
      folio: examenResp.body.examenGenerado.folio as string
    };
  }

  async function prepararEscenarioBase(token: string) {
    const periodoId = await crearPeriodo(token);
    const alumnoId = await crearAlumno(token, periodoId);
    const preguntaId = await crearPregunta(token, periodoId);
    const plantillaId = await crearPlantilla(token, periodoId, preguntaId);
    const { examenGeneradoId, folio } = await generarExamen(token, plantillaId);
    return { periodoId, alumnoId, preguntaId, plantillaId, examenGeneradoId, folio };
  }

  it('no lista recursos de otro docente (periodos/alumnos/banco/plantillas)', async () => {
    const tokenA = await registrar('docente-a-list@local.test');
    const tokenB = await registrar('docente-b-list@local.test');

    await prepararEscenarioBase(tokenA);

    const periodosB = await request(app)
      .get('/api/periodos')
      .set({ Authorization: `Bearer ${tokenB}` })
      .expect(200);
    expect(periodosB.body.periodos).toEqual([]);

    const alumnosB = await request(app)
      .get('/api/alumnos')
      .set({ Authorization: `Bearer ${tokenB}` })
      .expect(200);
    expect(alumnosB.body.alumnos).toEqual([]);

    const preguntasB = await request(app)
      .get('/api/banco-preguntas')
      .set({ Authorization: `Bearer ${tokenB}` })
      .expect(200);
    expect(preguntasB.body.preguntas).toEqual([]);

    const plantillasB = await request(app)
      .get('/api/examenes/plantillas')
      .set({ Authorization: `Bearer ${tokenB}` })
      .expect(200);
    expect(plantillasB.body.plantillas).toEqual([]);
  });

  it('no permite generar un examen con plantilla de otro docente', async () => {
    const tokenA = await registrar('docente-a-plantilla@local.test');
    const tokenB = await registrar('docente-b-plantilla@local.test');

    const { plantillaId } = await prepararEscenarioBase(tokenA);

    const respuesta = await request(app)
      .post('/api/examenes/generados')
      .set({ Authorization: `Bearer ${tokenB}` })
      .send({ plantillaId })
      .expect(403);

    expect(respuesta.body.error?.codigo ?? respuesta.body.codigo).toBe('NO_AUTORIZADO');
  });

  it('no permite vincular ni calificar examenes de otro docente', async () => {
    const tokenA = await registrar('docente-a-entrega@local.test');
    const tokenB = await registrar('docente-b-entrega@local.test');

    const { alumnoId, examenGeneradoId, folio, periodoId } = await prepararEscenarioBase(tokenA);

    // Vincular por id: falla con 403.
    const vincularId = await request(app)
      .post('/api/entregas/vincular')
      .set({ Authorization: `Bearer ${tokenB}` })
      .send({ examenGeneradoId, alumnoId })
      .expect(403);
    expect(vincularId.body.error?.codigo ?? vincularId.body.codigo).toBe('NO_AUTORIZADO');

    // Vincular por folio: no encuentra porque filtra por { folio, docenteId }.
    const vincularFolio = await request(app)
      .post('/api/entregas/vincular-folio')
      .set({ Authorization: `Bearer ${tokenB}` })
      .send({ folio, alumnoId })
      .expect(404);
    expect(vincularFolio.body.error?.codigo ?? vincularFolio.body.codigo).toBe('EXAMEN_NO_ENCONTRADO');

    // Calificar: falla por autorizacion por objeto.
    const calificar = await request(app)
      .post('/api/calificaciones/calificar')
      .set({ Authorization: `Bearer ${tokenB}` })
      .send({ examenGeneradoId, alumnoId, aciertos: 1, totalReactivos: 1 })
      .expect(403);
    expect(calificar.body.error?.codigo ?? calificar.body.codigo).toBe('NO_AUTORIZADO');

    // Export CSV calificaciones: no debe filtrar datos (CSV vacío salvo cabecera).
    const csv = await request(app)
      .get(`/api/analiticas/calificaciones-csv?periodoId=${encodeURIComponent(periodoId)}`)
      .set({ Authorization: `Bearer ${tokenB}` })
      .expect(200);

    expect(String(csv.headers['content-type'] ?? '')).toContain('text/csv');
    expect(csv.text).not.toContain('A001');
  });

  it('no lista banderas de otro docente', async () => {
    const tokenA = await registrar('docente-a-banderas@local.test');
    const tokenB = await registrar('docente-b-banderas@local.test');

    const { alumnoId, examenGeneradoId } = await prepararEscenarioBase(tokenA);
    await request(app)
      .post('/api/analiticas/banderas')
      .set({ Authorization: `Bearer ${tokenA}` })
      .send({
        examenGeneradoId,
        alumnoId,
        tipo: 'otro',
        severidad: 'baja',
        descripcion: 'bandera solo docente A'
      })
      .expect(201);

    const respuesta = await request(app)
      .get('/api/analiticas/banderas')
      .set({ Authorization: `Bearer ${tokenB}` })
      .expect(200);

    expect(respuesta.body.banderas).toEqual([]);
  });

  it('no permite acceder a examenes de otro docente', async () => {
    const tokenA = await registrar('docente-a@local.test');
    const tokenB = await registrar('docente-b@local.test');

    const periodoResp = await request(app)
      .post('/api/periodos')
      .set({ Authorization: `Bearer ${tokenA}` })
      .send({
        nombre: 'Periodo A',
        fechaInicio: '2025-01-01',
        fechaFin: '2025-06-01'
      })
      .expect(201);
    const periodoId = periodoResp.body.periodo._id as string;

    const preguntaResp = await request(app)
      .post('/api/banco-preguntas')
      .set({ Authorization: `Bearer ${tokenA}` })
      .send({
        periodoId,
        enunciado: 'Pregunta A',
        opciones: [
          { texto: 'A', esCorrecta: true },
          { texto: 'B', esCorrecta: false },
          { texto: 'C', esCorrecta: false },
          { texto: 'D', esCorrecta: false },
          { texto: 'E', esCorrecta: false }
        ]
      })
      .expect(201);
    const preguntaId = preguntaResp.body.pregunta._id as string;

    const plantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set({ Authorization: `Bearer ${tokenA}` })
      .send({
        periodoId,
        tipo: 'parcial',
        titulo: 'Plantilla A',
        totalReactivos: 1,
        preguntasIds: [preguntaId]
      })
      .expect(201);
    const plantillaId = plantillaResp.body.plantilla._id as string;

    const examenResp = await request(app)
      .post('/api/examenes/generados')
      .set({ Authorization: `Bearer ${tokenA}` })
      .send({ plantillaId })
      .expect(201);
    const folio = examenResp.body.examenGenerado.folio as string;

    const respuesta = await request(app)
      .get(`/api/examenes/generados/folio/${folio}`)
      .set({ Authorization: `Bearer ${tokenB}` })
      .expect(404);

    expect(respuesta.body.mensaje ?? respuesta.body.error?.codigo).toBeDefined();
  });
});

