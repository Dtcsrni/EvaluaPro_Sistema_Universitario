type PlantillaCompat = {
  numeroPaginas?: unknown;
};

export function resolverNumeroPaginasPlantilla(plantilla: PlantillaCompat): number {
  const numeroPaginas = Number(plantilla?.numeroPaginas);
  if (Number.isFinite(numeroPaginas) && numeroPaginas >= 1) {
    return Math.floor(numeroPaginas);
  }

  return 1;
}
