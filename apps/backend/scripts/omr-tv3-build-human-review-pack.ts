import fs from 'node:fs/promises';
import path from 'node:path';

type OrganizationItem = {
  archivoOriginal: string;
  folioId: string;
  pagina: number;
  destino: string;
};

type OrganizationSnapshot = {
  total: number;
  items: OrganizationItem[];
};

type DatasetManifest = {
  capturas: Array<{
    captureId: string;
    folio: string;
    numeroPagina: number;
    imagePath: string;
  }>;
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

type OcrOnlyOption = {
  letter: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string | null;
  confidence: number;
  evidenceCount: number;
  evidence: Array<{
    captureId: string;
    folio: string;
    pagina: number;
    text: string;
    similarity: number;
  }>;
};

type OcrOnlyQuestion = {
  numeroPregunta: number;
  prompt: string | null;
  promptConfidence: number;
  promptEvidence: Array<{
    captureId: string;
    folio: string;
    pagina: number;
    text: string;
    similarity: number;
  }>;
  options: OcrOnlyOption[];
  aggregateConfidence: number;
  certainty: string;
  captureCoverage: number;
};

type OcrOnlyReport = {
  extractedBank?: OcrOnlyQuestion[];
};

type ParsedArgs = {
  organizationPath: string;
  manifestPath: string;
  canonicalPath: string;
  ocrOnlyPath: string;
  outDir: string;
  copyEvidence: boolean;
};

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

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    organizationPath: '../../omr_samples_tv3/images/Por Folio/_organizacion_por_alumno.json',
    manifestPath: '../../omr_samples_tv3_real_por_folio/manifest.json',
    canonicalPath: '../../reports/qa/latest/por_folio_analysis_from_zero.json',
    ocrOnlyPath: '../../reports/qa/latest/por_folio_photo_content_ocr_only.json',
    outDir: '../../reports/qa/latest/por_folio_human_review',
    copyEvidence: true
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
    if ((key === '--manifest' || key === '-m') && next) {
      out.manifestPath = next;
      i += 1;
      continue;
    }
    if ((key === '--ocr-only' || key === '-i') && next) {
      out.ocrOnlyPath = next;
      i += 1;
      continue;
    }
    if ((key === '--out-dir' || key === '-d') && next) {
      out.outDir = next;
      i += 1;
      continue;
    }
    if (key === '--no-copy-evidence') {
      out.copyEvidence = false;
    }
  }
  return out;
}

function buildCaptureId(item: OrganizationItem) {
  const base = path.basename(item.destino).replace(/\.[^.]+$/, '');
  return `${item.folioId}-P${item.pagina}-${base}`;
}

