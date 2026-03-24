/**
 * Tokens visuales canónicos del PDF.
 *
 * Mantienen la paridad visual A050929D entre renderers para que
 * preview, individual y lote compartan la misma identidad gráfica.
 */
export const PDF_VISUAL_BASELINE = {
  primaryHex: '#141f33',
  textSoftHex: '#474f5c',
  lineHex: '#2e3d54',
  accentHex: '#0d75b3',
  accentSoftHex: '#edf7ff',
  sectionHex: '#f7faff',
  whiteHex: '#ffffff',
  blackHex: '#000000'
} as const;

export const PDF_VISUAL_BASELINE_RGB = {
  primary: [0.08, 0.12, 0.2],
  textSoft: [0.28, 0.31, 0.36],
  line: [0.18, 0.24, 0.33],
  accent: [0.05, 0.46, 0.7],
  accentSoft: [0.93, 0.97, 1],
  section: [0.97, 0.98, 1]
} as const;

export function construirFirmaVisualPdf(): string {
  return [
    PDF_VISUAL_BASELINE.primaryHex,
    PDF_VISUAL_BASELINE.textSoftHex,
    PDF_VISUAL_BASELINE.lineHex,
    PDF_VISUAL_BASELINE.accentHex,
    PDF_VISUAL_BASELINE.accentSoftHex,
    PDF_VISUAL_BASELINE.sectionHex
  ].join('|');
}
