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
