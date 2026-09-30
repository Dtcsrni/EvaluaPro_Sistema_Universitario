import type { OmrJobDetalle } from '../../tipos';
import type { TrabajoOmrResumen } from './components/PlantillasOmrWorkflow';

export function sincronizarResumenTrabajoOmr(
  trabajos: TrabajoOmrResumen[],
  job: OmrJobDetalle
): TrabajoOmrResumen[] {
  const indice = trabajos.findIndex((trabajo) => trabajo.jobId === job.jobId);
  if (indice < 0) return trabajos;

  const anterior = trabajos[indice];
  const resumenIgual = anterior.summary?.accepted === job.summary?.accepted
    && anterior.summary?.needsReview === job.summary?.needsReview
    && anterior.summary?.rejected === job.summary?.rejected;
  if (
    anterior.status === job.status
    && anterior.pagesTotal === job.pagesTotal
    && anterior.pagesProcessed === job.pagesProcessed
    && resumenIgual
  ) return trabajos;

  const actualizados = [...trabajos];
  actualizados[indice] = {
    ...anterior,
    status: job.status,
    pagesTotal: job.pagesTotal,
    pagesProcessed: job.pagesProcessed,
    summary: job.summary
  };
  return actualizados;
}
