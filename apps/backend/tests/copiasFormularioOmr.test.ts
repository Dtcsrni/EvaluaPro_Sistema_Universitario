import { describe, expect, it } from 'vitest';
import { segmentarCopiasFormulario, type PaginaCopiaFormulario } from '../src/modulos/modulo_escaneo_omr/copiasFormularioOmr.js';

function page(pageIndex: number, sourcePage: number, examPage: number, overrides: Partial<PaginaCopiaFormulario> = {}): PaginaCopiaFormulario {
  return {
    pageIndex,
    sourceFileId: 'scan-1',
    sourcePage,
    examId: 'form-1',
    folio: 'ABC123',
    examPage,
    scanStatus: 'accepted',
    exceptions: [],
    ...overrides
  };
}

describe('segmentarCopiasFormulario', () => {
  it('separa once copias consecutivas del mismo QR en once intentos completos', () => {
    const pages = Array.from({ length: 22 }, (_, index) => page(index + 1, index + 1, index % 2 === 0 ? 1 : 2));

    const copies = segmentarCopiasFormulario(pages, [1, 2], 'form-1', 'ABC123');

    expect(copies).toHaveLength(11);
    expect(copies.every((copy) => copy.status === 'ready' && copy.pageIndexes.length === 2)).toBe(true);
    expect(new Set(copies.map((copy) => copy.submissionId)).size).toBe(11);
    expect(new Set(pages.map((item) => item.submissionId)).size).toBe(11);
  });

  it('deja en revisión una frontera ambigua causada por P1 repetida', () => {
    const pages = [page(1, 1, 1), page(2, 2, 1), page(3, 3, 2)];

    const copies = segmentarCopiasFormulario(pages, [1, 2], 'form-1', 'ABC123');

    expect(copies).toHaveLength(2);
    expect(copies[0]).toMatchObject({ status: 'needs_review', pageIndexes: [1] });
    expect(copies[1]).toMatchObject({ status: 'needs_review', pageIndexes: [2, 3] });
    expect(pages[1]?.submissionId).toBe(copies[1]?.submissionId);
    expect(pages[1]?.exceptions).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'OMR_COPIA_SECUENCIA_AMBIGUA' })]));
  });

  it('no agrupa páginas de distintos archivos', () => {
    const pages = [page(1, 1, 1), page(2, 1, 2, { sourceFileId: 'scan-2' })];

    const copies = segmentarCopiasFormulario(pages, [1, 2], 'form-1', 'ABC123');

    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({ status: 'needs_review', pageIndexes: [1] });
    expect(pages[1]?.submissionId).toBeUndefined();
  });

  it('bloquea todas las copias que reutilizan el mismo hash de página fuente', () => {
    const pages = [
      page(1, 1, 1, { sourcePageSha256: 'a'.repeat(64) }),
      page(2, 2, 2, { sourcePageSha256: 'b'.repeat(64) }),
      page(3, 3, 1, { sourcePageSha256: 'c'.repeat(64) }),
      page(4, 4, 2, { sourcePageSha256: 'b'.repeat(64) })
    ];

    const copies = segmentarCopiasFormulario(pages, [1, 2], 'form-1', 'ABC123');

    expect(copies).toHaveLength(2);
    expect(copies.every((copy) => copy.status === 'needs_review')).toBe(true);
    expect(pages[1]?.submissionId).toBeUndefined();
    expect(pages[3]?.submissionId).toBeUndefined();
    expect(pages[1]?.exceptions).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'OMR_COPIA_FUENTE_DUPLICADA' })]));
    expect(pages[3]?.exceptions).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'OMR_COPIA_FUENTE_DUPLICADA' })]));
  });

  it('bloquea reutilizar la misma posición fuente aunque no haya hash rasterizado', () => {
    const pages = [page(1, 1, 1), page(2, 2, 2), page(3, 2, 2)];

    const copies = segmentarCopiasFormulario(pages, [1, 2], 'form-1', 'ABC123');

    expect(copies).toHaveLength(1);
    expect(copies.every((copy) => copy.status === 'needs_review')).toBe(true);
    expect(pages[1]?.exceptions).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'OMR_COPIA_FUENTE_DUPLICADA' })]));
    expect(pages[2]?.exceptions).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'OMR_COPIA_FUENTE_DUPLICADA' })]));
  });
});
