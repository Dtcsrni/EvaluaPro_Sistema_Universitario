import { ANCHO_CARTA, ALTO_CARTA } from '../shared/tiposPdf';

export const PX_POR_PUNTO = 816 / ANCHO_CARTA;
export const PUNTO_POR_PX = ANCHO_CARTA / 816;

export const LAYOUT_TEMPLATE_V9 = {
  engine: 'playwright-html-v1' as const,
  version: 9,
  pageWidthPx: 816,
  pageHeightPx: 1056,
  pageMarginPx: 32,
  gridPx: 4,
  firstHeaderHeightPx: 136,
  otherHeaderHeightPx: 28,
  footerHeightPx: 44,
  interQuestionGapPx: 0,
  contentGapPx: 16,
  omrColumnWidthPx: 96,
  questionNumberWidthPx: 30,
  questionNumberHeightPx: 26,
  questionInnerGapPx: 12,
  questionPaddingPx: 1,
  textFontPx: 14,
  optionFontPx: 12,
  stemLineHeightPx: 17,
  optionLineHeightPx: 13,
  minimumQuestionGapPx: 4,
  header: {
    leftLogoBox: { x: 16, y: 16, width: 70, height: 70 },
    titleBox: { x: 98, y: 14, width: 376, height: 72 },
    rightLogoBox: { x: 560, y: 18, width: 56, height: 56 },
    qrBox: { x: 652, y: 14, width: 96, height: 96 },
    metaBox: { x: 98, y: 86, width: 376, height: 14 },
    studentLabelWidth: 116,
    studentBox: { x: 98, y: 102, width: 520, height: 18 },
    groupBox: { x: 98, y: 122, width: 78, height: 18 }
  },
  omr: {
    panelWidthPx: 76,
    panelHeightPx: 100,
    framePaddingPx: 6,
    headerBandHeightPx: 10,
    bubbleTopOffsetPx: 2,
    panelIdWidthPx: 18,
    panelIdHeightPx: 14,
    bubbleRadiusPx: 7,
    bubbleStrokePx: 2,
    bubbleStepYPx: 15,
    bubbleColumnX: 15,
    labelColumnX: 34,
    labelsTopOffsetPx: 11,
    labelStepYPx: 15,
    fiducialSizePx: 7,
    fiducialInsetPx: 3
  }
};

export type LayoutTemplateV9 = typeof LAYOUT_TEMPLATE_V9;

export function pxAPuntos(px: number): number {
  return px * PUNTO_POR_PX;
}

export function puntosAPx(pt: number): number {
  return pt * PX_POR_PUNTO;
}

export function roundGrid(value: number, step = LAYOUT_TEMPLATE_V9.gridPx): number {
  return Math.round(value / step) * step;
}

export function pageHeightPt(): number {
  return ALTO_CARTA;
}
