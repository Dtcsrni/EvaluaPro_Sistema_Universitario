import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';

type HumanReview = {
  promptApproved: boolean | null;
  promptCorrection: string | null;
  optionsApproved: boolean | null;
  optionsCorrection: Record<'A' | 'B' | 'C' | 'D' | 'E', string | null>;
  correctOptionApproved: boolean | null;
  correctOptionCorrection: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  reviewer: string;
  reviewedAt: string;
  notes: string;
};

type ReviewTemplateQuestion = {
  numeroPregunta: number;
  humanReview: HumanReview;
};

type ReviewTemplate = {
  generatedAt?: string;
  status?: string;
  questions: ReviewTemplateQuestion[];
  [key: string]: unknown;
};

type ReviewPacket = {
  questions: Array<{
    numeroPregunta: number;
    pagina: number;
    canonical: {
      prompt: string;
      options: Record<'A' | 'B' | 'C' | 'D' | 'E', string>;
      correctOption: 'A' | 'B' | 'C' | 'D' | 'E';
    };
    imagenPrimaria?: {
      captureId?: string;
      imagePath?: string;
      vscodeUri?: string | null;
    } | null;
    imagenesRespaldo?: Array<{
      captureId?: string;
      imagePath?: string;
      vscodeUri?: string | null;
    }>;
    visualEvidence?: Array<{
      captureId?: string;
      imagePath?: string;
      vscodeUri?: string | null;
    }>;
  }>;
};

type ParsedArgs = {
  packetPath: string;
  templatePath: string;
  host: string;
  port: number;
  checkOnly: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    packetPath: '../../reports/qa/latest/por_folio_human_review/review_packet.json',
    templatePath: '../../reports/qa/latest/por_folio_human_review/review_template.json',
    host: '127.0.0.1',
    port: 4310,
    checkOnly: false
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if ((key === '--packet' || key === '-p') && value) {
      out.packetPath = value;
      i += 1;
      continue;
    }
    if ((key === '--template' || key === '-t') && value) {
      out.templatePath = value;
      i += 1;
      continue;
    }
    if ((key === '--host' || key === '-h') && value) {
      out.host = value;
      i += 1;
      continue;
    }
    if ((key === '--port' || key === '-P') && value) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) out.port = parsed;
      i += 1;
      continue;
    }
    if (key === '--check') {
      out.checkOnly = true;
    }
  }
  return out;
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
  for (let i = 0; i < 10; i += 1) {
    if (await pathExists(path.join(current, 'apps'))) return current;
    const nestedRepo = path.join(current, 'sistema-evaluacion-universitaria');
    if (await pathExists(path.join(nestedRepo, 'apps'))) return nestedRepo;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`No se pudo detectar raiz del repositorio desde ${startDir}`);
}

function resolveFromRoot(repoRoot: string, targetPath: string) {
  if (path.isAbsolute(targetPath)) return path.resolve(targetPath);
  return path.resolve(repoRoot, targetPath.replace(/^(\.\.\/)+/, ''));
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

function triState(value: unknown): boolean | null {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

function textOrNull(value: unknown): string | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function textOrEmpty(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeHumanReview(raw: unknown): HumanReview {
  const source = (raw ?? {}) as Record<string, unknown>;
  const correction = (source.optionsCorrection ?? {}) as Record<string, unknown>;
  const correctOption = textOrNull(source.correctOptionCorrection);
  const validCorrect = ['A', 'B', 'C', 'D', 'E'].includes(String(correctOption))
    ? (correctOption as 'A' | 'B' | 'C' | 'D' | 'E')
    : null;

  return {
    promptApproved: triState(source.promptApproved),
    promptCorrection: textOrNull(source.promptCorrection),
    optionsApproved: triState(source.optionsApproved),
    optionsCorrection: {
      A: textOrNull(correction.A),
      B: textOrNull(correction.B),
      C: textOrNull(correction.C),
      D: textOrNull(correction.D),
      E: textOrNull(correction.E)
    },
    correctOptionApproved: triState(source.correctOptionApproved),
    correctOptionCorrection: validCorrect,
    reviewer: textOrEmpty(source.reviewer),
    reviewedAt: textOrEmpty(source.reviewedAt),
    notes: textOrEmpty(source.notes)
  };
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  const body = `${JSON.stringify(payload)}\n`;
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(body);
}

function sendText(res: ServerResponse, status: number, contentType: string, text: string) {
  res.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store'
  });
  res.end(text);
}

function inferMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  if (ext === '.tif' || ext === '.tiff') return 'image/tiff';
  return 'application/octet-stream';
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const size = chunks.reduce((acc, b) => acc + b.byteLength, 0);
    if (size > 2 * 1024 * 1024) throw new Error('Body demasiado grande');
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return parsed as Record<string, unknown>;
}

async function writeTemplate(filePath: string, template: ReviewTemplate) {
  await fs.writeFile(filePath, `${JSON.stringify(template, null, 2)}\n`, 'utf8');
}

type LoadedState = {
  packet: ReviewPacket;
  template: ReviewTemplate;
  stateVersion: string;
};

