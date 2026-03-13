import { ErrorAplicacion } from '../../../compartido/errores/errorAplicacion';
import type { MapaVariante, PreguntaBase, ResultadoGeneracionPdf, TemplateVersion } from '../shared/tiposPdf';

export const TEMPLATE_VERSION_TV3: TemplateVersion = 3;
const OPCIONES_TV3 = 5;

type Opcion = { texto: string; esCorrecta: boolean };

function crearOpcionRelleno(indice: number): Opcion {
  return { texto: `Opcion ${String.fromCharCode(65 + indice)}`, esCorrecta: false };
}

export function normalizarPreguntaParaTv3(pregunta: PreguntaBase): PreguntaBase {
  const opciones = Array.isArray(pregunta.opciones) ? pregunta.opciones.slice() : [];
  if (opciones.length > OPCIONES_TV3) {
    throw new ErrorAplicacion(
      'PREGUNTA_NO_COMPATIBLE_TV3',
      `La pregunta ${pregunta.id} tiene ${opciones.length} opciones; TV3 soporta maximo ${OPCIONES_TV3}.`,
      422
    );
  }
  while (opciones.length < OPCIONES_TV3) {
    opciones.push(crearOpcionRelleno(opciones.length));
  }
  return { ...pregunta, opciones };
}

export function normalizarPreguntasParaTv3(preguntas: PreguntaBase[]) {
  if (!Array.isArray(preguntas) || preguntas.length === 0) {
    throw new ErrorAplicacion('SIN_PREGUNTAS', 'No hay preguntas para generar examen TV3', 400);
  }
  return preguntas.map(normalizarPreguntaParaTv3);
}

function ordenOpcionesDefault() {
  return Array.from({ length: OPCIONES_TV3 }, (_v, i) => i);
}

export function normalizarMapaVarianteTv3(preguntas: PreguntaBase[], mapaVariante?: MapaVariante): MapaVariante {
  const ids = preguntas.map((p) => p.id);
  const ordenPreguntasBruto = Array.isArray(mapaVariante?.ordenPreguntas) ? mapaVariante?.ordenPreguntas ?? [] : [];
  const setIds = new Set(ids);
  const usados = new Set<string>();
  const ordenPreguntas = [
    ...ordenPreguntasBruto.filter((id) => setIds.has(id) && !usados.has(id) && (usados.add(id), true)),
    ...ids.filter((id) => !usados.has(id))
  ];

  const ordenOpcionesPorPregunta: Record<string, number[]> = {};
  for (const id of ids) {
    const bruto = Array.isArray(mapaVariante?.ordenOpcionesPorPregunta?.[id])
      ? (mapaVariante?.ordenOpcionesPorPregunta?.[id] ?? [])
      : [];
    const filtrado = bruto.filter((x) => Number.isInteger(x) && x >= 0 && x < OPCIONES_TV3);
    const vistos = new Set<number>();
    const base = filtrado.filter((x) => !vistos.has(x) && (vistos.add(x), true));
    for (const x of ordenOpcionesDefault()) {
      if (!vistos.has(x)) base.push(x);
    }
    ordenOpcionesPorPregunta[id] = base.slice(0, OPCIONES_TV3);
  }

  return { ordenPreguntas, ordenOpcionesPorPregunta };
}

export function extraerPreguntasUsadasMapaOmr(mapaOmr: ResultadoGeneracionPdf['mapaOmr']) {
  const usados = new Set<string>();
  for (const pag of mapaOmr?.paginas ?? []) {
    for (const pr of pag.preguntas ?? []) {
      const id = String(pr.idPregunta ?? '').trim();
      if (id) usados.add(id);
    }
  }
  return usados;
}

export function construirMapaVarianteUsadaTv3(
  mapaVariante: MapaVariante,
  usados: Set<string>
): { ordenPreguntas: string[]; ordenOpcionesPorPregunta: Record<string, number[]> } {
  const ordenUsado = (mapaVariante.ordenPreguntas ?? []).filter((id) => usados.has(id));
  return {
    ordenPreguntas: ordenUsado,
    ordenOpcionesPorPregunta: Object.fromEntries(
      ordenUsado.map((id) => [id, mapaVariante.ordenOpcionesPorPregunta?.[id] ?? ordenOpcionesDefault()])
    ) as Record<string, number[]>
  };
}
