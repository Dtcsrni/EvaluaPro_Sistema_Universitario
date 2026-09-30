/**
 * ejecutorPipelineOmr
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import type { ResultadoOmr } from '../../servicioOmrCv.js';
import { registrarOmrEtapa, registrarOmrPipeline } from '../../../../compartido/observabilidad/metrics.js';
import { ejecutarEtapaCalidad } from '../calidad/etapaCalidad.js';
import { ejecutarEtapaDebug } from '../debug/etapaDebug.js';
import { ejecutarEtapaDeteccion } from '../deteccion/etapaDeteccion.js';
import { ejecutarEtapaQr } from '../qr/etapaQr.js';
import { ejecutarEtapaScoring } from '../scoring/etapaScoring.js';
import type { ContextoPipelineOmr, EtapaOmr, ResultadoPipelineOmr } from '../types.js';

type EjecutorEtapa = (contexto: ContextoPipelineOmr) => Promise<ContextoPipelineOmr>;

async function ejecutarConMetricas(
  etapa: EtapaOmr,
  contexto: ContextoPipelineOmr,
  ejecutor: EjecutorEtapa,
  reporteEtapas: ResultadoPipelineOmr<ResultadoOmr>['etapas']
) {
  const inicio = Date.now();
  try {
    const siguiente = await ejecutor(contexto);
    const duracionMs = Date.now() - inicio;
    registrarOmrEtapa(etapa, duracionMs, true, contexto.requestId);
    reporteEtapas.push({ etapa, duracionMs, exito: true });
    return siguiente;
  } catch (error) {
    const duracionMs = Date.now() - inicio;
    registrarOmrEtapa(etapa, duracionMs, false, contexto.requestId);
    reporteEtapas.push({ etapa, duracionMs, exito: false });
    throw error;
  }
}

export async function ejecutarPipelineOmr(
  contextoInicial: ContextoPipelineOmr
): Promise<ResultadoPipelineOmr<ResultadoOmr>> {
  const etapas: ResultadoPipelineOmr<ResultadoOmr>['etapas'] = [];
  let contexto = { ...contextoInicial };
  const inicio = Date.now();

  try {
    contexto = await ejecutarConMetricas('qr', contexto, ejecutarEtapaQr, etapas);
    contexto = await ejecutarConMetricas('deteccion', contexto, ejecutarEtapaDeteccion, etapas);
    contexto = await ejecutarConMetricas('scoring', contexto, ejecutarEtapaScoring, etapas);
    contexto = await ejecutarConMetricas('calidad', contexto, ejecutarEtapaCalidad, etapas);
    contexto = await ejecutarConMetricas('debug', contexto, ejecutarEtapaDebug, etapas);

    if (!contexto.resultado) {
      throw new Error('Pipeline OMR sin resultado final');
    }

    registrarOmrPipeline(true, Date.now() - inicio, contexto.requestId);
    return {
      requestId: contexto.requestId,
      exito: true,
      resultado: contexto.resultado as ResultadoOmr,
      etapas
    };
  } catch (error) {
    registrarOmrPipeline(false, Date.now() - inicio, contexto.requestId);
    throw error;
  }
}
