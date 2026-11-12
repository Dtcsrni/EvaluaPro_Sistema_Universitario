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

/** Incluye ambos estados y evita repetir un examen si cambia durante la consulta. */
export async function cargarExamenesParaOmr<T extends { _id: string }>(
  obtenerPagina: (archivado: boolean, cursor: string | null) => Promise<PaginaExamenesArchivados<T>>
): Promise<T[]> {
  const estados = await Promise.all([false, true].map((archivado) =>
    cargarTodasLasPaginasArchivadas((cursor) => obtenerPagina(archivado, cursor))
  ));
  return Array.from(new Map(estados.flat().map((examen) => [examen._id, examen])).values());
}
