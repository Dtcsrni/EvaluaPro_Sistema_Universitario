/**
 * pdf.numeroPaginasPlantilla.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { describe, expect, it } from 'vitest';
import { resolverNumeroPaginasPlantilla } from '../src/modulos/modulo_generacion_pdf/domain/resolverNumeroPaginasPlantilla.js';

describe('resolverNumeroPaginasPlantilla', () => {
  it('conserva el objetivo editorial configurado', () => {
    expect(resolverNumeroPaginasPlantilla({ numeroPaginas: 3 })).toBe(3);
    expect(resolverNumeroPaginasPlantilla({ numeroPaginas: 2.9 })).toBe(2);
    expect(resolverNumeroPaginasPlantilla({ numeroPaginas: 1 })).toBe(1);
  });

  it('retorna 1 cuando no hay datos válidos', () => {
    expect(resolverNumeroPaginasPlantilla({})).toBe(1);
    expect(resolverNumeroPaginasPlantilla({ numeroPaginas: 'x' })).toBe(1);
  });
});
