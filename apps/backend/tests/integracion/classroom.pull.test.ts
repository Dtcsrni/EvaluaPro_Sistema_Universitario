import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearApp } from '../../src/app';
import { Alumno } from '../../src/modulos/modulo_alumnos/modeloAlumno';
import { Periodo } from '../../src/modulos/modulo_alumnos/modeloPeriodo';
import { Docente } from '../../src/modulos/modulo_autenticacion/modeloDocente';
import { crearTokenDocente } from '../../src/modulos/modulo_autenticacion/servicioTokens';
import { EvidenciaEvaluacion } from '../../src/modulos/modulo_evaluaciones/modeloEvidenciaEvaluacion';
import {
  classroomGet,
  completarOauthClassroom,
  construirUrlOauthClassroom,
  obtenerTokenAccesoClassroom
} from '../../src/modulos/modulo_integraciones_classroom/servicioClassroomGoogle';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

vi.mock('../../src/modulos/modulo_integraciones_classroom/servicioClassroomGoogle', () => ({
  construirUrlOauthClassroom: vi.fn(),
  completarOauthClassroom: vi.fn(),
  obtenerTokenAccesoClassroom: vi.fn(),
  classroomGet: vi.fn()
}));

describe('integración classroom pull', () => {
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

  async function crearDocenteConAuth() {
    const docente = await Docente.create({
      _id: '507f1f77bcf86cd799439901',
      nombreCompleto: 'Docente Classroom',
      correo: 'classroom@test.com',
      roles: ['docente'],
      activo: true
    });
    const token = crearTokenDocente({ docenteId: String(docente._id), roles: ['docente'] });
    return { docente, auth: { Authorization: `Bearer ${token}` } };
  }

  it('inicia oauth y procesa callback', async () => {
    const { auth } = await crearDocenteConAuth();

    vi.mocked(construirUrlOauthClassroom).mockReturnValue({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?mock=1',
      state: 'mock-state'
    });

    const iniciar = await request(app).get('/api/integraciones/classroom/oauth/iniciar').set(auth).expect(200);
    expect(iniciar.body?.url).toContain('accounts.google.com');

    vi.mocked(completarOauthClassroom).mockResolvedValue({
      docenteId: '507f1f77bcf86cd799439901',
      correoGoogle: 'classroom@test.com',
      conectado: true
    });

    const callbackOk = await request(app)
      .get('/api/integraciones/classroom/oauth/callback?code=ok-code&state=ok-state')
      .expect(200);
    expect(String(callbackOk.text)).toContain('classroom-oauth');

    const callbackError = await request(app)
      .get('/api/integraciones/classroom/oauth/callback?error=access_denied')
      .expect(400);
    expect(String(callbackError.text)).toContain('error OAuth');
  });

  it('mapea coursework y ejecuta pull idempotente', async () => {
    const { docente, auth } = await crearDocenteConAuth();
    const periodo = await Periodo.create({
      _id: '507f1f77bcf86cd799439902',
      docenteId: docente._id,
      nombre: 'Sistemas Visuales',
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2026-03-31T00:00:00.000Z')
    });
    const alumno = await Alumno.create({
      _id: '507f1f77bcf86cd799439903',
      docenteId: docente._id,
      periodoId: periodo._id,
      matricula: 'CUH512410168',
      nombreCompleto: 'Alumno Classroom'
    });

    await request(app)
      .post('/api/integraciones/classroom/mapear')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        courseId: 'course-1',
        courseWorkId: 'cw-1',
        tituloEvidencia: 'Evidencia Classroom 1',
        ponderacion: 1,
        corte: 1,
        asignacionesAlumnos: [{ classroomUserId: 'user-1', alumnoId: String(alumno._id) }]
      })
      .expect(201);

    vi.mocked(obtenerTokenAccesoClassroom).mockResolvedValue('token-mock');
    vi.mocked(classroomGet).mockImplementation(async (_token, path) => {
      if (String(path).includes('/students')) {
        return {
          students: [{ userId: 'user-1', profile: { emailAddress: 'alumno@classroom.test', name: { fullName: 'Alumno Classroom' } } }]
        };
      }
      if (String(path).includes('/studentSubmissions')) {
        return {
          studentSubmissions: [{ id: 'submission-1', userId: 'user-1', assignedGrade: 95, updateTime: '2026-02-10T10:00:00.000Z' }]
        };
      }
      return {
        title: 'Tarea Classroom',
        description: 'Descripción',
        maxPoints: 100,
        updateTime: '2026-02-10T10:00:00.000Z'
      };
    });

    const pull1 = await request(app)
      .post('/api/integraciones/classroom/pull')
      .set(auth)
      .send({ periodoId: String(periodo._id) })
      .expect(200);
    expect(pull1.body?.importadas).toBe(1);
    expect(pull1.body?.actualizadas).toBe(0);

    const evidenciasTrasPull1 = await EvidenciaEvaluacion.find({
      docenteId: docente._id,
      periodoId: periodo._id,
      alumnoId: alumno._id
    }).lean();
    expect(evidenciasTrasPull1).toHaveLength(1);
    expect(Number(evidenciasTrasPull1[0]?.calificacionDecimal)).toBeCloseTo(9.5, 4);

    const pull2 = await request(app)
      .post('/api/integraciones/classroom/pull')
      .set(auth)
      .send({ periodoId: String(periodo._id) })
      .expect(200);
    expect(pull2.body?.importadas).toBe(0);
    expect(pull2.body?.actualizadas).toBe(1);

    const evidenciasTrasPull2 = await EvidenciaEvaluacion.find({
      docenteId: docente._id,
      periodoId: periodo._id,
      alumnoId: alumno._id
    }).lean();
    expect(evidenciasTrasPull2).toHaveLength(1);
  });
});
