export type PaginaConIdentidadOmr = {
  examId?: string;
  examPage?: number;
  pageIndex: number;
};

export type IntentoOmr<T extends PaginaConIdentidadOmr> = {
  examId: string;
  attemptId: string;
  attemptNumber: number;
  pages: T[];
  missingPages: number[];
};

/** Agrupa páginas repetidas por orden de ocurrencia, sin fusionar copias del mismo QR. */
export function agruparPaginasPorIntentoOmr<T extends PaginaConIdentidadOmr>(
  pages: readonly T[],
  expectedPagesByExam: ReadonlyMap<string, readonly number[]>
): IntentoOmr<T>[] {
  const ocurrencias = new Map<string, number>();
  const intentos = new Map<string, IntentoOmr<T>>();

  for (const page of [...pages].sort((a, b) => a.pageIndex - b.pageIndex)) {
    const examId = String(page.examId ?? '').trim();
    const examPage = Number(page.examPage);
    const expectedPages = expectedPagesByExam.get(examId);
    if (!examId || !Number.isSafeInteger(examPage) || !expectedPages?.includes(examPage)) continue;

    const occurrenceKey = `${examId}:${examPage}`;
    const attemptNumber = (ocurrencias.get(occurrenceKey) ?? 0) + 1;
    ocurrencias.set(occurrenceKey, attemptNumber);

    const attemptId = `${examId}:attempt:${attemptNumber}`;
    const attempt = intentos.get(attemptId) ?? {
      examId,
      attemptId,
      attemptNumber,
      pages: [],
      missingPages: []
    };
    attempt.pages.push(page);
    intentos.set(attemptId, attempt);
  }

  return [...intentos.values()]
    .map((attempt) => ({
      ...attempt,
      pages: attempt.pages.sort((a, b) => Number(a.examPage) - Number(b.examPage) || a.pageIndex - b.pageIndex),
      missingPages: (expectedPagesByExam.get(attempt.examId) ?? []).filter((expectedPage) =>
        !attempt.pages.some((page) => page.examPage === expectedPage)
      )
    }))
    .sort((a, b) => a.examId.localeCompare(b.examId) || a.attemptNumber - b.attemptNumber);
}
