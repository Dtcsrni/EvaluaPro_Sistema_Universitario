import { describe, expect, it } from 'vitest';
import { agruparExamenesOmrPorLote, cargarExamenesOmrReferenciables, combinarExamenesOmrReferenciables } from '../src/apps/app_docente/features/plantillas/archivoOmr';

describe('combinarExamenesOmrReferenciables', () => {
  it('incluye lotes activos y archivados, excluye exámenes individuales y elimina duplicados', () => {
    const activos = [
      { _id: 'active-1', loteId: '0AFF2B75', origenGeneracion: 'lote' },
      { _id: 'individual-1', origenGeneracion: 'individual' }
    ];
    const archivados = [
      { _id: 'archived-1', loteId: 'OLD12345', origenGeneracion: 'lote' },
      { _id: 'active-1', loteId: '0AFF2B75', origenGeneracion: 'lote' },
      { _id: 'without-lot', origenGeneracion: 'lote' }
    ];

    expect(combinarExamenesOmrReferenciables(activos, archivados).map(({ _id }) => _id)).toEqual([
      'active-1',
      'archived-1'
    ]);
  });

  it('consulta ambas páginas de estado al preparar candidatos para el cotejo', async () => {
    const consultas: string[] = [];
    const examenes = await cargarExamenesOmrReferenciables(async (query) => {
      consultas.push(query);
      const archivado = new URLSearchParams(query.slice(1)).get('archivado') === 'true';
      return {
        examenes: [{ _id: archivado ? 'old-1' : 'current-1', loteId: 'LOTE01', origenGeneracion: 'lote' }]
      };
    });

    expect(consultas.map((query) => new URLSearchParams(query.slice(1)).get('archivado'))).toEqual(['false', 'true']);
    expect(examenes.map(({ _id }) => _id)).toEqual(['current-1', 'old-1']);
  });

  it('marca cada lote como archivado solo si todos sus exámenes están archivados', () => {
    const lotes = agruparExamenesOmrPorLote([
      { _id: 'active-1', loteId: '0AFF2B75', origenGeneracion: 'lote', periodoId: 'period-1', archivadoEn: null },
      { _id: 'active-2', loteId: '0AFF2B75', origenGeneracion: 'lote', periodoId: 'period-1', archivadoEn: null },
      { _id: 'old-1', loteId: 'OLD12345', origenGeneracion: 'lote', periodoId: 'period-2', archivadoEn: '2026-10-01' },
      { _id: 'empty-lot', loteId: null, origenGeneracion: 'lote', periodoId: null }
    ], [
      { _id: 'period-1', nombre: 'Materia activa' },
      { _id: 'period-2', nombre: 'Materia archivada' }
    ]);

    expect(lotes).toEqual([
      { assessmentId: 'active-1', loteId: '0AFF2B75', etiqueta: 'Materia activa · Lote 0AFF2B75', cantidad: 2, archivado: false },
      { assessmentId: 'old-1', loteId: 'OLD12345', etiqueta: 'Materia archivada · Lote OLD12345', cantidad: 1, archivado: true }
    ]);
  });
});
