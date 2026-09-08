/**
 * Estimación conservadora de reactivos por página para la configuración actual.
 * No sustituye la previsualización del backend: sirve para orientar al docente
 * antes de guardar la plantilla.
 */

/**
 * Limite inferior de la UI y del contrato de PDF. 90% conserva una lectura
 * compacta para aprovechar el papel sin permitir escalas tipograficas extremas.
 */
export const MIN_FONT_SCALE_LEGIBLE = 0.9;

export type EstimacionDensidadPlantilla = {
  reactivosPorPaginaMin: number;
  reactivosPorPaginaMax: number;
  paginasEstimadas: number;
  capacidadBasePorPagina: number;
};

export function calcularEstimacionDensidadPlantilla({
  totalReactivos,
  paginasConfiguradas,
  temasSeleccionados,
  fontScale = 1,
  lineSpacing = 1.1
}: {
  totalReactivos: number;
  paginasConfiguradas: number;
  temasSeleccionados: number;
  fontScale?: number;
  lineSpacing?: number;
}): EstimacionDensidadPlantilla {
  const total = Math.max(0, Math.floor(Number(totalReactivos) || 0));
  const paginasSolicitadas = Math.max(1, Math.floor(Number(paginasConfiguradas) || 1));
  const temas = Math.max(0, Math.floor(Number(temasSeleccionados) || 0));
  const escala = Math.min(1.3, Math.max(MIN_FONT_SCALE_LEGIBLE, Number(fontScale) || 1));
  const espaciado = Math.min(1.6, Math.max(0.9, Number(lineSpacing) || 1.1));

  // Más temas suelen introducir variación de longitud; se descuenta poco para
  // no prometer una densidad que solo funcionaría con preguntas muy cortas.
  const factorTemas = temas <= 1 ? 1 : Math.max(0.94, 1 - Math.min(0.06, (temas - 1) * 0.01));
  const capacidadBasePorPagina = Math.min(
    15,
    Math.max(10, Math.round((15 * factorTemas) / (escala * espaciado)))
  );
  const paginasPorContenido = total > 0 ? Math.ceil(total / capacidadBasePorPagina) : paginasSolicitadas;
  const paginasEstimadas = Math.max(paginasSolicitadas, paginasPorContenido);

  if (total === 0) {
    return {
      reactivosPorPaginaMin: 0,
      reactivosPorPaginaMax: 0,
      paginasEstimadas,
      capacidadBasePorPagina
    };
  }

  const promedio = total / paginasEstimadas;
  return {
    reactivosPorPaginaMin: Math.max(1, Math.floor(promedio)),
    reactivosPorPaginaMax: Math.max(1, Math.ceil(promedio)),
    paginasEstimadas,
    capacidadBasePorPagina
  };
}

export function textoEstimacionDensidadPlantilla(estimacion: EstimacionDensidadPlantilla): string {
  if (estimacion.reactivosPorPaginaMax <= 0) return 'Selecciona temas para estimar';
  const rango = estimacion.reactivosPorPaginaMin === estimacion.reactivosPorPaginaMax
    ? `${estimacion.reactivosPorPaginaMax}`
    : `${estimacion.reactivosPorPaginaMin}–${estimacion.reactivosPorPaginaMax}`;
  return `Aprox. ${rango} reactivos/página · ${estimacion.paginasEstimadas} ${estimacion.paginasEstimadas === 1 ? 'página' : 'páginas'}`;
}
