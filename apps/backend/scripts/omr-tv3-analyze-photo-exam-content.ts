/**
 * omr-tv3-analyze-photo-exam-content
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

type OrganizacionItem = {
  archivoOriginal: string;
  folioId: string;
  pagina: number;
  destino: string;
};

type OrganizacionSnapshot = {
  total: number;
  items: OrganizacionItem[];
};

type CanonicalQuestionRow = {
  numeroPregunta: number;
  pagina: number;
  prompt: string;
  options: Record<'A' | 'B' | 'C' | 'D' | 'E', string>;
  correctOption: 'A' | 'B' | 'C' | 'D' | 'E';
};

type CanonicalReport = {
  canonicalVisibleBank?: CanonicalQuestionRow[];
};

type ParsedArgs = {
  organizationPath: string;
  canonicalPath: string;
  outPath: string;
};

type OcrCapture = {
  captureId: string;
  folio: string;
  pagina: number;
  sourcePath: string;
  ocrText: string;
  normalizedText: string;
  tokenSet: Set<string>;
  qualityScore: number;
};

type EvidenceScore = {
  score: number;
  tokenCoverage: number;
  trigramJaccard: number;
  captureId: string;
  folio: string;
  pagina: number;
};

const SPANISH_STOPWORDS = new Set([
  'que',
  'con',
  'para',
  'una',
  'del',
  'las',
  'los',
  'por',
  'sea',
  'sin',
  'sus',
  'como',
  'desde',
  'hasta',
  'donde',
  'cual',
  'cuales',
  'este',
  'esta',
  'estos',
  'estas'
]);

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    organizationPath: '../../omr_samples_tv3/images/Por Folio/_organizacion_por_alumno.json',
    canonicalPath: '../../reports/qa/latest/por_folio_analysis_from_zero.json',
    outPath: '../../reports/qa/latest/por_folio_photo_content_validation.json'
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if ((key === '--organization' || key === '-o') && next) {
      out.organizationPath = next;
      i += 1;
      continue;
    }
    if ((key === '--canonical' || key === '-c') && next) {
      out.canonicalPath = next;
      i += 1;
      continue;
    }
    if ((key === '--out' || key === '-r') && next) {
      out.outPath = next;
      i += 1;
      continue;
    }
  }

  return out;
}

async function readJson<T>(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findRepoRoot(startDir: string) {
  let current = path.resolve(startDir);
  for (let i = 0; i < 8; i += 1) {
    if (await pathExists(path.join(current, 'omr_samples_tv3'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`No se pudo detectar la raiz del repositorio desde ${startDir}`);
}

function normalizeText(raw: string) {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string) {
  return normalizeText(text)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => {
      if (!token) return false;
      const isNumeric = /^[0-9]+$/.test(token);
      if (isNumeric) return true;
      if (token.length < 2) return false;
      return !SPANISH_STOPWORDS.has(token);
    });
}

function buildTokenSet(text: string) {
  return new Set(tokenize(text));
}

function buildTrigramSet(normalized: string) {
  const compact = normalized.replace(/\s+/g, ' ').trim();
  const n = compact.length < 12 ? 2 : 3;
  if (compact.length < n) return new Set<string>();
  const out = new Set<string>();
  for (let i = 0; i <= compact.length - n; i += 1) out.add(compact.slice(i, i + n));
  return out;
}

function jaccardSimilarity<T>(a: Set<T>, b: Set<T>) {
  if (a.size === 0 && b.size === 0) return 1;
  const small = a.size <= b.size ? a : b;
  const large = a.size <= b.size ? b : a;
  let intersection = 0;
  for (const item of small) if (large.has(item)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function tokenCoverage(snippet: string, captureTokens: Set<string>) {
  const tokens = tokenize(snippet);
  if (tokens.length === 0) return 0;
  let found = 0;
  for (const token of tokens) if (captureTokens.has(token)) found += 1;
  return found / tokens.length;
}

function scoreSnippetAgainstCapture(snippet: string, capture: OcrCapture) {
  const normSnippet = normalizeText(snippet);
  const trigSnippet = buildTrigramSet(normSnippet);
  const trigCapture = buildTrigramSet(capture.normalizedText);
  const coverage = tokenCoverage(snippet, capture.tokenSet);
  const trigram = jaccardSimilarity(trigSnippet, trigCapture);
  const score = coverage * 0.65 + trigram * 0.35;
  return {
    score,
    tokenCoverage: coverage,
    trigramJaccard: trigram
  };
}

function buildCaptureId(item: OrganizacionItem) {
  const base = path.basename(item.destino).replace(/\.[^.]+$/, '');
  return `${item.folioId}-P${item.pagina}-${base}`;
}

function resolveFromRepoRoot(repoRoot: string, targetPath: string) {
  if (path.isAbsolute(targetPath)) return targetPath;
  const cleaned = String(targetPath ?? '').trim().replace(/\\/g, '/').replace(/^(\.\.\/)+/, '');
  return path.resolve(repoRoot, cleaned);
}

function resolveCaptureImagePath(repoRoot: string, organizationPath: string, destino: string) {
  const trimmed = String(destino ?? '').trim().replace(/\\/g, '/');
  if (path.isAbsolute(trimmed)) return trimmed;
  const repoRelative = trimmed.replace(/^(\.\.\/)+/, '');
  const fromRepo = path.resolve(repoRoot, repoRelative);
  return fromRepo;
}

function qualityFromOcrText(text: string) {
  const markers = (text.match(/\[[0-9]{1,2}\]/g) ?? []).length;
  const optionMarkers = (text.match(/[A-E]\)/g) ?? []).length;
  const words = tokenize(text).length;
  return markers * 2 + optionMarkers * 0.4 + Math.min(40, words / 40);
}

async function preprocessForOcr(imagePath: string) {
  const source = sharp(imagePath).rotate();
  const meta = await source.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error(`No se pudo leer tamaño de imagen: ${imagePath}`);

  const cropLeft = Math.round(width * 0.78);
  const cropTop = Math.round(height * 0.03);
  const cropHeight = Math.round(height * 0.95);

  const processed = await source
    .extract({ left: 0, top: cropTop, width: cropLeft, height: cropHeight })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.1, m1: 1, m2: 2 })
    .png()
    .toBuffer();

  return processed;
}

function toCertaintyLabel(score: number) {
  if (score >= 0.75) return 'muy_alta';
  if (score >= 0.68) return 'alta';
  if (score >= 0.62) return 'media';
  return 'baja';
}

async function main() {
  const args = parseArgs(process.argv);
  const repoRoot = await findRepoRoot(process.cwd());
  const organizationPath = resolveFromRepoRoot(repoRoot, args.organizationPath);
  const canonicalPath = resolveFromRepoRoot(repoRoot, args.canonicalPath);
  const outPath = resolveFromRepoRoot(repoRoot, args.outPath);

  const organization = await readJson<OrganizacionSnapshot>(organizationPath);
  const canonical = await readJson<CanonicalReport>(canonicalPath);
  const canonicalVisibleBank = (canonical.canonicalVisibleBank ?? []).slice().sort((a, b) => a.numeroPregunta - b.numeroPregunta);
  if (canonicalVisibleBank.length === 0) throw new Error(`No hay canonicalVisibleBank en ${canonicalPath}`);

  const worker = await createWorker('spa+eng');
  await worker.setParameters({
    tessedit_pageseg_mode: '6',
    preserve_interword_spaces: '1'
  });

  const captures: OcrCapture[] = [];
  try {
    for (const item of organization.items) {
      const absoluteImagePath = resolveCaptureImagePath(repoRoot, organizationPath, item.destino);
      const imageBuffer = await preprocessForOcr(absoluteImagePath);
      const { data } = await worker.recognize(imageBuffer);
      const ocrText = data.text ?? '';
      const normalizedText = normalizeText(ocrText);
      captures.push({
        captureId: buildCaptureId(item),
        folio: item.folioId,
        pagina: item.pagina,
        sourcePath: item.destino,
        ocrText,
        normalizedText,
        tokenSet: buildTokenSet(ocrText),
        qualityScore: qualityFromOcrText(ocrText)
      });
    }
  } finally {
    await worker.terminate();
  }

  const byPage = new Map<number, OcrCapture[]>();
  for (const capture of captures) {
    if (!byPage.has(capture.pagina)) byPage.set(capture.pagina, []);
    byPage.get(capture.pagina)!.push(capture);
  }
  for (const [, list] of byPage.entries()) list.sort((a, b) => b.qualityScore - a.qualityScore);

  const questionAnalysis = canonicalVisibleBank.map((question) => {
    const pageCaptures = byPage.get(question.pagina) ?? [];
    if (pageCaptures.length === 0) {
      return {
        numeroPregunta: question.numeroPregunta,
        pagina: question.pagina,
        prompt: question.prompt,
        options: question.options,
        correctOption: question.correctOption,
        certainty: 'baja',
        aggregateScore: 0,
        missingPageEvidence: true,
        promptEvidence: null,
        optionsEvidence: {}
      };
    }

    const pickBest = (snippet: string): EvidenceScore => {
      let best: EvidenceScore | null = null;
      for (const capture of pageCaptures) {
        const scored = scoreSnippetAgainstCapture(snippet, capture);
        if (!best || scored.score > best.score) {
          best = {
            ...scored,
            captureId: capture.captureId,
            folio: capture.folio,
            pagina: capture.pagina
          };
        }
      }
      return best!;
    };

    const promptEvidence = pickBest(question.prompt);
    const optionsEvidence = {
      A: pickBest(question.options.A),
      B: pickBest(question.options.B),
      C: pickBest(question.options.C),
      D: pickBest(question.options.D),
      E: pickBest(question.options.E)
    };
    const aggregateScore =
      (promptEvidence.score +
        optionsEvidence.A.score +
        optionsEvidence.B.score +
        optionsEvidence.C.score +
        optionsEvidence.D.score +
        optionsEvidence.E.score) /
      6;

    return {
      numeroPregunta: question.numeroPregunta,
      pagina: question.pagina,
      prompt: question.prompt,
      options: question.options,
      correctOption: question.correctOption,
      certainty: toCertaintyLabel(aggregateScore),
      aggregateScore: Number(aggregateScore.toFixed(4)),
      missingPageEvidence: false,
      promptEvidence,
      optionsEvidence
    };
  });

  const pageSummary = Array.from(byPage.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([pagina, list]) => ({
      pagina,
      totalCaptures: list.length,
      bestCapture: list[0]
        ? {
            captureId: list[0].captureId,
            folio: list[0].folio,
            qualityScore: Number(list[0].qualityScore.toFixed(4)),
            textPreview: list[0].ocrText.slice(0, 1800).trim()
          }
        : null
    }));

  const certaintyCounts = questionAnalysis.reduce(
    (acc, row) => {
      acc[row.certainty] = (acc[row.certainty] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const unresolved = questionAnalysis.filter((row) => row.aggregateScore < 0.62);

  const report = {
    generatedAt: new Date().toISOString(),
    source: {
      organizationPath: path.relative(repoRoot, organizationPath).replace(/\\/g, '/'),
      canonicalPath: path.relative(repoRoot, canonicalPath).replace(/\\/g, '/'),
      totalCaptures: captures.length
    },
    summary: {
      totalQuestions: questionAnalysis.length,
      certaintyCounts,
      unresolvedQuestions: unresolved.map((row) => row.numeroPregunta)
    },
    pageSummary,
    questionAnalysis
  };

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        outPath: path.relative(repoRoot, outPath).replace(/\\/g, '/'),
        totalCaptures: captures.length,
        totalQuestions: questionAnalysis.length,
        unresolvedQuestions: unresolved.map((row) => row.numeroPregunta)
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});
