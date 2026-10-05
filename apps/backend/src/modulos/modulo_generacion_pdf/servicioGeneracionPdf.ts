/**
 * Generacion de PDFs en formato carta con marcas y QR por pagina.
 *
 * Fachada del dominio PDF.
 */
import { generarExamenIndividual } from './application/usecases/generarExamenIndividual.js';
import type { MapaVariante, PreguntaBase } from './servicioVariantes.js';
import type { OmrTemplateId, TemplateVersion, TipoExamen } from './shared/tiposPdf.js';
import {
  resolverTemplateVersionCanonica,
  TEMPLATE_VERSION_DEFAULT
} from './domain/templateCanonico.js';
import { validarSeparacionDuplexOmr } from './domain/duplexOmrGuard.js';

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
  margenMm = 8,
  encabezado,
  bookletConfig,
  templateVersion = TEMPLATE_VERSION_DEFAULT,
  omrTemplateId
}: {
  titulo: string;
  folio: string;
  examId?: string;
  preguntas: PreguntaBase[];
  mapaVariante: MapaVariante;
  tipoExamen: TipoExamen;
  totalPaginas: number;
  margenMm?: number;
  templateVersion?: TemplateVersion;
  omrTemplateId?: OmrTemplateId;
  bookletConfig?: {
    densityMode?: 'balanced' | 'compact' | 'relaxed';
    autoFitPages?: boolean;
    autoFitTypography?: boolean;
    fontScale?: number;
    lineSpacing?: number;
    distribuirEnPaginasObjetivo?: boolean;
    logos?: { izquierdaPath?: string; derechaPath?: string };
  };
  encabezado?: {
    institucion?: string;
    lema?: string;
    materia?: string;
    docente?: string;
    instrucciones?: string;
    alumno?: { nombre?: string; grupo?: string; iniciales?: string };
    mostrarInstrucciones?: boolean;
    mostrarMarcaInstitucional?: boolean;
    logos?: { izquierdaPath?: string; derechaPath?: string };
  };
}) {
  const resultado = await generarExamenIndividual({
    titulo,
    folio,
    examId,
    preguntas,
    mapaVariante,
    tipoExamen,
    totalPaginas,
    margenMm,
    bookletConfig,
    encabezado,
    templateVersion: resolverTemplateVersionCanonica(templateVersion),
    omrTemplateId
  });
  validarSeparacionDuplexOmr(resultado.mapaOmr);
  return resultado;
}
