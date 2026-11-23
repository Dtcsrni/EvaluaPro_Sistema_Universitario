import { describe, expect, it } from 'vitest';
import { agruparPaginasPorIntentoOmr } from '../src/modulos/modulo_escaneo_omr/infra/agruparPaginasPorIntentoOmr.js';

const expected = new Map([['exam-a', [1, 2]]]);

describe('agruparPaginasPorIntentoOmr', () => {
  it('separa copias consecutivas con el mismo examen y QR', () => {
    const attempts = agruparPaginasPorIntentoOmr([
      { examId: 'exam-a', examPage: 1, pageIndex: 1 },
      { examId: 'exam-a', examPage: 2, pageIndex: 2 },
      { examId: 'exam-a', examPage: 1, pageIndex: 3 },
      { examId: 'exam-a', examPage: 2, pageIndex: 4 }
    ], expected);

    expect(attempts.map((attempt) => ({ number: attempt.attemptNumber, pages: attempt.pages.map((page) => page.pageIndex), missing: attempt.missingPages })))
      .toEqual([
        { number: 1, pages: [1, 2], missing: [] },
        { number: 2, pages: [3, 4], missing: [] }
      ]);
  });

  it('empareja por ocurrencia cuando el escáner apila todas las páginas del mismo número', () => {
    const attempts = agruparPaginasPorIntentoOmr([
      { examId: 'exam-a', examPage: 1, pageIndex: 1 },
      { examId: 'exam-a', examPage: 1, pageIndex: 2 },
      { examId: 'exam-a', examPage: 2, pageIndex: 3 },
      { examId: 'exam-a', examPage: 2, pageIndex: 4 }
    ], expected);

    expect(attempts.map((attempt) => attempt.pages.map((page) => page.pageIndex))).toEqual([[1, 3], [2, 4]]);
    expect(attempts.every((attempt) => attempt.missingPages.length === 0)).toBe(true);
  });

  it('mantiene incompleta para revisión una copia a la que le falta una página', () => {
    const attempts = agruparPaginasPorIntentoOmr([
      { examId: 'exam-a', examPage: 1, pageIndex: 1 },
      { examId: 'exam-a', examPage: 2, pageIndex: 2 },
      { examId: 'exam-a', examPage: 2, pageIndex: 3 }
    ], expected);

    expect(attempts.map((attempt) => ({ pages: attempt.pages.map((page) => page.pageIndex), missing: attempt.missingPages })))
      .toEqual([
        { pages: [1, 2], missing: [] },
        { pages: [3], missing: [1] }
      ]);
  });

  it('separa once copias de dos páginas que reutilizan el mismo QR', () => {
    const pages = Array.from({ length: 11 }, (_, index) => [
      { examId: 'p1-reused-qr', examPage: 1, pageIndex: index * 2 + 1 },
      { examId: 'p1-reused-qr', examPage: 2, pageIndex: index * 2 + 2 }
    ]).flat();
    const attempts = agruparPaginasPorIntentoOmr(pages, new Map([['p1-reused-qr', [1, 2]]]));

    expect(attempts).toHaveLength(11);
    expect(attempts.every((attempt) => attempt.missingPages.length === 0 && attempt.pages.length === 2)).toBe(true);
    expect(attempts.map((attempt) => attempt.attemptNumber)).toEqual(Array.from({ length: 11 }, (_, index) => index + 1));
  });

  it('conserva doce folios distintos como doce intentos completos', () => {
    const pages = Array.from({ length: 12 }, (_, index) => [
      { examId: `p2-exam-${index + 1}`, examPage: 1, pageIndex: index * 2 + 1 },
      { examId: `p2-exam-${index + 1}`, examPage: 2, pageIndex: index * 2 + 2 }
    ]).flat();
    const expectedPages = new Map(pages.map((page) => [page.examId, [1, 2]]));
    const attempts = agruparPaginasPorIntentoOmr(pages, expectedPages);

    expect(attempts).toHaveLength(12);
    expect(attempts.every((attempt) => attempt.attemptNumber === 1 && attempt.missingPages.length === 0)).toBe(true);
  });
});
