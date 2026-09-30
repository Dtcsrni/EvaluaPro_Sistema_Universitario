/**
 * imagenProcesamientoCv
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
export {
  calcularRegionQrFocalizada,
  calcularIntegral,
  coincidePayloadQrExacto,
  detectarOpcion,
  detectarQrEnRecorteNativo,
  detectarQrEnRecorteRealzado,
  detectarQrPorGeometriaConocida,
  detectarQrMejorado,
  detectarQrZxingPaginaFuente,
  extraerSubimagenRgba,
  mediaEnVentana,
  obtenerTransformacion
} from './imagenProcesamientoCanonico.js';
export type { QrDetalle } from './imagenProcesamientoCanonico.js';
