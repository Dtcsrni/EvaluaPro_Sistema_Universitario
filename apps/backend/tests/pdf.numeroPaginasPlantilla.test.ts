/**
 * pdf.numeroPaginasPlantilla.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { describe, expect, it } from 'vitest';
import { resolverNumeroPaginasPlantilla } from '../src/modulos/modulo_generacion_pdf/domain/resolverNumeroPaginasPlantilla.js';
import { resolverPaginasObjetivoPreferidas } from '../src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.js';

describe('resolverNumeroPaginasPlantilla', () => {
  it('conserva el objetivo editorial configurado', () => {
    expect(resolverNumeroPaginasPlantilla({ numeroPaginas: 3 })).toBe(3);
    expect(resolverNumeroPaginasPlantilla({ numeroPaginas: 2.9 })).toBe(2);
    expect(resolverNumeroPaginasPlantilla({ numeroPaginas: 1 })).toBe(1);
  });

  it('retorna 1 cuando no hay datos válidos', () => {
    expect(resolverNumeroPaginasPlantilla({})).toBe(1);
    expect(resolverNumeroPaginasPlantilla({ numeroPaginas: 'x' })).toBe(1);
    expect(resolverNumeroPaginasPlantilla(null)).toBe(1);
    expect(resolverNumeroPaginasPlantilla(undefined)).toBe(1);
  });
});

describe('resolverPaginasObjetivoPreferidas', () => {
  it('usa por defecto 2 páginas para parcial y 4 para global y extraordinario', () => {
    expect(resolverPaginasObjetivoPreferidas(null, 'parcial')).toBe(2);
    expect(resolverPaginasObjetivoPreferidas({}, 'global')).toBe(4);
    expect(resolverPaginasObjetivoPreferidas({}, 'extraordinario')).toBe(4);
  });

  it('respeta páginas pares configuradas e ignora valores inválidos', () => {
    const docente = { preferenciasPdf: { paginasPorTipo: { parcial: 6, global: 8, extraordinario: 10 } } };
    expect(resolverPaginasObjetivoPreferidas(docente, 'parcial')).toBe(6);
    expect(resolverPaginasObjetivoPreferidas(docente, 'global')).toBe(8);
    expect(resolverPaginasObjetivoPreferidas(docente, 'extraordinario')).toBe(10);
    expect(resolverPaginasObjetivoPreferidas({ preferenciasPdf: { paginasPorTipo: { global: 3 } } }, 'global')).toBe(4);
  });
});
