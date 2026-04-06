import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export type OpcionOmr = 'A' | 'B' | 'C' | 'D' | 'E';
export type MarkTypePorFolio = 'valid' | 'blank' | 'double' | 'smudge';

export type OrganizacionPorAlumnoItem = {
  archivoOriginal: string;
  qrTexto?: string;
  folioId: string;
  pagina: number;
  metodo: string;
  destino: string;
};

export type OrganizacionPorAlumnoSnapshot = {
  total: number;
  items: OrganizacionPorAlumnoItem[];
};

export type CaptureSourcePorFolio = {
  captureId: string;
  folio: string;
  numeroPagina: number;
  captureOrdinal: number;
  sourcePath: string;
  absoluteImagePath: string;
  sourceGroup: string;
  templateVersion: 4;
  expectedQr: string;
};

export type QuestionRangePorFolio = {
  from: number;
  to: number;
};

export type CaptureManifestPorFolio = {
  captureId: string;
  folio: string;
  numeroPagina: number;
  captureOrdinal: number;
  imagePath: string;
  mapaOmrPath: string;
  questionRange: QuestionRangePorFolio;
  sourcePath: string;
  sourceGroup: string;
  templateVersion: 4;
  expectedQr: string;
};

export type GroundTruthRowPorFolio = {
  captureId: string;
  folio: string;
  numeroPagina: number;
  numeroPregunta: number;
  opcionEsperada: OpcionOmr | null;
  markType: MarkTypePorFolio;
  selectedOptions: OpcionOmr[];
  sourceEvidence: {
    detector: 'panel_darkness_v1';
    panelIndex: number;
    panelBounds: { x: number; y: number; width: number; height: number };
    rawScores: Record<OpcionOmr, number>;
    dominantGap: number;
  };
};

export type MapaOmrPaginaPorFolio = {
  numeroPagina: number;
  templateVersion: 4;
  engineHints?: {
    preferredEngine?: 'cv';
    conservativeDecision?: boolean;
    forceSimpleScale?: boolean;
    useMapCoordinatesStrict?: boolean;
    localSearchRadiusPx?: number;
  };
  qr: {
    texto: string;
    x: number;
    y: number;
    size: number;
    padding: number;
  };
  marcasPagina: {
    tipo: 'cuadrados';
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
    opciones: Array<{ letra: OpcionOmr; x: number; y: number }>;
    cajaOmr: { x: number; y: number; width: number; height: number };
    perfilOmr: { radio: number; pasoY: number; cajaAncho: number };
    fiduciales: {
      leftTop: { x: number; y: number };
      leftBottom: { x: number; y: number };
      rightTop: { x: number; y: number };
      rightBottom: { x: number; y: number };
    };
  }>;
};

export type DetectionProfilePorFolio = {
  rightStripStartRatio: number;
  topCutRatio: number;
  bottomCutRatio: number;
  panelMinWidthRatio: number;
  panelMaxWidthRatio: number;
  panelMinHeightRatio: number;
  panelMaxHeightRatio: number;
  panelFooterCutRatio: number;
  bubbleYFractions: number[];
  bubbleXSearchStartRatio: number;
  bubbleXSearchEndRatio: number;
  bubbleYSearchRatio: number;
  panelDarkPercentile: number;
  panelDarkLift: number;
  markScoreMin: number;
  markGapMin: number;
  doubleRatioMin: number;
};

