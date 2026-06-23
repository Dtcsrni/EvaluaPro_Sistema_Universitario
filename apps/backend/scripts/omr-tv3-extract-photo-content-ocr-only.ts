/**
 * omr-tv3-extract-photo-content-ocr-only
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

type ParsedArgs = {
  organizationPath: string;
  outPath: string;
};

type ExtractedQuestion = {
  numeroPregunta: number;
  prompt: string;
  options: Partial<Record<'A' | 'B' | 'C' | 'D' | 'E', string>>;
};

type OcrCapture = {
  captureId: string;
  folio: string;
  pagina: number;
  sourcePath: string;
  ocrText: string;
  normalizedText: string;
  questions: ExtractedQuestion[];
};

type EvidenceRef = {
  captureId: string;
  folio: string;
  pagina: number;
  text: string;
  similarity: number;
};

type ConsensusResult = {
  text: string;
  confidence: number;
  evidence: EvidenceRef[];
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
    outPath: '../../reports/qa/latest/por_folio_photo_content_ocr_only.json'
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if ((key === '--organization' || key === '-o') && next) {
      out.organizationPath = next;
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

function resolveFromRepoRoot(repoRoot: string, targetPath: string) {
  if (path.isAbsolute(targetPath)) return targetPath;
  const cleaned = String(targetPath ?? '').trim().replace(/\\/g, '/').replace(/^(\.\.\/)+/, '');
  return path.resolve(repoRoot, cleaned);
}

function resolveCaptureImagePath(repoRoot: string, destino: string) {
  const trimmed = String(destino ?? '').trim().replace(/\\/g, '/');
  if (path.isAbsolute(trimmed)) return trimmed;
  return path.resolve(repoRoot, trimmed.replace(/^(\.\.\/)+/, ''));
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

function tokenize(raw: string) {
  return normalizeText(raw)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => {
      if (!token) return false;
      if (/^[0-9]+$/.test(token)) return true;
      if (token.length < 2) return false;
      return !SPANISH_STOPWORDS.has(token);
    });
}

function toTokenSet(raw: string) {
  return new Set(tokenize(raw));
}

function tokenSimilarity(aRaw: string, bRaw: string) {
  const a = toTokenSet(aRaw);
  const b = toTokenSet(bRaw);
  if (a.size === 0 && b.size === 0) return 1;
  const small = a.size <= b.size ? a : b;
  const large = a.size <= b.size ? b : a;
  let inter = 0;
  for (const token of small) if (large.has(token)) inter += 1;
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

function cleanLineArtifacts(raw: string) {
  return raw
    .replace(/[|]+/g, ' ')
    .replace(/[[\]{}]/g, ' ')
    .replace(/[_~`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseQuestionBlocksByMarkers(ocrText: string) {
  const text = ocrText.replace(/\r/g, '');
  const matcher = /(?:^|\n)[^\n]{0,4}?(?:\[(\d{1,2})\]|(\d{1,2})[.)])\s+/gm;
  const markers: Array<{ numeroPregunta: number; index: number; headerEnd: number }> = [];
  let match: RegExpExecArray | null = matcher.exec(text);
  while (match) {
    const q = Number(match[1] || match[2] || 0);
    if (Number.isInteger(q) && q >= 1 && q <= 99) {
      markers.push({
        numeroPregunta: q,
        index: match.index,
        headerEnd: matcher.lastIndex
      });
    }
    match = matcher.exec(text);
  }
  markers.sort((a, b) => a.index - b.index);
  const compactedMarkers = markers.filter((marker, idx) => {
    const prev = markers[idx - 1];
    if (!prev) return true;
    if (marker.index - prev.index < 14) return false;
    return true;
  });

  const questions: ExtractedQuestion[] = [];
  for (let i = 0; i < compactedMarkers.length; i += 1) {
    const current = compactedMarkers[i]!;
    const next = compactedMarkers[i + 1];
    const block = text.slice(current.headerEnd, next ? next.index : text.length).trim();
    if (!block) continue;

    const optionMatcher = /(?:^|[\s|])([A-E])[)\].:]\s*/g;
    const optionMarks: Array<{ letter: 'A' | 'B' | 'C' | 'D' | 'E'; index: number; start: number }> = [];
    let optionMatch: RegExpExecArray | null = optionMatcher.exec(block);
    while (optionMatch) {
      optionMarks.push({
        letter: optionMatch[1] as 'A' | 'B' | 'C' | 'D' | 'E',
        index: optionMatch.index,
        start: optionMatcher.lastIndex
      });
      optionMatch = optionMatcher.exec(block);
    }

    const prompt = cleanLineArtifacts(optionMarks.length > 0 ? block.slice(0, optionMarks[0]!.index) : block);
    const options: Partial<Record<'A' | 'B' | 'C' | 'D' | 'E', string>> = {};
    for (let oi = 0; oi < optionMarks.length; oi += 1) {
      const currentOption = optionMarks[oi]!;
      const nextOption = optionMarks[oi + 1];
      const optionText = cleanLineArtifacts(block.slice(currentOption.start, nextOption ? nextOption.index : block.length));
      if (optionText) options[currentOption.letter] = optionText;
    }

    questions.push({
      numeroPregunta: current.numeroPregunta,
      prompt,
      options
    });
  }

  return questions.filter((question) => {
    const optionCount = Object.values(question.options).filter(Boolean).length;
    return question.prompt.length >= 8 && optionCount >= 2;
  });
}

