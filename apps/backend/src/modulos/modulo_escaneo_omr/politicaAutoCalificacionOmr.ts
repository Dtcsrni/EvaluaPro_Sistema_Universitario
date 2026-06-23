/**
 * politicaAutoCalificacionOmr
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
type EstadoAnalisisOmr = 'ok' | 'rechazado_calidad' | 'requiere_revision';

export type EntradaAutoCalificacionOmr = {
  estadoAnalisis?: EstadoAnalisisOmr;
  calidadPagina: number;
  confianzaPromedioPagina: number;
  ratioAmbiguas: number;
  coberturaDeteccion: number;
};

export const UMBRALES_OMR_AUTO = {
  qualityRejectMin: Number.parseFloat(process.env.OMR_QUALITY_REJECT_MIN || '0.5'),
  qualityReviewMin: Number.parseFloat(process.env.OMR_QUALITY_REVIEW_MIN || '0.52'),
  autoConfMin: Number.parseFloat(process.env.OMR_AUTO_CONF_MIN || '0.58'),
  autoAmbiguasMax: Number.parseFloat(process.env.OMR_AUTO_AMBIGUAS_MAX || '0.4'),
  autoDeteccionMin: Number.parseFloat(process.env.OMR_AUTO_DETECCION_MIN || '0.6'),
  autoRescueQualityMin: Number.parseFloat(process.env.OMR_AUTO_RESCUE_QUALITY_MIN || '0.5'),
  autoRescueConfMin: Number.parseFloat(process.env.OMR_AUTO_RESCUE_CONF_MIN || '0.58'),
  autoRescueAmbigMax: Number.parseFloat(process.env.OMR_AUTO_RESCUE_AMBIG_MAX || '0.4'),
  // Cierres duros para no autocalificar cuando la señal es extremadamente inestable.
  autoHardStopConfMax: Number.parseFloat(process.env.OMR_AUTO_HARDSTOP_CONF_MAX || '0.3'),
  autoHardStopAmbiguasMin: Number.parseFloat(process.env.OMR_AUTO_HARDSTOP_AMBIGUAS_MIN || '0.85'),
  autoHardStopDeteccionMax: Number.parseFloat(process.env.OMR_AUTO_HARDSTOP_DETECCION_MAX || '0.35'),
  // Contrato operativo actual: todas las paginas deben poder autocalificarse.
  // Default estricto: NO forzar autocalificación. Solo habilitar por override explícito.
  autoForceAllPages: String(process.env.OMR_AUTO_FORCE_ALL_PAGES ?? '0').trim() !== '0'
} as const;

function clamp01(valor: number) {
  return Math.max(0, Math.min(1, valor));
}

export function evaluarRescateAltaPrecisionOmr(args: Omit<EntradaAutoCalificacionOmr, 'estadoAnalisis' | 'coberturaDeteccion'>) {
  const { calidadPagina, confianzaPromedioPagina, ratioAmbiguas } = args;
  return (
    clamp01(calidadPagina) >= UMBRALES_OMR_AUTO.autoRescueQualityMin &&
    clamp01(confianzaPromedioPagina) >= UMBRALES_OMR_AUTO.autoRescueConfMin &&
    clamp01(ratioAmbiguas) <= UMBRALES_OMR_AUTO.autoRescueAmbigMax
  );
}

export function evaluarAutoCalificableOmr(args: EntradaAutoCalificacionOmr) {
  const {
    estadoAnalisis,
    calidadPagina,
    confianzaPromedioPagina,
    ratioAmbiguas,
    coberturaDeteccion
  } = args;
  const rescateAltaPrecision = evaluarRescateAltaPrecisionOmr({
    calidadPagina,
    confianzaPromedioPagina,
    ratioAmbiguas
  });
  const hardStop =
    clamp01(confianzaPromedioPagina) <= UMBRALES_OMR_AUTO.autoHardStopConfMax ||
    clamp01(ratioAmbiguas) >= UMBRALES_OMR_AUTO.autoHardStopAmbiguasMin ||
    clamp01(coberturaDeteccion) <= UMBRALES_OMR_AUTO.autoHardStopDeteccionMax ||
    estadoAnalisis === 'rechazado_calidad';
  const cumpleBase =
    clamp01(calidadPagina) >= UMBRALES_OMR_AUTO.qualityReviewMin &&
    clamp01(confianzaPromedioPagina) >= UMBRALES_OMR_AUTO.autoConfMin &&
    clamp01(ratioAmbiguas) <= UMBRALES_OMR_AUTO.autoAmbiguasMax &&
    clamp01(coberturaDeteccion) >= UMBRALES_OMR_AUTO.autoDeteccionMin;
  const autoCalificableOmr = hardStop
    ? false
    : UMBRALES_OMR_AUTO.autoForceAllPages
    ? true
    : estadoAnalisis === 'ok' && (cumpleBase || rescateAltaPrecision);

  return {
    hardStop,
    rescateAltaPrecision,
    autoCalificableOmr
  };
}
