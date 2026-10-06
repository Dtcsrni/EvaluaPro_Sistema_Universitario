/**
 * periodosBorradoDuplicados.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas de periodos: deduplicacion y archivado.
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';
import { crearPreguntasPublicadas } from './_reactivosHelper.js';

describe('periodos (materias)', () => {
  const preguntasPorEscenario = 20;
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
        fechaInicio: '2025-01-01',
        fechaFin: '2025-01-30'
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

  async function crearPlantilla(token: string, periodoId: string, preguntasIds: string[]) {
    const plantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        periodoId,
        tipo: 'parcial',
        titulo: 'Plantilla A',
        numeroPaginas: 2,
        preguntasIds
      })
      .expect(201);
    return plantillaResp.body.plantilla._id as string;
  }

  async function generarExamen(token: string, plantillaId: string) {
    const examenResp = await request(app)
      .post('/api/examenes/generados')
      .set({ Authorization: `Bearer ${token}` })
      .send({ plantillaId });
    if (examenResp.status !== 201) {
      throw new Error(`Generación de examen falló: HTTP ${examenResp.status}, detalle ${JSON.stringify(examenResp.body)}`);
    }
    return examenResp.body.examenGenerado._id as string;
  }

  it('evita crear dos materias con el mismo nombre (normalizado)', async () => {
    const token = await registrar('docente-dup@local.test');

    await crearPeriodo(token, 'Algebra I');

    const resp = await request(app)
      .post('/api/periodos')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        nombre: '  algebra   i  ',
        fechaInicio: '2025-01-01',
        fechaFin: '2025-01-30'
      })
      .expect(409);

    expect(resp.body.error?.codigo ?? resp.body.codigo).toBe('PERIODO_DUPLICADO');
  });

  it('archiva una materia y conserva lo asociado', async () => {
    const token = await registrar('docente-del@local.test');

    const periodoId = await crearPeriodo(token, 'Materia A');
    await crearAlumno(token, periodoId);

    const preguntasIds = await crearPreguntasPublicadas({
      app,
      auth: { Authorization: `Bearer ${token}` },
      periodoId,
      externalPrefix: 'archivar-materia',
      preguntas: Array.from({ length: preguntasPorEscenario }, (_, index) => `Pregunta ${index + 1}`)
    });

    const plantillaId = await crearPlantilla(token, periodoId, preguntasIds);
    await request(app)
      .get(`/api/examenes/plantillas/${encodeURIComponent(plantillaId)}/previsualizar/pdf/visual`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    await generarExamen(token, plantillaId);

    const archivar = await request(app)
      .post(`/api/periodos/${periodoId}/archivar`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);

    expect(archivar.body.ok).toBe(true);

    const periodos = await request(app)
      .get('/api/periodos')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(periodos.body.periodos).toEqual([]);

    const archivadas = await request(app)
      .get('/api/periodos?activo=0')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(archivadas.body.periodos.length).toBe(1);

    const alumnos = await request(app)
      .get('/api/alumnos')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(alumnos.body.alumnos.length).toBe(1);
    expect(alumnos.body.alumnos[0].activo).toBe(false);

    const banco = await request(app)
      .get('/api/banco-preguntas')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(banco.body.preguntas).toEqual([]);

    const bancoArchivado = await request(app)
      .get(`/api/banco-preguntas?activo=0&periodoId=${periodoId}`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(bancoArchivado.body.preguntas.length).toBe(preguntasPorEscenario);
    expect(bancoArchivado.body.preguntas[0].activo).toBe(false);

    const plantillas = await request(app)
      .get('/api/examenes/plantillas')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(plantillas.body.plantillas).toEqual([]);

    const plantillasArchivadas = await request(app)
      .get('/api/examenes/plantillas?archivado=1')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(plantillasArchivadas.body.plantillas.length).toBe(1);

    const generados = await request(app)
      .get('/api/examenes/generados')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(generados.body.examenes).toEqual([]);

    const generadosArchivados = await request(app)
      .get('/api/examenes/generados?archivado=1')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(generadosArchivados.body.examenes.length).toBe(1);
  });

  it('archiva una materia (la oculta de activas) y guarda resumen', async () => {
    const token = await registrar('docente-arch@local.test');

    const periodoId = await crearPeriodo(token, 'Materia Archivable');
    await crearAlumno(token, periodoId);
    await crearPreguntasPublicadas({
      app,
      auth: { Authorization: `Bearer ${token}` },
      periodoId,
      externalPrefix: 'archivar-resumen',
      preguntas: ['Pregunta A']
    });

    const archivar = await request(app)
      .post(`/api/periodos/${periodoId}/archivar`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);

    expect(archivar.body.ok).toBe(true);
    expect(archivar.body.periodo?.activo).toBe(false);
    expect(typeof archivar.body.periodo?.archivadoEn).toBe('string');

    const activas = await request(app)
      .get('/api/periodos')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(activas.body.periodos).toEqual([]);

    const archivadas = await request(app)
      .get('/api/periodos?activo=0')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(archivadas.body.periodos.length).toBe(1);
    expect(archivadas.body.periodos[0]._id).toBe(periodoId);
    expect(archivadas.body.periodos[0].resumenArchivado?.alumnos).toBe(1);
    expect(archivadas.body.periodos[0].resumenArchivado?.bancoPreguntas).toBe(1);

    const alumnos = await request(app)
      .get('/api/alumnos')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(alumnos.body.alumnos.length).toBe(1);
    expect(alumnos.body.alumnos[0].activo).toBe(false);

    const banco = await request(app)
      .get(`/api/banco-preguntas?activo=0&periodoId=${periodoId}`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(banco.body.preguntas.length).toBe(1);
    expect(banco.body.preguntas[0].activo).toBe(false);
  });

  it('permite editar datos de una materia activa', async () => {
    const token = await registrar('docente-edit@local.test');
    const periodoId = await crearPeriodo(token, 'Materia Editable');

    const actualizar = await request(app)
      .post(`/api/periodos/${periodoId}/actualizar`)
      .set({ Authorization: `Bearer ${token}` })
      .send({
        nombre: 'Materia Editable 2',
        fechaInicio: '2025-02-01',
        fechaFin: '2025-02-28',
        grupos: ['A1', 'B1']
      })
      .expect(200);

    expect(actualizar.body.ok).toBe(true);
    expect(actualizar.body.periodo?.nombre).toBe('Materia Editable 2');
    expect(Array.isArray(actualizar.body.periodo?.grupos)).toBe(true);
    expect(actualizar.body.periodo?.grupos).toEqual(['A1', 'B1']);

    const activas = await request(app)
      .get('/api/periodos')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(activas.body.periodos[0]?.nombre).toBe('Materia Editable 2');
  });
});
