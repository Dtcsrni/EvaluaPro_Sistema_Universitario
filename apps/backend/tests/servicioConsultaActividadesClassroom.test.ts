import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  curso: vi.fn(),
  actividades: vi.fn(),
  temas: vi.fn(),
  token: vi.fn()
}));

vi.mock('../src/modulos/modulo_integraciones_classroom/servicioClassroomGoogle.js', () => ({
  classroomGet: mocks.curso,
  listarActividadesClassroomConEstado: mocks.actividades,
  listarTemasClassroomConEstado: mocks.temas,
  obtenerTokenAccesoClassroom: mocks.token
}));

import { consultarActividadesClassroomPorTema, enlaceClassroomPermitido } from '../src/modulos/modulo_integraciones_classroom/servicioConsultaActividadesClassroom.js';

describe('consulta de actividades Classroom por tema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.curso.mockResolvedValue({ id: 'course-1', name: 'Marketing Digital', section: 'Grupo A', courseState: 'ACTIVE' });
    mocks.token.mockResolvedValue('access-token');
    mocks.actividades.mockResolvedValue({ completa: true, items: [] });
    mocks.temas.mockResolvedValue({ completa: true, items: [] });
  });

  it('mapea contenido, tema, fechas UTC, categoría, materiales y enlace seguro', async () => {
    mocks.temas.mockResolvedValue({ completa: true, items: [{ topicId: 'topic-2', name: 'Segundo Parcial' }] });
    mocks.actividades.mockResolvedValue({ completa: true, items: [{
      id: 'work-1', title: 'Debate', description: 'Descripción completa', topicId: 'topic-2', workType: 'ASSIGNMENT',
      state: 'PUBLISHED', dueDate: { year: 2026, month: 10, day: 23 }, dueTime: { hours: 15, minutes: 30 },
      creationTime: '2026-10-01T12:00:00Z', updateTime: '2026-10-02T12:00:00Z', maxPoints: 20,
      gradeCategory: { id: 'cat-1', name: 'Tareas', weight: 35 },
      materials: [{ link: { title: 'Guía', url: 'https://docs.google.com/document/d/abc' } }],
      alternateLink: 'https://classroom.google.com/c/course-1/a/work-1/details'
    }] });

    const resultado = await consultarActividadesClassroomPorTema('docente-1', 'course-1');

    expect(mocks.token).toHaveBeenCalledWith('docente-1');
    expect(mocks.curso).toHaveBeenCalledWith('access-token', 'courses/course-1');
    expect(mocks.actividades).toHaveBeenCalledWith('access-token', 'course-1');
    expect(mocks.temas).toHaveBeenCalledWith('access-token', 'course-1');
    expect(resultado).toMatchObject({ completa: true, errores: [], curso: { id: 'course-1', name: 'Marketing Digital', section: 'Grupo A' }, temas: [{ id: 'topic-2', name: 'Segundo Parcial' }] });
    expect(resultado.actividades[0]).toMatchObject({
      id: 'work-1', courseId: 'course-1', courseName: 'Marketing Digital', title: 'Debate', description: 'Descripción completa',
      topicId: 'topic-2', topicName: 'Segundo Parcial', workType: 'ASSIGNMENT', state: 'PUBLISHED',
      dueAtUtc: '2026-10-23T15:30:00.000Z', maxPoints: 20, gradeCategory: { id: 'cat-1', name: 'Tareas', weight: 35 },
      materials: [{ tipo: 'Enlace', nombre: 'Guía', enlace: 'https://docs.google.com/document/d/abc' }],
      alternateLink: 'https://classroom.google.com/c/course-1/a/work-1/details'
    });
  });

  it('conserva una fecha sin hora y no inventa fecha límite ni tema', async () => {
    mocks.actividades.mockResolvedValue({ completa: true, items: [
      { id: 'date-only', dueDate: { year: 2026, month: 2, day: 28 } },
      { id: 'no-due', dueDate: { year: 2026, month: 2, day: 30 }, dueTime: { hours: 9, minutes: 0 } }
    ] });

    const resultado = await consultarActividadesClassroomPorTema('docente-1', 'course-1', 'provided-token');

    expect(mocks.token).not.toHaveBeenCalled();
    expect(resultado.actividades[0]).toMatchObject({ dueDate: { year: 2026, month: 2, day: 28 }, dueTime: null, dueAtUtc: null, topicName: 'Sin tema' });
    expect(resultado.actividades[1]).toMatchObject({ dueDate: null, dueAtUtc: null });
  });

  it('marca resultados parciales sin descartar actividades recibidas', async () => {
    mocks.actividades.mockResolvedValue({ completa: false, errorCode: 'CLASSROOM_API_ERROR', items: [{ id: 'work-1', title: 'Parcial' }] });
    mocks.temas.mockRejectedValue(new Error('temas falló'));

    const resultado = await consultarActividadesClassroomPorTema('docente-1', 'course-1', 'provided-token');

    expect(resultado.completa).toBe(false);
    expect(resultado.actividades).toHaveLength(1);
    expect(resultado.errores).toEqual([
      { recurso: 'actividades', codigo: 'CLASSROOM_API_ERROR' },
      { recurso: 'temas', codigo: 'CLASSROOM_CONSULTA_ERROR' }
    ]);
  });

  it('solo habilita enlaces HTTPS de hosts permitidos', () => {
    expect(enlaceClassroomPermitido('https://classroom.google.com/c/1', 'actividad')).toBe('https://classroom.google.com/c/1');
    expect(enlaceClassroomPermitido('https://evil.example/c/1', 'actividad')).toBeNull();
    expect(enlaceClassroomPermitido('http://docs.google.com/document/d/1', 'material')).toBeNull();
    expect(enlaceClassroomPermitido('https://user:secret@youtube.com/watch?v=1', 'material')).toBeNull();
  });
});
