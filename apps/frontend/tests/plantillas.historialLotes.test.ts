import { describe, expect, it, vi } from 'vitest';
import { cargarExamenesActivosDeLote, describirLote, describirLoteVisible } from '../src/apps/app_docente/features/plantillas/historialLotes';

describe('historial de lotes de exámenes', () => {
  it('recorre todas las páginas y filtra el lote antes de regenerar', async () => {
    const consultar = vi.fn()
      .mockResolvedValueOnce({
        examenes: [
          { _id: 'EX-1', loteId: 'LOTE-A', folio: 'A-001' },
          { _id: 'EX-2', loteId: 'LOTE-B', folio: 'B-001' }
        ],
        nextCursor: 'cursor-2'
      })
      .mockResolvedValueOnce({
        examenes: [{ _id: 'EX-3', loteId: 'LOTE-A', folio: 'A-002' }],
        nextCursor: null
      });

    const examenes = await cargarExamenesActivosDeLote('LOTE-A', 'PLANTILLA-1', consultar);

    expect(consultar).toHaveBeenNthCalledWith(1, '/examenes/generados?plantillaId=PLANTILLA-1&limite=200');
    expect(consultar).toHaveBeenNthCalledWith(2, '/examenes/generados?plantillaId=PLANTILLA-1&limite=200&cursor=cursor-2');
    expect(examenes.map(({ _id }) => _id)).toEqual(['EX-1', 'EX-3']);
    expect(describirLote(examenes)).toBe('lote de 2 exámenes; folios A-001, A-002');
  });

  it('falla sin un lote completo y etiqueta las referencias visibles con folios', async () => {
    await expect(cargarExamenesActivosDeLote('LOTE-A', 'PLANTILLA-1', async () => ({ examenes: [], nextCursor: null })))
      .rejects.toThrow('No se encontraron exámenes activos');
    expect(describirLoteVisible([
      { loteId: 'LOTE-A', folio: 'A-001' },
      { loteId: 'LOTE-A', folio: 'A-002' },
      { loteId: 'LOTE-A', folio: 'A-003' },
      { loteId: 'LOTE-A', folio: 'A-004' }
    ])).toBe('lote con folios visibles A-001, A-002, A-003 y 1 más en esta lista');
  });
});
