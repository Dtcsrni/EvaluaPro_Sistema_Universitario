import { describe, expect, it } from 'vitest';
import { presentarCalificacionExtraordinaria } from '../src/modulos/modulo_calificacion/servicioCalificacion.js';
import { esquemaCalificarExamen } from '../src/modulos/modulo_calificacion/validacionesCalificacion.js';

const evidenciaValida = {
  loteId: '5A20D6E5',
  folio: '88DC8464',
  documentoSha256: 'a'.repeat(64),
  criteriosAplicados: 'Se excluyen seis reactivos defectuosos identificados en la revisión manual.'
};

describe('origen de calificación inferida para extraordinarios', () => {
  it('requiere evidencia explícita al declarar origen inferida manualmente', () => {
    const resultado = esquemaCalificarExamen.safeParse({
      examenGeneradoId: '507f1f77bcf86cd799439011',
      origen: 'inferida manualmente'
    });

    expect(resultado.success).toBe(false);
  });

  it('acepta evidencia trazable con lote, folio, hash y criterios', () => {
    const resultado = esquemaCalificarExamen.safeParse({
      examenGeneradoId: '507f1f77bcf86cd799439011',
      origen: 'inferida manualmente',
      origenEvidencia: evidenciaValida
    });

    expect(resultado.success).toBe(true);
  });

  it('presenta equivalencia sobre 10 y aplica aprobación estrictamente mayor que 6', () => {
    expect(presentarCalificacionExtraordinaria('2.2857142857142857')).toEqual({
      calificacionEquivalenteSobre10Texto: '4.57',
      estadoAprobatorio: 'No aprobatoria'
    });
    expect(presentarCalificacionExtraordinaria('2.29')).toEqual({
      calificacionEquivalenteSobre10Texto: '4.58',
      estadoAprobatorio: 'No aprobatoria'
    });
    expect(presentarCalificacionExtraordinaria('3.00')).toEqual({
      calificacionEquivalenteSobre10Texto: '6.00',
      estadoAprobatorio: 'No aprobatoria'
    });
    expect(presentarCalificacionExtraordinaria('3.01')).toEqual({
      calificacionEquivalenteSobre10Texto: '6.02',
      estadoAprobatorio: 'Aprobatoria'
    });
  });
});
