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

    expect(hoja.getCell('AL11').value).toBe(3);
    expect(hoja.getCell('AM11').value).toBe(4);
    expect(formulaDeCelda(hoja.getCell('AN11').value)).toBe('IF(COUNT(AL11,AM11)<2,"",MIN(10,MAX(0,SUM(AL11,AM11))))');

    expect(hoja.getCell('AO11').value).toBeNull();
    expect(hoja.getCell('AP11').value).toBeNull();
    expect(formulaDeCelda(hoja.getCell('AQ11').value)).toBe('IF(COUNT(AO11,AP11)<2,"",((AO11*0.6+AP11*0.4)/2))');
    expect(hoja.getCell('AR11').value).toBeNull();
    expect(formulaDeCelda(hoja.getCell('AS11').value)).toBe('IF(COUNT(AQ11,AR11)<2,"",MIN(10,MAX(0,SUM(AQ11,AR11))))');

    expect(hoja.getCell('AT11').value).toBe(5);
    expect(hoja.getCell('AU11').value).toBe(4);
    expect(formulaDeCelda(hoja.getCell('AV11').value)).toBe('IF(COUNT(AT11,AU11)<2,"",MIN(10,MAX(0,SUM(AT11,AU11))))');

    expect(formulaDeCelda(hoja.getCell('AW11').value)).toBe('IF(ISNUMBER(AV11),(AV11*5/10)*60/5,"")');
    expect(formulaDeCelda(hoja.getCell('AX11').value)).toBe('IF(COUNT(AN11,AS11)<2,"",(AN11*5)/10+(AS11*5)/10)');
    expect(formulaDeCelda(hoja.getCell('AY11').value)).toBe('IF(ISNUMBER(AX11),(AX11*5/10)*40/5,"")');
    expect(formulaDeCelda(hoja.getCell('AZ11').value)).toBe('IF(COUNT(AW11,AY11)<2,"",AW11+AY11)');
    expect(formulaDeCelda(hoja.getCell('BA11').value)).toBe('IF(ISNUMBER(AZ11),AZ11*0.1,"")');
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
    expect(formulaDeCelda(hoja.getCell('AQ11').value)).toBe('IF(COUNT(AO11,AP11)<2,"",((AO11*0.6+AP11*0.4)/2))');
    expect(formulaDeCelda(hoja.getCell('AS11').value)).toBe('IF(COUNT(AQ11,AR11)<2,"",MIN(10,MAX(0,SUM(AQ11,AR11))))');
    expect(hoja.getCell('AV11').value).toBe(9);
    expect(formulaDeCelda(hoja.getCell('AW11').value)).toBe('IF(ISNUMBER(AV11),(AV11*5/10)*60/5,"")');
    expect(formulaDeCelda(hoja.getCell('BA11').value)).toBe('IF(ISNUMBER(AZ11),AZ11*0.1,"")');
  });

  it('mantiene vacías las calificaciones y el cierre cuando faltan componentes por capturar', async () => {
    const buffer = await generarXlsxCalificacionesProduccion({
      docenteNombre: 'Docente SV',
      nombrePeriodo: 'Sistemas Visuales',
      cicloLectivo: 'Enero-Febrero 2026',
      alumnos: [{ _id: 'alumno-1', matricula: 'A001', nombreCompleto: 'Alumno Uno' }],
      calificaciones: []
    });

    const hoja = await cargarHojaLibro(buffer);
    for (const [celda, formula] of [
      ['AQ11', 'IF(COUNT(AO11,AP11)<2,"",((AO11*0.6+AP11*0.4)/2))'],
      ['AN11', 'IF(COUNT(AL11,AM11)<2,"",MIN(10,MAX(0,SUM(AL11,AM11))))'],
      ['AS11', 'IF(COUNT(AQ11,AR11)<2,"",MIN(10,MAX(0,SUM(AQ11,AR11))))'],
      ['AV11', 'IF(COUNT(AT11,AU11)<2,"",MIN(10,MAX(0,SUM(AT11,AU11))))'],
      ['AX11', 'IF(COUNT(AN11,AS11)<2,"",(AN11*5)/10+(AS11*5)/10)'],
      ['AZ11', 'IF(COUNT(AW11,AY11)<2,"",AW11+AY11)']
    ] as const) {
      expect(formulaDeCelda(hoja.getCell(celda).value)).toBe(formula);
    }
  });

  it('prioriza las capturas manuales del contrato físico sobre la nota automática', async () => {
    const buffer = await generarXlsxCalificacionesProduccion({
      docenteNombre: 'Docente', nombrePeriodo: 'Periodo', cicloLectivo: '',
      alumnos: [{ _id: 'alumno-1', matricula: 'A001', nombreCompleto: 'Alumno Uno' }],
      calificaciones: [{ alumnoId: 'alumno-1', tipoExamen: 'parcial', plantillaTitulo: 'Segundo Parcial', calificacionExamenFinalTexto: '4.75' }],
      listaAcademica: [{ alumnoId: 'alumno-1', tareasYEjercicios2doParcial: '8.5', practica2doParcial: '7', examen2doParcial: '4.25' }]
    });
    const hoja = await cargarHojaLibro(buffer);
    expect(hoja.getCell('AO11').value).toBe(8.5);
    expect(hoja.getCell('AP11').value).toBe(7);
    expect(formulaDeCelda(hoja.getCell('AQ11').value)).toBe('IF(COUNT(AO11,AP11)<2,"",((AO11*0.6+AP11*0.4)/2))');
    expect(hoja.getCell('AR11').value).toBe(4.25);
    expect(formulaDeCelda(hoja.getCell('AS11').value)).toBe('IF(COUNT(AQ11,AR11)<2,"",MIN(10,MAX(0,SUM(AQ11,AR11))))');
  });

  it('exporta Global y continua de C3 desde la lista, limita el parcial a 10', async () => {
    const buffer = await generarXlsxCalificacionesProduccion({
      docenteNombre: 'Docente', nombrePeriodo: 'Materia', cicloLectivo: '',
      alumnos: [{ _id: 'alumno-1', matricula: 'A001', nombreCompleto: 'Alumno Uno' }],
      calificaciones: [],
      listaAcademica: [{ alumnoId: 'alumno-1', examenGlobalLista: '5.5', continuaTercerParcialLista: '5', calificacionTercerParcial: '10' }]
    });
    const hoja = await cargarHojaLibro(buffer);
    expect(hoja.getCell('AT11').value).toBe(5.5);
    expect(hoja.getCell('AU11').value).toBe(5);
    expect(hoja.getCell('AV11').value).toBe(10);
  });

  it('exporta una sola columna de bono con fórmulas de exención por final 10 y cascada Global→P2→P1', async () => {
    const buffer = await generarXlsxCalificacionesProduccion({
      docenteNombre: 'Docente', nombrePeriodo: 'Materia', cicloLectivo: '',
      alumnos: [{ _id: 'alumno-1', matricula: 'A001', nombreCompleto: 'Alumno Uno' }],
      calificaciones: [
        { alumnoId: 'alumno-1', tipoExamen: 'parcial', plantillaTitulo: 'Primer Parcial', evaluacionContinuaTexto: '4', calificacionExamenFinalTexto: '4', createdAt: '2026-01-01' }
      ],
      listaAcademica: [{
        alumnoId: 'alumno-1', tareasYEjercicios2doParcial: '10', practica2doParcial: '10', examen2doParcial: '4',
        examenGlobalLista: '4', continuaTercerParcialLista: '4', bonoExtracurricularSolicitado: '0.5'
      }]
    });
    const hoja = await cargarHojaLibro(buffer);
    expect(hoja.getCell('BB10').value).toBe('Bono extracurricular');
    expect(formulaDeCelda(hoja.getCell('BB11').value)).toContain('SUM(MIN(IF(AND(AND(COUNT(AL11,AM11)=2,');
    expect(formulaDeCelda(hoja.getCell('BB11').value)).toContain('>=10),0,0.5)');
    expect(formulaDeCelda(hoja.getCell('AV11').value)).toContain('IF(ISNUMBER(AT11),MAX(0,5-AT11),0)+IF(ISNUMBER(AU11),MAX(0,5-AU11),0)');
    expect(formulaDeCelda(hoja.getCell('AS11').value)).toContain('5.25-AR11');
    expect(formulaDeCelda(hoja.getCell('AN11').value)).toContain('>=10),0,0.5)-MIN(IF(AND(AND(COUNT(AL11,AM11)=2,');
  });

  it('exporta el bono ya guardado desde las notas base y evita aplicarlo dos veces', async () => {
    const buffer = await generarXlsxCalificacionesProduccion({
      docenteNombre: 'Docente', nombrePeriodo: 'Materia', cicloLectivo: '',
      alumnos: [{ _id: 'alumno-1', matricula: 'A001', nombreCompleto: 'Alumno Uno' }],
      calificaciones: [
        { alumnoId: 'alumno-1', tipoExamen: 'parcial', plantillaTitulo: 'Primer Parcial', evaluacionContinuaTexto: '4', calificacionExamenFinalTexto: '4', calificacionParcialTexto: '8', createdAt: '2026-01-01' },
        { alumnoId: 'alumno-1', tipoExamen: 'parcial', plantillaTitulo: 'Segundo Parcial', calificacionParcialTexto: '9.5', createdAt: '2026-02-01' },
        { alumnoId: 'alumno-1', tipoExamen: 'global', plantillaTitulo: 'Examen Global', calificacionExamenFinalTexto: '4.5', proyectoTexto: '5', calificacionGlobalTexto: '9.5', createdAt: '2026-03-01' }
      ],
      listaAcademica: [{
        alumnoId: 'alumno-1', tareasYEjercicios2doParcial: '10', practica2doParcial: '10', examen2doParcial: '4.5',
        calificacionSegundoParcial: '10', examenGlobalLista: '4.5', continuaTercerParcialLista: '5',
        calificacionTercerParcial: '10', bonoExtracurricularSolicitado: '0.5'
      }]
    });

    const hoja = await cargarHojaLibro(buffer);
    const bono = formulaDeCelda(hoja.getCell('BB11').value) ?? '';
    expect(bono).toContain('0.6*9.5');
    expect(bono).toContain('MAX(0,10-9.5)');
    expect(formulaDeCelda(hoja.getCell('AS11').value)).toContain('SUM(AQ11,AR11)');
  });

  it('exporta el registro más reciente de cada corte igual que la consulta académica', async () => {
    const buffer = await generarXlsxCalificacionesProduccion({
      docenteNombre: 'Docente SV',
      nombrePeriodo: 'Sistemas Visuales',
      cicloLectivo: 'Enero-Febrero 2026',
      alumnos: [{ _id: 'alumno-1', matricula: 'A001', nombreCompleto: 'Alumno Uno' }],
      calificaciones: [
        { alumnoId: 'alumno-1', tipoExamen: 'parcial', plantillaTitulo: 'Segundo Parcial', evaluacionContinuaTexto: '2', calificacionExamenFinalTexto: '3', calificacionParcialTexto: '5', createdAt: '2026-02-01' },
        { alumnoId: 'alumno-1', tipoExamen: 'global', plantillaTitulo: 'Examen Global', calificacionExamenFinalTexto: '3', proyectoTexto: '2', calificacionGlobalTexto: '5', createdAt: '2026-03-01' },
        { alumnoId: 'alumno-1', tipoExamen: 'parcial', plantillaTitulo: 'Primer Parcial', evaluacionContinuaTexto: '3', calificacionExamenFinalTexto: '4', calificacionParcialTexto: '7', createdAt: '2026-01-01' },
        { alumnoId: 'alumno-1', tipoExamen: 'parcial', plantillaTitulo: 'Segundo Parcial', evaluacionContinuaTexto: '4', calificacionExamenFinalTexto: '5', calificacionParcialTexto: '9', createdAt: '2026-02-15' },
        { alumnoId: 'alumno-1', tipoExamen: 'global', plantillaTitulo: 'Examen Global', calificacionExamenFinalTexto: '5', proyectoTexto: '4', calificacionGlobalTexto: '9', createdAt: '2026-03-15' },
        { alumnoId: 'alumno-1', tipoExamen: 'parcial', plantillaTitulo: 'Primer Parcial', evaluacionContinuaTexto: '4', calificacionExamenFinalTexto: '5', calificacionParcialTexto: '9', createdAt: '2026-01-15' }
      ]
    });

    const hoja = await cargarHojaLibro(buffer);
    expect(hoja.getCell('AL11').value).toBe(4);
    expect(hoja.getCell('AM11').value).toBe(5);
    expect(hoja.getCell('AN11').value).toBe(9);
    expect(hoja.getCell('AO11').value).toBeNull();
    expect(hoja.getCell('AP11').value).toBeNull();
    expect(formulaDeCelda(hoja.getCell('AQ11').value)).toBe('IF(COUNT(AO11,AP11)<2,"",((AO11*0.6+AP11*0.4)/2))');
    expect(hoja.getCell('AR11').value).toBeNull();
    expect(formulaDeCelda(hoja.getCell('AS11').value)).toBe('IF(COUNT(AQ11,AR11)<2,"",MIN(10,MAX(0,SUM(AQ11,AR11))))');
    expect(hoja.getCell('AT11').value).toBe(5);
    expect(hoja.getCell('AU11').value).toBe(4);
    expect(hoja.getCell('AV11').value).toBe(9);
  });
});
