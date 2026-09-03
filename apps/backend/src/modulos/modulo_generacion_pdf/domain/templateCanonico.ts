/**
 * Contrato de la plantilla OMR canónica.
 *
 * Responsabilidad: normalizar el único formato de examen operativo.
 * Límites: no contiene adaptadores ni rutas de compatibilidad histórica.
 */
import { ErrorAplicacion } from '../../../compartido/errores/errorAplicacion';
import type {
  MapaVariante,
  PreguntaBase,
  ResultadoGeneracionPdf,
  TemplateVersion
} from '../shared/tiposPdf';

export const TEMPLATE_VERSION_CANONICA: TemplateVersion = 4;
export const TEMPLATE_VERSION_DEFAULT: TemplateVersion = TEMPLATE_VERSION_CANONICA;
export const OMR_CANONICAL_CONTRACT_ID = 'omr-canonical-v4';
export const OMR_CANONICAL_DISPLAY_LABEL = 'OMR canónico · v4';

const OPCIONES_OMR_CANONICAS = 5;
type Opcion = { texto: string; esCorrecta: boolean };

function crearOpcionVacia(indice: number): Opcion {
  return { texto: `Opcion ${String.fromCharCode(65 + indice)}`, esCorrecta: false };
}

export function esTemplateVersionCanonica(templateVersion?: number): templateVersion is TemplateVersion {
  return Number(templateVersion) === TEMPLATE_VERSION_CANONICA;
}

export function resolverTemplateVersionCanonica(templateVersion?: number): TemplateVersion {
  if (templateVersion === undefined || templateVersion === null) return TEMPLATE_VERSION_DEFAULT;
  const normalizado = Number(templateVersion);
  if (esTemplateVersionCanonica(normalizado)) return normalizado;
  throw new ErrorAplicacion(
    'OMR_TEMPLATE_VERSION_INVALIDA',
    `Template version ${String(templateVersion)} no válida. Solo se admite la plantilla OMR canónica.`,
    422
  );
}

export function normalizarPreguntaCanonica(pregunta: PreguntaBase): PreguntaBase {
  const opciones = Array.isArray(pregunta.opciones) ? pregunta.opciones.slice() : [];
  if (opciones.length > OPCIONES_OMR_CANONICAS) {
    throw new ErrorAplicacion(
      'PREGUNTA_OMR_OPCIONES_INVALIDAS',
      `La pregunta ${pregunta.id} tiene ${opciones.length} opciones; la plantilla canónica admite máximo ${OPCIONES_OMR_CANONICAS}.`,
      422
    );
  }
  while (opciones.length < OPCIONES_OMR_CANONICAS) opciones.push(crearOpcionVacia(opciones.length));
  return { ...pregunta, opciones };
}

export function normalizarPreguntasCanonicas(preguntas: PreguntaBase[]) {
  if (!Array.isArray(preguntas) || preguntas.length === 0) {
    throw new ErrorAplicacion('SIN_PREGUNTAS', 'No hay preguntas para generar el examen.', 400);
  }
  return preguntas.map(normalizarPreguntaCanonica);
}

function ordenOpcionesDefault() {
  return Array.from({ length: OPCIONES_OMR_CANONICAS }, (_v, i) => i);
}

export function normalizarMapaVarianteCanonica(
  preguntas: PreguntaBase[],
  mapaVariante: MapaVariante | undefined
): MapaVariante {
  const ids = preguntas.map((p) => p.id);
  const ordenPreguntasBruto = Array.isArray(mapaVariante?.ordenPreguntas) ? mapaVariante.ordenPreguntas : [];
  const setIds = new Set(ids);
  const usados = new Set<string>();
  const ordenPreguntas = [
    ...ordenPreguntasBruto.filter((id) => setIds.has(id) && !usados.has(id) && (usados.add(id), true)),
    ...ids.filter((id) => !usados.has(id))
  ];

  const ordenOpcionesPorPregunta: Record<string, number[]> = {};
  for (const id of ids) {
    const bruto = Array.isArray(mapaVariante?.ordenOpcionesPorPregunta?.[id])
      ? mapaVariante.ordenOpcionesPorPregunta[id]
      : [];
    const filtrado = bruto.filter((x) => Number.isInteger(x) && x >= 0 && x < OPCIONES_OMR_CANONICAS);
    const vistos = new Set<number>();
    const base = filtrado.filter((x) => !vistos.has(x) && (vistos.add(x), true));
    for (const x of ordenOpcionesDefault()) if (!vistos.has(x)) base.push(x);
    ordenOpcionesPorPregunta[id] = base.slice(0, OPCIONES_OMR_CANONICAS);
  }

  return { ordenPreguntas, ordenOpcionesPorPregunta };
}

export function extraerPreguntasUsadasMapaOmr(mapaOmr: ResultadoGeneracionPdf['mapaOmr']) {
  const usados = new Set<string>();
  for (const pagina of mapaOmr?.paginas ?? []) {
    for (const pregunta of pagina.preguntas ?? []) {
      const id = String(pregunta.idPregunta ?? '').trim();
      if (id) usados.add(id);
    }
  }
  return usados;
}

export function construirMapaVarianteUsadaCanonica(
  mapaVariante: MapaVariante,
  usados: Set<string>
): { ordenPreguntas: string[]; ordenOpcionesPorPregunta: Record<string, number[]> } {
  const ordenUsado = usados.size > 0
    ? (mapaVariante.ordenPreguntas ?? []).filter((id) => usados.has(id))
    : (mapaVariante.ordenPreguntas ?? []);
  return {
    ordenPreguntas: ordenUsado,
    ordenOpcionesPorPregunta: Object.fromEntries(
      ordenUsado.map((id) => [id, mapaVariante.ordenOpcionesPorPregunta?.[id] ?? ordenOpcionesDefault()])
    ) as Record<string, number[]>
  };
}
