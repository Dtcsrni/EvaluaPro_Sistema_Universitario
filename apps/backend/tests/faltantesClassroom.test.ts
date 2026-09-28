/**
 * faltantesClassroom
 *
 * Responsabilidad: proteger el registro manual de faltantes frente a los datos de Classroom.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  borrar: vi.fn(),
  guardar: vi.fn(),
  actualizarMapeo: vi.fn(),
  obtenerMapeo: vi.fn(),
  obtenerAlumno: vi.fn(),
  token: vi.fn(),
  classroomGet: vi.fn()
}));

vi.mock('../src/infraestructura/baseDatos/sqlite.js', () => ({
  prisma: {
    mapeoClassroomEvidencia: { deleteMany: mocks.borrar, upsert: mocks.guardar }
  }
}));
vi.mock('../src/modulos/modulo_integraciones_classroom/modeloMapeoClassroomEvidencia.js', () => ({
  MapeoClassroomEvidencia: { findOne: mocks.obtenerMapeo, findOneAndUpdate: mocks.actualizarMapeo }
}));
vi.mock('../src/modulos/modulo_integraciones_classroom/modeloMapeoClassroomAlumnoCurso.js', () => ({
  MapeoClassroomAlumnoCurso: { findOne: mocks.obtenerAlumno }
}));
vi.mock('../src/modulos/modulo_alumnos/modeloAlumno.js', () => ({ Alumno: {} }));
vi.mock('../src/modulos/modulo_evaluaciones/modeloEvidenciaEvaluacion.js', () => ({ EvidenciaEvaluacion: {} }));
vi.mock('../src/modulos/modulo_integraciones_classroom/modeloIntegracionClassroom.js', () => ({ IntegracionClassroom: {} }));
vi.mock('../src/modulos/modulo_integraciones_classroom/modeloBitacoraSyncClassroom.js', () => ({ BitacoraSyncClassroom: {} }));
vi.mock('../src/modulos/modulo_integraciones_classroom/servicioClassroomGoogle.js', () => ({
  classroomGet: mocks.classroomGet,
  listarActividadesClassroom: vi.fn(),
  listarCursosClassroom: vi.fn(),
  obtenerTokenAccesoClassroom: mocks.token
}));

import { actualizarFaltanteManualClassroom } from '../src/modulos/modulo_integraciones_classroom/servicioSyncClassroom.js';

const solicitud = {
  docenteId: 'docente-1',
  periodoId: '507f1f77bcf86cd799439922',
  alumnoId: '507f1f77bcf86cd799439923',
  courseId: 'course-1',
  courseWorkId: 'work-1',
  faltante: true
};

function configurarActividad() {
  mocks.obtenerMapeo.mockReturnValue({
    lean: vi.fn().mockResolvedValue({ activo: true, incluirEnPromedio: true, corte: 2 })
  });
  mocks.obtenerAlumno.mockReturnValue({
    lean: vi.fn().mockResolvedValue({ classroomUserId: 'student-1' })
  });
  mocks.token.mockResolvedValue('token-docente');
  mocks.classroomGet.mockImplementation(async (_token: string, route: string) => {
    if (route.endsWith('/studentSubmissions')) {
      return { studentSubmissions: [{ userId: 'student-1', state: 'CREATED' }] };
    }
    return { maxPoints: 20, dueDate: { year: 2026, month: 9, day: 20 } };
  });
}

describe('confirmación manual de faltantes Classroom', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-28T12:00:00.000Z'));
    configurarActividad();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('registra 0 solo después de comprobar actividad elegible, fecha vencida y submission sin nota publicada', async () => {
    const resultado = await actualizarFaltanteManualClassroom(solicitud);

    expect(resultado).toMatchObject({ faltante: true, fechaLimite: '2026-09-20T23:59:59.999Z' });
    expect(mocks.classroomGet).toHaveBeenCalledTimes(2);
    expect(mocks.guardar).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: expect.stringMatching(/^faltante-/) },
      create: expect.objectContaining({ estado: 'faltante_confirmado', alumnoId: solicitud.alumnoId })
    }));
    expect(mocks.actualizarMapeo).toHaveBeenCalledWith(expect.any(Object), { $set: {
      puntosPosibles: 20,
      fechaLimiteClassroom: '2026-09-20T23:59:59.999Z'
    } });
  });

  it.each([
    ['sin fecha límite', { maxPoints: 20 }],
    ['antes del vencimiento', { maxPoints: 20, dueDate: { year: 2026, month: 10, day: 20 } }]
  ])('rechaza una actividad %s y no persiste el faltante', async (_caso, courseWork) => {
    mocks.classroomGet.mockResolvedValueOnce(courseWork);

    await expect(actualizarFaltanteManualClassroom(solicitud)).rejects.toMatchObject({ codigo: 'CLASSROOM_ACTIVIDAD_NO_VENCIDA' });
    expect(mocks.guardar).not.toHaveBeenCalled();
  });

  it('rechaza una nota ya publicada en Classroom y no persiste el faltante', async () => {
    mocks.classroomGet.mockImplementation(async (_token: string, route: string) => route.endsWith('/studentSubmissions')
      ? { studentSubmissions: [{ userId: 'student-1', assignedGrade: 0, state: 'RETURNED' }] }
      : { maxPoints: 20, dueDate: { year: 2026, month: 9, day: 20 } });

    await expect(actualizarFaltanteManualClassroom(solicitud)).rejects.toMatchObject({ codigo: 'CLASSROOM_ENTREGA_YA_CALIFICADA' });
    expect(mocks.guardar).not.toHaveBeenCalled();
  });

  it('rechaza un alumno sin submission y una actividad excluida del promedio', async () => {
    mocks.classroomGet.mockImplementation(async (_token: string, route: string) => route.endsWith('/studentSubmissions')
      ? { studentSubmissions: [] }
      : { maxPoints: 20, dueDate: { year: 2026, month: 9, day: 20 } });
    await expect(actualizarFaltanteManualClassroom(solicitud)).rejects.toMatchObject({ codigo: 'CLASSROOM_ENTREGA_NO_ENCONTRADA' });

    mocks.obtenerMapeo.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    await expect(actualizarFaltanteManualClassroom(solicitud)).rejects.toMatchObject({ codigo: 'CLASSROOM_ACTIVIDAD_NO_ELEGIBLE' });
    expect(mocks.guardar).not.toHaveBeenCalled();
  });

  it('permite retirar solo la confirmación propia', async () => {
    await expect(actualizarFaltanteManualClassroom({ ...solicitud, faltante: false }))
      .resolves.toEqual({ faltante: false, fechaLimite: null });
    expect(mocks.borrar).toHaveBeenCalledWith({ where: expect.objectContaining({
      docenteId: solicitud.docenteId,
      periodoId: solicitud.periodoId,
      alumnoId: solicitud.alumnoId,
      courseId: solicitud.courseId,
      courseWorkId: solicitud.courseWorkId
    }) });
    expect(mocks.classroomGet).not.toHaveBeenCalled();
  });
});
