/**
 * etapaQr
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import type { ContextoPipelineOmr } from '../types';
import { leerQrDesdeImagen as leerQrDesdeImagenCv } from '../../servicioOmrCv';

export async function ejecutarEtapaQr(contexto: ContextoPipelineOmr) {
  contexto.qrTexto = await leerQrDesdeImagenCv(contexto.imagenBase64);
  return contexto;
}
