/**
 * listaAcademicaResumen
 *
 * Contrato de agregación de calificaciones por alumno para la consulta docente.
 */
import { describe, expect, it } from 'vitest';
import { construirListaAcademica } from '../src/modulos/modulo_analiticas/servicioListaAcademica.js';

describe('construirListaAcademica', () => {
  it('conserva los dos parciales y el global del mismo alumno', () => {
    const filas = construirListaAcademica(
      [{ _id: 'alumno-1', matricula: 'A-001', nombreCompleto: 'Alumno Uno', grupo: 'A' }],
      [
        { alumnoId: 'alumno-1', tipoExamen: 'parcial', calificacionParcialTexto: '8', createdAt: '2026-01-01' },
        { alumnoId: 'alumno-1', tipoExamen: 'parcial', calificacionParcialTexto: '9', createdAt: '2026-02-01' },
        { alumnoId: 'alumno-1', tipoExamen: 'global', calificacionGlobalTexto: '10', createdAt: '2026-03-01' }
      ],
      []
    );

    expect(filas[0]).toMatchObject({ parcial1: '8', parcial2: '9', global: '10', final: '10' });
  });

  it('asigna cada parcial por la etiqueta de la plantilla y no por el orden de alta', () => {
    const filas = construirListaAcademica(
      [{ _id: 'alumno-1', matricula: 'A-001', nombreCompleto: 'Alumno Uno', grupo: 'A' }],
      [
        {
          alumnoId: 'alumno-1',
          tipoExamen: 'parcial',
          plantillaTitulo: 'Segundo Parcial · Álgebra',
          calificacionParcialTexto: '9',
          createdAt: '2026-01-01'
        },
        {
          alumnoId: 'alumno-1',
          tipoExamen: 'parcial',
          plantillaTitulo: 'Primer Parcial · Álgebra',
          calificacionParcialTexto: '8',
          createdAt: '2026-02-01'
        },
        {
          alumnoId: 'alumno-1',
          tipoExamen: 'global',
          plantillaTitulo: 'Examen Global',
          calificacionGlobalTexto: '10',
          createdAt: '2026-03-01'
        }
      ],
      []
    );

    expect(filas[0]).toMatchObject({ parcial1: '8', parcial2: '9', global: '10', final: '10' });
  });

  it('reconoce las etiquetas ordinales usadas por la lista de calificaciones', () => {
    const filas = construirListaAcademica(
      [{ _id: 'alumno-1', matricula: 'A-001', nombreCompleto: 'Alumno Uno', grupo: 'A' }],
      [
        {
          alumnoId: 'alumno-1',
          tipoExamen: 'parcial',
          plantillaTitulo: 'Exámen 2do Parcial',
          calificacionParcialTexto: '9',
          createdAt: '2026-01-01'
        },
        {
          alumnoId: 'alumno-1',
          tipoExamen: 'parcial',
          plantillaTitulo: 'Examen 1er Parcial',
          calificacionParcialTexto: '8',
          createdAt: '2026-02-01'
        }
      ],
      []
    );

    expect(filas[0]).toMatchObject({ parcial1: '8', parcial2: '9' });
  });

  it('no usa el orden de inserción para reemplazar el parcial 2 en la columna final', () => {
    const filas = construirListaAcademica(
      [{ _id: 'alumno-1', matricula: 'A-001', nombreCompleto: 'Alumno Uno', grupo: 'A' }],
      [
        {
          alumnoId: 'alumno-1',
          tipoExamen: 'parcial',
          plantillaTitulo: 'Segundo Parcial',
          calificacionParcialTexto: '7.5',
          calificacionExamenFinalTexto: '7.5',
          createdAt: '2026-02-01'
        },
        {
          alumnoId: 'alumno-1',
          tipoExamen: 'parcial',
          plantillaTitulo: 'Primer Parcial · Importado',
          calificacionParcialTexto: '8.5',
          calificacionExamenFinalTexto: '8.5',
          createdAt: '2026-03-01'
        }
      ],
      []
    );

    expect(filas[0]).toMatchObject({ parcial1: '8.5', parcial2: '7.5', final: '7.5' });
  });

  it('usa la calificación más reciente por corte cuando hay varias con etiqueta explícita', () => {
    const filas = construirListaAcademica(
      [{ _id: 'alumno-1', matricula: 'A-001', nombreCompleto: 'Alumno Uno', grupo: 'A' }],
      [
        { alumnoId: 'alumno-1', tipoExamen: 'parcial', plantillaTitulo: 'Segundo Parcial', calificacionParcialTexto: '7', createdAt: '2026-02-01' },
        { alumnoId: 'alumno-1', tipoExamen: 'global', plantillaTitulo: 'Examen Global', calificacionGlobalTexto: '8', createdAt: '2026-03-01' },
        { alumnoId: 'alumno-1', tipoExamen: 'parcial', plantillaTitulo: 'Primer Parcial', calificacionParcialTexto: '8', createdAt: '2026-01-01' },
        { alumnoId: 'alumno-1', tipoExamen: 'parcial', plantillaTitulo: 'Segundo Parcial', calificacionParcialTexto: '9', createdAt: '2026-02-15' },
        { alumnoId: 'alumno-1', tipoExamen: 'global', plantillaTitulo: 'Examen Global', calificacionGlobalTexto: '10', createdAt: '2026-03-15' },
        { alumnoId: 'alumno-1', tipoExamen: 'parcial', plantillaTitulo: 'Primer Parcial', calificacionParcialTexto: '9', createdAt: '2026-01-15' }
      ],
      []
    );

    expect(filas[0]).toMatchObject({ parcial1: '9', parcial2: '9', global: '10', final: '10' });
  });

  it('proyecta el Global y la continua Classroom de C3 a las columnas físicas del tercer parcial', () => {
    const filas = construirListaAcademica(
      [{ _id: 'alumno-1', matricula: 'A-001', nombreCompleto: 'Alumno Uno', grupo: 'A' }],
      [],
      [],
      {
        componentesExamen: [{ alumnoId: 'alumno-1', corte: 'global', examenCorteDecimal: 8 }],
        mapeosClassroom: [
          { courseId: 'curso', courseWorkId: 'proyecto', corte: 3, activo: true },
          { courseId: 'curso', courseWorkId: 'p2', corte: 2, activo: true }
        ],
        evidencias: [
          { alumnoId: 'alumno-1', fuente: 'classroom', estadoCaptura: 'calificada', calificacionDecimal: 8.5, classroomData: { courseId: 'curso', courseWorkId: 'proyecto', maxPoints: 100 } },
          { alumnoId: 'alumno-1', fuente: 'classroom', estadoCaptura: 'calificada', calificacionDecimal: 10, classroomData: { courseId: 'curso', courseWorkId: 'p2', maxPoints: 100 } },
          { alumnoId: 'alumno-2', fuente: 'classroom', estadoCaptura: 'calificada', calificacionDecimal: 10, classroomData: { courseId: 'curso', courseWorkId: 'proyecto', maxPoints: 100 } }
        ]
      }
    );

    expect(filas[0]).toMatchObject({
      global: '8.25',
      examenGlobalComponente: '8',
      examenGlobalLista: '4',
      continuaTercerParcialLista: '4.25',
      calificacionTercerParcial: '8.25'
    });
  });

  it('prioriza la captura manual de Global en escala física y calcula el tercer parcial sin fabricar componentes', () => {
    const filas = construirListaAcademica(
      [{ _id: 'alumno-1', matricula: 'A-001', nombreCompleto: 'Alumno Uno', grupo: 'A' }],
      [{ alumnoId: 'alumno-1', tipoExamen: 'global', calificacionExamenFinalTexto: '4', proyectoTexto: '4.5' }],
      [],
      {
        calificacionesManuales: [{ alumnoId: 'alumno-1', componente: 'Exámen Global', calificacion: 4.75, version: 2 }]
      }
    );

    expect(filas[0]).toMatchObject({
      examenGlobalComponente: '',
      examenGlobalLista: '4.75',
      examenGlobalListaVersion: 2,
      continuaTercerParcialLista: '4.5',
      calificacionTercerParcial: '9.25',
      global: '9.25'
    });
  });

  it('limita a 10 las calificaciones agregadas de parciales y globales fuera de rango', () => {
    const filas = construirListaAcademica(
      [{ _id: 'alumno-1', nombreCompleto: 'Alumno Uno' }],
      [
        { alumnoId: 'alumno-1', tipoExamen: 'parcial', plantillaTitulo: 'Primer Parcial', calificacionParcialTexto: '12' },
        { alumnoId: 'alumno-1', tipoExamen: 'global', plantillaTitulo: 'Global', calificacionGlobalTexto: '14' }
      ],
      []
    );
    expect(filas[0]).toMatchObject({ parcial1: '10', global: '10', final: '10' });
  });
});