function resolveCaptureImagePath(repoRoot: string, destino: string) {
  const trimmed = String(destino ?? '').trim().replace(/\\/g, '/');
  if (path.isAbsolute(trimmed)) return trimmed;
  return path.resolve(repoRoot, trimmed.replace(/^(\.\.\/)+/, ''));
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function sanitizeFileName(value: string) {
  return String(value ?? '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

function toVscodeFileUri(filePath: string) {
  const normalized = path.resolve(filePath).replace(/\\/g, '/');
  return `vscode://file/${encodeURI(normalized)}`;
}

async function main() {
  const args = parseArgs(process.argv);
  const repoRoot = await findRepoRoot(process.cwd());
  const organizationPath = resolveFromRepoRoot(repoRoot, args.organizationPath);
  const manifestPath = resolveFromRepoRoot(repoRoot, args.manifestPath);
  const canonicalPath = resolveFromRepoRoot(repoRoot, args.canonicalPath);
  const ocrOnlyPath = resolveFromRepoRoot(repoRoot, args.ocrOnlyPath);
  const outDir = resolveFromRepoRoot(repoRoot, args.outDir);

  const hasOrganization = await pathExists(organizationPath);
  const hasManifest = await pathExists(manifestPath);
  if (!hasOrganization && !hasManifest) {
    throw new Error(`No se encontro organization ni manifest para construir evidencia visual`);
  }
  const organization = hasOrganization ? await readJson<OrganizationSnapshot>(organizationPath) : null;
  const manifest = hasManifest ? await readJson<DatasetManifest>(manifestPath) : null;
  const canonical = await readJson<CanonicalReport>(canonicalPath);
  const ocrOnly = await readJson<OcrOnlyReport>(ocrOnlyPath);

  const canonicalBank = (canonical.canonicalVisibleBank ?? []).slice().sort((a, b) => a.numeroPregunta - b.numeroPregunta);
  const ocrBank = new Map<number, OcrOnlyQuestion>(
    (ocrOnly.extractedBank ?? []).map((question) => [question.numeroPregunta, question])
  );

  const capturePathById = new Map<string, string>();
  const capturePathByFolioPage = new Map<string, string>();
  if (organization) {
    for (const item of organization.items) {
      capturePathById.set(buildCaptureId(item), resolveCaptureImagePath(repoRoot, item.destino));
    }
  }
  if (manifest) {
    for (const cap of manifest.capturas ?? []) {
      const imagePath = path.resolve(path.dirname(manifestPath), cap.imagePath);
      capturePathById.set(cap.captureId, imagePath);
      capturePathByFolioPage.set(`${String(cap.folio).toUpperCase()}:P${Number(cap.numeroPagina)}`, imagePath);
    }
  }

  await fs.mkdir(outDir, { recursive: true });
  const evidenceDir = path.join(outDir, 'images');
  if (args.copyEvidence) await fs.mkdir(evidenceDir, { recursive: true });
  let copiedCount = 0;
  let copyErrorCount = 0;

  const reviewRows = canonicalBank.map((question) => {
    const ocr = ocrBank.get(question.numeroPregunta) ?? null;
    const optionByLetter = new Map(
      (ocr?.options ?? []).map((option) => [option.letter, option] as const)
    );

    const captureCandidates = unique([
      ...(ocr?.promptEvidence.map((e) => e.captureId) ?? []),
      ...(['A', 'B', 'C', 'D', 'E'] as const).flatMap((letter) => optionByLetter.get(letter)?.evidence.map((e) => e.captureId) ?? [])
    ]).slice(0, 8);

    const resolveEvidencePath = (captureId: string) => {
      const direct = capturePathById.get(captureId);
      if (direct) return direct;
      const parsed = /^([A-F0-9]{8})-P(\d+)-/i.exec(captureId);
      if (!parsed) return null;
      const key = `${parsed[1]!.toUpperCase()}:P${Number(parsed[2])}`;
      return capturePathByFolioPage.get(key) ?? null;
    };

    return {
      numeroPregunta: question.numeroPregunta,
      pagina: question.pagina,
      canonical: {
        prompt: question.prompt,
        options: question.options,
        correctOption: question.correctOption
      },
      ocrOnly: {
        prompt: ocr?.prompt ?? null,
        promptConfidence: ocr?.promptConfidence ?? 0,
        aggregateConfidence: ocr?.aggregateConfidence ?? 0,
        certainty: ocr?.certainty ?? 'sin_datos',
        captureCoverage: ocr?.captureCoverage ?? 0,
        options: {
          A: optionByLetter.get('A')?.text ?? null,
          B: optionByLetter.get('B')?.text ?? null,
          C: optionByLetter.get('C')?.text ?? null,
          D: optionByLetter.get('D')?.text ?? null,
          E: optionByLetter.get('E')?.text ?? null
        },
        optionsConfidence: {
          A: optionByLetter.get('A')?.confidence ?? 0,
          B: optionByLetter.get('B')?.confidence ?? 0,
          C: optionByLetter.get('C')?.confidence ?? 0,
          D: optionByLetter.get('D')?.confidence ?? 0,
          E: optionByLetter.get('E')?.confidence ?? 0
        }
      },
      visualEvidence: captureCandidates.map((captureId) => ({
        captureId,
        imagePath: resolveEvidencePath(captureId),
        vscodeUri: resolveEvidencePath(captureId) ? toVscodeFileUri(resolveEvidencePath(captureId) as string) : null
      })),
      humanReview: {
        promptApproved: null,
        promptCorrection: null,
        optionsApproved: null,
        optionsCorrection: {
          A: null,
          B: null,
          C: null,
          D: null,
          E: null
        },
        correctOptionApproved: null,
        correctOptionCorrection: null,
        reviewer: null,
        reviewedAt: null,
        notes: null
      }
    };
  });

  if (args.copyEvidence) {
    const copied = new Set<string>();
    for (const row of reviewRows) {
      for (const ev of row.visualEvidence) {
        if (!ev.imagePath || copied.has(ev.captureId)) continue;
        const source = ev.imagePath;
        const ext = path.extname(source) || '.jpg';
        const target = path.join(evidenceDir, `${sanitizeFileName(ev.captureId)}${ext}`);
        try {
          await fs.copyFile(source, target);
          copied.add(ev.captureId);
          copiedCount += 1;
        } catch {
          copyErrorCount += 1;
        }
      }
    }
  }

  const packet = {
    generatedAt: new Date().toISOString(),
    source: {
      organizationPath: hasOrganization ? path.relative(repoRoot, organizationPath).replace(/\\/g, '/') : null,
      organizationVscodeUri: hasOrganization ? toVscodeFileUri(organizationPath) : null,
      manifestPath: hasManifest ? path.relative(repoRoot, manifestPath).replace(/\\/g, '/') : null,
      manifestVscodeUri: hasManifest ? toVscodeFileUri(manifestPath) : null,
      canonicalPath: path.relative(repoRoot, canonicalPath).replace(/\\/g, '/'),
      canonicalVscodeUri: toVscodeFileUri(canonicalPath),
      ocrOnlyPath: path.relative(repoRoot, ocrOnlyPath).replace(/\\/g, '/'),
      ocrOnlyVscodeUri: toVscodeFileUri(ocrOnlyPath)
    },
    reviewInstructions: [
      'Revisar prompt y opciones contra evidencia visual de las capturas.',
      'Aprobar o corregir texto en humanReview.',
      'Confirmar opcion correcta academica por reactivo.',
      'Registrar notas solo cuando exista duda de lectura o ambiguedad del impreso.'
    ],
    questions: reviewRows
  };

  const template = {
    generatedAt: packet.generatedAt,
    status: 'pendiente_revision_humana',
    questions: reviewRows.map((row) => ({
      numeroPregunta: row.numeroPregunta,
      humanReview: row.humanReview
    }))
  };

  const markdownLines: string[] = [];
  markdownLines.push('# Paquete de Revision Humana Por Folio');
  markdownLines.push('');
  markdownLines.push(`Generado: ${packet.generatedAt}`);
  markdownLines.push('');
  markdownLines.push('## Abrir Archivos En VS Code');
  markdownLines.push(`- review_packet.json: ${toVscodeFileUri(path.join(outDir, 'review_packet.json'))}`);
  markdownLines.push(`- review_template.json: ${toVscodeFileUri(path.join(outDir, 'review_template.json'))}`);
  markdownLines.push(`- README.md: ${toVscodeFileUri(path.join(outDir, 'README.md'))}`);
  markdownLines.push('');
  markdownLines.push('## Instrucciones');
  for (const step of packet.reviewInstructions) markdownLines.push(`- ${step}`);
  markdownLines.push('');
  for (const row of reviewRows) {
    markdownLines.push(`## Pregunta ${row.numeroPregunta}`);
    markdownLines.push(`- Pagina: ${row.pagina}`);
    markdownLines.push(`- Certeza OCR-only: ${row.ocrOnly.certainty} (${row.ocrOnly.aggregateConfidence})`);
    markdownLines.push(`- Prompt canónico: ${row.canonical.prompt}`);
    markdownLines.push(`- Prompt OCR-only: ${row.ocrOnly.prompt ?? '(sin dato)'}`);
    markdownLines.push(`- Opcion correcta canónica: ${row.canonical.correctOption}`);
    markdownLines.push('- Evidencia visual:');
    for (const ev of row.visualEvidence) {
      const rel = ev.imagePath ? path.relative(repoRoot, ev.imagePath).replace(/\\/g, '/') : 'sin ruta';
      markdownLines.push(`  - ${ev.captureId}: ${rel}`);
      if (ev.vscodeUri) markdownLines.push(`    abrir: ${ev.vscodeUri}`);
    }
    markdownLines.push('- Opciones:');
    for (const letter of ['A', 'B', 'C', 'D', 'E'] as const) {
      markdownLines.push(
        `  - ${letter}: canónico="${row.canonical.options[letter]}" | OCR="${row.ocrOnly.options[letter] ?? '(sin dato)'}" (conf=${row.ocrOnly.optionsConfidence[letter]})`
      );
    }
    markdownLines.push('');
  }

  await fs.writeFile(path.join(outDir, 'review_packet.json'), `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(outDir, 'review_template.json'), `${JSON.stringify(template, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(outDir, 'README.md'), `${markdownLines.join('\n')}\n`, 'utf8');

  const openLinksLines: string[] = [];
  openLinksLines.push('# Open In VS Code');
  openLinksLines.push('');
  openLinksLines.push(`- [review_packet.json](${toVscodeFileUri(path.join(outDir, 'review_packet.json'))})`);
  openLinksLines.push(`- [review_template.json](${toVscodeFileUri(path.join(outDir, 'review_template.json'))})`);
  openLinksLines.push(`- [README.md](${toVscodeFileUri(path.join(outDir, 'README.md'))})`);
  openLinksLines.push('');
  openLinksLines.push('## Top Questions (Low OCR Confidence)');
  for (const row of reviewRows.slice().sort((a, b) => a.ocrOnly.aggregateConfidence - b.ocrOnly.aggregateConfidence).slice(0, 10)) {
    openLinksLines.push(
      `- Q${row.numeroPregunta} (conf=${row.ocrOnly.aggregateConfidence})`
    );
    const topEvidence = row.visualEvidence.slice(0, 3).filter((ev) => Boolean(ev.vscodeUri));
    for (const ev of topEvidence) {
      openLinksLines.push(`  - [${ev.captureId}](${ev.vscodeUri})`);
    }
  }
  openLinksLines.push('');
  await fs.writeFile(path.join(outDir, 'OPEN_IN_VSCODE.md'), `${openLinksLines.join('\n')}\n`, 'utf8');

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        outDir: path.relative(repoRoot, outDir).replace(/\\/g, '/'),
        totalQuestions: reviewRows.length,
        evidenceImagesCopied: args.copyEvidence,
        copiedCount,
        copyErrorCount
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
