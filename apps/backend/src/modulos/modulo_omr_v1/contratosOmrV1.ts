/**
 * contratosOmrV1
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
export type OmrRuntimeVersion = 1;

export type OmrSheetFamilyCode =
  | 'S20_5A_BASIC'
  | 'S50_5A_ID5_VR6'
  | 'S100_5A_ID9_VR6_2P'
  | 'CUSTOM_SCHEMA_V1';

export type OmrIdentityMode = 'qr_plus_bubbled_id';
export type OmrPrefillMode = 'none' | 'roster' | 'per-student';
export type OmrVersionMode = 'single' | 'multi_version';
export type OmrCaptureMode = 'pdf_and_mobile';

export type OmrScanStatus = 'accepted' | 'needs_review' | 'rejected';
export type OmrExceptionSeverity = 'info' | 'warning' | 'blocking';

export type OmrExceptionCode =
  | 'qr_missing'
  | 'qr_mismatch'
  | 'anchors_missing'
  | 'anchors_unstable'
  | 'sheet_family_unknown'
  | 'sheet_serial_unknown'
  | 'page_clipped'
  | 'glare_detected'
  | 'low_contrast'
  | 'blur_detected'
  | 'student_id_ambiguous'
  | 'student_id_missing'
  | 'version_missing'
  | 'version_ambiguous'
  | 'mark_ambiguous'
  | 'double_mark'
  | 'unused_bubble_marked'
  | 'wrong_page_side'
  | 'manual_review_required';

export type OmrExceptionV1 = {
  code: OmrExceptionCode;
  severity: OmrExceptionSeverity;
  message: string;
  region?: string;
  candidateValues?: string[];
  recommendedAction?: string;
};

export type OmrSheetGeometryV1 = {
  pageFormat: 'letter';
  widthPt: number;
  heightPt: number;
  outerMarginPt: number;
  anchorSizePt: number;
  anchorQuietZonePt: number;
  anchorSearchWindowPt: number;
  qrSizePt: number;
  qrPaddingPt: number;
  bubbleDiameterPt: number;
  bubbleRadiusPt: number;
  bubblePitchYpt: number;
  bubblePitchXpt: number;
  minWhitespacePt: number;
  questionsPerPage: number;
  choiceCountMax: number;
  studentIdDigits: number;
  versionBubbleCount: number;
  idDigitsTop: number;
  answersTop: number;
};

export type OmrSheetFamilyDescriptor = {
  familyCode: OmrSheetFamilyCode;
  displayName: string;
  status: 'draft' | 'active' | 'retired';
  pageFormat: 'letter';
  questionCapacity: number;
  choiceCountMax: number;
  studentIdDigits: number;
  versionBubbleCount: number;
  supportsPrefill: boolean;
  supportsBlankGeneric: boolean;
  geometryDefaults: OmrSheetGeometryV1;
  printSpec: {
    duplex: boolean;
    pages: number;
  };
  scanSpec: {
    minDpi: number;
    supportsPdf: boolean;
    supportsMobile: boolean;
  };
};

export type BookletPreviewV1 = {
  pagesConfigured: number;
  pagesEstimated: number;
  questionsPerPage: number[];
  imageHeavyQuestions: Array<{ id: string; numero: number }>;
  layoutWarnings: string[];
  pdfUrl?: string;
};

export type OmrSheetPreviewV1 = {
  familyCode: OmrSheetFamilyCode;
  familyRevision: number;
  questionCapacity: number;
  questionsUsed: number;
  unusedQuestionsIgnored: number;
  studentIdDigits: number;
  versionBubbleCount: number;
  identityMode: OmrIdentityMode;
  pdfUrl?: string;
};

export type AssessmentPreviewV1 = {
  omrRuntimeVersion: OmrRuntimeVersion;
  assessmentTemplateId: string;
  questionCount: number;
  proposedGenerationSeed: string;
  previewFingerprint: string;
  recommendedSheetFamily: OmrSheetFamilyCode;
  previewState: 'ready' | 'warning' | 'blocked';
  bookletPreview: BookletPreviewV1;
  omrSheetPreview: OmrSheetPreviewV1;
  diagnostics: {
    bookletDensityScore: number;
    omrReadabilityScore: number;
    anchorFootprintRatio: number;
    qrFootprintRatio: number;
    bubbleSpacingScore: number;
    pagesWithLowDensity: number[];
    hardLayoutWarnings: string[];
  };
  blockingIssues: string[];
  warnings: string[];
};

export type GeneratedAssessmentSummaryV1 = {
  _id: string;
  folio: string;
  generationSeed: string;
  previewFingerprint: string;
  retentionStatus: 'active' | 'artifacts_purged';
  artifactsPurgedAt?: unknown;
  downloadAvailable: boolean;
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

export type OmrScoreResultV1 = {
  totalPreguntas: number;
  correctas: number;
  contestadas: number;
  invalidas: number;
  porcentaje: number;
  detalles?: Array<{
    numeroPregunta: number;
    expected: string | null;
    detected: string | null;
    correcta: boolean;
  }>;
};

export const OMR_RUNTIME_VERSION_V1: OmrRuntimeVersion = 1;