function inferQuestionNumberFromPage(pagina: number, promptIndex: number) {
  if (pagina === 1) return promptIndex + 1;
  if (pagina === 2) return promptIndex + 9;
  return pagina * 100 + promptIndex + 1;
}

function parseQuestionBlocksByPrompt(ocrText: string, pagina: number) {
  const text = ocrText.replace(/\r/g, '');
  const promptMatcher = /¿[\s\S]{12,280}?\?/g;
  const prompts: Array<{ index: number; end: number; text: string }> = [];
  let match: RegExpExecArray | null = promptMatcher.exec(text);
  while (match) {
    prompts.push({
      index: match.index,
      end: promptMatcher.lastIndex,
      text: cleanLineArtifacts(match[0])
    });
    match = promptMatcher.exec(text);
  }

  const questions: ExtractedQuestion[] = [];
  for (let i = 0; i < prompts.length; i += 1) {
    const prompt = prompts[i]!;
    const next = prompts[i + 1];
    const block = text.slice(prompt.end, next ? next.index : text.length).trim();
    if (!block) continue;
    const optionMatcher = /(?:^|[\s|])([A-E])[)\].:]\s*/g;
    const optionMarks: Array<{ letter: 'A' | 'B' | 'C' | 'D' | 'E'; index: number; start: number }> = [];
    let optionMatch: RegExpExecArray | null = optionMatcher.exec(block);
    while (optionMatch) {
      optionMarks.push({
        letter: optionMatch[1] as 'A' | 'B' | 'C' | 'D' | 'E',
        index: optionMatch.index,
        start: optionMatcher.lastIndex
      });
      optionMatch = optionMatcher.exec(block);
    }

    const options: Partial<Record<'A' | 'B' | 'C' | 'D' | 'E', string>> = {};
    for (let oi = 0; oi < optionMarks.length; oi += 1) {
      const currentOption = optionMarks[oi]!;
      const nextOption = optionMarks[oi + 1];
      const optionText = cleanLineArtifacts(block.slice(currentOption.start, nextOption ? nextOption.index : block.length));
      if (optionText) options[currentOption.letter] = optionText;
    }

    const optionCount = Object.values(options).filter(Boolean).length;
    if (optionCount < 2) continue;
    questions.push({
      numeroPregunta: inferQuestionNumberFromPage(pagina, i),
      prompt: prompt.text,
      options
    });
  }

  return questions;
}

function parseQuestionBlocks(ocrText: string, pagina: number) {
  const byPrompt = parseQuestionBlocksByPrompt(ocrText, pagina);
  if (byPrompt.length >= 6) return byPrompt;
  const byMarkers = parseQuestionBlocksByMarkers(ocrText);
  return byMarkers.length > byPrompt.length ? byMarkers : byPrompt;
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

  return source
    .extract({ left: 0, top: cropTop, width: cropLeft, height: cropHeight })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.1, m1: 1, m2: 2 })
    .png()
    .toBuffer();
}

function buildCaptureId(item: OrganizacionItem) {
  const base = path.basename(item.destino).replace(/\.[^.]+$/, '');
  return `${item.folioId}-P${item.pagina}-${base}`;
}

function toCertainty(similarity: number) {
  if (similarity >= 0.86) return 'muy_alta';
  if (similarity >= 0.74) return 'alta';
  if (similarity >= 0.58) return 'media';
  return 'baja';
}

