/**
 * resolverNumeroPaginasPlantilla
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
type PlantillaParaPaginacion = {
  numeroPaginas?: unknown;
  tipo?: unknown;
};

export function resolverNumeroPaginasPlantilla(plantilla: PlantillaParaPaginacion | null | undefined): number {
  if (plantilla?.tipo === 'parcial') return 2;
  if (plantilla?.tipo === 'global') return 4;
  const numeroPaginas = Number(plantilla?.numeroPaginas);
  if (Number.isFinite(numeroPaginas) && numeroPaginas >= 1) {
    return Math.floor(numeroPaginas);
  }

  return 1;
}
