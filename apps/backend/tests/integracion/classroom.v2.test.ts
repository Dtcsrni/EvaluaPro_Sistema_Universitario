import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearApp } from '../../src/app';
import { Alumno } from '../../src/modulos/modulo_alumnos/modeloAlumno';
import { Periodo } from '../../src/modulos/modulo_alumnos/modeloPeriodo';
import { Docente } from '../../src/modulos/modulo_autenticacion/modeloDocente';
import { crearTokenDocente } from '../../src/modulos/modulo_autenticacion/servicioTokens';
import { EvidenciaEvaluacion } from '../../src/modulos/modulo_evaluaciones/modeloEvidenciaEvaluacion';
import { classroomGet, obtenerTokenAccesoClassroom } from '../../src/modulos/modulo_integraciones_classroom/servicioClassroomGoogle';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

vi.mock('../../src/modulos/modulo_integraciones_classroom/servicioClassroomGoogle', () => ({
  construirUrlOauthClassroom: vi.fn(),
  completarOauthClassroom: vi.fn(),
  obtenerTokenAccesoClassroom: vi.fn(),
  classroomGet: vi.fn(),
  classroomGetAll: vi.fn(),
  listarCursosClassroom: vi.fn(async () => [
    { id: 'course-1', name: 'Programación', section: 'A', courseState: 'ACTIVE' }
  ]),
  listarActividadesClassroom: vi.fn(async () => [
    { id: 'cw-1', title: 'Actividad 1', description: 'Desc', maxPoints: 100, state: 'PUBLISHED' }
  ]),
  desconectarOauthClassroom: vi.fn(async () => undefined)
}));

