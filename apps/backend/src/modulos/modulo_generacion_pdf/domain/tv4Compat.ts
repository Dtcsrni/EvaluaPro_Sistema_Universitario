import type { MapaVariante, PreguntaBase } from '../shared/tiposPdf';
import {
  TEMPLATE_VERSION_TV4,
  construirMapaVarianteUsadaParaTemplate,
  extraerPreguntasUsadasMapaOmr,
  normalizarMapaVarianteParaTemplate,
  normalizarPreguntaParaTemplate,
  normalizarPreguntasParaTemplate
} from './templateCompat';

export { TEMPLATE_VERSION_TV4 };

export function normalizarPreguntaParaTv4(pregunta: PreguntaBase) {
  return normalizarPreguntaParaTemplate(pregunta, TEMPLATE_VERSION_TV4);
}

export function normalizarPreguntasParaTv4(preguntas: PreguntaBase[]) {
  return normalizarPreguntasParaTemplate(preguntas, TEMPLATE_VERSION_TV4);
}

export function normalizarMapaVarianteTv4(preguntas: PreguntaBase[], mapaVariante?: MapaVariante) {
  return normalizarMapaVarianteParaTemplate(preguntas, mapaVariante, TEMPLATE_VERSION_TV4);
}

export { extraerPreguntasUsadasMapaOmr };

export function construirMapaVarianteUsadaTv4(mapaVariante: MapaVariante, usados: Set<string>) {
  return construirMapaVarianteUsadaParaTemplate(mapaVariante, usados);
}
