/**
 * ia-handoff
 *
 * Responsabilidad: Generar handoff IA en formato canonico JSON y reporte Markdown legible.
 * Limites: No implementar trazabilidad dependiente de proveedor ni persistir prompts completos o salidas crudas extensas.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeTraceInput, renderTraceMarkdown, validateTraceDocument } from './ia-traceability.mjs';

const exec = promisify(execCb);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export const HANDOFF_CHECKS = [
  { name: 'lint', command: 'npm run lint', level: 'full' },
  { name: 'typecheck', command: 'npm run typecheck', level: 'full' },
  { name: 'test_frontend_ci', command: 'npm run test:frontend:ci', level: 'full' },
  { name: 'test_coverage_ci', command: 'npm run test:coverage:ci', level: 'full' },
  { name: 'test_tdd_enforcement_ci', command: 'npm run test:tdd:enforcement:ci', level: 'full' },
  { name: 'test_backend_ci', command: 'npm run test:backend:ci', level: 'full' },
  { name: 'test_portal_ci', command: 'npm run test:portal:ci', level: 'full' },
  { name: 'perf_check', command: 'npm run perf:check', level: 'full' },
  { name: 'pipeline_contract_check', command: 'npm run pipeline:contract:check', level: 'quick' },
  { name: 'docs_check', command: 'npm run docs:check', level: 'quick' }
];

function getArg(argv, flag) {
  const prefix = `${flag}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length).trim();
  }
  const idx = argv.indexOf(flag);
  if (idx === -1) {
    return null;
  }
  return argv[idx + 1] ?? null;
}

function normalizeMode(value) {
  return value === 'full' ? 'full' : 'quick';
}

function normalizeSessionId(value, fallback) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

function compactOutput(stdout, stderr) {
  const text = `${stdout ?? ''}\n${stderr ?? ''}`.trim();
  if (!text) {
    return '(sin salida)';
  }
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 6) {
    return lines.join(' | ');
  }
  return `${lines.slice(0, 4).join(' | ')} | ... | ${lines.slice(-2).join(' | ')}`;
}

function parseChangedFiles(statusText) {
  return statusText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith('?? ')) {
        return line.slice(3).trim();
      }
      return line.slice(2).trim();
    })
    .filter(Boolean);
}

async function runShell(command, context = {}) {
  const cwd = typeof context === 'string' ? context : context.cwd;
  const result = await exec(command, {
    cwd,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: 0
  };
}

async function readCommandOutput(command, cwd) {
  try {
    const result = await runShell(command, cwd);
    return (result.stdout || '').trim();
  } catch (error) {
    const stdout = String(error?.stdout ?? '').trim();
    const stderr = String(error?.stderr ?? '').trim();
    const summary = [stdout, stderr].filter(Boolean).join('\n');
    return summary || `ERROR: ${String(error?.message || error)}`;
  }
}

export async function collectRuntimeContext(currentRootDir = rootDir) {
  const branch = await readCommandOutput('git rev-parse --abbrev-ref HEAD', currentRootDir);
  const commit = await readCommandOutput('git rev-parse --short HEAD', currentRootDir);
  const workingTreeStatus = await readCommandOutput('git status --short', currentRootDir);
  return {
    rootDir: currentRootDir,
    branch: branch || 'unknown',
    commit: commit || 'unknown',
    workingTreeStatus,
    changedFiles: parseChangedFiles(workingTreeStatus)
  };
}

export async function executeChecks({ mode, checks = HANDOFF_CHECKS, cwd = rootDir, runner = runShell }) {
  const results = [];
  for (const check of checks) {
    if (mode === 'quick' && check.level !== 'quick') {
      results.push({
        name: check.name,
        command: check.command,
        status: 'omitido',
        exitCode: null,
        durationMs: 0,
        resultSummary: 'omitido por perfil quick'
      });
      continue;
    }

    const start = Date.now();
    try {
      const result = await runner(check.command, { cwd, check });
      results.push({
        name: check.name,
        command: check.command,
        status: 'ok',
        exitCode: Number.isInteger(result?.exitCode) ? result.exitCode : 0,
        durationMs: Date.now() - start,
        resultSummary: compactOutput(result?.stdout, result?.stderr)
      });
    } catch (error) {
      results.push({
        name: check.name,
        command: check.command,
        status: 'falla',
        exitCode: Number.isInteger(error?.exitCode) ? error.exitCode : Number.isFinite(Number(error?.code)) ? Number(error.code) : 1,
        durationMs: Date.now() - start,
        resultSummary: compactOutput(error?.stdout, error?.stderr || error?.message)
      });
    }
  }
  return results;
}

async function readInputTrace(inputPath, currentRootDir) {
  if (!inputPath) {
    return {};
  }
  const resolvedPath = path.isAbsolute(inputPath) ? inputPath : path.join(currentRootDir, inputPath);
  const raw = await fs.readFile(resolvedPath, 'utf8');
  return JSON.parse(raw);
}

export async function generateHandoffReport(options = {}) {
  const currentRootDir = options.rootDir || rootDir;
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const nowIso = now.toISOString();
  const mode = normalizeMode(options.mode);
  const fallbackSessionId = `sesion-${nowIso.replaceAll(':', '-')}`;
  const sessionId = normalizeSessionId(options.sessionId, fallbackSessionId);
  const dateFolder = nowIso.slice(0, 10);
  const outputDir = options.outputDir
    ? path.resolve(currentRootDir, options.outputDir)
    : path.join(currentRootDir, 'docs', 'handoff', 'sesiones', dateFolder);

  const inputTrace = options.inputTrace ?? (await readInputTrace(options.inputPath, currentRootDir));
  const runtimeContext = options.runtimeContext ?? (await collectRuntimeContext(currentRootDir));
  const commands = options.commands ?? (await executeChecks({
    mode,
    checks: options.checks || HANDOFF_CHECKS,
    cwd: currentRootDir,
    runner: options.runner || runShell
  }));

  await fs.mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `${sessionId}.json`);
  const markdownPath = path.join(outputDir, `${sessionId}.md`);
  const relativeJsonPath = path.relative(currentRootDir, jsonPath).replace(/\\/g, '/');
  const relativeMarkdownPath = path.relative(currentRootDir, markdownPath).replace(/\\/g, '/');

  const trace = normalizeTraceInput(inputTrace, {
    nowIso,
    sessionId,
    validationProfile: mode,
    outputs: [relativeJsonPath, relativeMarkdownPath],
    changedFiles: runtimeContext.changedFiles,
    commands,
    repo: runtimeContext
  });
  validateTraceDocument(trace);

  const markdown = renderTraceMarkdown(trace);
  await fs.writeFile(jsonPath, `${JSON.stringify(trace, null, 2)}\n`, 'utf8');
  await fs.writeFile(markdownPath, `${markdown}\n`, 'utf8');

  return {
    trace,
    markdown,
    jsonPath,
    markdownPath
  };
}

export async function main() {
  const args = process.argv.slice(2);
  const mode = normalizeMode(getArg(args, '--mode') ?? 'quick');
  const sessionId = getArg(args, '--session');
  const inputPath = getArg(args, '--input');
  const outputDir = getArg(args, '--output-dir');

  const result = await generateHandoffReport({
    mode,
    sessionId,
    inputPath,
    outputDir
  });

  const jsonRel = path.relative(rootDir, result.jsonPath).replace(/\\/g, '/');
  const markdownRel = path.relative(rootDir, result.markdownPath).replace(/\\/g, '/');
  console.log(`[ia-handoff] json: ${jsonRel}`);
  console.log(`[ia-handoff] markdown: ${markdownRel}`);
  console.log(`[ia-handoff] status: ${result.trace.status}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[ia-handoff] error: ${String(error?.message || error)}`);
    process.exit(1);
  });
}
