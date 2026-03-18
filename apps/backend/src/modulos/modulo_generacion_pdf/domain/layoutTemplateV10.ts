import { ANCHO_CARTA } from '../shared/tiposPdf';

export const LAYOUT_TEMPLATE_V10 = {
  engine: 'playwright-html-v1' as const,
  version: 10,
  pageWidthPx: 816,
  pageHeightPx: 1056,
  pageMarginPx: 28,
  gridPx: 4,
  firstHeaderHeightPx: 144,
  otherHeaderHeightPx: 26,
  footerHeightPx: 42,
  interQuestionGapPx: 6,
  contentGapPx: 22,
  omrColumnWidthPx: 112,
  questionNumberWidthPx: 32,
  questionNumberHeightPx: 28,
  questionInnerGapPx: 14,
  questionPaddingPx: 2,
  textFontPx: 15,
  optionFontPx: 13,
  stemLineHeightPx: 19,
  optionLineHeightPx: 15,
  minimumQuestionGapPx: 6,
  header: {
    leftLogoBox: { x: 18, y: 18, width: 72, height: 72 },
    titleBox: { x: 104, y: 12, width: 394, height: 78 },
    rightLogoBox: { x: 566, y: 18, width: 60, height: 60 },
    qrBox: { x: 646, y: 12, width: 104, height: 104 },
    metaBox: { x: 104, y: 88, width: 394, height: 16 },
    studentLabelWidth: 122,
    studentBox: { x: 104, y: 108, width: 534, height: 18 },
    groupBox: { x: 104, y: 128, width: 82, height: 18 }
  },
  omr: {
    panelWidthPx: 88,
    panelHeightPx: 100,
    framePaddingPx: 8,
    headerBandHeightPx: 12,
    bubbleTopOffsetPx: 4,
    panelIdWidthPx: 20,
    panelIdHeightPx: 14,
    bubbleRadiusPx: 8,
    bubbleStrokePx: 2,
    bubbleStepYPx: 15,
    bubbleColumnX: 17,
    labelColumnX: 40,
    labelsTopOffsetPx: 14,
    labelStepYPx: 15,
    fiducialSizePx: 8,
    fiducialInsetPx: 4,
    centerFiducialOffsetPx: 46
  }
};

export type LayoutTemplateV10 = typeof LAYOUT_TEMPLATE_V10;

export const PX_POR_PUNTO_V10 = 816 / ANCHO_CARTA;
export const PUNTO_POR_PX_V10 = ANCHO_CARTA / 816;

export function pxAPuntosV10(px: number): number {
  return px * PUNTO_POR_PX_V10;
}

export function roundGridV10(value: number, step = LAYOUT_TEMPLATE_V10.gridPx): number {
  return Math.round(value / step) * step;
}