async function loadState(packetPath: string, templatePath: string): Promise<LoadedState> {
  const [packet, template, packetStat, templateStat] = await Promise.all([
    readJson<ReviewPacket>(packetPath),
    readJson<ReviewTemplate>(templatePath),
    fs.stat(packetPath),
    fs.stat(templatePath)
  ]);
  if (!Array.isArray(packet.questions)) packet.questions = [];
  if (!Array.isArray(template.questions)) template.questions = [];
  const stateVersion = [
    `p:${packetStat.mtimeMs.toFixed(0)}:${packetStat.size}`,
    `t:${templateStat.mtimeMs.toFixed(0)}:${templateStat.size}`
  ].join('|');
  return { packet, template, stateVersion };
}

async function main() {
  const args = parseArgs(process.argv);
  const repoRoot = await findRepoRoot(process.cwd());
  const packetPath = resolveFromRoot(repoRoot, args.packetPath);
  const templatePath = resolveFromRoot(repoRoot, args.templatePath);
  const uiPath = fileURLToPath(new URL('./omr-tv3-human-review-ui.html', import.meta.url));

  if (!(await pathExists(packetPath))) {
    throw new Error(`No existe packet: ${packetPath}`);
  }
  if (!(await pathExists(templatePath))) {
    throw new Error(`No existe template: ${templatePath}`);
  }
  if (!(await pathExists(uiPath))) {
    throw new Error(`No existe HTML UI: ${uiPath}`);
  }

  const initialState = await loadState(packetPath, templatePath);

  if (args.checkOnly) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          checkOnly: true,
          packetPath: path.relative(repoRoot, packetPath).replace(/\\/g, '/'),
          templatePath: path.relative(repoRoot, templatePath).replace(/\\/g, '/'),
          totalPacketQuestions: initialState.packet.questions.length,
          totalTemplateQuestions: initialState.template.questions.length
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const server = createServer(async (req, res) => {
    try {
      if (!req.url || !req.method) {
        sendJson(res, 400, { error: 'request invalido' });
        return;
      }

      const origin = `http://${args.host}:${args.port}`;
      const url = new URL(req.url, origin);
      const method = req.method.toUpperCase();

      if (method === 'GET' && url.pathname === '/') {
        const uiHtml = await fs.readFile(uiPath, 'utf8');
        sendText(res, 200, 'text/html; charset=utf-8', uiHtml);
        return;
      }

      if (method === 'GET' && url.pathname === '/api/state') {
        const state = await loadState(packetPath, templatePath);
        sendJson(res, 200, {
          packetPath: path.relative(repoRoot, packetPath).replace(/\\/g, '/'),
          templatePath: path.relative(repoRoot, templatePath).replace(/\\/g, '/'),
          stateVersion: state.stateVersion,
          packet: state.packet,
          template: state.template
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/image') {
        const rawPath = String(url.searchParams.get('path') ?? '');
        if (!rawPath.trim()) {
          sendJson(res, 400, { error: 'path requerido' });
          return;
        }
        const absolute = path.resolve(rawPath);
        const safeRoot = path.resolve(repoRoot).toLowerCase();
        const safeTarget = absolute.toLowerCase();
        if (!safeTarget.startsWith(safeRoot)) {
          sendJson(res, 400, { error: 'Ruta fuera de la raiz del repositorio' });
          return;
        }
        if (!(await pathExists(absolute))) {
          sendJson(res, 404, { error: 'Imagen no encontrada' });
          return;
        }
        const fileBuffer = await fs.readFile(absolute);
        res.writeHead(200, {
          'content-type': inferMimeType(absolute),
          'cache-control': 'no-store'
        });
        res.end(fileBuffer);
        return;
      }

      const reviewMatch = /^\/api\/review\/(\d+)$/.exec(url.pathname);
      if (method === 'POST' && reviewMatch) {
        const numeroPregunta = Number(reviewMatch[1]);
        if (!Number.isInteger(numeroPregunta) || numeroPregunta <= 0) {
          sendJson(res, 400, { error: 'numeroPregunta invalido' });
          return;
        }
        const body = await readJsonBody(req);
        const humanReview = normalizeHumanReview(body.humanReview);
        const state = await loadState(packetPath, templatePath);
        const template = state.template;
        let row = template.questions.find((item) => Number(item.numeroPregunta) === numeroPregunta);
        if (!row) {
          row = { numeroPregunta, humanReview };
          template.questions.push(row);
        } else {
          row.humanReview = humanReview;
        }
        template.questions.sort((a, b) => a.numeroPregunta - b.numeroPregunta);
        template.generatedAt = new Date().toISOString();
        await writeTemplate(templatePath, template);
        const refreshed = await loadState(packetPath, templatePath);
        sendJson(res, 200, { ok: true, numeroPregunta, humanReview, stateVersion: refreshed.stateVersion });
        return;
      }

      sendJson(res, 404, { error: 'Ruta no encontrada' });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  server.listen(args.port, args.host, () => {
    const packetRel = path.relative(repoRoot, packetPath).replace(/\\/g, '/');
    const templateRel = path.relative(repoRoot, templatePath).replace(/\\/g, '/');
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          url: `http://${args.host}:${args.port}`,
          packet: packetRel,
          template: templateRel
        },
        null,
        2
      )}\n`
    );
  });
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});
