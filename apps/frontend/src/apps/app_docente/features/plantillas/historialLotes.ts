import { cargarTodasLasPaginasArchivadas, type PaginaExamenesArchivados } from './archivoOmr';

type ExamenConLote = {
  loteId?: string | null;
  folio?: string | null;
};

export async function cargarExamenesActivosDeLote<T extends ExamenConLote>(
  loteId: string,
  plantillaId: string,
  consultar: (ruta: string) => Promise<PaginaExamenesArchivados<T>>
): Promise<T[]> {
  const objetivo = String(loteId ?? '').trim();
  if (!objetivo) throw new Error('No se pudo identificar el lote que se va a regenerar.');

  const obtenerPagina = (cursor: string | null) => {
    const query = new URLSearchParams({ plantillaId, limite: '200', ...(cursor ? { cursor } : {}) });
    return consultar(`/examenes/generados?${query.toString()}`);
  };
  const historialCompleto = await cargarTodasLasPaginasArchivadas(obtenerPagina);
  const examenes = historialCompleto.filter((examen) => String(examen.loteId ?? '').trim() === objetivo);
  if (examenes.length === 0) throw new Error('No se encontraron exámenes activos para este lote. Actualiza el historial e inténtalo de nuevo.');
  return examenes;
}

export function describirLote(examenes: ExamenConLote[]): string {
  const folios = examenes.map((examen) => String(examen.folio ?? '').trim()).filter(Boolean);
  const muestraFolios = folios.slice(0, 3);
  const restantes = Math.max(0, folios.length - muestraFolios.length);
  const referencia = muestraFolios.length > 0
    ? `; folios ${muestraFolios.join(', ')}${restantes ? ` y ${restantes} más` : ''}`
    : '';
  const cantidad = examenes.length;
  return `lote de ${cantidad} ${cantidad === 1 ? 'examen' : 'exámenes'}${referencia}`;
}

export function describirLoteVisible(examenes: ExamenConLote[]): string {
  const folios = examenes.map((examen) => String(examen.folio ?? '').trim()).filter(Boolean);
  const muestraFolios = folios.slice(0, 3);
  const restantes = Math.max(0, folios.length - muestraFolios.length);
  if (muestraFolios.length === 0) return `lote con ${examenes.length} exámenes listados`;
  return `lote con folios visibles ${muestraFolios.join(', ')}${restantes ? ` y ${restantes} más en esta lista` : ''}`;
}
