import { describe, expect, it, vi } from 'vitest';
import { agruparLotesOmr, cargarCandidatosOmr, cargarTodasLasPaginasArchivadas } from '../src/apps/app_docente/features/plantillas/archivoOmr';

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

  it('incluye lotes activos y archivados sin duplicar exámenes', async () => {
    const solicitudes: Array<{ archivados: boolean; cursor: string | null }> = [];
    const resultados = await cargarCandidatosOmr(async (archivados, cursor) => {
      solicitudes.push({ archivados, cursor });
      if (!archivados) return { examenes: [{ _id: 'activo', loteId: '0AFF2B75' }], nextCursor: null };
      if (!cursor) return { examenes: [{ _id: 'compartido', loteId: 'LOTE1' }], nextCursor: 'pagina-2' };
      return { examenes: [{ _id: 'compartido', loteId: 'LOTE1' }, { _id: 'archivado', loteId: 'LOTE2' }], nextCursor: null };
    });

    expect(resultados.map((examen) => examen._id)).toEqual(['activo', 'compartido', 'archivado']);
    expect(solicitudes).toEqual([
      { archivados: false, cursor: null },
      { archivados: true, cursor: null },
      { archivados: true, cursor: 'pagina-2' }
    ]);
  });

  it('agrupa lotes OMR y marca estado ambiguo si mezcla exámenes archivados y activos', () => {
    const lotes = agruparLotesOmr([
      { _id: 'examen-1', loteId: 'LOTE-A', periodoId: 'periodo-1', archivadoEn: null },
      { _id: 'examen-2', loteId: 'LOTE-A', periodoId: 'periodo-1', archivadoEn: '2026-10-25' },
      { _id: 'examen-3', loteId: 'LOTE-B', periodoId: 'periodo-2', archivadoEn: null },
      { _id: 'examen-sin-lote', periodoId: 'periodo-1' }
    ], [
      { _id: 'periodo-1', nombre: 'Materia A' },
      { _id: 'periodo-2', nombre: 'Materia B' }
    ]);

    expect(lotes).toEqual([
      { assessmentId: 'examen-1', loteId: 'LOTE-A', etiqueta: 'Materia A · Lote LOTE-A', cantidad: 2, archivado: null },
      { assessmentId: 'examen-3', loteId: 'LOTE-B', etiqueta: 'Materia B · Lote LOTE-B', cantidad: 1, archivado: false }
    ]);
  });
});
