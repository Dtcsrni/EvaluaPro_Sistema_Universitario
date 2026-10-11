export type PaginaExamenesArchivados<T> = {
  examenes: T[];
  nextCursor?: string | null;
};

/** Recorre todo el archivo paginado y falla si el servidor repite un cursor. */
export async function cargarTodasLasPaginasArchivadas<T>(
  obtenerPagina: (cursor: string | null) => Promise<PaginaExamenesArchivados<T>>
): Promise<T[]> {
  const examenes: T[] = [];
  const cursoresVisitados = new Set<string>();
  let cursor: string | null = null;

  while (true) {
    const pagina = await obtenerPagina(cursor);
    if (!Array.isArray(pagina.examenes)) {
      throw new Error('El archivo de exámenes devolvió una página inválida.');
    }
    examenes.push(...pagina.examenes);

    const siguiente = pagina.nextCursor || null;
    if (!siguiente) return examenes;
    if (siguiente === cursor || cursoresVisitados.has(siguiente)) {
      throw new Error('La paginación del archivo repitió un cursor; no se mostrará una lista incompleta.');
    }

    cursoresVisitados.add(siguiente);
    cursor = siguiente;
  }
}

/** Carga todas las páginas activas y archivadas y las ordena por fecha reciente. */
export async function cargarHistorialCompletoExamenes<T extends { generadoEn?: string }>(
  obtenerPagina: (archivado: boolean, cursor: string | null) => Promise<PaginaExamenesArchivados<T>>
) {
  const [activos, archivados] = await Promise.all([
    cargarTodasLasPaginasArchivadas((cursor) => obtenerPagina(false, cursor)),
    cargarTodasLasPaginasArchivadas((cursor) => obtenerPagina(true, cursor))
  ]);
  return [...activos, ...archivados].sort((a, b) => {
    const fechaA = Date.parse(String(a.generadoEn ?? '')) || 0;
    const fechaB = Date.parse(String(b.generadoEn ?? '')) || 0;
    return fechaB - fechaA;
  });
}
