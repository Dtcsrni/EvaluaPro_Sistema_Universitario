/**
 * Tipos compartidos para el dominio de generacion de PDFs.
 * 
 * Define DTOs, types y constantes compartidas entre capas del modulo.
 */

export type TemplateVersion = 1 | 3;
export type TipoExamen = 'parcial' | 'global';

export interface EncabezadoExamen {
  institucion?: string;
  lema?: string;
  materia?: string;
  docente?: string;
  instrucciones?: string;
  alumno?: { nombre?: string; grupo?: string };
  mostrarInstrucciones?: boolean;
  logos?: { izquierdaPath?: string; derechaPath?: string };
}

export interface ParametrosGeneracionPdf {
  titulo: string;
  folio: string;
  examId?: string;
  preguntas: PreguntaBase[];
  mapaVariante: MapaVariante;
  tipoExamen: TipoExamen;
  totalPaginas: number;
  margenMm?: number;
  templateVersion?: TemplateVersion;
  encabezado?: EncabezadoExamen;
}

export interface PreguntaBase {
  id: string;
  enunciado: string;
  imagenUrl?: string;
  opciones: Array<{ texto: string; esCorrecta: boolean }>;
}

export interface MapaVariante {
  ordenPreguntas: string[];
  ordenOpcionesPorPregunta: Record<string, number[]>;
}

export interface ResultadoGeneracionPdf {
  pdfBytes: Buffer;
  layoutEngine?: 'pdf-lib-legacy' | 'playwright-html-v1';
  layoutTemplateVersion?: number;
  paginas: Array<{
    numero: number;
    qrTexto: string;
    preguntasDel: number;
    preguntasAl: number;
  }>;
  metricasPaginas: Array<{
    numero: number;
    fraccionVacia: number;
    preguntas: number;
  }>;
  metricasLayout?: {
    minLineHeightApplied: number;
    preguntasConFormatoRico: number;
    imagenesIntentadas: number;
    imagenesRenderizadas: number;
    imagenesFallidas: number;
  };
  renderDiagnostics?: {
    preguntasCalculadas: number;
    preguntasRenderizadas: number;
    pageFillRatios: number[];
    collisionsDetected: Array<{ pagina: number; a: string; b: string }>;
    imagesRequested: number;
    imagesRendered: number;
    imagesFailed: number;
  };
  mapaOmr: MapaOmr;
  preguntasRestantes: number;
}

export interface MapaOmr {
  margenMm: number;
  templateVersion: TemplateVersion;
  markerSpec?: MarkerSpecOmr;
  blockSpec?: BlockSpecOmr;
  engineHints?: EngineHintsOmr;
  perfilLayout: PerfilLayoutImpresion;
  perfil: PerfilPlantillaOmr;
  paginas: PaginaOmr[];
}

export interface MarkerSpecOmr {
  family: 'aruco_4x4_50';
  sizeMm: number;
  quietZoneMm: number;
  ids?: {
    tl: number;
    tr: number;
    bl: number;
    br: number;
  };
}

export interface BlockSpecOmr {
  preguntasPorBloque: number;
  opcionesPorPregunta: number;
  bubbleDiameterMm: number;
  bubblePitchYmm: number;
  labelToBubbleMm: number;
  bubbleStrokePt: number;
}

export interface EngineHintsOmr {
  preferredEngine: 'cv';
  enableClahe: boolean;
  adaptiveThreshold: boolean;
  conservativeDecision: boolean;
}

export interface PerfilLayoutImpresion {
  gridStepPt: number;
  headerHeightFirst: number;
  headerHeightOther: number;
  bottomSafePt: number;
  usarRellenosDecorativos: boolean;
  usarEtiquetaOmrSolida: boolean;
}

export interface PerfilPlantillaOmr {
  qrSize: number;
  qrPadding: number;
  qrMarginModulos: number;
  marcasEsquina: 'lineas' | 'cuadrados';
  marcaCuadradoSize: number;
  marcaCuadradoQuietZone: number;
  burbujaRadio: number;
  burbujaPasoY: number;
  cajaOmrAncho: number;
  fiducialSize: number;
  bubbleStrokePt?: number;
  labelToBubbleMm?: number;
  preguntasPorBloque?: number;
  opcionesPorPregunta?: number;
}

export interface PaginaOmr {
  numeroPagina: number;
  qr: {
    texto: string;
    x: number;
    y: number;
    size: number;
    padding: number;
  };
  marcasPagina: {
    tipo: 'lineas' | 'cuadrados';
    size: number;
    quietZone: number;
    tl: { x: number; y: number };
    tr: { x: number; y: number };
    bl: { x: number; y: number };
    br: { x: number; y: number };
  };
  preguntas: Array<{
    numeroPregunta: number;
    idPregunta: string;
    opciones: Array<{ letra: string; x: number; y: number }>;
    textRuns?: Array<{
      tipo: 'texto' | 'codigo';
      fuente: string;
      size: number;
      lineHeight: number;
      bbox: { x: number; y: number; width: number; height: number };
    }>;
    imageRenderStatus?: 'ok' | 'error';
    bboxPregunta?: { x: number; y: number; width: number; height: number };
    cajaOmr?: { x: number; y: number; width: number; height: number };
    perfilOmr?: { radio: number; pasoY: number; cajaAncho: number };
    fiduciales?: {
      leftTop: { x: number; y: number };
      leftBottom: { x: number; y: number };
      rightTop: { x: number; y: number };
      rightBottom: { x: number; y: number };
      leftMid?: { x: number; y: number };
      rightMid?: { x: number; y: number };
    };
  }>;
  layoutDebug?: {
    engine?: 'pdf-lib-legacy' | 'playwright-html-v1';
    layoutTemplateVersion?: number;
    pageShell?: { x: number; y: number; width: number; height: number };
    header?: { x: number; y: number; width: number; height: number };
    qr?: { x: number; y: number; width: number; height: number };
    headerTextBlocks?: Array<{ x: number; y: number; width: number; height: number; id: string }>;
    lineHeightViolations?: Array<{ preguntaId: string; lineHeight: number; min: number }>;
    contentStartY?: number;
    contentEndY?: number;
    headerSlots?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
    contentShell?: { x: number; y: number; width: number; height: number };
    footerShell?: { x: number; y: number; width: number; height: number };
    questionBlockBoxes?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
    omrPanelBoxes?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
    collisionBoxes?: Array<{ pagina: number; a: string; b: string }>;
  };
}

// Constantes de formato carta (puntos PostScript)
export const ANCHO_CARTA = 612;
export const ALTO_CARTA = 792;
export const MM_A_PUNTOS = 72 / 25.4;