type ConnectedBox = {
  count: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type BubbleMarkScore = {
  option: OpcionOmr;
  score: number;
  coreMean: number;
  ringMean: number;
  outerMean: number;
  fillRatio: number;
};

export type PanelDarknessDetection = {
  panelIndex: number;
  questionNumber: number;
  panelBounds: { x: number; y: number; width: number; height: number };
  optionCentersImage: Array<{ letra: OpcionOmr; x: number; y: number }>;
  markType: MarkTypePorFolio;
  option: OpcionOmr | null;
  selectedOptions: OpcionOmr[];
  dominantGap: number;
  rawScores: Record<OpcionOmr, number>;
};

type DerivedPanel = {
  panelIndex: number;
  bounds: ConnectedBox;
  optionCentersImage: Array<{ letra: OpcionOmr; x: number; y: number }>;
  optionCentersCanonical: Array<{ letra: OpcionOmr; x: number; y: number }>;
  questionNumber: number;
  truth: {
    option: OpcionOmr | null;
    markType: MarkTypePorFolio;
    selectedOptions: OpcionOmr[];
    scores: BubbleMarkScore[];
  };
};

type GrayImage = {
  width: number;
  height: number;
  gray: Uint8ClampedArray;
};

const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;
const TV4_QR = { x: 513, y: 34.5, size: 72, padding: 6 };
const TV4_MARKERS = {
  size: 10.5,
  quietZone: 2.25,
  tl: { x: 28.5, y: 28.5 },
  tr: { x: 573, y: 28.5 },
  bl: { x: 28.5, y: 753 },
  br: { x: 573, y: 753 }
};

export const DEFAULT_POR_FOLIO_PROFILE: DetectionProfilePorFolio = {
  rightStripStartRatio: 0.78,
  topCutRatio: 0.06,
  bottomCutRatio: 0.94,
  panelMinWidthRatio: 0.06,
  panelMaxWidthRatio: 0.15,
  panelMinHeightRatio: 0.05,
  panelMaxHeightRatio: 0.12,
  panelFooterCutRatio: 0.8,
  bubbleYFractions: [0.211, 0.356, 0.5, 0.644, 0.789],
  bubbleXSearchStartRatio: 0.18,
  bubbleXSearchEndRatio: 0.42,
  bubbleYSearchRatio: 0.045,
  panelDarkPercentile: 0.18,
  panelDarkLift: 18,
  markScoreMin: 0.19,
  markGapMin: 0.08,
  doubleRatioMin: 0.9
};

function round6(value: number) {
  return Number(value.toFixed(6));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function sanitizeCaptureLabel(value: string) {
  return String(value).replace(/[^A-Za-z0-9_-]+/g, '_');
}

function normalizarQrCanonicoTv4(valor: string | undefined, folio: string, pageNumber: number) {
  const limpio = String(valor ?? '').trim();
  if (!limpio) return `EXAMEN:${folio}:P${pageNumber}:TV4`;
  if (/:TV3\b/i.test(limpio)) return limpio.replace(/:TV3\b/i, ':TV4');
  return limpio;
}

function overlapRatio(a: ConnectedBox, b: ConnectedBox) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= left || bottom <= top) return 0;
  const intersection = (right - left) * (bottom - top);
  const minArea = Math.min(a.width * a.height, b.width * b.height);
  return minArea > 0 ? intersection / minArea : 0;
}

function percentile(values: Uint8Array, q: number) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < values.length; i += 1) hist[values[i]!] += 1;
  const target = Math.max(1, Math.floor(values.length * clamp(q, 0, 1)));
  let acc = 0;
  for (let idx = 0; idx < hist.length; idx += 1) {
    acc += hist[idx]!;
    if (acc >= target) return idx;
  }
  return 255;
}

async function readJsonFile<T>(filePath: string) {
  const raw = await fs.readFile(filePath, 'utf8');
  const sanitized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(sanitized) as T;
}

function resolveFromRepoRoot(repoRoot: string, targetPath: string) {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(repoRoot, targetPath);
}

async function loadGrayImage(filePath: string): Promise<GrayImage> {
  const { data, info } = await sharp(filePath).rotate().greyscale().raw().toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    gray: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)
  };
}

async function loadGrayImageFromBuffer(imageBuffer: Buffer): Promise<GrayImage> {
  const { data, info } = await sharp(imageBuffer).rotate().greyscale().raw().toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    gray: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)
  };
}

function meanDisk(gray: Uint8ClampedArray, width: number, height: number, cx: number, cy: number, radius: number) {
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius));
  let sum = 0;
  let count = 0;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r2) continue;
      sum += gray[y * width + x] ?? 255;
      count += 1;
    }
  }
  return count > 0 ? sum / count : 255;
}

function meanAnnulus(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number
) {
  const outer2 = outerRadius * outerRadius;
  const inner2 = innerRadius * innerRadius;
  const minX = Math.max(0, Math.floor(cx - outerRadius));
  const maxX = Math.min(width - 1, Math.ceil(cx + outerRadius));
  const minY = Math.max(0, Math.floor(cy - outerRadius));
  const maxY = Math.min(height - 1, Math.ceil(cy + outerRadius));
  let sum = 0;
  let count = 0;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > outer2 || d2 < inner2) continue;
      sum += gray[y * width + x] ?? 255;
      count += 1;
    }
  }
  return count > 0 ? sum / count : 255;
}

function connectedComponents(binary: Uint8Array, width: number, height: number, offsetX: number, offsetY: number) {
  const seen = new Uint8Array(binary.length);
  const boxes: ConnectedBox[] = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ] as const;

  for (let idx = 0; idx < binary.length; idx += 1) {
    if (!binary[idx] || seen[idx]) continue;
    const stack = [idx];
    seen[idx] = 1;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = -1;
    let maxY = -1;
    let count = 0;

    while (stack.length > 0) {
      const current = stack.pop()!;
      const y = Math.floor(current / width);
      const x = current - y * width;
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (!binary[next] || seen[next]) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }

    boxes.push({
      count,
      x: minX + offsetX,
      y: minY + offsetY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    });
  }

  return boxes;
}

function imageToCanonical(width: number, height: number, point: { x: number; y: number }) {
  return {
    x: round6((point.x / width) * LETTER_WIDTH),
    y: round6(((height - point.y) / height) * LETTER_HEIGHT)
  };
}

