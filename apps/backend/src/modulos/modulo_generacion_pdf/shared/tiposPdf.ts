/**
 * Tipos compartidos para el dominio de generacion de PDFs.
 * 
 * Define DTOs, types y constantes compartidas entre capas del modulo.
 */

/** La plataforma genera y procesa una única plantilla OMR canónica. */
export type TemplateVersion = 4;
export type TipoExamen = 'parcial' | 'global';

export interface EncabezadoExamen {
  institucion?: string;
  lema?: string;
  materia?: string;
  docente?: string;
  instrucciones?: string;
  alumno?: { nombre?: string; grupo?: string };
  mostrarInstrucciones?: boolean;
  /** La identidad se muestra por defecto cuando existe `encabezado`; puede omitirse explícitamente. */
  mostrarMarcaInstitucional?: boolean;
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
  bookletConfig?: {
    densityMode?: 'balanced' | 'compact' | 'relaxed';
    /** Ajusta el cuerpo del examen para intentar encajar en totalPaginas. */
    autoFitPages?: boolean;
    /** Permite al autoajuste ampliar la tipografía cuando aún hay capacidad. */
    autoFitTypography?: boolean;
    fontScale?: number;
    lineSpacing?: number;
    logos?: { izquierdaPath?: string; derechaPath?: string };
  };
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
  /** Valores efectivos que eligió el autoajuste, si estuvo activo. */
  fontScaleAplicada?: number;
  lineSpacingAplicado?: number;
  layoutEngine?: 'pdf-lib-canonical';
  layoutTemplateVersion?: number;
  paginas: Array<{
    numero: number;
    qrTexto: string;
    preguntasDel: number;
    preguntasAl: number;
    /** Identifica un reverso añadido para completar el par dúplex. */
    tipoPagina?: 'examen' | 'reverso-vacio';
  }>;
  metricasPaginas: Array<{
    numero: number;
    fraccionVacia: number;
    preguntas: number;
  }>;
  metricasLayout?: {
    minLineHeightApplied: number;
    fontSizePregunta: number;
    fontSizeOpcion: number;
    fontSizeIndicaciones: number;
    lineHeightPregunta: number;
    lineHeightOpcion: number;
    preguntasConFormatoRico: number;
    imagenesIntentadas: number;
    imagenesRenderizadas: number;
    imagenesFallidas: number;
    logosOmitidos: string[];
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
  /** Secuencia física para impresión dúplex por borde largo. */
  impresion?: {
    modo: 'duplex';
    volteo: 'borde-largo';
    paginasPorHoja: 2;
  };
  perfilLayout: PerfilLayoutImpresion;
  perfil: PerfilPlantillaOmr;
  paginas: PaginaOmr[];
}

export interface MarkerSpecOmr {
  /** Fiducial sólido localizado por contraste y posición esperada; no es ArUco. */
  family: 'solid_square_4pt_v1';
  sizeMm: number;
  quietZoneMm: number;
}

export interface BlockSpecOmr {
  preguntasPorBloque: number;
  opcionesPorPregunta: number;
  bubbleDiameterMm: number;
  /** Orientación física del bloque de respuestas canónico. */
  orientation?: 'vertical' | 'horizontal';
  /** Campo legado; no representa la separación de opciones en v4 vertical. */
  bubblePitchXmm: number;
  /** Paso real entre centros de burbuja apilados verticalmente. */
  bubblePitchYmm: number;
  labelToBubbleMm: number;
  bubbleStrokePt: number;
}

export interface EngineHintsOmr {
  preferredEngine: 'cv';
  enableClahe: boolean;
  adaptiveThreshold: boolean;
  conservativeDecision: boolean;
  forceSimpleScale?: boolean;
  useMapCoordinatesStrict?: boolean;
  localSearchRadiusPx?: number;
}

export interface PerfilLayoutImpresion {
  gridStepPt: number;
  headerHeightFirst: number;
  headerHeightOther: number;
  bottomSafePt: number;
  usarRellenosDecorativos: boolean;
  usarEtiquetaOmrSolida: boolean;
}

export type ModoDensidadBooklet = 'balanced' | 'compact' | 'relaxed';

export interface PerfilPlantillaOmr {
  qrSize: number;
  qrPadding: number;
  qrMarginModulos: number;
  marcasEsquina: 'lineas' | 'cuadrados';
  marcaCuadradoSize: number;
  marcaCuadradoQuietZone: number;
  burbujaRadio: number;
  burbujaPasoY: number;
  /** Paso horizontal opcional para el perfil denso de una sola fila. */
  burbujaPasoX?: number;
  /** Disposición de las burbujas; el perfil robusto usa vertical. */
  orientacion?: 'vertical' | 'horizontal';
  cajaOmrAncho: number;
  fiducialSize: number;
  fiducialMargin?: number;
  fiducialQuietZone?: number;
  bubbleStrokePt?: number;
  labelToBubbleMm?: number;
  preguntasPorBloque?: number;
  opcionesPorPregunta?: number;
}

export interface PaginaOmr {
  numeroPagina: number;
  /** Defensa para mapas históricos: un reverso vacío no contiene QR, fiduciales ni paneles OMR. */
  tipoPagina?: 'examen' | 'reverso-vacio';
  /** Página lógica dentro de la hoja física dúplex. */
  duplex?: {
    hoja: number;
    lado: 'frente' | 'reverso';
    indiceEnHoja: 1 | 2;
  };
  /** Identidad de contrato persistida también en cada página aislada. */
  templateVersion?: TemplateVersion;
  markerSpec?: MarkerSpecOmr;
  engineHints?: EngineHintsOmr;
  qr?: {
    texto: string;
    x: number;
    y: number;
    size: number;
    padding: number;
    /** Quiet zone y numero de modulos del simbolo QR. */
    marginModules?: number;
    /** Numero de modulos de la matriz QR, sin quiet zone. */
    matrixModules?: number;
  };
  marcasPagina?: {
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
    imagen?: { x: number; y: number; width: number; height: number };
    imagenDisposicion?: 'lateral' | 'inferior';
    bboxPregunta?: { x: number; y: number; width: number; height: number };
    cajaOmr?: { x: number; y: number; width: number; height: number };
    perfilOmr?: {
      radio: number;
      pasoY: number;
      pasoX?: number;
      cajaAncho: number;
      orientacion?: 'vertical' | 'horizontal';
      etiquetaBordeInferiorGap?: number;
    };
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
    engine?: 'pdf-lib-canonical';
    layoutTemplateVersion?: number;
    pageShell?: { x: number; y: number; width: number; height: number };
    header?: { x: number; y: number; width: number; height: number };
    continuationBand?: { x: number; y: number; width: number; height: number };
    continuationTextBlocks?: Array<{ x: number; y: number; width: number; height: number; id: string }>;
    qr?: { x: number; y: number; width: number; height: number };
    instructions?: { x: number; y: number; width: number; height: number };
    headerTextBlocks?: Array<{ x: number; y: number; width: number; height: number; id: string }>;
    headerFieldBoxes?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
    lineHeightViolations?: Array<{ preguntaId: string; lineHeight: number; min: number }>;
    contentStartY?: number;
    contentEndY?: number;
    headerSlots?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
    headerIconBoxes?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
    contentShell?: { x: number; y: number; width: number; height: number };
    footerShell?: { x: number; y: number; width: number; height: number };
    questionBlockBoxes?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
    questionBackgroundBoxes?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
    questionPromptBoxes?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
    omrPanelBoxes?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
    collisionBoxes?: Array<{ pagina: number; a: string; b: string }>;
  };
}

// Constantes de formato carta (puntos PostScript)
export const ANCHO_CARTA = 612;
export const ALTO_CARTA = 792;
export const MM_A_PUNTOS = 72 / 25.4;
