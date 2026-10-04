import { describe, expect, it } from 'vitest';
import {
  calcularColumnasFisicasParcial2,
  COLUMNA_EXAMEN_PARCIAL_2,
  COLUMNA_PRACTICA_PARCIAL_2,
  COLUMNA_TAREAS_PARCIAL_2
} from '../src/modulos/modulo_analiticas/servicioListaFisicaParcial2.js';

describe('proyección de columnas físicas del Segundo Parcial', () => {
  it('pondera tareas por puntos, deriva 60/40 y suma examen en escalas del libro', () => {
    const resultado = calcularColumnasFisicasParcial2({
      alumnoId: 'alumno-1',
      mapeosClassroom: [
        { courseId: 'curso', courseWorkId: 'tarea-1', corte: 2, destinoColumna: COLUMNA_TAREAS_PARCIAL_2 },
        { courseId: 'curso', courseWorkId: 'tarea-2', corte: 2, destinoColumna: COLUMNA_TAREAS_PARCIAL_2 },
        { courseId: 'curso', courseWorkId: 'practica', corte: 2, destinoColumna: COLUMNA_PRACTICA_PARCIAL_2 }
      ],
      evidencias: [
        { alumnoId: 'alumno-1', fuente: 'classroom', estadoCaptura: 'calificada', calificacionDecimal: 9, classroomData: { courseId: 'curso', courseWorkId: 'tarea-1', maxPoints: 100, submissionState: 'RETURNED' } },
        { alumnoId: 'alumno-1', fuente: 'classroom', estadoCaptura: 'calificada', calificacionDecimal: 5, classroomData: { courseId: 'curso', courseWorkId: 'tarea-2', maxPoints: 200, submissionState: 'RETURNED' } },
        { alumnoId: 'alumno-1', fuente: 'classroom', estadoCaptura: 'calificada', calificacionDecimal: 10, classroomData: { courseId: 'curso', courseWorkId: 'practica', maxPoints: 10, submissionState: 'RETURNED' } }
      ],
      calificacionesManuales: [
        { alumnoId: 'alumno-1', componente: COLUMNA_PRACTICA_PARCIAL_2, calificacion: 7.5 },
        { alumnoId: 'alumno-1', componente: COLUMNA_EXAMEN_PARCIAL_2, calificacion: 4.5 }
      ],
      examenAutomatico: 4.25
    });

    expect(resultado).toMatchObject({
      tareasYEjercicios2doParcial: '6.3333',
      tareasPuntosObtenidos: '190',
      tareasPuntosPosibles: '300',
      practica2doParcial: '7.5',
      evaluacionContinua2doParcial: '3.4',
      examen2doParcial: '4.5',
      examen2doParcialAutomatico: '4.25',
      calificacionSegundoParcial: '7.9'
    });
  });

  it('cuenta como cero solo el faltante confirmado y persistido como NEW o CREATED', () => {
    const base = {
      alumnoId: 'alumno-1',
      mapeosClassroom: [{ courseId: 'curso', courseWorkId: 'tarea', corte: 2, destinoColumna: COLUMNA_TAREAS_PARCIAL_2 }],
      calificacionesManuales: []
    };
    const evidencia = {
      alumnoId: 'alumno-1',
      fuente: 'classroom',
      estadoCaptura: 'pendiente',
      classroomData: { courseId: 'curso', courseWorkId: 'tarea', maxPoints: 100, submissionState: 'NEW' }
    };

    expect(calcularColumnasFisicasParcial2({ ...base, evidencias: [evidencia] }).tareasYEjercicios2doParcial).toBe('');
    expect(calcularColumnasFisicasParcial2({
      ...base,
      evidencias: [{ ...evidencia, metadata: { faltanteClassroomConfirmado: { docenteId: 'docente-1' } } }]
    })).toMatchObject({ tareasYEjercicios2doParcial: '0', tareasPuntosPosibles: '100' });
    expect(calcularColumnasFisicasParcial2({
      ...base,
      evidencias: [{ ...evidencia, classroomData: { ...evidencia.classroomData, submissionState: 'TURNED_IN' }, metadata: { faltanteClassroomConfirmado: true } }]
    }).tareasYEjercicios2doParcial).toBe('');
  });

  it('excluye otras columnas, cortes, mapeos inactivos y evidencia de otros alumnos', () => {
    const resultado = calcularColumnasFisicasParcial2({
      alumnoId: 'alumno-1',
      mapeosClassroom: [
        { courseId: 'curso', courseWorkId: 'ok', corte: 2, destinoColumna: COLUMNA_TAREAS_PARCIAL_2 },
        { courseId: 'curso', courseWorkId: 'otro-corte', corte: 1, destinoColumna: COLUMNA_TAREAS_PARCIAL_2 },
        { courseId: 'curso', courseWorkId: 'otra-columna', corte: 2, destinoColumna: COLUMNA_PRACTICA_PARCIAL_2 },
        { courseId: 'curso', courseWorkId: 'inactivo', corte: 2, destinoColumna: COLUMNA_TAREAS_PARCIAL_2, activo: false }
      ],
      evidencias: [
        { alumnoId: 'alumno-1', fuente: 'classroom', estadoCaptura: 'calificada', calificacionDecimal: 8, classroomData: { courseId: 'curso', courseWorkId: 'ok', maxPoints: 100 } },
        { alumnoId: 'alumno-1', fuente: 'classroom', estadoCaptura: 'calificada', calificacionDecimal: 10, classroomData: { courseId: 'curso', courseWorkId: 'otro-corte', maxPoints: 100 } },
        { alumnoId: 'alumno-1', fuente: 'classroom', estadoCaptura: 'calificada', calificacionDecimal: 10, classroomData: { courseId: 'curso', courseWorkId: 'otra-columna', maxPoints: 100 } },
        { alumnoId: 'alumno-1', fuente: 'classroom', estadoCaptura: 'calificada', calificacionDecimal: 10, classroomData: { courseId: 'curso', courseWorkId: 'inactivo', maxPoints: 100 } },
        { alumnoId: 'alumno-2', fuente: 'classroom', estadoCaptura: 'calificada', calificacionDecimal: 0, classroomData: { courseId: 'curso', courseWorkId: 'ok', maxPoints: 100 } }
      ],
      calificacionesManuales: []
    });

    expect(resultado.tareasYEjercicios2doParcial).toBe('8');
    expect(resultado.tareasPuntosPosibles).toBe('100');
    expect(resultado.practica2doParcial).toBe('');
    expect(resultado.evaluacionContinua2doParcial).toBe('');
    expect(resultado.calificacionSegundoParcial).toBe('');
  });

  it('no permite que la suma del Segundo Parcial exceda 10', () => {
    const resultado = calcularColumnasFisicasParcial2({
      alumnoId: 'alumno-1',
      mapeosClassroom: [{ courseId: 'curso', courseWorkId: 'tarea', corte: 2, destinoColumna: COLUMNA_TAREAS_PARCIAL_2 }],
      evidencias: [{ alumnoId: 'alumno-1', fuente: 'classroom', estadoCaptura: 'calificada', calificacionDecimal: 10, classroomData: { courseId: 'curso', courseWorkId: 'tarea', maxPoints: 100, submissionState: 'RETURNED' } }],
      calificacionesManuales: [
        { alumnoId: 'alumno-1', componente: COLUMNA_PRACTICA_PARCIAL_2, calificacion: 10 },
        { alumnoId: 'alumno-1', componente: COLUMNA_EXAMEN_PARCIAL_2, calificacion: 5.25 }
      ]
    });
    expect(resultado.evaluacionContinua2doParcial).toBe('5');
    expect(resultado.calificacionSegundoParcial).toBe('10');
  });
});
