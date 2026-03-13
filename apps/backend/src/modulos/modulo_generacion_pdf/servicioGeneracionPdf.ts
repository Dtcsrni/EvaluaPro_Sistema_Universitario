/**
 * Generacion de PDFs en formato carta con marcas y QR por pagina.
 *
 * Fachada del dominio PDF.
 */
import { generarExamenIndividual } from './application/usecases/generarExamenIndividual';
import type { MapaVariante, PreguntaBase } from './servicioVariantes';
import type { TemplateVersion } from './shared/tiposPdf';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { TEMPLATE_VERSION_TV3 } from './domain/tv3Compat';

/**
 * Fachada que delega al caso de uso modular.
 */
export async function generarPdfExamen({
  titulo,
  folio,
  examId,
  preguntas,
  mapaVariante,
  tipoExamen,
  totalPaginas,
  margenMm = 10,
  encabezado,
  templateVersion = TEMPLATE_VERSION_TV3
}: {
  titulo: string;
  folio: string;
  examId?: string;
  preguntas: PreguntaBase[];
  mapaVariante: MapaVariante;
  tipoExamen: 'parcial' | 'global';
  totalPaginas: number;
  margenMm?: number;
  templateVersion?: TemplateVersion;
  encabezado?: {
    institucion?: string;
    lema?: string;
    materia?: string;
    docente?: string;
    instrucciones?: string;
    alumno?: { nombre?: string; grupo?: string };
    mostrarInstrucciones?: boolean;
    logos?: { izquierdaPath?: string; derechaPath?: string };
  };
}) {
  if (templateVersion !== undefined && templateVersion !== TEMPLATE_VERSION_TV3) {
    throw new ErrorAplicacion(
      'OMR_TEMPLATE_NO_COMPATIBLE',
      `Template version ${String(templateVersion)} no compatible. Solo TV3 está soportado.`,
      422
    );
  }
  const resultado = await generarExamenIndividual({
    titulo,
    folio,
    examId,
    preguntas,
    mapaVariante,
    tipoExamen,
    totalPaginas,
    margenMm,
    encabezado,
    templateVersion: TEMPLATE_VERSION_TV3
  });
  return resultado;
}