describe('classroom v2', () => {
  const app = crearApp();

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  async function crearContexto() {
    const docente = await Docente.create({
      _id: '507f1f77bcf86cd799439921',
      nombreCompleto: 'Docente Classroom V2',
      correo: 'classroomv2@test.com',
      roles: ['docente'],
      activo: true
    });
    const periodo = await Periodo.create({
      _id: '507f1f77bcf86cd799439922',
      docenteId: docente._id,
      nombre: 'Periodo Classroom V2',
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2026-03-31T00:00:00.000Z')
    });
    const alumno1 = await Alumno.create({
      _id: '507f1f77bcf86cd799439923',
      docenteId: docente._id,
      periodoId: periodo._id,
      matricula: 'ALU001',
      nombreCompleto: 'Alumno Uno',
      correo: 'uno@classroom.test'
    });
    const alumno2 = await Alumno.create({
      _id: '507f1f77bcf86cd799439924',
      docenteId: docente._id,
      periodoId: periodo._id,
      matricula: 'MAT002',
      nombreCompleto: 'Alumno Dos'
    });
    const alumno3 = await Alumno.create({
      _id: '507f1f77bcf86cd799439925',
      docenteId: docente._id,
      periodoId: periodo._id,
      matricula: 'ALU003',
      nombreCompleto: 'Alumno Tres'
    });
    const token = crearTokenDocente({ docenteId: String(docente._id), roles: ['docente'] });
    return {
      docente,
      periodo,
      alumno1,
      alumno2,
      alumno3,
      auth: { Authorization: `Bearer ${token}` }
    };
  }

  // Cobertura integral del flujo Classroom v2 en un solo escenario end-to-end.
  it('lista cursos, actividades, mapea alumnos y ejecuta preview/importación con historial', async () => {
    const { docente, periodo, alumno3, auth } = await crearContexto();

    vi.mocked(obtenerTokenAccesoClassroom).mockResolvedValue('token-mock');
    vi.mocked(classroomGet).mockImplementation(async (_token, path) => {
      if (String(path) === 'courses/course-1') {
        return { id: 'course-1', name: 'Programación', section: 'A' };
      }
      if (String(path).includes('/students')) {
        return {
          students: [
            { userId: 'user-1', profile: { emailAddress: 'uno@classroom.test', name: { fullName: 'Alumno Uno' } } },
            { userId: 'user-2', profile: { emailAddress: 'mat002@institucion.test', name: { fullName: 'Alumno Dos' } } },
            { userId: 'user-3', profile: { emailAddress: 'tres@classroom.test', name: { fullName: 'Alumno Tres' } } }
          ]
        };
      }
      if (String(path).includes('/studentSubmissions')) {
        return {
          studentSubmissions: [
            { id: 'submission-1', userId: 'user-1', assignedGrade: 90, state: 'TURNED_IN', updateTime: '2026-02-10T10:00:00.000Z' },
            { id: 'submission-2', userId: 'user-2', state: 'CREATED', updateTime: '2026-02-11T10:00:00.000Z' },
            { id: 'submission-3', userId: 'user-3', assignedGrade: 70, state: 'RETURNED', updateTime: '2026-02-12T10:00:00.000Z' }
          ]
        };
      }
      return {
        id: 'cw-1',
        title: 'Actividad 1',
        description: 'Desc',
        maxPoints: 100,
        updateTime: '2026-02-10T10:00:00.000Z'
      };
    });

    const estadoInicial = await request(app).get('/api/evaluaciones/v2/classroom/estado').set(auth).expect(200);
    expect(estadoInicial.body?.estado?.conectado).toBe(false);

    const cursos = await request(app).get('/api/evaluaciones/v2/classroom/cursos').set(auth).expect(200);
    expect(cursos.body?.cursos).toHaveLength(1);

    const actividades = await request(app)
      .get(`/api/evaluaciones/v2/classroom/cursos/course-1/actividades?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);
    expect(actividades.body?.actividades).toHaveLength(1);

    const roster = await request(app)
      .get(`/api/evaluaciones/v2/classroom/cursos/course-1/alumnos?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);
    expect(roster.body?.alumnosClassroom).toHaveLength(3);
    expect(roster.body?.alumnosClassroom?.find((fila: { classroomUserId: string }) => fila.classroomUserId === 'user-1')?.matchStrategy).toBe('email');
    expect(roster.body?.alumnosClassroom?.find((fila: { classroomUserId: string }) => fila.classroomUserId === 'user-2')?.matchStrategy).toBe('matricula');

    await request(app)
      .put('/api/evaluaciones/v2/classroom/cursos/course-1/mapeo-alumnos')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        asignaciones: [{ classroomUserId: 'user-3', alumnoId: String(alumno3._id) }]
      })
      .expect(200);

    const preview = await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/preview')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        actividades: [{ courseId: 'course-1', courseWorkId: 'cw-1', tituloEvidencia: 'Actividad importada', ponderacion: 1, corte: 1 }]
      })
      .expect(200);

    expect(preview.body?.matched).toBe(3);
    expect(preview.body?.pending).toBe(1);
    expect(preview.body?.graded).toBe(2);
    expect(preview.body?.unmatched).toBe(0);

    const ejecucion = await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/ejecutar')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        actividades: [{ courseId: 'course-1', courseWorkId: 'cw-1', tituloEvidencia: 'Actividad importada', ponderacion: 1, corte: 1 }]
      })
      .expect(200);

    expect(ejecucion.body?.importadas).toBe(3);
    const evidencias = await EvidenciaEvaluacion.find({ docenteId: docente._id, periodoId: periodo._id }).sort({ 'classroom.submissionId': 1 }).lean();
    expect(evidencias).toHaveLength(3);
    expect(evidencias.find((item) => item.classroom?.submissionId === 'submission-2')?.estadoCaptura).toBe('pendiente');
    expect(evidencias.find((item) => item.classroom?.submissionId === 'submission-1')?.estadoCaptura).toBe('calificada');

    const historial = await request(app)
      .get(`/api/evaluaciones/v2/classroom/importaciones/historial?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);
    expect(historial.body?.historial?.length).toBeGreaterThanOrEqual(2);
  });
});
