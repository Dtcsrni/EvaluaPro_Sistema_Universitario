/**
 * tipos
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
export type Docente = {
  id: string;
  nombreCompleto: string;
  nombres?: string;
  apellidos?: string;
  correo: string;
  roles?: string[];
  permisos?: string[];
  tieneContrasena?: boolean;
  tieneGoogle?: boolean;
  capacidadesIntegraciones?: {
    oauthGoogleBackend?: boolean;
    classroomBackend?: boolean;
    smtpBackend?: boolean;
  };
  preferenciasPdf?: {
    institucion?: string;
    lema?: string;
    logos?: { izquierdaPath?: string; derechaPath?: string };
  };
};

export type Alumno = {
  _id: string;
  matricula: string;
  nombreCompleto: string;
  periodoId?: string;
  nombres?: string;
  apellidos?: string;
  correo?: string;
  grupo?: string;
  activo?: boolean;
  createdAt?: string;
};

export type Periodo = {
  _id: string;
  nombre: string;
  fechaInicio?: string;
  fechaFin?: string;
  grupos?: string[];
  activo?: boolean;
  createdAt?: string;
  archivadoEn?: string;
  resumenArchivado?: {
    alumnos?: number;
    bancoPreguntas?: number;
    plantillas?: number;
    examenesGenerados?: number;
    calificaciones?: number;
    codigosAcceso?: number;
  };
};

export type Plantilla = {
  _id: string;
  titulo: string;
  tipo: 'parcial' | 'global';
  numeroPaginas: number;
  reactivosObjetivo?: number;
  defaultVersionCount?: number;
  answerKeyMode?: 'digital' | 'scan_sheet';
  bookletConfig?: {
    targetPages?: number;
    densityMode?: 'balanced' | 'compact' | 'relaxed';
    allowImages?: boolean;
    imageBudgetPolicy?: 'strict' | 'balanced';
    headerStyle?: 'institutional' | 'compact';
    fontScale?: number;
    lineSpacing?: number;
    separateCoverPage?: boolean;
  };
  omrConfig?: {
    sheetFamilyCode?: string;
    sheetRevisionId?: string;
    prefillMode?: 'none' | 'roster' | 'per-student';
    identityMode?: 'qr_plus_bubbled_id';
    allowBlankGenericSheets?: boolean;
    versionMode?: 'single' | 'multi_version';
    ignoreUnusedTrailingQuestions?: boolean;
    captureMode?: 'pdf_and_mobile';
  };
  // Legacy (deprecado): puede existir en plantillas antiguas.
  totalReactivos?: number;
  periodoId?: string;
  preguntasIds?: string[];
  temas?: string[];
  instrucciones?: string;
  createdAt?: string;
};

export type PreviewPlantilla = {
  // Clasico (previsualizar plantilla tradicional)
  plantillaId?: string;
  numeroPaginas?: number;
  totalDisponibles?: number;
  totalUsados?: number;
  fraccionVaciaUltimaPagina?: number;
  advertencias?: string[];
  conteoPorTema?: Array<{ tema: string; disponibles: number }>;
  temasDisponiblesEnMateria?: Array<{ tema: string; disponibles: number }>;
  paginas?: Array<{
    numero: number;
    preguntasDel: number;
    preguntasAl: number;
    elementos: string[];
    preguntas: Array<{ numero: number; id: string; tieneImagen: boolean; enunciadoCorto: string }>;
  }>;

  // OMR V1 (previsualizacion de assessment)
  omrRuntimeVersion?: 1;
  assessmentTemplateId?: string;
  questionCount?: number;
  proposedGenerationSeed?: string;
  previewFingerprint?: string;
  recommendedSheetFamily?: string;
  previewState?: 'ready' | 'warning' | 'blocked';
  bookletPreview?: {
    pagesConfigured: number;
    pagesEstimated: number;
    questionsPerPage: number[];
    imageHeavyQuestions: Array<{ id: string; numero: number }>;
    layoutWarnings: string[];
    pdfUrl?: string;
  };
  omrSheetPreview?: {
    familyCode: string;
    familyRevision: number;
    questionCapacity: number;
    questionsUsed: number;
    unusedQuestionsIgnored: number;
    studentIdDigits: number;
    versionBubbleCount: number;
    identityMode: 'qr_plus_bubbled_id';
    pdfUrl?: string;
  };
  diagnostics?: {
    bookletDensityScore: number;
    omrReadabilityScore: number;
    anchorFootprintRatio: number;
    qrFootprintRatio: number;
    bubbleSpacingScore: number;
    pagesWithLowDensity: number[];
    hardLayoutWarnings: string[];
  };
  blockingIssues?: string[];
  warnings?: string[];
};

export type GeneratedAssessmentDetalle = {
  assessment: {
    _id: string;
    folio: string;
    generationSeed: string;
    previewFingerprint: string;
    bookletPdfUrl?: string;
    omrSheetPdfUrl?: string;
    studentPacketZipUrl?: string;
    answerKeyUrl?: string;
    manifestUrl?: string;
    versionSet: Array<{ versionCode: string; questionCount: number }>;
    statisticsSummary: {
      sheetCount: number;
      studentPacketCount: number;
      versionCount: number;
    };
  };
  sheetInstances: Array<{
    sheetSerial: string;
    pageIndex: number;
    versionCode?: string;
    studentBinding?: {
      alumnoId?: string | null;
      studentId?: string | null;
      studentName?: string | null;
    };
  }>;
  statisticsSummary?: {
    sheetCount?: number;
    studentPacketCount?: number;
    versionCount?: number;
    warnings?: string[];
  };
  versionSet?: Array<{ versionCode: string; questionCount: number }>;
  studentPacketArtifacts?: Array<{
    alumnoId?: string | null;
    studentId?: string | null;
    studentName?: string | null;
    sheetSerial: string;
    versionCode: string;
    path?: string;
    fileName?: string;
  }>;
};

export type OmrJobDetalle = {
  jobId: string;
  sourceType: 'pdf' | 'image_batch' | 'camera_capture';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'finalized';
  pagesTotal: number;
  pagesProcessed: number;
  summary?: {
    accepted?: number;
    needsReview?: number;
    rejected?: number;
    autoGradable?: number;
    sheets?: number;
    averageScore?: number;
    finalizedAt?: string;
    results?: Array<{
      sheetSerial: string;
      studentId?: string | null;
      versionCode?: string | null;
      confidence?: number;
      autoGradable?: boolean;
      scoreResult?: {
        totalPreguntas: number;
        correctas: number;
        contestadas: number;
        invalidas: number;
        porcentaje: number;
      };
    }>;
  };
  pages: Array<{
    sheetSerial: string;
    pageIndex: number;
    scanStatus: 'accepted' | 'needs_review' | 'rejected';
    confidence: number;
    autoGradable?: boolean;
    manualReviewRequired?: boolean;
    scoreResult?: {
      totalPreguntas: number;
      correctas: number;
      contestadas: number;
      invalidas: number;
      porcentaje: number;
    };
    identityResult?: {
      studentId?: string | null;
      studentName?: string | null;
    };
    versionResult?: {
      versionCode?: string | null;
    };
    responses: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
    exceptions: Array<{
      code: string;
      severity: 'info' | 'warning' | 'blocking';
      message: string;
      recommendedAction?: string;
    }>;
  }>;
  reviewResolutions?: Array<{
    sheetSerial: string;
    resolvedAt: string;
    resolutionReason?: string;
  }>;
};

export type Pregunta = {
  _id: string;
  periodoId?: string;
  tema?: string;
  activo?: boolean;
  versionActual?: number;
  versiones: Array<{
    numeroVersion?: number;
    enunciado: string;
    imagenUrl?: string;
    opciones?: Array<{ texto: string; esCorrecta: boolean }>;
  }>;
  createdAt?: string;
};

export type RegistroSincronizacion = {
  _id?: string;
  estado?: 'pendiente' | 'exitoso' | 'fallido' | string;
  tipo?: string;
  detalles?: Record<string, unknown>;
  ejecutadoEn?: string;
  createdAt?: string;
};

export type RespuestaSyncPush = {
  mensaje?: string;
  conteos?: Record<string, number>;
  cursor?: string | null;
  exportadoEn?: string;
};

export type RespuestaSyncPull = {
  mensaje?: string;
  paquetesRecibidos?: number;
  ultimoCursor?: string | null;
  pdfsGuardados?: number;
};

export type ResultadoOmr = {
  respuestasDetectadas: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>;
  advertencias: string[];
  qrTexto?: string;
  calidadPagina: number;
  estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
  motivosRevision: string[];
  templateVersionDetectada: 1 | 3;
  confianzaPromedioPagina: number;
  ratioAmbiguas: number;
};

export type PermisosUI = {
  periodos: { leer: boolean; gestionar: boolean; archivar: boolean };
  alumnos: { leer: boolean; gestionar: boolean };
  banco: { leer: boolean; gestionar: boolean; archivar: boolean };
  plantillas: { leer: boolean; gestionar: boolean; archivar: boolean; previsualizar: boolean };
  examenes: { leer: boolean; generar: boolean; archivar: boolean; regenerar: boolean; descargar: boolean };
  entregas: { gestionar: boolean };
  omr: { analizar: boolean };
  calificaciones: { calificar: boolean };
  rehidratacion: { usar: boolean };
  evaluaciones: { leer: boolean; gestionar: boolean };
  classroom: { conectar: boolean; pull: boolean };
  publicar: { publicar: boolean };
  sincronizacion: { listar: boolean; exportar: boolean; importar: boolean; push: boolean; pull: boolean };
  cuenta: { leer: boolean; actualizar: boolean };
};

export type EnviarConPermiso = <T = unknown>(
  permiso: string,
  ruta: string,
  payload: unknown,
  mensaje: string,
  opciones?: { timeoutMs?: number }
) => Promise<T>;

export type PreviewCalificacion = {
  aciertos: number;
  totalReactivos: number;
  calificacionExamenFinalTexto?: string;
  calificacionExamenTexto?: string;
  calificacionParcialTexto?: string;
  calificacionGlobalTexto?: string;
};

export type ResultadoAnalisisOmr = {
  resultado: ResultadoOmr;
  examenId: string;
  folio: string;
  numeroPagina: number;
  alumnoId?: string | null;
  templateVersionDetectada?: 1 | 3;
};

export type RevisionPaginaOmr = {
  numeroPagina: number;
  resultado: ResultadoOmr;
  respuestas: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>;
  imagenBase64?: string;
  nombreArchivo?: string;
  actualizadoEn: number;
};

export type RevisionExamenOmr = {
  examenId: string;
  folio: string;
  alumnoId?: string | null;
  paginas: RevisionPaginaOmr[];
  claveCorrectaPorNumero: Record<number, string>;
  ordenPreguntas: number[];
  revisionConfirmada: boolean;
  actualizadoEn: number;
  creadoEn: number;
};

export type ExamenGeneradoClave = {
  _id?: string;
  periodoId?: string;
  mapaVariante?: {
    ordenPreguntas?: string[];
    ordenOpcionesPorPregunta?: Record<string, number[]>;
  };
  preguntasIds?: string[];
};

export type SolicitudRevisionAlumno = {
  _id?: string;
  externoId: string;
  folio: string;
  numeroPregunta: number;
  comentario?: string;
  estado: 'pendiente' | 'atendida' | 'rechazada' | 'cerrada';
  solicitadoEn?: string;
  atendidoEn?: string | null;
  respuestaDocente?: string;
  firmaDocente?: string;
  firmadoEn?: string | null;
  cerradoEn?: string | null;
  alumnoNombreCompleto?: string;
  conformidadAlumno?: boolean;
  conformidadActualizadaEn?: string | null;
};

