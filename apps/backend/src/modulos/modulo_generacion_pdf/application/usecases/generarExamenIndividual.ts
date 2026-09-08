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
} from '../../shared/tiposPdf';
import { ExamenPdf } from '../../domain/examenPdf';
import { obtenerPerfilPlantilla } from '../../domain/layoutExamen';
import { resolverPerfilLayout } from '../../infra/configuracionLayoutEnv';
import { PdfKitRenderer } from '../../infra/pdfKitRenderer';
import {
  resolverTemplateVersionCanonica,
  normalizarMapaVarianteCanonica,
  normalizarPreguntasCanonicas
} from '../../domain/templateCanonico';

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

  const examen = new ExamenPdf(
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
      fontScale: params.bookletConfig?.fontScale,
      lineSpacing: params.bookletConfig?.lineSpacing,
      logos: params.bookletConfig?.logos
    },
    params.encabezado
  );

  const perfilOmr = obtenerPerfilPlantilla(templateVersion);
  const perfilLayout = resolverPerfilLayout();
  return new PdfKitRenderer(perfilOmr, perfilLayout).generarPdf(examen);
}
