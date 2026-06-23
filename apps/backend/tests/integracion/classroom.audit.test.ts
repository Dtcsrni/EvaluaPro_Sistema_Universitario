/**
 * classroom.audit.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearApp } from '../../src/app';
import { ErrorAplicacion } from '../../src/compartido/errores/errorAplicacion';
import { Alumno } from '../../src/modulos/modulo_alumnos/modeloAlumno';
import { Periodo } from '../../src/modulos/modulo_alumnos/modeloPeriodo';
import { Docente } from '../../src/modulos/modulo_autenticacion/modeloDocente';
import { crearTokenDocente } from '../../src/modulos/modulo_autenticacion/servicioTokens';
import { EvidenciaEvaluacion } from '../../src/modulos/modulo_evaluaciones/modeloEvidenciaEvaluacion';
import {
  classroomGet,
  listarActividadesClassroom,
  listarCursosClassroom,
  obtenerTokenAccesoClassroom
} from '../../src/modulos/modulo_integraciones_classroom/servicioClassroomGoogle';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

vi.mock('../../src/modulos/modulo_integraciones_classroom/servicioClassroomGoogle', () => ({
  construirUrlOauthClassroom: vi.fn(),
  completarOauthClassroom: vi.fn(),
  obtenerTokenAccesoClassroom: vi.fn(),
  classroomGet: vi.fn(),
  classroomGetAll: vi.fn(),
  listarCursosClassroom: vi.fn(async () => []),
  listarActividadesClassroom: vi.fn(async () => []),
  desconectarOauthClassroom: vi.fn(async () => undefined)
}));

describe('auditoria integración classroom', () => {
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
      _id: '507f1f77bcf86cd799439931',
      nombreCompleto: 'Docente Auditoria Classroom',
      correo: 'classroom-audit@test.com',
      roles: ['docente'],
      activo: true
    });
    const periodo = await Periodo.create({
      _id: '507f1f77bcf86cd799439932',
      docenteId: docente._id,
      nombre: 'Periodo Auditoria Classroom',
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2026-03-31T00:00:00.000Z')
    });
    const token = crearTokenDocente({ docenteId: String(docente._id), roles: ['docente'] });
    return {
      docente,
      periodo,
      auth: { Authorization: `Bearer ${token}` }
    };
  }

  it('reporta no conectado y errores de Google al listar cursos', async () => {
    const { auth } = await crearContexto();

    vi.mocked(obtenerTokenAccesoClassroom).mockRejectedValueOnce(
      new ErrorAplicacion('CLASSROOM_NO_CONECTADO', 'No hay una cuenta Classroom conectada para este docente', 404)
    );

    const noConectado = await request(app).get('/api/evaluaciones/v2/classroom/cursos').set(auth).expect(404);
    expect(noConectado.body?.error?.codigo).toBe('CLASSROOM_NO_CONECTADO');

    vi.mocked(obtenerTokenAccesoClassroom).mockResolvedValueOnce('token-mock');
    vi.mocked(listarCursosClassroom).mockRejectedValueOnce(
      new ErrorAplicacion('CLASSROOM_API_ERROR', 'quota exceeded', 502)
    );

    const errorGoogle = await request(app).get('/api/evaluaciones/v2/classroom/cursos').set(auth).expect(502);
    expect(errorGoogle.body?.error?.codigo).toBe('CLASSROOM_API_ERROR');
    expect(errorGoogle.body?.error?.mensaje).toBe('quota exceeded');
  });

  it('devuelve roster vacio y preview sin submissions cuando el curso no tiene datos', async () => {
    const { periodo, auth } = await crearContexto();

    vi.mocked(obtenerTokenAccesoClassroom).mockResolvedValue('token-mock');
    vi.mocked(classroomGet).mockImplementation(async (_token, path) => {
      if (String(path).includes('/students')) {
        return { students: [] };
      }
      if (String(path).includes('/studentSubmissions')) {
        return { studentSubmissions: [] };
      }
      if (String(path) === 'courses/course-empty') {
        return { id: 'course-empty', name: 'Curso vacio' };
      }
      return {
        id: 'cw-empty',
        title: 'Actividad vacia',
        description: 'Sin entregas',
        maxPoints: 100,
        updateTime: '2026-02-10T10:00:00.000Z'
      };
    });
    vi.mocked(listarActividadesClassroom).mockResolvedValueOnce([
      { id: 'cw-empty', title: 'Actividad vacia', description: 'Sin entregas', maxPoints: 100, state: 'PUBLISHED' }
    ]);

    const roster = await request(app)
      .get(`/api/evaluaciones/v2/classroom/cursos/course-empty/alumnos?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);

    expect(roster.body?.alumnosLocales).toHaveLength(0);
    expect(roster.body?.alumnosClassroom).toHaveLength(0);

    const preview = await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/preview')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        actividades: [{ courseId: 'course-empty', courseWorkId: 'cw-empty', tituloEvidencia: 'Actividad vacia', ponderacion: 1, corte: 1 }]
      })
      .expect(200);

    expect(preview.body?.submissionsProcesadas).toBe(0);
    expect(preview.body?.matched).toBe(0);
    expect(preview.body?.actividades?.[0]?.submissionsProcesadas).toBe(0);
  });

  it('mantiene visibles los unmatched y no persiste evidencias cuando no existe mapeo resoluble', async () => {
    const { docente, periodo, auth } = await crearContexto();

    vi.mocked(obtenerTokenAccesoClassroom).mockResolvedValue('token-mock');
    vi.mocked(classroomGet).mockImplementation(async (_token, path) => {
      if (String(path).includes('/students')) {
        return {
          students: [{ userId: 'user-unmatched', profile: { emailAddress: 'sin-match@classroom.test', name: { fullName: 'Sin Match' } } }]
        };
      }
      if (String(path).includes('/studentSubmissions')) {
        return {
          studentSubmissions: [
            { id: 'submission-unmatched', userId: 'user-unmatched', assignedGrade: 80, state: 'TURNED_IN', updateTime: '2026-02-15T10:00:00.000Z' }
          ]
        };
      }
      if (String(path) === 'courses/course-unmatched') {
        return { id: 'course-unmatched', name: 'Curso Unmatched' };
      }
      return {
        id: 'cw-unmatched',
        title: 'Actividad unmatched',
        description: 'Sin alumno local',
        maxPoints: 100,
        updateTime: '2026-02-15T10:00:00.000Z'
      };
    });

    const preview = await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/preview')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        actividades: [{ courseId: 'course-unmatched', courseWorkId: 'cw-unmatched', tituloEvidencia: 'Actividad unmatched', ponderacion: 1, corte: 1 }]
      })
      .expect(200);

    expect(preview.body?.matched).toBe(0);
    expect(preview.body?.unmatched).toBe(1);
    expect(preview.body?.omitidas).toBe(1);
    expect(preview.body?.actividades?.[0]?.submissions?.[0]?.classroomUserId).toBe('user-unmatched');

    const ejecucion = await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/ejecutar')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        actividades: [{ courseId: 'course-unmatched', courseWorkId: 'cw-unmatched', tituloEvidencia: 'Actividad unmatched', ponderacion: 1, corte: 1 }]
      })
      .expect(200);

    expect(ejecucion.body?.importadas).toBe(0);
    expect(ejecucion.body?.actualizadas).toBe(0);
    expect(ejecucion.body?.omitidas).toBe(1);

    const evidencias = await EvidenciaEvaluacion.find({ docenteId: docente._id, periodoId: periodo._id }).lean();
    expect(evidencias).toHaveLength(0);
  });

  it('procesa paginacion de roster y submissions en importacion persistente', async () => {
    const { docente, periodo, auth } = await crearContexto();
    await Alumno.create({
      _id: '507f1f77bcf86cd799439933',
      docenteId: docente._id,
      periodoId: periodo._id,
      matricula: 'ALU001',
      nombreCompleto: 'Alumno Uno',
      correo: 'uno@classroom.test'
    });
    await Alumno.create({
      _id: '507f1f77bcf86cd799439934',
      docenteId: docente._id,
      periodoId: periodo._id,
      matricula: 'ALU002',
      nombreCompleto: 'Alumno Dos',
      correo: 'dos@classroom.test'
    });

    vi.mocked(obtenerTokenAccesoClassroom).mockResolvedValue('token-mock');
    vi.mocked(classroomGet).mockImplementation(async (_token, path, query) => {
      if (String(path).includes('/students')) {
        if (query?.pageToken === 'page-2') {
          return {
            students: [{ userId: 'user-2', profile: { emailAddress: 'dos@classroom.test', name: { fullName: 'Alumno Dos' } } }]
          };
        }
        return {
          students: [{ userId: 'user-1', profile: { emailAddress: 'uno@classroom.test', name: { fullName: 'Alumno Uno' } } }],
          nextPageToken: 'page-2'
        };
      }
      if (String(path).includes('/studentSubmissions')) {
        if (query?.pageToken === 'page-2') {
          return {
            studentSubmissions: [
              { id: 'submission-2', userId: 'user-2', assignedGrade: 90, state: 'RETURNED', updateTime: '2026-02-16T10:00:00.000Z' }
            ]
          };
        }
        return {
          studentSubmissions: [
            { id: 'submission-1', userId: 'user-1', assignedGrade: 80, state: 'TURNED_IN', updateTime: '2026-02-15T10:00:00.000Z' }
          ],
          nextPageToken: 'page-2'
        };
      }
      if (String(path) === 'courses/course-pages') {
        return { id: 'course-pages', name: 'Curso paginado' };
      }
      return {
        id: 'cw-pages',
        title: 'Actividad paginada',
        description: 'Con varias paginas',
        maxPoints: 100,
        updateTime: '2026-02-16T10:00:00.000Z'
      };
    });

    const ejecucion = await request(app)
      .post('/api/evaluaciones/v2/classroom/importaciones/ejecutar')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        actividades: [{ courseId: 'course-pages', courseWorkId: 'cw-pages', tituloEvidencia: 'Actividad paginada', ponderacion: 1, corte: 1 }]
      })
      .expect(200);

    expect(ejecucion.body?.submissionsProcesadas).toBe(2);
    expect(ejecucion.body?.matched).toBe(2);
    expect(ejecucion.body?.importadas).toBe(2);

    const evidencias = await EvidenciaEvaluacion.find({ docenteId: docente._id, periodoId: periodo._id }).sort({ 'classroom.submissionId': 1 }).lean();
    expect(evidencias).toHaveLength(2);
    expect(evidencias[0]?.classroom?.submissionId).toBe('submission-1');
    expect(evidencias[1]?.classroom?.submissionId).toBe('submission-2');
  });
});
