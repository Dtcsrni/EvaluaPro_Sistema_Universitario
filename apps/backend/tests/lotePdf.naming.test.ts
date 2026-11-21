import { describe, expect, it } from 'vitest';
import { construirNombrePdfLote } from '../src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.js';

describe('nombre descriptivo de lote PDF', () => {
  const base = {
    loteId: 'LOT-123',
    materiaNombre: 'Ingeniería de Software',
    plantillaTitulo: 'Primer Parcial',
    totalExamenes: 14
  };

  it('incluye el único grupo al generar un paquete filtrado', () => {
    expect(construirNombrePdfLote({ ...base, grupos: ['23A'] })).toBe(
      'evaluapro_paquete_examenes_materia-Ingenieria_de_Software_plantilla-Primer_Parcial_grupo-23A_total-14_lote-LOT-123.pdf'
    );
  });

  it('incluye todos los grupos en orden estable al generar toda la materia', () => {
    const nombre = construirNombrePdfLote({ ...base, grupos: ['26a', '25', '26a'] });
    expect(nombre).toContain('_grupos-25_26a_');
    expect(nombre).toContain('_lote-LOT-123.pdf');
  });

  it('normaliza etiquetas y conserva compatibilidad con llamadas sin grupos', () => {
    expect(construirNombrePdfLote({ ...base, grupos: ['  A/1  '] })).toContain('_grupo-A1_');
    expect(construirNombrePdfLote(base)).not.toMatch(/_grupos?-/);
  });
});
