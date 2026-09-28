/**
 * analiticas.xlsx.sv.contract.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { Workbook, type CellFormulaValue } from 'exceljs';
import { describe, expect, it } from 'vitest';
import { generarXlsxCalificacionesProduccion } from '../src/modulos/modulo_analiticas/servicioExportacionXlsxCalificaciones.js';

async function cargarHojaLibro(buffer: Buffer) {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);
  const hoja = workbook.getWorksheet('LIBRO DE CALIFICACIONES');
  if (!hoja) {
    throw new Error('No se encontro hoja LIBRO DE CALIFICACIONES');
  }
  return hoja;
}

function formulaDeCelda(valor: unknown): string | null {
  if (valor && typeof valor === 'object' && 'formula' in (valor as Record<string, unknown>)) {
    return String((valor as CellFormulaValue).formula || '');
  }
  return null;
}

describe('exportacion XLSX SV contractual', () => {
  it('preserva formulas contractuales AL..BA cuando faltan totales historicos', async () => {
    const buffer = await generarXlsxCalificacionesProduccion({
      docenteNombre: 'Docente SV',
      nombrePeriodo: 'Sistemas Visuales',
      cicloLectivo: 'Enero-Febrero 2026',
      alumnos: [{ _id: 'alumno-1', matricula: 'A001', nombreCompleto: 'Alumno Uno', correo: 'a001@cuh.mx' }],
      calificacionesFisicasParcial2: {
        'alumno-1': { tareasEjerciciosParcial2: '7.5', practicaParcial2: '8', calificacionExamenConBonoParcial2: '5.25' }
      },
      calificaciones: [
        {
          alumnoId: 'alumno-1',
          tipoExamen: 'parcial',
          evaluacionContinuaTexto: '3',
          calificacionExamenFinalTexto: '4',
          createdAt: '2026-01-20T00:00:00.000Z'
        },
        {
          alumnoId: 'alumno-1',
          tipoExamen: 'parcial',
          evaluacionContinuaTexto: '4',
          calificacionExamenFinalTexto: '4.5',
          createdAt: '2026-02-20T00:00:00.000Z'
        },
        {
          alumnoId: 'alumno-1',
          tipoExamen: 'global',
          calificacionExamenFinalTexto: '5',
          proyectoTexto: '4',
          createdAt: '2026-03-20T00:00:00.000Z'
        }
      ]
    });

    const hoja = await cargarHojaLibro(buffer);

    expect(hoja.getCell('C10').value).toBe('Nombre del alumno');
    expect(['AO', 'AP', 'AQ', 'AR', 'AS'].map((columna) => hoja.getCell(`${columna}10`).value)).toEqual([
      'Tareas  y Ejercicios 2do Parcial',
      'Practica 2do Parcial',
      'Evaluación Continua 2do Parcial',
      'Exámen 2do Parcial',
      'Calificación Segundo Parcial'
    ]);
    expect(hoja.getCell('AV10').value).toBe('Calificación Tercer Parcial');
    expect(hoja.getCell('AW10').value).toBe('Calificación Tercer Parcial ');
    expect(hoja.getCell('AX10').value).toBe('Porcentaje 1er y Segundo Parcial');
    expect(hoja.getCell('AY10').value).toBe('Porcentaje 1er y Segundo Parcial ');

    expect(hoja.getCell('AL11').value).toBe(3);
    expect(hoja.getCell('AM11').value).toBe(4);
    expect(formulaDeCelda(hoja.getCell('AN11').value)).toBe('AL11+AM11');

    expect(hoja.getCell('AO11').value).toBe(7.5);
    expect(hoja.getCell('AP11').value).toBe(8);
    expect(formulaDeCelda(hoja.getCell('AQ11').value)).toBe('IF(COUNT(AO11:AP11)<2,"",(AO11*0.6+AP11*0.4)/2)');
    expect(hoja.getCell('AR11').value).toBe(5.25);
    expect(formulaDeCelda(hoja.getCell('AS11').value)).toBe('IF(COUNT(AQ11:AR11)<2,"",AQ11+AR11)');

    expect(hoja.getCell('AT11').value).toBe(5);
    expect(hoja.getCell('AU11').value).toBe(4);
    expect(formulaDeCelda(hoja.getCell('AV11').value)).toBe('AT11+AU11');

    expect(formulaDeCelda(hoja.getCell('AW11').value)).toBe('(AV11*5/10)*60/5');
    expect(formulaDeCelda(hoja.getCell('AX11').value)).toBe('(AN11*5)/10+(AS11*5)/10');
    expect(formulaDeCelda(hoja.getCell('AY11').value)).toBe('(AX11*5/10)*40/5');
    expect(formulaDeCelda(hoja.getCell('AZ11').value)).toBe('AW11+AY11');
    expect(formulaDeCelda(hoja.getCell('BA11').value)).toBe('AZ11*0.1');
  });

  it('usa totales historicos cuando existen sin alterar formulas de cierre', async () => {
    const buffer = await generarXlsxCalificacionesProduccion({
      docenteNombre: 'Docente SV',
      nombrePeriodo: 'Sistemas Visuales',
      cicloLectivo: 'Enero-Febrero 2026',
      alumnos: [{ _id: 'alumno-1', matricula: 'A001', nombreCompleto: 'Alumno Uno', correo: 'a001@cuh.mx' }],
      calificaciones: [
        {
          alumnoId: 'alumno-1',
          tipoExamen: 'parcial',
          evaluacionContinuaTexto: '3',
          calificacionExamenFinalTexto: '4',
          calificacionParcialTexto: '7',
          createdAt: '2026-01-20T00:00:00.000Z'
        },
        {
          alumnoId: 'alumno-1',
          tipoExamen: 'parcial',
          evaluacionContinuaTexto: '4',
          calificacionExamenFinalTexto: '4.5',
          calificacionParcialTexto: '8.5',
          createdAt: '2026-02-20T00:00:00.000Z'
        },
        {
          alumnoId: 'alumno-1',
          tipoExamen: 'global',
          calificacionExamenFinalTexto: '5',
          proyectoTexto: '4',
          calificacionGlobalTexto: '9',
          createdAt: '2026-03-20T00:00:00.000Z'
        }
      ]
    });

    const hoja = await cargarHojaLibro(buffer);
    expect(hoja.getCell('AN11').value).toBe(7);
    expect(hoja.getCell('AR11').value).toBeNull();
    expect(formulaDeCelda(hoja.getCell('AS11').value)).toBe('IF(COUNT(AQ11:AR11)<2,"",AQ11+AR11)');
    expect(hoja.getCell('AV11').value).toBe(9);
    expect(formulaDeCelda(hoja.getCell('AW11').value)).toBe('(AV11*5/10)*60/5');
    expect(formulaDeCelda(hoja.getCell('BA11').value)).toBe('AZ11*0.1');
  });
});
