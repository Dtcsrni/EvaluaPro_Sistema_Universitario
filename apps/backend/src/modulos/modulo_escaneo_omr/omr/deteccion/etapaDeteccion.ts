import type { ContextoPipelineOmr } from '../types';

export async function ejecutarEtapaDeteccion(contexto: ContextoPipelineOmr) {
  // En esta iteracion, la deteccion fina se mantiene en el motor OMR actual.
  // Esta etapa existe para separar contrato de pipeline e instrumentacion.
  return contexto;
}