function detectOmrPanels(grayImage: GrayImage, profile = DEFAULT_POR_FOLIO_PROFILE) {
  const { width, height, gray } = grayImage;
  const regionX = Math.floor(width * profile.rightStripStartRatio);
  const regionY = Math.floor(height * profile.topCutRatio);
  const regionBottom = Math.floor(height * profile.bottomCutRatio);
  const regionWidth = width - regionX;
  const regionHeight = regionBottom - regionY;
  const strip = new Uint8Array(regionWidth * regionHeight);
  for (let y = regionY; y < regionBottom; y += 1) {
    for (let x = regionX; x < width; x += 1) {
      strip[(y - regionY) * regionWidth + (x - regionX)] = gray[y * width + x] ?? 255;
    }
  }

  const darkThreshold = Math.min(150, percentile(strip, profile.panelDarkPercentile) + profile.panelDarkLift);
  const binary = new Uint8Array(strip.length);
  for (let idx = 0; idx < strip.length; idx += 1) binary[idx] = strip[idx]! < darkThreshold ? 1 : 0;

  const minWidth = width * profile.panelMinWidthRatio;
  const maxWidth = width * profile.panelMaxWidthRatio;
  const minHeight = height * profile.panelMinHeightRatio;
  const maxHeight = height * profile.panelMaxHeightRatio;
  const footerCut = height * profile.panelFooterCutRatio;

  const rawBoxes = connectedComponents(binary, regionWidth, regionHeight, regionX, regionY)
    .filter((box) => box.x >= regionX)
    .filter((box) => box.width >= minWidth && box.width <= maxWidth)
    .filter((box) => box.height >= minHeight && box.height <= maxHeight)
    .filter((box) => box.y + box.height <= footerCut)
    .filter((box) => box.count >= Math.max(900, Math.floor(box.width * box.height * 0.08)))
    .sort((a, b) => b.count - a.count);

  const selected: ConnectedBox[] = [];
  for (const box of rawBoxes) {
    if (selected.some((current) => overlapRatio(current, box) > 0.45)) continue;
    selected.push(box);
  }

  return selected.sort((a, b) => a.y - b.y);
}

function ringSignatureScore(grayImage: GrayImage, cx: number, cy: number, radius: number) {
  const ringMean = meanAnnulus(grayImage.gray, grayImage.width, grayImage.height, cx, cy, radius * 0.72, radius * 1.16);
  const outerMean = meanAnnulus(grayImage.gray, grayImage.width, grayImage.height, cx, cy, radius * 1.24, radius * 1.8);
  return Math.max(0, (outerMean - ringMean) / 255);
}

function detectBubbleCenters(grayImage: GrayImage, panel: ConnectedBox, profile = DEFAULT_POR_FOLIO_PROFILE) {
  const radius = Math.max(10, Math.min(panel.width, panel.height) * 0.06);
  const xStart = Math.round(panel.x + panel.width * profile.bubbleXSearchStartRatio);
  const xEnd = Math.round(panel.x + panel.width * profile.bubbleXSearchEndRatio);
  let bestX = xStart;
  let bestXScore = -Infinity;

  for (let x = xStart; x <= xEnd; x += 2) {
    let score = 0;
    for (const fraction of profile.bubbleYFractions) {
      const y = Math.round(panel.y + panel.height * fraction);
      score += ringSignatureScore(grayImage, x, y, radius);
    }
    if (score > bestXScore) {
      bestXScore = score;
      bestX = x;
    }
  }

  return profile.bubbleYFractions.map((fraction, index) => {
    const yBase = Math.round(panel.y + panel.height * fraction);
    const yMin = Math.round(panel.y + panel.height * (fraction - profile.bubbleYSearchRatio));
    const yMax = Math.round(panel.y + panel.height * (fraction + profile.bubbleYSearchRatio));
    let bestY = yBase;
    let bestScore = -Infinity;
    for (let y = yMin; y <= yMax; y += 2) {
      const score = ringSignatureScore(grayImage, bestX, y, radius);
      if (score > bestScore) {
        bestScore = score;
        bestY = y;
      }
    }
    return {
      letra: String.fromCharCode(65 + index) as OpcionOmr,
      x: bestX,
      y: bestY
    };
  });
}

function scoreBubbleMark(grayImage: GrayImage, center: { letra: OpcionOmr; x: number; y: number }, panel: ConnectedBox): BubbleMarkScore {
  const radius = Math.max(9, Math.min(panel.width, panel.height) * 0.055);
  const coreMean = meanDisk(grayImage.gray, grayImage.width, grayImage.height, center.x, center.y, radius * 0.62);
  const ringMean = meanAnnulus(
    grayImage.gray,
    grayImage.width,
    grayImage.height,
    center.x,
    center.y,
    radius * 0.74,
    radius * 1.15
  );
  const outerMean = meanAnnulus(
    grayImage.gray,
    grayImage.width,
    grayImage.height,
    center.x,
    center.y,
    radius * 1.26,
    radius * 1.9
  );
  const fillThreshold = Math.min(185, Math.max(60, outerMean - 18));
  const fillRatio = clamp01((fillThreshold - coreMean + 24) / 96);
  const fillDelta = clamp01((ringMean - coreMean) / 90);
  const centerContrast = clamp01((outerMean - coreMean) / 120);
  const ringPenalty = clamp01((outerMean - ringMean) / 110);
  const score = clamp01(fillDelta * 0.62 + fillRatio * 0.28 + centerContrast * 0.18 - ringPenalty * 0.16);

  return {
    option: center.letra,
    score: round6(score),
    coreMean: round6(coreMean),
    ringMean: round6(ringMean),
    outerMean: round6(outerMean),
    fillRatio: round6(fillRatio)
  };
}

