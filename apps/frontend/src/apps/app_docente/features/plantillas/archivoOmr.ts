export type PaginaExamenesArchivados<T> = {
  examenes: T[];
  nextCursor?: string | null;
};

export type LoteOmrDisponible = {
  assessmentId: string;
  loteId: string;
  etiqueta: string;
  cantidad: number;
  archivado: boolean | null;
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

/** Une páginas activas y archivadas para localizar cualquier lote por sus QR. */
export async function cargarCandidatosOmr<T extends { _id: string }>(
  obtenerPagina: (archivados: boolean, cursor: string | null) => Promise<PaginaExamenesArchivados<T>>
): Promise<T[]> {
  const [activos, archivados] = await Promise.all([false, true].map((soloArchivados) =>
    cargarTodasLasPaginasArchivadas<T>((cursor) => obtenerPagina(soloArchivados, cursor))
  ));
  return Array.from(new Map([...activos, ...archivados].map((examen) => [examen._id, examen])).values());
}

/** Agrupa exámenes por lote y conserva el estado de archivo cuando es consistente. */
export function agruparLotesOmr<T extends { _id: string; loteId?: string; periodoId?: string; archivadoEn?: string | null }>(
  examenes: T[],
  periodos: Array<{ _id: string; nombre: string }>
): LoteOmrDisponible[] {
  const agrupados = new Map<string, { assessmentId: string; periodoId: string; cantidad: number; archivado: boolean | null }>();
  for (const examen of examenes) {
    const loteId = String(examen.loteId ?? '').trim();
    if (!loteId) continue;
    const archivado = examen.archivadoEn === undefined ? null : Boolean(examen.archivadoEn);
    const lote = agrupados.get(loteId);
    if (lote) {
      lote.cantidad += 1;
      if (lote.archivado !== archivado) lote.archivado = null;
    } else {
      agrupados.set(loteId, {
        assessmentId: examen._id,
        periodoId: String(examen.periodoId ?? ''),
        cantidad: 1,
        archivado
      });
    }
  }
  return Array.from(agrupados.entries()).map(([loteId, lote]) => {
    const periodo = periodos.find((item) => item._id === lote.periodoId);
    return {
      assessmentId: lote.assessmentId,
      loteId,
      etiqueta: `${periodo?.nombre ?? 'Materia'} · Lote ${loteId}`,
      cantidad: lote.cantidad,
      archivado: lote.archivado
    };
  }).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
}
