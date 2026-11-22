/**
 * pdf.numeroPaginasPlantilla.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { describe, expect, it } from 'vitest';
import { resolverNumeroPaginasPlantilla } from '../src/modulos/modulo_generacion_pdf/domain/resolverNumeroPaginasPlantilla.js';
import { longitudTextoVisible, resolverPaginasObjetivoPreferidas } from '../src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.js';
import { esquemaCrearPlantilla, esquemaActualizarPlantilla } from '../src/modulos/modulo_generacion_pdf/validacionesExamenes.js';

describe('resolverNumeroPaginasPlantilla', () => {
  it('fija parciales a dos páginas y globales a cuatro aunque haya preferencias legadas', () => {
    expect(resolverNumeroPaginasPlantilla({ tipo: 'parcial', numeroPaginas: 6 })).toBe(2);
    expect(resolverNumeroPaginasPlantilla({ tipo: 'global', numeroPaginas: 1 })).toBe(4);
  });

  it('conserva el objetivo editorial para tipos no estandarizados', () => {
    expect(resolverNumeroPaginasPlantilla({ tipo: 'extraordinario', numeroPaginas: 3 })).toBe(3);
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

  it('fija parcial/global e ignora preferencias legadas para esos tipos', () => {
    const docente = { preferenciasPdf: { paginasPorTipo: { parcial: 6, global: 8, extraordinario: 10 } } };
    expect(resolverPaginasObjetivoPreferidas(docente, 'parcial')).toBe(2);
    expect(resolverPaginasObjetivoPreferidas(docente, 'global')).toBe(4);
    expect(resolverPaginasObjetivoPreferidas(docente, 'extraordinario')).toBe(10);
    expect(resolverPaginasObjetivoPreferidas({ preferenciasPdf: { paginasPorTipo: { global: 3 } } }, 'global')).toBe(4);
  });
});

describe('longitudTextoVisible para estimación de maquetación', () => {
  it('ignora etiquetas y conserva texto con símbolos matemáticos y etiquetas malformadas', () => {
    expect(longitudTextoVisible('<p>Hola <strong title="a > b">mundo</strong></p>')).toBe(10);
    expect(longitudTextoVisible('2 < 3')).toBe(5);
    expect(longitudTextoVisible('<b')).toBe(2);
  });

  it('cuenta contenido de script como texto y no lo trata como marcado', () => {
    expect(longitudTextoVisible('<script>alert(1)</script>')).toBe(8);
  });
});

describe('contrato de páginas físicas de plantillas', () => {
  it.each([
    ['parcial', 2],
    ['global', 4]
  ] as const)('acepta %s con exactamente %i páginas', (tipo, paginas) => {
    const resultado = esquemaCrearPlantilla.safeParse({
      tipo,
      titulo: 'Plantilla de prueba',
      numeroPaginas: paginas,
      preguntasIds: ['507f1f77bcf86cd799439011']
    });
    expect(resultado.success).toBe(true);
  });

  it.each([
    ['parcial', 1],
    ['parcial', 4],
    ['global', 2],
    ['global', 6]
  ] as const)('rechaza %s con presupuesto incompatible de %i páginas', (tipo, paginas) => {
    const resultado = esquemaCrearPlantilla.safeParse({
      tipo,
      titulo: 'Plantilla de prueba',
      numeroPaginas: paginas,
      preguntasIds: ['507f1f77bcf86cd799439011']
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza que una actualización cambie el presupuesto físico de un parcial', () => {
    const resultado = esquemaActualizarPlantilla.safeParse({
      tipo: 'parcial',
      numeroPaginas: 4,
      bookletConfig: { targetPages: 4 }
    });
    expect(resultado.success).toBe(false);
  });
});