function resolvePanelTruth(scores: BubbleMarkScore[], profile = DEFAULT_POR_FOLIO_PROFILE) {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const first = sorted[0];
  const second = sorted[1];
  const dominantGap = round6((first?.score ?? 0) - (second?.score ?? 0));
  const dominantRatio = (second?.score ?? 0) / Math.max(0.0001, first?.score ?? 0.0001);
  const selectedOptions = first ? [first.option] : [];
  let markType: MarkTypePorFolio = 'blank';
  let option: OpcionOmr | null = null;

  if ((first?.score ?? 0) < profile.markScoreMin) {
    markType = 'blank';
  } else if (
    dominantGap < profile.markGapMin ||
    dominantRatio >= profile.doubleRatioMin ||
    ((second?.score ?? 0) >= profile.markScoreMin * 0.95 && dominantRatio >= 0.82)
  ) {
    markType = 'double';
    option = null;
    return {
      option,
      markType,
      selectedOptions: [first?.option, second?.option].filter(Boolean) as OpcionOmr[],
      dominantGap
    };
  } else {
    markType = 'valid';
    option = first?.option ?? null;
  }

  return {
    option,
    markType,
    selectedOptions,
    dominantGap
  };
}

function analyzePanelsFromGrayImage(
  grayImage: GrayImage,
  questionNumbers: number[],
  profile = DEFAULT_POR_FOLIO_PROFILE
): PanelDarknessDetection[] {
  const panels = detectOmrPanels(grayImage, profile);
  return panels.slice(0, questionNumbers.length).map((panel, index) => {
    const centersImage = detectBubbleCenters(grayImage, panel, profile);
    const scores = centersImage.map((center) => scoreBubbleMark(grayImage, center, panel));
    const truth = resolvePanelTruth(scores, profile);
    return {
      panelIndex: index,
      questionNumber: questionNumbers[index] ?? buildCanonicalQuestionNumber(0, index),
      panelBounds: {
        x: panel.x,
        y: panel.y,
        width: panel.width,
        height: panel.height
      },
      optionCentersImage: centersImage,
      markType: truth.markType,
      option: truth.option,
      selectedOptions: truth.selectedOptions,
      dominantGap: truth.dominantGap,
      rawScores: Object.fromEntries(scores.map((score) => [score.option, score.score])) as Record<OpcionOmr, number>
    };
  });
}

export async function analyzeOmrPanelsFromImageBuffer(
  imageBuffer: Buffer,
  questionNumbers: number[],
  profile = DEFAULT_POR_FOLIO_PROFILE
): Promise<PanelDarknessDetection[]> {
  const grayImage = await loadGrayImageFromBuffer(imageBuffer);
  return analyzePanelsFromGrayImage(grayImage, questionNumbers, profile);
}

function buildCanonicalQuestionNumber(pageNumber: number, panelIndex: number) {
  return pageNumber * 100 + panelIndex + 1;
}

function buildMapQuestion(panel: ConnectedBox, centersImage: Array<{ letra: OpcionOmr; x: number; y: number }>, grayImage: GrayImage) {
  const centersCanonical = centersImage.map((item) => ({
    letra: item.letra,
    ...imageToCanonical(grayImage.width, grayImage.height, item)
  }));
  const topLeft = imageToCanonical(grayImage.width, grayImage.height, { x: panel.x, y: panel.y });
  const bottomRight = imageToCanonical(grayImage.width, grayImage.height, {
    x: panel.x + panel.width,
    y: panel.y + panel.height
  });
  const x = Math.min(topLeft.x, bottomRight.x);
  const y = Math.min(topLeft.y, bottomRight.y);
  const width = Math.abs(bottomRight.x - topLeft.x);
  const height = Math.abs(topLeft.y - bottomRight.y);
  const step = centersCanonical.length >= 2 ? Math.abs(centersCanonical[1]!.y - centersCanonical[0]!.y) : 8.5;
  const fidMargin = Math.min(4.5, width * 0.085);

  return {
    centersCanonical,
    cajaOmr: {
      x: round6(x),
      y: round6(y),
      width: round6(width),
      height: round6(height)
    },
    perfilOmr: {
      radio: 5.1,
      pasoY: round6(step),
      cajaAncho: round6(width)
    },
    fiduciales: {
      leftTop: { x: round6(x + fidMargin), y: round6(y + height - fidMargin) },
      leftBottom: { x: round6(x + fidMargin), y: round6(y + fidMargin) },
      rightTop: { x: round6(x + width - fidMargin), y: round6(y + height - fidMargin) },
      rightBottom: { x: round6(x + width - fidMargin), y: round6(y + fidMargin) }
    }
  };
}

