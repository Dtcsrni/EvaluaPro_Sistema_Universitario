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

  // Autoajuste conservador: primero intenta conservar la tipografía y solo
  // compacta el cuerpo del examen. La cabecera queda protegida en el renderer.
  const escalas = [...new Set([fontScaleBase, 1, 0.95, 0.9, 0.85, 0.8, 0.75])]
    .filter((value) => value >= 0.75 && value <= fontScaleBase)
    .sort((a, b) => b - a);
  const espaciados = [...new Set([lineSpacingBase, 1, 0.95, 0.9, 0.85, 0.8, 0.75])]
    .filter((value) => value >= 0.75 && value <= lineSpacingBase)
    .sort((a, b) => b - a);

  let ultimoResultado: ResultadoGeneracionPdf | undefined;
  for (const escala of escalas) {
    for (const espaciado of espaciados) {
      const resultado = await renderizar(escala, espaciado);
      ultimoResultado = resultado;
      if (resultado.preguntasRestantes === 0 && resultado.paginas.length <= totalPaginas) {
        return resultado;
      }
    }
  }

  // Nunca se recortan preguntas ni se fuerza una geometría insegura: si el
  // contenido no cabe, se conserva el mejor intento para que la UI muestre la
  // advertencia real del motor y sugiera aumentar páginas o editar contenido.
  return ultimoResultado ?? renderizar(fontScaleBase, lineSpacingBase);
}
