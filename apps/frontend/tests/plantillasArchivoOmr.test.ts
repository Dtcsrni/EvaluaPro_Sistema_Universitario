import { describe, expect, it, vi } from 'vitest';
import { cargarHistorialCompletoExamenes, cargarTodasLasPaginasArchivadas } from '../src/apps/app_docente/features/plantillas/archivoOmr';

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

  it('combina y pagina el historial de exámenes activos y archivados', async () => {
    const grupos = new Map<boolean, Array<{ _id: string; generadoEn: string }>>([
      [false, [{ _id: 'activo-2', generadoEn: '2026-02-01' }, { _id: 'activo-1', generadoEn: '2026-01-01' }]],
      [true, [{ _id: 'archivado-1', generadoEn: '2025-12-01' }]]
    ]);
    const obtenerPagina = vi.fn(async (archivado: boolean, cursor: string | null) => ({
      examenes: cursor ? [] : grupos.get(archivado) ?? [],
      nextCursor: cursor ? null : `${archivado ? 'archivado' : 'activo'}-siguiente`
    }));

    const examenes = await cargarHistorialCompletoExamenes(obtenerPagina);

    expect(examenes.map((examen) => examen._id)).toEqual(['activo-2', 'activo-1', 'archivado-1']);
    expect(obtenerPagina).toHaveBeenCalledWith(false, null);
    expect(obtenerPagina).toHaveBeenCalledWith(true, null);
    expect(obtenerPagina).toHaveBeenCalledWith(false, 'activo-siguiente');
    expect(obtenerPagina).toHaveBeenCalledWith(true, 'archivado-siguiente');
  });
});
