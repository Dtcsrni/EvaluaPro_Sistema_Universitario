/**
 * familiasOmrV1
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import type { OmrSheetFamilyCode, OmrSheetFamilyDescriptor } from './contratosOmrV1';

const MM_A_PT = 72 / 25.4;

function mm(mm: number) {
  return Number((mm * MM_A_PT).toFixed(2));
}

const baseGeometry = {
  pageFormat: 'letter' as const,
  widthPt: 612,
  heightPt: 792,
  outerMarginPt: mm(9.5),
  anchorSizePt: mm(7),
  anchorQuietZonePt: mm(3.2),
  anchorSearchWindowPt: mm(32),
  qrSizePt: mm(20),
  qrPaddingPt: mm(3),
  bubbleDiameterPt: mm(5),
  bubbleRadiusPt: mm(2.5),
  bubblePitchYpt: mm(8),
  bubblePitchXpt: mm(8.5),
  minWhitespacePt: mm(9.5),
  choiceCountMax: 5,
  answersTop: mm(60)
};

export const FAMILIAS_OMR_V1: Record<OmrSheetFamilyCode, OmrSheetFamilyDescriptor> = {
  S20_5A_BASIC: {
    familyCode: 'S20_5A_BASIC',
    displayName: 'Hoja OMR 20 reactivos',
    status: 'active',
    pageFormat: 'letter',
    questionCapacity: 20,
    choiceCountMax: 5,
    studentIdDigits: 0,
    versionBubbleCount: 1,
    supportsPrefill: false,
    supportsBlankGeneric: true,
    geometryDefaults: {
      ...baseGeometry,
      questionsPerPage: 20,
      studentIdDigits: 0,
      versionBubbleCount: 1,
      idDigitsTop: mm(0)
    },
    printSpec: { duplex: false, pages: 1 },
    scanSpec: { minDpi: 180, supportsPdf: true, supportsMobile: true }
  },
  S50_5A_ID5_VR6: {
    familyCode: 'S50_5A_ID5_VR6',
    displayName: 'Hoja OMR 50 reactivos + ID 5 + 6 versiones',
    status: 'active',
    pageFormat: 'letter',
    questionCapacity: 50,
    choiceCountMax: 5,
    studentIdDigits: 5,
    versionBubbleCount: 6,
    supportsPrefill: true,
    supportsBlankGeneric: true,
    geometryDefaults: {
      ...baseGeometry,
      questionsPerPage: 25,
      studentIdDigits: 5,
      versionBubbleCount: 6,
      idDigitsTop: mm(28)
    },
    printSpec: { duplex: false, pages: 2 },
    scanSpec: { minDpi: 180, supportsPdf: true, supportsMobile: true }
  },
  S100_5A_ID9_VR6_2P: {
    familyCode: 'S100_5A_ID9_VR6_2P',
    displayName: 'Hoja OMR 100 reactivos + ID 9 + 6 versiones',
    status: 'active',
    pageFormat: 'letter',
    questionCapacity: 100,
    choiceCountMax: 5,
    studentIdDigits: 9,
    versionBubbleCount: 6,
    supportsPrefill: true,
    supportsBlankGeneric: false,
    geometryDefaults: {
      ...baseGeometry,
      questionsPerPage: 50,
      studentIdDigits: 9,
      versionBubbleCount: 6,
      idDigitsTop: mm(28)
    },
    printSpec: { duplex: false, pages: 2 },
    scanSpec: { minDpi: 200, supportsPdf: true, supportsMobile: true }
  },
  CUSTOM_SCHEMA_V1: {
    familyCode: 'CUSTOM_SCHEMA_V1',
    displayName: 'Hoja OMR personalizada V1',
    status: 'draft',
    pageFormat: 'letter',
    questionCapacity: 60,
    choiceCountMax: 5,
    studentIdDigits: 5,
    versionBubbleCount: 4,
    supportsPrefill: true,
    supportsBlankGeneric: true,
    geometryDefaults: {
      ...baseGeometry,
      questionsPerPage: 30,
      studentIdDigits: 5,
      versionBubbleCount: 4,
      idDigitsTop: mm(28)
    },
    printSpec: { duplex: false, pages: 2 },
    scanSpec: { minDpi: 180, supportsPdf: true, supportsMobile: true }
  }
};

export function listarFamiliasOmrV1() {
  return Object.values(FAMILIAS_OMR_V1);
}

export function resolverFamiliaOmrV1(familyCode?: string | null) {
  const key = String(familyCode ?? '').trim().toUpperCase() as OmrSheetFamilyCode;
  return FAMILIAS_OMR_V1[key] ?? FAMILIAS_OMR_V1.S50_5A_ID5_VR6;
}

export function recomendarFamiliaOmrV1(questionCount: number) {
  if (questionCount <= 20) return FAMILIAS_OMR_V1.S20_5A_BASIC;
  if (questionCount <= 50) return FAMILIAS_OMR_V1.S50_5A_ID5_VR6;
  if (questionCount <= 100) return FAMILIAS_OMR_V1.S100_5A_ID9_VR6_2P;
  return FAMILIAS_OMR_V1.CUSTOM_SCHEMA_V1;
}
