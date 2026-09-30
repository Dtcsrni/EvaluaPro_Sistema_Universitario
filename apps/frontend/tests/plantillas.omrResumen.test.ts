import { describe, expect, it } from 'vitest';
import type { OmrJobDetalle } from '../src/apps/app_docente/tipos';
import type { TrabajoOmrResumen } from '../src/apps/app_docente/features/plantillas/components/PlantillasOmrWorkflow';
import { sincronizarResumenTrabajoOmr } from '../src/apps/app_docente/features/plantillas/estadoTrabajoOmr';

const trabajo: TrabajoOmrResumen = {
  jobId: 'job-1', workflow: 'pdf_ingesta', assessmentId: 'assessment-1',
  sourceType: 'pdf', status: 'failed', pagesTotal: 48, pagesProcessed: 41,
  summary: { needsReview: 41 }, createdAt: '2026-09-29T19:44:17.000Z', updatedAt: '2026-09-29T19:44:17.000Z'
};

const job: OmrJobDetalle = {
  jobId: 'job-1', sourceType: 'pdf', status: 'completed', pagesTotal: 48, pagesProcessed: 48,
  summary: { accepted: 0, needsReview: 48, rejected: 0, autoGradable: 0 }, pages: []
};

describe('sincronización de resumen OMR', () => {
  it('actualiza estado, progreso y conteos de historial desde el detalle actual', () => {
    const trabajos = [trabajo];
    const actualizados = sincronizarResumenTrabajoOmr(trabajos, job);

    expect(actualizados).not.toBe(trabajos);
    expect(actualizados[0]).toMatchObject({
      jobId: 'job-1', status: 'completed', pagesTotal: 48, pagesProcessed: 48,
      summary: { accepted: 0, needsReview: 48, rejected: 0 }
    });
    expect(trabajo).toMatchObject({ status: 'failed', pagesProcessed: 41, summary: { needsReview: 41 } });
  });

  it('preserva la colección cuando el detalle pertenece a otro job', () => {
    const trabajos = [trabajo];
    expect(sincronizarResumenTrabajoOmr(trabajos, { ...job, jobId: 'otro-job' })).toBe(trabajos);
  });
});
