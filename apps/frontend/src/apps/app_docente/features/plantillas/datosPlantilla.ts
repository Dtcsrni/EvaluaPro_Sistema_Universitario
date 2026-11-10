import type { ArchivoOmrLote } from './components/PlantillasOmrWorkflow';
import type { Periodo, Pregunta } from '../../tipos';

type ExamenArchivadoOmr = {
  _id: string;
  loteId?: string | null;
  periodoId?: string | null;
  archivadoEn?: string | null;
};

export function resumirLotesOmr(
  examenes: ExamenArchivadoOmr[],
  periodos: Periodo[],
  periodosArchivados: Periodo[]
): ArchivoOmrLote[] {
  const agrupados = new Map<string, { assessmentId: string; periodoId: string; cantidad: number; archivado: boolean }>();
  for (const examen of examenes) {
    const loteId = String(examen.loteId ?? '').trim();
    if (!loteId) continue;
    const archivado = Boolean(examen.archivadoEn);
    const key = `${archivado ? 'archivado' : 'activo'}:${loteId}`;
    const lote = agrupados.get(key);
    if (lote) lote.cantidad += 1;
    else agrupados.set(key, {
      assessmentId: examen._id,
      periodoId: String(examen.periodoId ?? ''),
      cantidad: 1,
      archivado
    });
  }
  return Array.from(agrupados.entries()).map(([key, lote]) => {
    const loteId = key.slice(key.indexOf(':') + 1);
    const periodo = [...periodos, ...periodosArchivados].find((item) => item._id === lote.periodoId);
    return {
      assessmentId: lote.assessmentId,
      loteId,
      etiqueta: `${periodo?.nombre ?? 'Materia no disponible'} · Lote ${loteId} · ${lote.archivado ? 'archivado' : 'activo'}`,
      cantidad: lote.cantidad,
      archivado: lote.archivado
    };
  }).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

/** Alias de compatibilidad para callers que distinguían lotes archivados OMR. */
export const resumirLotesArchivadosOmr = resumirLotesOmr;

export type TemaDisponible = { tema: string; total: number };

export function derivarDisponibilidadPlantilla(
  preguntas: Pregunta[],
  periodoId: string,
  temasSeleccionados: string[]
): { temasDisponibles: TemaDisponible[]; totalDisponiblePorTemas: number } {
  const preguntasDisponibles = !periodoId
    ? []
    : (Array.isArray(preguntas) ? preguntas : []).filter((pregunta) => pregunta.periodoId === periodoId);
  const mapa = new Map<string, TemaDisponible>();
  for (const pregunta of preguntasDisponibles) {
    const tema = String(pregunta.tema ?? '').trim().replace(/\s+/g, ' ');
    if (!tema) continue;
    const key = tema.toLowerCase();
    const actual = mapa.get(key);
    if (actual) actual.total += 1;
    else mapa.set(key, { tema, total: 1 });
  }
  const temasDisponibles = Array.from(mapa.values()).sort((a, b) => a.tema.localeCompare(b.tema));
  const seleccion = new Set(temasSeleccionados.map((tema) => tema.toLowerCase()));
  const totalDisponiblePorTemas = temasDisponibles
    .filter((tema) => seleccion.has(tema.tema.toLowerCase()))
    .reduce((total, tema) => total + tema.total, 0);

  return { temasDisponibles, totalDisponiblePorTemas };
}
