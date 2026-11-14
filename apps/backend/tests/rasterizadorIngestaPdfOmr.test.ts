import { describe, expect, it, vi } from 'vitest';
import { rasterizarBloqueIngestaOmr } from '../src/modulos/modulo_escaneo_omr/infra/rasterizadorIngestaPdfOmr.js';

const page = (numero: number) => ({ numero, dataUrl: `data:image/png;base64,${numero}` });

describe('rasterizarBloqueIngestaOmr', () => {
  it('conserva el camino por bloque cuando todas las páginas se rasterizan', async () => {
    const rasterizar = vi.fn(async (_buffer, opciones) => ({
      paginas: Array.from({ length: opciones.cantidadPaginas }, (_, index) => page(opciones.desdePagina + index)),
      paginasTotales: 8,
      paginasOmitidas: 0
    }));

    const resultado = await rasterizarBloqueIngestaOmr(Buffer.from('pdf'), 1, 3, rasterizar);

    expect(rasterizar).toHaveBeenCalledTimes(1);
    expect(rasterizar).toHaveBeenCalledWith(expect.any(Buffer), { dpi: 144, desdePagina: 1, cantidadPaginas: 3 });
    expect([...resultado.paginas.keys()]).toEqual([1, 2, 3]);
    expect(resultado.fallidas.size).toBe(0);
  });

  it('reduce el tamaño del bloque y termina con reintentos por página', async () => {
    const rasterizar = vi.fn(async (_buffer, opciones) => {
      if (opciones.cantidadPaginas > 1) throw new Error('timeout');
      return { paginas: [page(opciones.desdePagina)], paginasTotales: 3, paginasOmitidas: 0 };
    });

    const resultado = await rasterizarBloqueIngestaOmr(Buffer.from('pdf'), 4, 3, rasterizar);

    expect(rasterizar.mock.calls.map(([, opciones]) => opciones.cantidadPaginas)).toEqual([3, 2, 1, 1, 1]);
    expect([...resultado.paginas.keys()]).toEqual([4, 5, 6]);
    expect(resultado.fallidas.size).toBe(0);
  });

  it('devuelve fallidas solo las páginas que tampoco pudieron recuperarse aisladas', async () => {
    const rasterizar = vi.fn(async (_buffer, opciones) => {
      if (opciones.cantidadPaginas > 1) return { paginas: [], paginasTotales: 2, paginasOmitidas: 2 };
      if (opciones.desdePagina === 8) throw new Error('page error');
      return { paginas: [page(opciones.desdePagina)], paginasTotales: 2, paginasOmitidas: 0 };
    });

    const resultado = await rasterizarBloqueIngestaOmr(Buffer.from('pdf'), 7, 2, rasterizar);

    expect([...resultado.paginas.keys()]).toEqual([7]);
    expect([...resultado.fallidas]).toEqual([8]);
  });
});