export function deriveCaptureId(folio: string, pageNumber: number, captureOrdinal: number) {
  return `${sanitizeCaptureLabel(String(folio).trim().toUpperCase())}-P${pageNumber}-C${captureOrdinal}`;
}

export function parseOrganizationSnapshot(raw: unknown) {
  const parsed = raw as Partial<OrganizacionPorAlumnoSnapshot>;
  const items = Array.isArray(parsed.items)
    ? parsed.items
        .map((item) => ({
          archivoOriginal: String((item as OrganizacionPorAlumnoItem).archivoOriginal || '').trim(),
          qrTexto: String((item as OrganizacionPorAlumnoItem).qrTexto || '').trim() || undefined,
          folioId: String((item as OrganizacionPorAlumnoItem).folioId || '').trim().toUpperCase(),
          pagina: Number((item as OrganizacionPorAlumnoItem).pagina || 0),
          metodo: String((item as OrganizacionPorAlumnoItem).metodo || '').trim(),
          destino: String((item as OrganizacionPorAlumnoItem).destino || '').trim()
        }))
        .filter((item) => item.archivoOriginal && item.folioId && Number.isInteger(item.pagina) && item.pagina > 0)
    : [];
  return {
    total: Number(parsed.total || items.length),
    items
  } satisfies OrganizacionPorAlumnoSnapshot;
}

export async function loadOrganizationSnapshot(filePath: string) {
  return parseOrganizationSnapshot(await readJsonFile<unknown>(filePath));
}

function resolveCaptureImagePath(args: {
  repoRoot: string;
  relativeSource: string;
  captureId: string;
  fallbackDatasetRoot?: string;
}) {
  const primaryImagePath = path.resolve(args.repoRoot, args.relativeSource);
  if (fsSync.existsSync(primaryImagePath)) return primaryImagePath;
  if (args.fallbackDatasetRoot) {
    const fallbackImagePath = path.resolve(args.fallbackDatasetRoot, 'images', `${args.captureId}.jpg`);
    if (fsSync.existsSync(fallbackImagePath)) return fallbackImagePath;
  }
  return primaryImagePath;
}

