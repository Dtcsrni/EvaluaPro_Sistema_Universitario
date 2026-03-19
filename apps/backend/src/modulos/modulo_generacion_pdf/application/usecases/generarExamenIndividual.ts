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
import { logError } from '../../../../infraestructura/logging/logger';
import { ExamenPdf } from '../../domain/examenPdf';
import { obtenerPerfilPlantilla } from '../../domain/layoutExamen';
import { resolverPerfilLayout } from '../../infra/configuracionLayoutEnv';
import { ExamHtmlRenderer } from '../../infra/html/examHtmlRenderer';
import { PdfKitRenderer } from '../../infra/pdfKitRenderer';
import { resolverPdfEngine } from '../../infra/resolverPdfEngine';
import {
  resolverTemplateVersionCompatible
} from '../../domain/templateCompat';
import {
  normalizarMapaVarianteTv4,
  normalizarPreguntasParaTv4
} from '../../domain/tv4Compat';

/**
 * Genera un PDF de examen individual.
 * 
 * Implementacion modular: dominio + infraestructura desacoplada.
 */
export async function generarExamenIndividual(
  params: ParametrosGeneracionPdf
): Promise<ResultadoGeneracionPdf> {
  const templateVersion = resolverTemplateVersionCompatible(params.templateVersion);
  const preguntas = normalizarPreguntasParaTv4(params.preguntas);
  const mapaVariante = normalizarMapaVarianteTv4(preguntas, params.mapaVariante);
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
      totalPaginas
    },
    params.encabezado
  );

  const perfilOmr = obtenerPerfilPlantilla(templateVersion);
  const perfilLayout = resolverPerfilLayout();
  const engine = resolverPdfEngine();
  if (engine === 'pdf-lib-legacy') {
    return new PdfKitRenderer(perfilOmr, perfilLayout).generarPdf(examen);
  }

  try {
    return await new ExamHtmlRenderer(perfilOmr, perfilLayout).generarPdf(examen);
  } catch (error) {
    logError('Fallo renderer playwright-html-v1. Se usa fallback pdf-lib-legacy.', error, {
      modulo: 'modulo_generacion_pdf',
      folio: examen.folio,
      templateVersion
    });
    const fallback = await new PdfKitRenderer(perfilOmr, perfilLayout).generarPdf(examen);
    return {
      ...fallback,
      layoutEngine: 'pdf-lib-legacy',
      renderDiagnostics: {
        preguntasCalculadas: examen.totalPreguntas,
        preguntasRenderizadas: examen.totalPreguntas - (fallback.preguntasRestantes ?? 0),
        pageFillRatios: fallback.metricasPaginas.map((item) => Number((1 - item.fraccionVacia).toFixed(4))),
        collisionsDetected: [],
        imagesRequested: fallback.metricasLayout?.imagenesIntentadas ?? 0,
        imagesRendered: fallback.metricasLayout?.imagenesRenderizadas ?? 0,
        imagesFailed: fallback.metricasLayout?.imagenesFallidas ?? 0
      }
    };
  }
}