function buildConsensus(entries: Array<{ capture: OcrCapture; text: string }>): ConsensusResult | null {
  const valid = entries
    .map((entry) => ({ capture: entry.capture, text: cleanLineArtifacts(entry.text) }))
    .filter((entry) => entry.text.length >= 3);
  if (valid.length === 0) return null;

  let bestIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < valid.length; i += 1) {
    let acc = 0;
    for (let j = 0; j < valid.length; j += 1) {
      if (i === j) continue;
      acc += tokenSimilarity(valid[i]!.text, valid[j]!.text);
    }
    const avg = valid.length > 1 ? acc / (valid.length - 1) : 1;
    if (avg > bestScore) {
      bestScore = avg;
      bestIndex = i;
    }
  }

  const centroid = valid[bestIndex]!;
  const evidences = valid
    .map((entry) => ({
      captureId: entry.capture.captureId,
      folio: entry.capture.folio,
      pagina: entry.capture.pagina,
      text: entry.text,
      similarity: Number(tokenSimilarity(entry.text, centroid.text).toFixed(4))
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  const confidence = evidences.reduce((acc, item) => acc + item.similarity, 0) / Math.max(1, evidences.length);
  return {
    text: centroid.text,
    confidence: Number(confidence.toFixed(4)),
    evidence: evidences
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const repoRoot = await findRepoRoot(process.cwd());
  const organizationPath = resolveFromRepoRoot(repoRoot, args.organizationPath);
  const outPath = resolveFromRepoRoot(repoRoot, args.outPath);

  const organization = await readJson<OrganizacionSnapshot>(organizationPath);
  const worker = await createWorker('spa+eng');
  await worker.setParameters({
    tessedit_pageseg_mode: '6',
    preserve_interword_spaces: '1'
  });

  const captures: OcrCapture[] = [];
  try {
    for (const item of organization.items) {
      const imagePath = resolveCaptureImagePath(repoRoot, item.destino);
      const prepared = await preprocessForOcr(imagePath);
      const { data } = await worker.recognize(prepared);
      const ocrText = data.text ?? '';
      captures.push({
        captureId: buildCaptureId(item),
        folio: item.folioId,
        pagina: item.pagina,
        sourcePath: item.destino,
        ocrText,
        normalizedText: normalizeText(ocrText),
        questions: parseQuestionBlocks(ocrText, item.pagina)
      });
    }
  } finally {
    await worker.terminate();
  }

  const byQuestion = new Map<number, Array<{ capture: OcrCapture; question: ExtractedQuestion }>>();
  for (const capture of captures) {
    for (const question of capture.questions) {
      if (!byQuestion.has(question.numeroPregunta)) byQuestion.set(question.numeroPregunta, []);
      byQuestion.get(question.numeroPregunta)!.push({ capture, question });
    }
  }

  const allQuestionNumbers = Array.from(byQuestion.keys()).sort((a, b) => a - b);
  const extractedBank = allQuestionNumbers.map((numeroPregunta) => {
    const entries = byQuestion.get(numeroPregunta) ?? [];
    const promptConsensus = buildConsensus(entries.map((entry) => ({ capture: entry.capture, text: entry.question.prompt })));
    const options = (['A', 'B', 'C', 'D', 'E'] as const).map((letter) => {
      const optionConsensus = buildConsensus(
        entries
          .filter((entry) => Boolean(entry.question.options[letter]))
          .map((entry) => ({ capture: entry.capture, text: entry.question.options[letter]! }))
      );
      return {
        letter,
        text: optionConsensus?.text ?? null,
        confidence: optionConsensus?.confidence ?? 0,
        evidenceCount: optionConsensus?.evidence.length ?? 0,
        evidence: optionConsensus?.evidence ?? []
      };
    });
    const avgOptionConfidence = options.reduce((acc, option) => acc + option.confidence, 0) / options.length;
    const aggregateConfidence = Number(((promptConsensus?.confidence ?? 0) * 0.4 + avgOptionConfidence * 0.6).toFixed(4));
    return {
      numeroPregunta,
      prompt: promptConsensus?.text ?? null,
      promptConfidence: promptConsensus?.confidence ?? 0,
      promptEvidence: promptConsensus?.evidence ?? [],
      options,
      aggregateConfidence,
      certainty: toCertainty(aggregateConfidence),
      captureCoverage: entries.length
    };
  });

  const unresolved = extractedBank.filter(
    (question) =>
      !question.prompt ||
      question.options.some((option) => !option.text) ||
      question.captureCoverage < 2
  );

  const report = {
    generatedAt: new Date().toISOString(),
    source: {
      organizationPath: path.relative(repoRoot, organizationPath).replace(/\\/g, '/'),
      totalCaptures: captures.length
    },
    summary: {
      detectedQuestionNumbers: allQuestionNumbers,
      totalQuestionsDetected: extractedBank.length,
      unresolvedQuestions: unresolved.map((question) => question.numeroPregunta),
      certaintyCounts: extractedBank.reduce(
        (acc, question) => {
          acc[question.certainty] = (acc[question.certainty] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      )
    },
    extractedBank
  };

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        outPath: path.relative(repoRoot, outPath).replace(/\\/g, '/'),
        totalCaptures: captures.length,
        totalQuestionsDetected: extractedBank.length,
        unresolvedQuestions: unresolved.map((question) => question.numeroPregunta)
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
