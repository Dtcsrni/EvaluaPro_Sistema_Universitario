import type { MapaVariante, PreguntaBase } from '../shared/tiposPdf';
import {
  TEMPLATE_VERSION_TV3,
  construirMapaVarianteUsadaParaTemplate,
  extraerPreguntasUsadasMapaOmr,
  normalizarMapaVarianteParaTemplate,
  normalizarPreguntaParaTemplate,
  normalizarPreguntasParaTemplate
} from './templateCompat';

export { TEMPLATE_VERSION_TV3 };

export function normalizarPreguntaParaTv3(pregunta: PreguntaBase) {
  return normalizarPreguntaParaTemplate(pregunta, TEMPLATE_VERSION_TV3);
}

export function normalizarPreguntasParaTv3(preguntas: PreguntaBase[]) {
  return normalizarPreguntasParaTemplate(preguntas, TEMPLATE_VERSION_TV3);
}

export function normalizarMapaVarianteTv3(preguntas: PreguntaBase[], mapaVariante?: MapaVariante) {
  return normalizarMapaVarianteParaTemplate(preguntas, mapaVariante, TEMPLATE_VERSION_TV3);
}

export { extraerPreguntasUsadasMapaOmr };

export function construirMapaVarianteUsadaTv3(mapaVariante: MapaVariante, usados: Set<string>) {
  return construirMapaVarianteUsadaParaTemplate(mapaVariante, usados);
}
