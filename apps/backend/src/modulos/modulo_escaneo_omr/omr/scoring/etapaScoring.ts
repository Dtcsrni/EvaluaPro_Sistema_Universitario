/**
 * etapaScoring
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import type { ContextoPipelineOmr } from '../types';
import { analizarOmr as analizarOmrCv, type ResultadoOmr } from '../../servicioOmrCv';
import { debeIntentarMotorCv, describirErrorCv, preprocesarImagenOmrCv } from '../../infra/omrCvEngine';

export async function ejecutarEtapaScoring(contexto: ContextoPipelineOmr) {
  const mapaPagina = contexto.mapaPagina as Parameters<typeof analizarOmrCv>[1];
  const templateVersion =
    Number((mapaPagina as { templateVersion?: unknown })?.templateVersion ?? contexto.debugInfo?.templateVersionDetectada ?? 3);
  const engineVersion = templateVersion === 4 ? 'omr-v4-cv' : templateVersion === 1 ? 'omr-v1-cv' : 'omr-v3-cv';

  let resultado: ResultadoOmr;
  if (debeIntentarMotorCv(templateVersion)) {
    try {
      const imagenCv = await preprocesarImagenOmrCv(contexto.imagenBase64);
      resultado = await analizarOmrCv(
        imagenCv,
        mapaPagina,
        contexto.qrEsperado,
        contexto.margenMm,
        contexto.debugInfo,
        { rawImageBase64: contexto.imagenBase64 }
      );
      resultado.engineVersion = engineVersion;
    } catch (error) {
      resultado = await analizarOmrCv(
        contexto.imagenBase64,
        mapaPagina,
        contexto.qrEsperado,
        contexto.margenMm,
        contexto.debugInfo,
        { rawImageBase64: contexto.imagenBase64 }
      );
      resultado.engineVersion = engineVersion;
      resultado.motivosRevision = Array.from(
        new Set([...(resultado.motivosRevision ?? []), `CV_PREPROCESO_REINTENTO:${describirErrorCv(error)}`])
      ).slice(0, 24);
    }
  } else {
    resultado = await analizarOmrCv(
      contexto.imagenBase64,
      mapaPagina,
      contexto.qrEsperado,
      contexto.margenMm,
      contexto.debugInfo,
      { rawImageBase64: contexto.imagenBase64 }
    );
    resultado.engineVersion = engineVersion;
  }

  contexto.resultado = resultado as ResultadoOmr;
  return contexto;
}