export function buildCaptureSources(
  snapshot: OrganizacionPorAlumnoSnapshot,
  repoRoot: string,
  options: { fallbackDatasetRoot?: string } = {}
) {
  const baseByGroup = new Map<string, OrganizacionPorAlumnoItem[]>();
  for (const item of snapshot.items) {
    const key = `${item.folioId}:P${item.pagina}`;
    if (!baseByGroup.has(key)) baseByGroup.set(key, []);
    baseByGroup.get(key)!.push(item);
  }

  const captures: CaptureSourcePorFolio[] = [];
  for (const [groupKey, items] of Array.from(baseByGroup.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const sorted = [...items].sort((a, b) => a.destino.localeCompare(b.destino) || a.archivoOriginal.localeCompare(b.archivoOriginal));
    const [folio, pageToken] = groupKey.split(':');
    const pageNumber = Number(pageToken?.replace(/^P/i, '') || 0);
    sorted.forEach((item, index) => {
      const captureOrdinal = index + 1;
      const captureId = deriveCaptureId(folio!, pageNumber, captureOrdinal);
      const relativeSource = item.destino.replace(/^(\.\.\/)+/, '').replace(/\\/g, '/');
      const absoluteImagePath = resolveCaptureImagePath({
        repoRoot,
        relativeSource,
        captureId,
        fallbackDatasetRoot: options.fallbackDatasetRoot
      });
      captures.push({
        captureId,
        folio: folio!,
        numeroPagina: pageNumber,
        captureOrdinal,
        sourcePath: relativeSource,
        absoluteImagePath,
        sourceGroup: groupKey,
        templateVersion: 4,
        expectedQr: normalizarQrCanonicoTv4(item.qrTexto, folio!, pageNumber)
      });
    });
  }
  return captures;
}

export async function deriveCaptureOmrFromImage(
  capture: CaptureSourcePorFolio,
  profile = DEFAULT_POR_FOLIO_PROFILE
): Promise<{
  mapPage: MapaOmrPaginaPorFolio;
  truthRows: GroundTruthRowPorFolio[];
  questionRange: QuestionRangePorFolio;
  panels: DerivedPanel[];
}> {
  const qrCanonico = normalizarQrCanonicoTv4(capture.expectedQr, capture.folio, capture.numeroPagina);
  const grayImage = await loadGrayImage(capture.absoluteImagePath);
  const panels = detectOmrPanels(grayImage, profile);
  if (panels.length === 0) {
    throw new Error(`No se detectaron paneles OMR en ${capture.captureId}`);
  }

  const derivedPanels: DerivedPanel[] = panels.map((panel, panelIndex) => {
    const centersImage = detectBubbleCenters(grayImage, panel, profile);
    const mapGeometry = buildMapQuestion(panel, centersImage, grayImage);
    const scores = centersImage.map((center) => scoreBubbleMark(grayImage, center, panel));
    const truth = resolvePanelTruth(scores, profile);
    return {
      panelIndex,
      bounds: panel,
      optionCentersImage: centersImage,
      optionCentersCanonical: mapGeometry.centersCanonical,
      questionNumber: buildCanonicalQuestionNumber(capture.numeroPagina, panelIndex),
      truth: {
        option: truth.option,
        markType: truth.markType,
        selectedOptions: truth.selectedOptions,
        scores
      }
    };
  });

  const mapQuestions = derivedPanels.map((panel) => {
    const geometry = buildMapQuestion(panel.bounds, panel.optionCentersImage, grayImage);
    return {
      numeroPregunta: panel.questionNumber,
      idPregunta: `${capture.captureId}-Q${panel.panelIndex + 1}`,
      opciones: panel.optionCentersCanonical,
      cajaOmr: geometry.cajaOmr,
      perfilOmr: geometry.perfilOmr,
      fiduciales: geometry.fiduciales
    };
  });
  const questionRange = {
    from: mapQuestions[0]!.numeroPregunta,
    to: mapQuestions[mapQuestions.length - 1]!.numeroPregunta
  };

  const truthRows: GroundTruthRowPorFolio[] = derivedPanels.map((panel) => ({
    captureId: capture.captureId,
    folio: capture.folio,
    numeroPagina: capture.numeroPagina,
    numeroPregunta: panel.questionNumber,
    opcionEsperada: panel.truth.option,
    markType: panel.truth.markType,
    selectedOptions: panel.truth.selectedOptions,
    sourceEvidence: {
      detector: 'panel_darkness_v1',
      panelIndex: panel.panelIndex,
      panelBounds: {
        x: round6(panel.bounds.x),
        y: round6(panel.bounds.y),
        width: round6(panel.bounds.width),
        height: round6(panel.bounds.height)
      },
      rawScores: Object.fromEntries(panel.truth.scores.map((score) => [score.option, score.score])) as Record<OpcionOmr, number>,
      dominantGap: round6(
        (panel.truth.scores.sort((a, b) => b.score - a.score)[0]?.score ?? 0) -
          (panel.truth.scores.sort((a, b) => b.score - a.score)[1]?.score ?? 0)
      )
    }
  }));

  const mapPage: MapaOmrPaginaPorFolio = {
    numeroPagina: capture.numeroPagina,
    templateVersion: 4,
    engineHints: {
      preferredEngine: 'cv',
      conservativeDecision: true,
      forceSimpleScale: false,
      useMapCoordinatesStrict: false
    },
    qr: {
      texto: qrCanonico,
      ...TV4_QR
    },
    marcasPagina: {
      tipo: 'cuadrados',
      ...TV4_MARKERS
    },
    preguntas: mapQuestions
  };

  return {
    mapPage,
    truthRows,
    questionRange,
    panels: derivedPanels
  };
}

type CanonicalAnswerKeySnapshotPorFolio = {
  generatedAt?: string;
  loteId?: string;
  sourceReport?: string;
  rationale?: string;
  answers: Record<string, OpcionOmr | null>;
};

function isOpcionOmr(value: unknown): value is OpcionOmr {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D' || value === 'E';
}

export function buildAnswerKey(rows: GroundTruthRowPorFolio[]) {
  const groups = new Map<number, Map<OpcionOmr, number>>();
  for (const row of rows) {
    if (row.markType !== 'valid' || !row.opcionEsperada) continue;
    if (!groups.has(row.numeroPregunta)) groups.set(row.numeroPregunta, new Map<OpcionOmr, number>());
    const bucket = groups.get(row.numeroPregunta)!;
    bucket.set(row.opcionEsperada, (bucket.get(row.opcionEsperada) ?? 0) + 1);
  }
  const answerKey: Record<number, OpcionOmr | null> = {};
  for (const [questionNumber, votes] of groups.entries()) {
    const winner = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    answerKey[questionNumber] = winner?.[0] ?? null;
  }
  return answerKey;
}

async function loadCanonicalAnswerKeySnapshot(filePath: string) {
  const snapshot = await readJsonFile<CanonicalAnswerKeySnapshotPorFolio>(filePath);
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.answers || typeof snapshot.answers !== 'object') {
    throw new Error(`Snapshot de answer key invalido: ${filePath}`);
  }

  const answerKey: Record<number, OpcionOmr | null> = {};
  for (const [questionNumberRaw, option] of Object.entries(snapshot.answers)) {
    const questionNumber = Number(questionNumberRaw);
    if (!Number.isInteger(questionNumber) || questionNumber <= 0) {
      throw new Error(`Numero de pregunta invalido en answer key canonica: ${questionNumberRaw}`);
    }
    if (option !== null && !isOpcionOmr(option)) {
      throw new Error(`Opcion invalida en answer key canonica para ${questionNumberRaw}: ${String(option)}`);
    }
    answerKey[questionNumber] = option;
  }

  if (Object.keys(answerKey).length === 0) {
    throw new Error(`Snapshot de answer key canonica sin respuestas: ${filePath}`);
  }

  return {
    snapshot,
    answerKey
  };
}

