/**
 * Use case: Generar Examen Individual
 * 
 * Orquesta la generacion de un PDF de examen individual con todas sus paginas,
 * metadata OMR y validaciones de negocio.
 * 
 * Responsabilidad: coordinar domain + infra sin logica de rendering.
 */
import type {
  ParametrosGeneracionPdf,
  ResultadoGeneracionPdf
} from '../../shared/tiposPdf.js';
import { ExamenPdf } from '../../domain/examenPdf.js';
import { obtenerPerfilPlantilla } from '../../domain/layoutExamen.js';
import { resolverPerfilLayout } from '../../infra/configuracionLayoutEnv.js';
import { PdfKitRenderer } from '../../infra/pdfKitRenderer.js';
import {
  resolverTemplateVersionCanonica,
  normalizarMapaVarianteCanonica,
  normalizarPreguntasCanonicas
} from '../../domain/templateCanonico.js';

type PistaAutoFit = { escala: number; espaciado: number };

// El autoajuste se ejecuta repetidamente al previsualizar la misma plantilla.
// La clave incluye los datos que afectan al layout, por lo que una pregunta,
// encabezado o configuración diferente no reutiliza una pista vieja.
const pistasAutoFit = new Map<string, PistaAutoFit>();
const MAX_PISTAS_AUTOFIT = 32;

function construirClaveAutoFit(params: ParametrosGeneracionPdf, templateVersion: number) {
  return JSON.stringify({
    titulo: params.titulo,
    tipoExamen: params.tipoExamen,
    totalPaginas: params.totalPaginas,
    margenMm: params.margenMm,
    templateVersion,
    preguntas: params.preguntas,
    mapaVariante: params.mapaVariante,
    bookletConfig: params.bookletConfig,
    encabezado: params.encabezado
  });
}

function priorizarPista(valores: number[], pista: number | undefined) {
  if (!Number.isFinite(pista) || !valores.includes(pista as number)) return valores;
  return [pista as number, ...valores.filter((valor) => valor !== pista)];
}

function construirCombinacionesAutoFit(
  escalas: number[],
  espaciados: number[],
  pista?: PistaAutoFit
) {
  const combinaciones: PistaAutoFit[] = [];
  const agregada = new Set<string>();
  const agregar = (escala: number, espaciado: number) => {
    const clave = `${escala}:${espaciado}`;
    if (agregada.has(clave)) return;
    agregada.add(clave);
    combinaciones.push({ escala, espaciado });
  };

  // Una pista válida resuelve la siguiente vista en un solo render. En el
  // primer cálculo, estas sondas cubren los extremos y valores intermedios
  // habituales antes de entrar a la matriz completa de respaldo.
  if (pista) agregar(pista.escala, pista.espaciado);
  agregar(escalas[0] ?? 1, espaciados[0] ?? 1.1);
  agregar(escalas[0] ?? 1, espaciados[espaciados.length - 1] ?? 0.75);
  agregar(escalas[escalas.length - 1] ?? 0.75, espaciados[0] ?? 1.1);
  for (const valor of [0.9, 0.8, 0.75]) {
    if (escalas.includes(valor) && espaciados.includes(valor)) agregar(valor, valor);
  }

  // Respaldo exacto: conserva la prioridad original (mayor legibilidad
  // primero) para bancos atípicos que no entren con las sondas anteriores.
  for (const escala of escalas) {
    for (const espaciado of espaciados) agregar(escala, espaciado);
  }
  return combinaciones;
}

function guardarPistaAutoFit(clave: string, pista: PistaAutoFit) {
  pistasAutoFit.delete(clave);
  pistasAutoFit.set(clave, pista);
  while (pistasAutoFit.size > MAX_PISTAS_AUTOFIT) {
    const primera = pistasAutoFit.keys().next().value;
    if (typeof primera !== 'string') break;
    pistasAutoFit.delete(primera);
  }
}

/**
 * Genera un PDF de examen individual.
 * 
 * Implementacion modular: dominio + infraestructura desacoplada.
 */
