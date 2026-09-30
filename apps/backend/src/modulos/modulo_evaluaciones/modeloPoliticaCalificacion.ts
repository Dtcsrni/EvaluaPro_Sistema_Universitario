/**
 * modeloPoliticaCalificacion
 *
 * Responsabilidad: Definición de constantes y tipos de politicas de calificación.
 */
export const CODIGOS_POLITICA = ['POLICY_SV_EXCEL_2026', 'POLICY_LISC_ENCUADRE_2026'] as const;
export type CodigoPoliticaCalificacion = string;

export const PoliticaCalificacion = {
  find() {
    return {
      lean() { return []; }
    };
  }
};
