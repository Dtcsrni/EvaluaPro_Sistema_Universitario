export type PaginaCopiaFormulario = {
  pageIndex: number;
  sourceFileId: string;
  sourcePage: number;
  sourcePageSha256?: string;
  examId?: string;
  folio?: string;
  examPage?: number;
  scanStatus: 'accepted' | 'needs_review' | 'rejected';
  submissionId?: string;
  exceptions: Array<{ code: string; severity: 'warning' | 'blocking'; message: string }>;
};

export type CopiaFormulario = {
  submissionId: string;
  formExamId: string;
  formFolio: string;
  sourceFileId: string;
  pageIndexes: number[];
  status: 'ready' | 'needs_review';
  studentId: string | null;
  studentName: string | null;
  assignedAt?: string;
};

const exceptionFor = (code: string, message: string) => ({ code, severity: 'blocking' as const, message });

function revisarPagina(page: PaginaCopiaFormulario, code: string, message: string) {
  page.scanStatus = 'needs_review';
  if (!page.exceptions.some((exception) => exception.code === code)) {
    page.exceptions.push(exceptionFor(code, message));
  }
}

/** Agrupa copias consecutivas por archivo sin confundir el QR del formulario con el alumno. */
export function segmentarCopiasFormulario(
  pages: PaginaCopiaFormulario[],
  expectedPages: number[],
  formExamId: string,
  formFolio: string
): CopiaFormulario[] {
  const orderedPages = [...expectedPages].sort((a, b) => a - b);
  if (!orderedPages.length || new Set(orderedPages).size !== orderedPages.length) return [];

  for (const page of pages) delete page.submissionId;
  const sourceKeys = new Map<string, PaginaCopiaFormulario[]>();
  for (const page of pages) {
    const keys = [
      `page-index:${page.pageIndex}`,
      `file-page:${page.sourceFileId}:${page.sourcePage}`,
      ...(page.sourcePageSha256 ? [`image-sha256:${page.sourcePageSha256}`] : [])
    ];
    for (const key of keys) {
      const matches = sourceKeys.get(key) ?? [];
      matches.push(page);
      sourceKeys.set(key, matches);
    }
  }
  const duplicateSources = new Set<PaginaCopiaFormulario>();
  for (const matches of sourceKeys.values()) {
    if (matches.length < 2) continue;
    for (const page of matches) duplicateSources.add(page);
  }
  for (const page of duplicateSources) {
    revisarPagina(page, 'OMR_COPIA_FUENTE_DUPLICADA', 'La misma página fuente o imagen aparece más de una vez; no se puede asignar a copias distintas.');
  }

  const files = new Map<string, PaginaCopiaFormulario[]>();
  for (const page of pages) {
    const filePages = files.get(page.sourceFileId) ?? [];
    filePages.push(page);
    files.set(page.sourceFileId, filePages);
  }

  const copies: CopiaFormulario[] = [];
  for (const [sourceFileId, filePages] of files) {
    const orderedFilePages = [...filePages].sort((a, b) => a.sourcePage - b.sourcePage || a.pageIndex - b.pageIndex);
    let active: { copy: CopiaFormulario; nextPageIndex: number } | null = null;
    const closeIncomplete = () => {
      if (!active) return;
      active.copy.status = 'needs_review';
      const missing = orderedPages.slice(active.nextPageIndex);
      const message = `La copia quedó incompleta; faltan las páginas ${missing.join(', ')}.`;
      for (const pageIndex of active.copy.pageIndexes) {
        const page = pages.find((item) => item.pageIndex === pageIndex);
        if (page) revisarPagina(page, 'OMR_COPIA_PAGINAS_INCOMPLETAS', message);
      }
      active = null;
    };

    for (const page of orderedFilePages) {
      if (duplicateSources.has(page)) {
        closeIncomplete();
        continue;
      }
      if (!page.examId || !page.examPage || page.examId !== formExamId || page.folio?.toUpperCase() !== formFolio.toUpperCase()) {
        closeIncomplete();
        if (page.examId || page.examPage) revisarPagina(page, 'OMR_FORMULARIO_COMPARTIDO_DISCREPANTE', 'La página no pertenece al formulario compartido seleccionado.');
        continue;
      }

      if (page.examPage === orderedPages[0]) {
        const ambiguousBoundary = Boolean(active);
        closeIncomplete();
        if (ambiguousBoundary) revisarPagina(page, 'OMR_COPIA_SECUENCIA_AMBIGUA', 'Comenzó otra copia antes de completar la anterior; ambas quedan para revisión por posible página repetida o copia incompleta.');
      const submissionId = `shared-${sourceFileId}-${page.pageIndex}`;
        const copy: CopiaFormulario = {
          submissionId,
          formExamId,
          formFolio,
          sourceFileId,
          pageIndexes: [page.pageIndex],
          status: 'needs_review',
          studentId: null,
          studentName: null
        };
        page.submissionId = submissionId;
        copies.push(copy);
        active = { copy, nextPageIndex: 1 };
        continue;
      }

      if (!active || orderedPages[active.nextPageIndex] !== page.examPage) {
        closeIncomplete();
        revisarPagina(page, 'OMR_COPIA_SECUENCIA_INVALIDA', 'La secuencia no comienza con la primera página del formulario o contiene una página repetida/fuera de orden.');
        continue;
      }

      page.submissionId = active.copy.submissionId;
      active.copy.pageIndexes.push(page.pageIndex);
      active.nextPageIndex += 1;
      if (active.nextPageIndex === orderedPages.length) {
        active.copy.status = active.copy.pageIndexes.every((pageIndex) => {
          const associated = pages.find((item) => item.pageIndex === pageIndex);
          return associated?.scanStatus === 'accepted';
        }) ? 'ready' : 'needs_review';
        active = null;
      }
    }
    closeIncomplete();
  }
  return copies;
}