export async function generarExamenIndividual(
  params: ParametrosGeneracionPdf
): Promise<ResultadoGeneracionPdf> {
  const templateVersion = resolverTemplateVersionCanonica(params.templateVersion);
  const preguntas = normalizarPreguntasCanonicas(params.preguntas);
  const mapaVariante = normalizarMapaVarianteCanonica(preguntas, params.mapaVariante);
  const totalPaginas = Number.isFinite(params.totalPaginas)
    ? Math.max(1, Math.floor(params.totalPaginas))
    : 1;
  const margenMm = Number.isFinite(params.margenMm)
    ? Math.max(4.5, Number(params.margenMm))
    : 8;

  const perfilOmr = obtenerPerfilPlantilla(templateVersion);
  const perfilLayout = resolverPerfilLayout();
  const renderer = new PdfKitRenderer(perfilOmr, perfilLayout);
  const construirExamen = (fontScale: number, lineSpacing: number) => new ExamenPdf(
    params.titulo?.trim() || 'Examen',
    params.folio?.trim() || 'SIN-FOLIO',
    params.examId?.trim(),
    preguntas,
    mapaVariante,
    params.tipoExamen,
    {
      margenMm,
      templateVersion,
      totalPaginas,
      densityMode: params.bookletConfig?.densityMode,
      fontScale,
      lineSpacing,
      logos: params.bookletConfig?.logos
    },
    params.encabezado
  );

  const fontScaleBase = Math.min(1.3, Math.max(0.75, Number(params.bookletConfig?.fontScale ?? 1) || 1));
  const lineSpacingBase = Math.min(1.6, Math.max(0.75, Number(params.bookletConfig?.lineSpacing ?? 1.1) || 1.1));
  const renderizar = (fontScale: number, lineSpacing: number) =>
    renderer.generarPdf(construirExamen(fontScale, lineSpacing));

  if (params.bookletConfig?.autoFitPages !== true) {
    return renderizar(fontScaleBase, lineSpacingBase);
  }

  const claveAutoFit = construirClaveAutoFit(params, templateVersion);
  const pista = pistasAutoFit.get(claveAutoFit);

  // El modo editorial puede solicitar que el autoajuste use también el aire
  // disponible para ampliar el texto. Las configuraciones manuales conservan
  // su límite superior histórico; la cabecera y el OMR siguen protegidos.
  const autoFitTypography = params.bookletConfig?.autoFitTypography === true;
  const escalasMaximas = autoFitTypography
    ? [1.3, 1.25, 1.2, 1.15, 1.1, 1.05, fontScaleBase]
    : [fontScaleBase];
  const limiteEscala = autoFitTypography ? 1.3 : fontScaleBase;
  const escalasBase = [...new Set([...escalasMaximas, 1, 0.95, 0.9, 0.85, 0.8, 0.75])]
    .filter((value) => value >= 0.75 && value <= limiteEscala)
    .sort((a, b) => b - a);
  const espaciadosBase = [...new Set([lineSpacingBase, 1, 0.95, 0.9, 0.85, 0.8, 0.75])]
    .filter((value) => value >= 0.75 && value <= lineSpacingBase)
    .sort((a, b) => b - a);
  const escalas = priorizarPista(escalasBase, pista?.escala);
  const espaciados = priorizarPista(espaciadosBase, pista?.espaciado);
  const combinaciones = construirCombinacionesAutoFit(escalas, espaciados, pista);

  let ultimoResultado: ResultadoGeneracionPdf | undefined;
  for (const combinacion of combinaciones) {
    const resultado = await renderizar(combinacion.escala, combinacion.espaciado);
    ultimoResultado = resultado;
    if (resultado.preguntasRestantes === 0 && resultado.paginas.length <= totalPaginas) {
      guardarPistaAutoFit(claveAutoFit, combinacion);
      return resultado;
    }
  }

  // Nunca se recortan preguntas ni se fuerza una geometría insegura: si el
  // contenido no cabe, se conserva el mejor intento para que la UI muestre la
  // advertencia real del motor y sugiera aumentar páginas o editar contenido.
  return ultimoResultado ?? renderizar(fontScaleBase, lineSpacingBase);
}
