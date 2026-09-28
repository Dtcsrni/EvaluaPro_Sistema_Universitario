/**
 * validacionesAnaliticas
 *
 * Responsabilidad: proteger los contratos de captura local y faltantes del segundo parcial.
 */
import { describe, expect, it } from 'vitest';
import {
  esquemaActualizarFaltanteManualParcial2,
  esquemaExportarCsv,
  esquemaGuardarCalificacionesManualesParcial2
} from '../src/modulos/modulo_analiticas/validacionesAnaliticas.js';

const periodoId = '507f1f77bcf86cd799439922';

describe('validaciones de analíticas y libro físico', () => {
  it('acepta captura manual válida y rechaza el bono sin nota de examen', () => {
    expect(esquemaGuardarCalificacionesManualesParcial2.safeParse({
      periodoId,
      practicaDecimal: 9.5,
      examenDecimal: 4.25,
      bonoGuiaEstudio: true
    }).success).toBe(true);
    expect(esquemaGuardarCalificacionesManualesParcial2.safeParse({
      periodoId,
      practicaDecimal: null,
      examenDecimal: null,
      bonoGuiaEstudio: true
    }).success).toBe(false);
  });

  it('valida faltantes con IDs completos y no permite campos adicionales', () => {
    const payload = { periodoId, courseId: 'course-1', courseWorkId: 'work-1', faltante: true };
    expect(esquemaActualizarFaltanteManualParcial2.safeParse(payload).success).toBe(true);
    expect(esquemaActualizarFaltanteManualParcial2.safeParse({ ...payload, docenteId: 'forjado' }).success).toBe(false);
  });

  it('mantiene estricto el contrato de exportación CSV', () => {
    expect(esquemaExportarCsv.safeParse({ columnas: ['alumno'], filas: [{ alumno: 'Ana' }] }).success).toBe(true);
    expect(esquemaExportarCsv.safeParse({ columnas: ['alumno'], filas: [{ alumno: 'Ana' }], inesperado: true }).success).toBe(false);
  });
});