export async function buildPorFolioDataset(args: {
  repoRoot: string;
  datasetRoot: string;
  organizationPath?: string;
  assignmentSnapshotPath?: string;
  pdfSnapshotPath?: string;
  structureTruthPath?: string;
  canonicalPageMappingPath?: string;
  answerKeyReconciliationPath?: string;
  canonicalAnswerKeyPath?: string;
  profile?: DetectionProfilePorFolio;
}) {
  const repoRoot = path.resolve(args.repoRoot);
  const datasetRoot = resolveFromRepoRoot(repoRoot, args.datasetRoot);
  const outputDatasetRoot = `${datasetRoot}.__tmp_build`;
  const defaultOrganizationPath = path.resolve(repoRoot, 'omr_samples_tv3/images/Por Folio/_organizacion_por_alumno.json');
  const organizationPath = args.organizationPath
    ? resolveFromRepoRoot(repoRoot, args.organizationPath)
    : fsSync.existsSync(defaultOrganizationPath)
      ? defaultOrganizationPath
      : path.join(datasetRoot, 'source', 'organization_snapshot.json');
  const assignmentSnapshotPath = args.assignmentSnapshotPath
    ? resolveFromRepoRoot(repoRoot, args.assignmentSnapshotPath)
    : path.resolve(repoRoot, 'reports/qa/latest/rebuild_lote_from_pdf_asignaciones.json');
  const pdfSnapshotPath = args.pdfSnapshotPath
    ? resolveFromRepoRoot(repoRoot, args.pdfSnapshotPath)
    : path.resolve(repoRoot, 'reports/qa/latest/folios_extraidos_pdf.json');
  const structureTruthPath = args.structureTruthPath
    ? resolveFromRepoRoot(repoRoot, args.structureTruthPath)
    : path.resolve(repoRoot, 'reports/qa/latest/pdf_analysis_079d38a9/a050929d_structure_truth.json');
  const canonicalPageMappingPath = args.canonicalPageMappingPath
    ? resolveFromRepoRoot(repoRoot, args.canonicalPageMappingPath)
    : path.resolve(repoRoot, 'reports/qa/latest/pdf_analysis_079d38a9/a050929d_canonical_page_mapping.json');
  const answerKeyReconciliationPath = args.answerKeyReconciliationPath
    ? resolveFromRepoRoot(repoRoot, args.answerKeyReconciliationPath)
    : path.resolve(repoRoot, 'reports/qa/latest/pdf_analysis_079d38a9/a050929d_answer_key_reconciliation_report.json');
  const canonicalAnswerKeyPath = args.canonicalAnswerKeyPath
    ? resolveFromRepoRoot(repoRoot, args.canonicalAnswerKeyPath)
    : path.resolve(repoRoot, 'reports/qa/latest/pdf_analysis_079d38a9/a050929d_answer_key_canonical.json');
  const profile = args.profile ?? DEFAULT_POR_FOLIO_PROFILE;

  await fs.access(organizationPath);
  await fs.access(canonicalAnswerKeyPath);
  await fs.access(structureTruthPath);
  await fs.access(canonicalPageMappingPath);
  await fs.access(answerKeyReconciliationPath);

  const organization = await loadOrganizationSnapshot(organizationPath);
  const captures = buildCaptureSources(organization, repoRoot, { fallbackDatasetRoot: datasetRoot });
  const manifestCaptures: CaptureManifestPorFolio[] = [];
  const truthRows: GroundTruthRowPorFolio[] = [];

  await fs.rm(outputDatasetRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(outputDatasetRoot, 'images'), { recursive: true });
  await fs.mkdir(path.join(outputDatasetRoot, 'maps'), { recursive: true });
  await fs.mkdir(path.join(outputDatasetRoot, 'source'), { recursive: true });

  for (const capture of captures) {
    const imageName = `${capture.captureId}.jpg`;
    const mapName = `${capture.captureId}.json`;
    const imagePath = path.join(outputDatasetRoot, 'images', imageName);
    const mapPath = path.join(outputDatasetRoot, 'maps', mapName);
    await fs.copyFile(capture.absoluteImagePath, imagePath);
    const derived = await deriveCaptureOmrFromImage(capture, profile);
    derived.mapPage.engineHints = {
      ...(derived.mapPage.engineHints ?? {}),
      preferredEngine: 'cv',
      conservativeDecision: true,
      forceSimpleScale: false,
      useMapCoordinatesStrict: false
    };
    if (derived.mapPage.engineHints && 'localSearchRadiusPx' in derived.mapPage.engineHints) {
      delete (derived.mapPage.engineHints as { localSearchRadiusPx?: number }).localSearchRadiusPx;
    }
    await fs.writeFile(mapPath, `${JSON.stringify(derived.mapPage, null, 2)}\n`, 'utf8');
    truthRows.push(...derived.truthRows);
    manifestCaptures.push({
      captureId: capture.captureId,
      folio: capture.folio,
      numeroPagina: capture.numeroPagina,
      captureOrdinal: capture.captureOrdinal,
      imagePath: `images/${imageName}`,
      mapaOmrPath: `maps/${mapName}`,
      questionRange: derived.questionRange,
      sourcePath: capture.sourcePath,
      sourceGroup: capture.sourceGroup,
      templateVersion: 4,
      expectedQr: normalizarQrCanonicoTv4(capture.expectedQr, capture.folio, capture.numeroPagina)
    });
  }

  const derivedAnswerKey = buildAnswerKey(truthRows);
  const canonicalAnswerKey = await loadCanonicalAnswerKeySnapshot(canonicalAnswerKeyPath);
  const manifest = {
    version: '1',
    datasetType: 'tv4_real_por_folio',
    thresholds: {
      precisionMin: 1,
      falsePositiveMax: 0,
      invalidDetectionMin: 1,
      pagePassMin: 1,
      autoGradeTrustMin: 1,
      autoCoverageMin: 1
    },
    groundTruthRef: 'ground_truth.jsonl',
    answerKeyPath: 'answer_key.json',
    structureBaselinePath: 'source/pdf_structure_truth_snapshot.json',
    canonicalPageMappingPath: 'source/folio_exam_page_mapping_snapshot.json',
    answerKeySourcePath: 'source/answer_key_canonical_snapshot.json',
    answerKeyReconciliationPath: 'source/answer_key_reconciliation_snapshot.json',
    answerKeyMethod: 'canonical_visible_reconciliation',
    capturas: manifestCaptures
  };

  await fs.writeFile(path.join(outputDatasetRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    path.join(outputDatasetRoot, 'answer_key.json'),
    `${JSON.stringify(canonicalAnswerKey.answerKey, null, 2)}\n`,
    'utf8'
  );
  await fs.writeFile(
    path.join(outputDatasetRoot, 'ground_truth.jsonl'),
    `${truthRows.map((row) => JSON.stringify(row)).join('\n')}\n`,
    'utf8'
  );

  await fs.copyFile(organizationPath, path.join(outputDatasetRoot, 'source', 'organization_snapshot.json'));
  try {
    await fs.copyFile(assignmentSnapshotPath, path.join(outputDatasetRoot, 'source', 'folio_assignment_snapshot.json'));
  } catch {
    // Best effort: repo puede no tener snapshot si se ejecuta fuera del contexto QA.
  }
  try {
    await fs.copyFile(pdfSnapshotPath, path.join(outputDatasetRoot, 'source', 'pdf_folios_snapshot.json'));
  } catch {
    // Best effort.
  }
  await fs.copyFile(structureTruthPath, path.join(outputDatasetRoot, 'source', 'pdf_structure_truth_snapshot.json'));
  await fs.copyFile(canonicalPageMappingPath, path.join(outputDatasetRoot, 'source', 'folio_exam_page_mapping_snapshot.json'));
  await fs.copyFile(
    answerKeyReconciliationPath,
    path.join(outputDatasetRoot, 'source', 'answer_key_reconciliation_snapshot.json')
  );
  await fs.writeFile(
    path.join(outputDatasetRoot, 'source', 'answer_key_canonical_snapshot.json'),
    `${JSON.stringify(canonicalAnswerKey.snapshot, null, 2)}\n`,
    'utf8'
  );
  await fs.writeFile(
    path.join(outputDatasetRoot, 'source', 'answer_key_derived_from_marks.json'),
    `${JSON.stringify(derivedAnswerKey, null, 2)}\n`,
    'utf8'
  );
  await fs.writeFile(
    path.join(outputDatasetRoot, 'source', 'layout_detection_profile.json'),
    `${JSON.stringify(profile, null, 2)}\n`,
    'utf8'
  );

  const readme = [
    '# OMR TV4 Por Folio',
    '',
    'Dataset real autocontenido derivado de `omr_samples_tv3/images/Por Folio`, promovido como baseline canonico TV4.',
    '',
    '- `images/`: copias de las capturas originales.',
    '- `maps/`: mapa OMR por captura derivado por deteccion de paneles laterales.',
    '- `ground_truth.jsonl`: verdad de marcas por burbuja derivada con `panel_darkness_v1`.',
    '- `answer_key.json`: clave correcta canonica del examen, no derivada de marcas estudiantiles.',
    '- `source/`: snapshots usados para trazabilidad de folios, estructura PDF, mapeo canonico, reconciliacion y perfil de deteccion.',
    '',
    'Regeneracion:',
    '',
    '```bash',
    'npm run omr:tv3:build:por-folio-dataset',
    '```',
    ''
  ].join('\n');
  await fs.writeFile(path.join(outputDatasetRoot, 'README.md'), readme, 'utf8');

  await fs.rm(datasetRoot, { recursive: true, force: true });
  await fs.rename(outputDatasetRoot, datasetRoot);

  return {
    datasetRoot,
    captures: manifestCaptures.length,
    truthRows: truthRows.length,
    answerKeySize: Object.keys(canonicalAnswerKey.answerKey).length
  };
}
