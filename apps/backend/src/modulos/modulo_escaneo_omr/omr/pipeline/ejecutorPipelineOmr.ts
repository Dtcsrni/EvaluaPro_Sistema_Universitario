import type { ResultadoOmr } from '../../servicioOmrCv';
import { registrarOmrEtapa, registrarOmrPipeline } from '../../../../compartido/observabilidad/metrics';
import { ejecutarEtapaCalidad } from '../calidad/etapaCalidad';
import { ejecutarEtapaDebug } from '../debug/etapaDebug';
import { ejecutarEtapaDeteccion } from '../deteccion/etapaDeteccion';
import { ejecutarEtapaQr } from '../qr/etapaQr';
import { ejecutarEtapaScoring } from '../scoring/etapaScoring';
import type { ContextoPipelineOmr, EtapaOmr, ResultadoPipelineOmr } from '../types';

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
