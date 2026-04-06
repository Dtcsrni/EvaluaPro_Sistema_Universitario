import { describe, expect, it } from 'vitest';
import { resolverNumeroPaginasPlantilla } from '../src/modulos/modulo_generacion_pdf/domain/resolverNumeroPaginasPlantilla';

describe('resolverNumeroPaginasPlantilla', () => {
  it('usa numeroPaginas cuando es válido', () => {
    expect(resolverNumeroPaginasPlantilla({ numeroPaginas: 3 })).toBe(3);
    expect(resolverNumeroPaginasPlantilla({ numeroPaginas: 2.9 })).toBe(2);
  });

  it('retorna 1 cuando no hay datos válidos', () => {
    expect(resolverNumeroPaginasPlantilla({})).toBe(1);
    expect(resolverNumeroPaginasPlantilla({ numeroPaginas: 'x' })).toBe(1);
  });
});
