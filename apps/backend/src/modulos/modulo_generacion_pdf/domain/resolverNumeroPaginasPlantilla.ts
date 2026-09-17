/**
 * resolverNumeroPaginasPlantilla
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
type PlantillaParaPaginacion = {
  numeroPaginas?: unknown;
};

export function resolverNumeroPaginasPlantilla(plantilla: PlantillaParaPaginacion): number {
  const numeroPaginas = Number(plantilla?.numeroPaginas);
  if (Number.isFinite(numeroPaginas) && numeroPaginas >= 1) {
    return Math.floor(numeroPaginas);
  }

  return 1;
}
