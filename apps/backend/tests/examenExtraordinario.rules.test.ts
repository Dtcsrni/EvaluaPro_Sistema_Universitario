import { describe, expect, it } from 'vitest';
import { calcularCalificacion } from '../src/modulos/modulo_calificacion/servicioCalificacion.js';
import { resolverCorteExamen } from '../src/modulos/modulo_analiticas/servicioListaAcademica.js';
import { esquemaGenerarExamenesLote } from '../src/modulos/modulo_generacion_pdf/validacionesExamenes.js';

const plantillaId = '11111111-1111-4111-8111-111111111111';
const alumnoUno = '22222222-2222-4222-8222-222222222222';
const alumnoDos = '33333333-3333-4333-8333-333333333333';
const lote = { plantillaId, confirmarMasivo: true, loteId: 'EXT_1234' };

describe('exámenes extraordinarios', () => {
  it('requiere alumnos únicos para generar un extraordinario por lote', () => {
    expect(esquemaGenerarExamenesLote.safeParse({
      ...lote,
      tipoExamen: 'extraordinario',
      alumnoIds: [alumnoUno, alumnoDos]
    }).success).toBe(true);
    expect(esquemaGenerarExamenesLote.safeParse({ ...lote, tipoExamen: 'extraordinario' }).success).toBe(false);
    expect(esquemaGenerarExamenesLote.safeParse({
      ...lote,
      tipoExamen: 'extraordinario',
      alumnoIds: [alumnoUno, alumnoUno]
    }).success).toBe(false);
    expect(esquemaGenerarExamenesLote.safeParse({ ...lote, alumnoIds: [alumnoUno] }).success).toBe(false);
    expect(esquemaGenerarExamenesLote.safeParse({ ...lote, tipoExamen: 'ordinario' }).success).toBe(false);
  });

  it('califica el examen sin producir componentes ni cortes ordinarios', () => {
    const resultado = calcularCalificacion(8, 10, 0, 5, 5, 'extraordinario');
    expect(resultado.calificacionFinalTexto).toBeTruthy();
    expect(resultado.evaluacionContinuaTexto).toBeUndefined();
    expect(resultado.proyectoTexto).toBeUndefined();
    expect(resultado.calificacionParcialTexto).toBeUndefined();
    expect(resultado.calificacionGlobalTexto).toBeUndefined();
    expect(resolverCorteExamen('extraordinario', 'Parcial 1')).toBeNull();
    expect(resolverCorteExamen('extraordinario', 'Examen Global')).toBeNull();
  });
});
