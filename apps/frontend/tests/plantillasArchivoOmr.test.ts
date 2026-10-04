import { describe, expect, it, vi } from 'vitest';
import { cargarTodasLasPaginasArchivadas } from '../src/apps/app_docente/features/plantillas/archivoOmr';

describe('paginación del archivo OMR', () => {
  it('carga más de 20 páginas sin truncar lotes archivados', async () => {
    const obtenerPagina = vi.fn(async (cursor: string | null) => {
      const indice = cursor === null ? 0 : Number(cursor);
      return {
        examenes: Array.from({ length: 200 }, (_, fila) => indice * 200 + fila),
        nextCursor: indice < 20 ? String(indice + 1) : null
      };
    });

    const examenes = await cargarTodasLasPaginasArchivadas(obtenerPagina);

    expect(obtenerPagina).toHaveBeenCalledTimes(21);
    expect(examenes).toHaveLength(4200);
    expect(examenes.at(-1)).toBe(4199);
  });

  it('falla explícitamente si el backend repite un cursor', async () => {
    const obtenerPagina = vi.fn(async () => ({ examenes: ['parcial'], nextCursor: 'mismo-cursor' }));

    await expect(cargarTodasLasPaginasArchivadas(obtenerPagina)).rejects.toThrow(/repitió un cursor/i);
    expect(obtenerPagina).toHaveBeenCalledTimes(2);
  });

  it('no convierte una respuesta inválida del backend en archivo vacío', async () => {
    const obtenerPagina = vi.fn(async () => ({ examenes: null as unknown as number[], nextCursor: null }));

    await expect(cargarTodasLasPaginasArchivadas(obtenerPagina)).rejects.toThrow(/página inválida/i);
  });
});
