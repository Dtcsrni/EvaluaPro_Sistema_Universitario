/**
 * listaAcademicaResumen.test
 *
 * Responsabilidad: validar la agregación determinista de cortes académicos.
 */
import { describe, expect, it } from 'vitest';
import { construirListaAcademica, resolverCorteExamen } from '../src/modulos/modulo_analiticas/servicioListaAcademica.js';
import { calcularComponentesFisicosParcial2, obtenerFechaLimiteClassroom, proyectarPromedioTareasParcial2 } from '../src/modulos/modulo_analiticas/servicioPromedioTareasParcial2.js';

describe('resumen de lista académica', () => {
  it('resuelve el corte desde títulos institucionales', () => {
    expect(resolverCorteExamen('parcial', 'Primer Parcial')).toBe('parcial1');
    expect(resolverCorteExamen('parcial', 'Segundo Parcial')).toBe('parcial2');
    expect(resolverCorteExamen('global', 'Examen Global')).toBe('global');
  });

  it('conserva Parcial 1, Parcial 2 y Global sin depender del orden de entrada', () => {
    const filas = construirListaAcademica(
      [{ _id: 'alumno-1', matricula: 'A-001', nombreCompleto: 'Pérez López Ana', grupo: 'A' }],
      [
        {
          alumnoId: 'alumno-1',
          tipoExamen: 'global',
          plantillaTitulo: 'Examen Global',
          calificacionGlobalTexto: '9.4',
          calificacionExamenFinalTexto: '9.4',
          createdAt: '2026-05-01T00:00:00.000Z'
        },
        {
          alumnoId: 'alumno-1',
          tipoExamen: 'parcial',
          plantillaTitulo: 'Segundo Parcial',
          calificacionParcialTexto: '8.2',
          calificacionExamenFinalTexto: '8.2',
          createdAt: '2026-04-01T00:00:00.000Z'
        },
        {
          alumnoId: 'alumno-1',
          tipoExamen: 'parcial',
          plantillaTitulo: 'Primer Parcial',
          calificacionParcialTexto: '7.6',
          calificacionExamenFinalTexto: '7.6',
          createdAt: '2026-03-01T00:00:00.000Z'
        }
      ],
      []
    );

    expect(filas[0]).toMatchObject({
      alumnoId: 'alumno-1',
      parcial1: '7.6',
      parcial2: '8.2',
      global: '9.4',
      final: '9.4'
    });
  });

  it('acepta tipos persistidos que ya incluyen el numero de parcial', () => {
    const filas = construirListaAcademica(
      [{ _id: 'alumno-3', matricula: 'A-003', nombreCompleto: 'López Ana', grupo: 'C' }],
      [
        {
          alumnoId: 'alumno-3',
          tipoExamen: 'Parcial 1',
          calificacionParcialTexto: '8.7',
          calificacionExamenFinalTexto: '8.7',
          createdAt: '2026-05-01T00:00:00.000Z'
        }
      ],
      []
    );

    expect(filas[0]).toMatchObject({ parcial1: '8.7', final: '8.7' });
  });

  it('usa parciales antiguos sin título como Parcial 1 y Parcial 2 por fecha', () => {
    const filas = construirListaAcademica(
      [{ _id: 'alumno-2', matricula: 'A-002', nombres: 'Luis', apellidos: 'Gómez Ruiz', grupo: 'B' }],
      [
        { alumnoId: 'alumno-2', tipoExamen: 'parcial', calificacionParcialTexto: '8', createdAt: '2026-04-01T00:00:00.000Z' },
        { alumnoId: 'alumno-2', tipoExamen: 'parcial', calificacionParcialTexto: '6', createdAt: '2026-03-01T00:00:00.000Z' }
      ],
      []
    );

    expect(filas[0]?.parcial1).toBe('6');
    expect(filas[0]?.parcial2).toBe('8');
  });

  it('calcula Tareas y Ejercicios 2do Parcial ponderando por puntos y solo con notas publicadas mapeadas', () => {
    const proyeccion = proyectarPromedioTareasParcial2(
      ['a1', 'a2'],
      [
        { courseId: 'c1', courseWorkId: 'w1', titulo: 'Guía 1' },
        { courseId: 'c1', courseWorkId: 'w2', titulo: 'Cuestionario 2' }
      ],
      [
        { alumnoId: 'a1', classroom: { courseId: 'c1', courseWorkId: 'w1', assignedGrade: 5, maxPoints: 10 }, updatedAt: '2026-09-24T00:00:00Z', _id: 'old' },
        { alumnoId: 'a1', classroom: { courseId: 'c1', courseWorkId: 'w2', assignedGrade: 0, maxPoints: 20 } },
        { alumnoId: 'a1', classroom: { courseId: 'c1', courseWorkId: 'sin-mapeo', assignedGrade: 10, maxPoints: 10 } },
        { alumnoId: 'a1', classroom: { courseId: 'c1', courseWorkId: 'w1', assignedGrade: 8, draftGrade: 10, maxPoints: 10 }, updatedAt: '2026-09-25T00:00:00Z', _id: 'new' },
        { alumnoId: 'a2', classroom: { courseId: 'c1', courseWorkId: 'w1', draftGrade: 7, maxPoints: 10 } }
      ]
    );

    expect(proyeccion.get('a1')).toMatchObject({
      tareasEjerciciosParcial2: '2.67',
      puntosObtenidosParcial2: 8,
      puntosPosiblesParcial2: 30,
      actividadesCalificadasParcial2: 2
    });
    expect(proyeccion.get('a2')).toMatchObject({
      tareasEjerciciosParcial2: '',
      puntosObtenidosParcial2: null,
      puntosPosiblesParcial2: null,
      actividadesCalificadasParcial2: 0
    });
  });

  it('excluye actividades sin puntos posibles y conserva 10 como máximo de escala', () => {
    const proyeccion = proyectarPromedioTareasParcial2(
      ['a1'],
      [{ courseId: 'c1', courseWorkId: 'w1' }, { courseId: 'c1', courseWorkId: 'w2' }],
      [
        { alumnoId: 'a1', classroom: { courseId: 'c1', courseWorkId: 'w1', assignedGrade: 12, maxPoints: 10 } },
        { alumnoId: 'a1', classroom: { courseId: 'c1', courseWorkId: 'w2', assignedGrade: 5, maxPoints: 0 } }
      ]
    );
    expect(proyeccion.get('a1')?.tareasEjerciciosParcial2).toBe('10');
    expect(proyeccion.get('a1')?.puntosPosiblesParcial2).toBe(10);
  });

  it('promedia todas las actividades del segundo parcial por omisión y respeta las excluidas por el docente', () => {
    const actividades = [
      { courseId: 'c1', courseWorkId: 'w1' },
      { courseId: 'c1', courseWorkId: 'w2', incluirEnPromedio: false }
    ];
    const proyeccion = proyectarPromedioTareasParcial2(
      ['a1'],
      actividades,
      [
        { alumnoId: 'a1', classroom: { courseId: 'c1', courseWorkId: 'w1', assignedGrade: 8, maxPoints: 10 } },
        { alumnoId: 'a1', classroom: { courseId: 'c1', courseWorkId: 'w2', assignedGrade: 0, maxPoints: 10 } }
      ]
    );

    expect(proyeccion.get('a1')).toMatchObject({
      tareasEjerciciosParcial2: '8',
      puntosObtenidosParcial2: 8,
      puntosPosiblesParcial2: 10,
      actividadesCalificadasParcial2: 1
    });
  });

  it('mantiene Tareas y Ejercicios 2do Parcial en blanco si se excluyen todas las actividades', () => {
    const proyeccion = proyectarPromedioTareasParcial2(
      ['a1'],
      [{ courseId: 'c1', courseWorkId: 'w1', incluirEnPromedio: false }],
      [{ alumnoId: 'a1', classroom: { courseId: 'c1', courseWorkId: 'w1', assignedGrade: 9, maxPoints: 10 } }]
    ).get('a1');

    expect(proyeccion).toMatchObject({
      tareasEjerciciosParcial2: '',
      puntosObtenidosParcial2: null,
      puntosPosiblesParcial2: null,
      actividadesCalificadasParcial2: 0,
      actividadesParcial2: []
    });
  });

  it('cuenta como cero únicamente la falta marcada para una actividad vencida y sin nota publicada', () => {
    const proyeccion = proyectarPromedioTareasParcial2(
      ['a1'],
      [
        { courseId: 'c1', courseWorkId: 'faltante', puntosPosibles: 20, fechaLimite: '2026-09-20T18:00:00.000Z' },
        { courseId: 'c1', courseWorkId: 'futura', puntosPosibles: 30, fechaLimite: '2026-10-20T18:00:00.000Z' },
        { courseId: 'c1', courseWorkId: 'cero-publicado', puntosPosibles: 10 }
      ],
      [{ alumnoId: 'a1', classroom: { courseId: 'c1', courseWorkId: 'cero-publicado', assignedGrade: 0, maxPoints: 10 } }],
      [
        { alumnoId: 'a1', courseId: 'c1', courseWorkId: 'faltante' },
        { alumnoId: 'a1', courseId: 'c1', courseWorkId: 'futura' },
        { alumnoId: 'a1', courseId: 'c1', courseWorkId: 'cero-publicado' }
      ],
      new Date('2026-09-28T12:00:00.000Z')
    ).get('a1');

    expect(proyeccion).toMatchObject({
      tareasEjerciciosParcial2: '0',
      puntosObtenidosParcial2: 0,
      puntosPosiblesParcial2: 30,
      actividadesCalificadasParcial2: 1
    });
    expect(proyeccion?.actividadesParcial2).toEqual(expect.arrayContaining([
      expect.objectContaining({ courseWorkId: 'faltante', estado: 'faltante', faltanteConfirmado: true, puntosObtenidos: null }),
      expect.objectContaining({ courseWorkId: 'futura', estado: 'pendiente', faltanteConfirmado: false }),
      expect.objectContaining({ courseWorkId: 'cero-publicado', estado: 'calificada', faltanteConfirmado: false, puntosObtenidos: 0 })
    ]));
  });

  it('interpreta fecha límite con hora UTC y fecha sin hora hasta el fin del día', () => {
    expect(obtenerFechaLimiteClassroom({
      dueDate: { year: 2026, month: 9, day: 20 },
      dueTime: { hours: 12, minutes: 30, seconds: 15, nanos: 500_000_000 }
    })?.toISOString()).toBe('2026-09-20T12:30:15.500Z');
    expect(obtenerFechaLimiteClassroom({ dueDate: { year: 2026, month: 9, day: 20 } })?.toISOString())
      .toBe('2026-09-20T23:59:59.999Z');
    expect(obtenerFechaLimiteClassroom({ dueDate: { year: 2026, month: 2, day: 30 } })).toBeNull();
    expect(obtenerFechaLimiteClassroom({ dueDate: { year: 2026, month: 9, day: 20 }, dueTime: { hours: 24 } })).toBeNull();
  });

  it('combina columnas físicas con práctica, examen y bono manual sin completar insumos ausentes', () => {
    expect(calcularComponentesFisicosParcial2({
      tareasEjerciciosParcial2: '7.5', practicaParcial2: 8.5, examenManualParcial2: 4.75, bonoGuiaEstudio: true
    })).toEqual({
      evaluacionContinuaParcial2: '3.95',
      calificacionExamenConBonoParcial2: '5',
      calificacionSegundoParcialFisica: '8.95'
    });
    expect(calcularComponentesFisicosParcial2({
      tareasEjerciciosParcial2: '7.5', practicaParcial2: null, examenManualParcial2: null, bonoGuiaEstudio: false
    })).toEqual({
      evaluacionContinuaParcial2: '',
      calificacionExamenConBonoParcial2: '',
      calificacionSegundoParcialFisica: ''
    });
  });
});
