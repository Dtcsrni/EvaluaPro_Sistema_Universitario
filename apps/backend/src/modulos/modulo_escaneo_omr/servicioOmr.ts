/**
 * servicioOmr
 *
 * Responsabilidad: Servicio de dominio/aplicacion con reglas de negocio reutilizables.
 * Limites: Mantener invariantes del dominio y errores controlados.
 */
import { ejecutarPipelineOmr } from './omr/pipeline/ejecutorPipelineOmr';
import { analizarOmr as analizarOmrCv, leerQrDesdeImagen as leerQrDesdeImagenCv, type ResultadoOmr } from './servicioOmrCv';

type ParametrosAnalizarOmr = Parameters<typeof analizarOmrCv>;
type MapaPaginaOmr = ParametrosAnalizarOmr[1];
type DebugInfoOmr = ParametrosAnalizarOmr[4];

export type { ResultadoOmr };

export async function leerQrDesdeImagen(imagenBase64: string): Promise<string | undefined> {
  return leerQrDesdeImagenCv(imagenBase64);
}

export async function analizarOmr(
  imagenBase64: string,
  mapaPagina: MapaPaginaOmr,
  qrEsperado?: string | string[],
  margenMm = 10,
  debugInfo?: DebugInfoOmr,
  requestId?: string
): Promise<ResultadoOmr> {
  const pipeline = await ejecutarPipelineOmr({
    imagenBase64,
    mapaPagina,
    qrEsperado,
    margenMm,
    debugInfo,
    requestId
  });
  return pipeline.resultado;
}
