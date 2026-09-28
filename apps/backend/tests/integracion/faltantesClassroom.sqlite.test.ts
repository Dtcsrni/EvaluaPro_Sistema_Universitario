/**
 * faltantesClassroom.sqlite
 *
 * Responsabilidad: comprobar que la confirmación docente persiste en la SQLite temporal y no escribe en Classroom.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { Docente } from '../../src/modulos/modulo_autenticacion/modeloDocente.js';
import { Alumno } from '../../src/modulos/modulo_alumnos/modeloAlumno.js';
import { Periodo } from '../../src/modulos/modulo_alumnos/modeloPeriodo.js';
import { MapeoClassroomEvidencia } from '../../src/modulos/modulo_integraciones_classroom/modeloMapeoClassroomEvidencia.js';
import { MapeoClassroomAlumnoCurso } from '../../src/modulos/modulo_integraciones_classroom/modeloMapeoClassroomAlumnoCurso.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTest.js';

const classroom = vi.hoisted(() => ({
  token: vi.fn(),
  get: vi.fn(),
  publicarNota: vi.fn()
}));

vi.mock('../../src/modulos/modulo_integraciones_classroom/servicioClassroomGoogle.js', () => ({
  construirUrlOauthClassroom: vi.fn(),
  completarOauthClassroom: vi.fn(),
  desconectarOauthClassroom: vi.fn(),
  classroomGet: classroom.get,
  listarActividadesClassroom: vi.fn(),
  listarCursosClassroom: vi.fn(),
  obtenerTokenAccesoClassroom: classroom.token
}));

import { actualizarFaltanteManualClassroom } from '../../src/modulos/modulo_integraciones_classroom/servicioSyncClassroom.js';

describe('confirmación de faltante Classroom con SQLite temporal', () => {
  beforeAll(async () => {
    await conectarSqliteTest();
  });

  beforeEach(async () => {
    await limpiarSqliteTest();
    vi.clearAllMocks();
    classroom.token.mockResolvedValue('token-prueba');
    classroom.get.mockImplementation(async (_token: string, route: string) => {
      if (route.endsWith('/studentSubmissions')) {
        return { studentSubmissions: [{ userId: 'student-1', state: 'CREATED' }] };
      }
      return { maxPoints: 20, dueDate: { year: 2026, month: 9, day: 20 } };
    });
  });

  afterAll(async () => {
    await cerrarSqliteTest();
  });

  it('persiste la confirmación docente solo para actividad vencida sin nota publicada', async () => {
    const docenteId = '507f1f77bcf86cd799439921';
    const periodoId = '507f1f77bcf86cd799439922';
    const alumnoId = '507f1f77bcf86cd799439923';
    await Docente.create({ _id: docenteId, nombreCompleto: 'Docente prueba', correo: 'prueba@classroom.test', roles: ['docente'], activo: true });
    await Periodo.create({
      _id: periodoId,
      docenteId,
      nombre: 'Periodo prueba',
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2026-12-31T00:00:00.000Z')
    });
    await Alumno.create({
      _id: alumnoId,
      docenteId,
      periodoId,
      matricula: `ALU-${alumnoId.slice(-4)}`,
      nombreCompleto: 'Alumno prueba',
      correo: `alumno-${alumnoId.slice(-4)}@classroom.test`
    });
    await MapeoClassroomEvidencia.create({
      docenteId, periodoId, alumnoId: 'todos', courseId: 'course-1', courseWorkId: 'work-1',
      estado: 'mapeada', corte: 2, activo: true, incluirEnPromedio: true
    });
    await MapeoClassroomAlumnoCurso.create({
      docenteId, periodoId, alumnoId, courseId: 'course-1', classroomUserId: 'student-1'
    });

    const resultado = await actualizarFaltanteManualClassroom({
      docenteId, periodoId, alumnoId, courseId: 'course-1', courseWorkId: 'work-1', faltante: true
    });

    const persistido = await prisma.mapeoClassroomEvidencia.findFirst({
      where: { docenteId, periodoId, alumnoId, courseId: 'course-1', courseWorkId: 'work-1' }
    });
    expect(resultado.faltante).toBe(true);
    expect(persistido?.estado).toBe('faltante_confirmado');
    expect(JSON.parse(String(persistido?.metadata))).toMatchObject({
      tipo: 'faltante_confirmado_docente',
      actualizadoPor: docenteId,
      fechaLimiteClassroom: '2026-09-20T23:59:59.999Z'
    });
    expect(classroom.publicarNota).not.toHaveBeenCalled();
  });

  it('rechaza una calificación ya publicada y conserva la base temporal sin insertar faltante', async () => {
    const docenteId = '507f1f77bcf86cd799439931';
    const periodoId = '507f1f77bcf86cd799439932';
    const alumnoId = '507f1f77bcf86cd799439933';
    await Docente.create({ _id: docenteId, nombreCompleto: 'Docente prueba', correo: 'prueba2@classroom.test', roles: ['docente'], activo: true });
    await Periodo.create({
      _id: periodoId,
      docenteId,
      nombre: 'Periodo prueba',
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2026-12-31T00:00:00.000Z')
    });
    await Alumno.create({
      _id: alumnoId,
      docenteId,
      periodoId,
      matricula: `ALU-${alumnoId.slice(-4)}`,
      nombreCompleto: 'Alumno prueba',
      correo: `alumno-${alumnoId.slice(-4)}@classroom.test`
    });
    await MapeoClassroomEvidencia.create({
      docenteId, periodoId, alumnoId: 'todos', courseId: 'course-1', courseWorkId: 'work-1',
      estado: 'mapeada', corte: 2, activo: true, incluirEnPromedio: true
    });
    await MapeoClassroomAlumnoCurso.create({
      docenteId, periodoId, alumnoId, courseId: 'course-1', classroomUserId: 'student-1'
    });
    classroom.get.mockImplementation(async (_token: string, route: string) => route.endsWith('/studentSubmissions')
      ? { studentSubmissions: [{ userId: 'student-1', state: 'RETURNED', assignedGrade: 0 }] }
      : { maxPoints: 20, dueDate: { year: 2026, month: 9, day: 20 } });

    await expect(actualizarFaltanteManualClassroom({
      docenteId, periodoId, alumnoId, courseId: 'course-1', courseWorkId: 'work-1', faltante: true
    })).rejects.toMatchObject({ codigo: 'CLASSROOM_ENTREGA_YA_CALIFICADA' });
    expect(await prisma.mapeoClassroomEvidencia.count({ where: { docenteId, periodoId, alumnoId } })).toBe(0);
  });
});
