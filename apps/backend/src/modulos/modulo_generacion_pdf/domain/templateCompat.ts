/**
 * templateCompat
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { ErrorAplicacion } from '../../../compartido/errores/errorAplicacion';
import type { MapaVariante, PreguntaBase, ResultadoGeneracionPdf, TemplateVersion } from '../shared/tiposPdf';

export const TEMPLATE_VERSION_TV3: TemplateVersion = 3;
export const TEMPLATE_VERSION_TV4: TemplateVersion = 4;
export const TEMPLATE_VERSION_DEFAULT: TemplateVersion = TEMPLATE_VERSION_TV4;

const TEMPLATE_VERSIONS_COMPATIBLES = new Set<TemplateVersion>([TEMPLATE_VERSION_TV3, TEMPLATE_VERSION_TV4]);
const OPCIONES_COMPATIBLES_OMR = 5;

type Opcion = { texto: string; esCorrecta: boolean };

function crearOpcionRelleno(indice: number): Opcion {
  return { texto: `Opcion ${String.fromCharCode(65 + indice)}`, esCorrecta: false };
}

export function esTemplateVersionCompatible(templateVersion?: number): templateVersion is TemplateVersion {
  return TEMPLATE_VERSIONS_COMPATIBLES.has(Number(templateVersion) as TemplateVersion);
}

export function resolverTemplateVersionCompatible(templateVersion?: number): TemplateVersion {
  if (templateVersion === undefined || templateVersion === null) return TEMPLATE_VERSION_DEFAULT;
  const normalizado = Number(templateVersion);
  if (esTemplateVersionCompatible(normalizado)) return normalizado;
  throw new ErrorAplicacion(
    'OMR_TEMPLATE_NO_COMPATIBLE',
    `Template version ${String(templateVersion)} no compatible. Versiones soportadas: TV3 y TV4.`,
    422
  );
}

export function normalizarPreguntaParaTemplate(pregunta: PreguntaBase, templateVersion: TemplateVersion): PreguntaBase {
  const opciones = Array.isArray(pregunta.opciones) ? pregunta.opciones.slice() : [];
  if (opciones.length > OPCIONES_COMPATIBLES_OMR) {
    throw new ErrorAplicacion(
      `PREGUNTA_NO_COMPATIBLE_TV${templateVersion}`,
      `La pregunta ${pregunta.id} tiene ${opciones.length} opciones; TV${templateVersion} soporta maximo ${OPCIONES_COMPATIBLES_OMR}.`,
      422
    );
  }
  while (opciones.length < OPCIONES_COMPATIBLES_OMR) {
    opciones.push(crearOpcionRelleno(opciones.length));
  }
  return { ...pregunta, opciones };
}

export function normalizarPreguntasParaTemplate(
  preguntas: PreguntaBase[],
  templateVersion: TemplateVersion
) {
  if (!Array.isArray(preguntas) || preguntas.length === 0) {
    throw new ErrorAplicacion('SIN_PREGUNTAS', `No hay preguntas para generar examen TV${templateVersion}`, 400);
  }
  return preguntas.map((pregunta) => normalizarPreguntaParaTemplate(pregunta, templateVersion));
}

function ordenOpcionesDefault() {
  return Array.from({ length: OPCIONES_COMPATIBLES_OMR }, (_v, i) => i);
}

export function normalizarMapaVarianteParaTemplate(
  preguntas: PreguntaBase[],
  mapaVariante: MapaVariante | undefined,
  templateVersion: TemplateVersion
): MapaVariante {
  void templateVersion;
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
    const filtrado = bruto.filter((x) => Number.isInteger(x) && x >= 0 && x < OPCIONES_COMPATIBLES_OMR);
    const vistos = new Set<number>();
    const base = filtrado.filter((x) => !vistos.has(x) && (vistos.add(x), true));
    for (const x of ordenOpcionesDefault()) {
      if (!vistos.has(x)) base.push(x);
    }
    ordenOpcionesPorPregunta[id] = base.slice(0, OPCIONES_COMPATIBLES_OMR);
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

export function construirMapaVarianteUsadaParaTemplate(
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
