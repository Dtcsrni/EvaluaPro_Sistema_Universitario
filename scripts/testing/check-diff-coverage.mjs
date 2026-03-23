import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFile = promisify(execFileCb);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const APPS = [
  {
    name: 'backend',
    root: 'apps/backend',
    scope: 'apps/backend/src',
    lcov: 'apps/backend/coverage/lcov.info'
  },
  {
    name: 'frontend',
    root: 'apps/frontend',
    scope: 'apps/frontend/src',
    lcov: 'apps/frontend/coverage/lcov.info'
  },
  {
    name: 'portal',
    root: 'apps/portal_alumno_cloud',
    scope: 'apps/portal_alumno_cloud/src',
    lcov: 'apps/portal_alumno_cloud/coverage/lcov.info'
  }
];

const COVERABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

function resolveSelectedApps() {
  const raw = getArg('--apps') ?? process.env.DIFF_COVERAGE_APPS ?? '';
  const requested = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (requested.length === 0) return APPS;

  const selected = APPS.filter((app) => requested.includes(app.name));
  if (selected.length === 0) {
    throw new Error(`No hay apps válidas para diff coverage en "${raw}". Opciones: ${APPS.map((app) => app.name).join(', ')}`);
  }
  return selected;
}

function normalizeRelative(inputPath) {
  const normalized = inputPath.replace(/\\/g, '/');
  if (/^[a-zA-Z]:\//.test(normalized)) {
    const absolute = path.resolve(normalized);
    const relative = path.relative(rootDir, absolute).replace(/\\/g, '/');
    return relative;
  }
  if (normalized.startsWith('/')) {
    const fromRoot = path.relative(rootDir, normalized).replace(/\\/g, '/');
    if (!fromRoot.startsWith('..')) return fromRoot;
  }
  return normalized.replace(/^\.\//, '');
}

function isCoverableFile(filePath) {
  const ext = path.extname(normalizeRelative(filePath)).toLowerCase();
  return COVERABLE_EXTENSIONS.has(ext);
}

async function runGitDiff(baseRef, headRef, apps) {
  const scopes = apps.map((app) => app.scope);

  try {
    const { stdout } = await execFile(
      'git',
      ['diff', '--unified=0', '--no-color', `${baseRef}...${headRef}`, '--', ...scopes],
      { cwd: rootDir, windowsHide: true, maxBuffer: 20 * 1024 * 1024 }
    );
    return stdout;
  } catch (error) {
    const stderr = String(error?.stderr ?? '');
    const isNoMergeBase = /no merge base/i.test(stderr);

    if (!isNoMergeBase) {
      throw error;
    }

    console.warn(
      `[diff-coverage] Advertencia: sin merge-base entre ${baseRef} y ${headRef}. Se usa fallback ${baseRef}..${headRef}.`
    );

    const { stdout } = await execFile(
      'git',
      ['diff', '--unified=0', '--no-color', `${baseRef}..${headRef}`, '--', ...scopes],
      { cwd: rootDir, windowsHide: true, maxBuffer: 20 * 1024 * 1024 }
    );

    return stdout;
  }
}

function parseTouchedLines(diffOutput) {
  const touched = new Map();
  const lines = diffOutput.split(/\r?\n/);
  let currentFile = null;
  let currentLine = 0;

  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice('+++ b/'.length).trim();
      continue;
    }

    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      currentLine = Number(hunkMatch[1]);
      continue;
    }

    if (!currentFile || line.length === 0) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const set = touched.get(currentFile) ?? new Set();
      set.add(currentLine);
      touched.set(currentFile, set);
      currentLine += 1;
      continue;
    }
    if (line.startsWith('-') || line.startsWith('---')) {
      continue;
    }
  }

  return touched;
}

function normalizeLcovSourcePath(sourcePath, app) {
  const normalized = normalizeRelative(sourcePath);

  if (
    normalized.startsWith(`${app.scope}/`) ||
    normalized === app.scope ||
    normalized.startsWith(`${app.root}/`) ||
    normalized === app.root
  ) {
    return normalized;
  }

  return normalizeRelative(path.join(app.root, normalized));
}

function parseLcov(content, app) {
  const records = content.split('end_of_record');
  const coverageByFile = new Map();

  for (const recordRaw of records) {
    const record = recordRaw.trim();
    if (!record) continue;

    const lines = record.split(/\r?\n/);
    const sfLine = lines.find((line) => line.startsWith('SF:'));
    if (!sfLine) continue;

    const sourcePath = normalizeLcovSourcePath(sfLine.slice(3), app);
    const lineHits = new Map();

    for (const line of lines) {
      if (!line.startsWith('DA:')) continue;
      const [lineNumberRaw, hitsRaw] = line.slice(3).split(',');
      const lineNumber = Number(lineNumberRaw);
      const hits = Number(hitsRaw);
      if (!Number.isFinite(lineNumber) || !Number.isFinite(hits)) continue;
      lineHits.set(lineNumber, hits);
    }

    coverageByFile.set(sourcePath, lineHits);
  }

  return coverageByFile;
}

function appForFile(relativeFile, apps) {
  const normalized = normalizeRelative(relativeFile);
  return apps.find((app) => normalized.startsWith(`${app.scope}/`) || normalized === app.scope) ?? null;
}

function resolveRequiredApps(touched, apps) {
  const required = new Map();

  for (const file of touched.keys()) {
    if (!isCoverableFile(file)) continue;
    const app = appForFile(file, apps);
    if (app) {
      required.set(app.name, app);
    }
  }

  return [...required.values()];
}

async function loadCoverageMaps(requiredApps) {
  const merged = new Map();

  for (const app of requiredApps) {
    const lcovPath = path.join(rootDir, app.lcov);
    let content;
    try {
      content = await fs.readFile(lcovPath, 'utf8');
    } catch {
      throw new Error(`No se encontró coverage para ${app.name}: ${app.lcov}. Ejecuta npm run test:coverage:ci antes del diff coverage.`);
    }

    const map = parseLcov(content, app);
    for (const [file, lineHits] of map.entries()) {
      merged.set(file, lineHits);
    }
  }

  return merged;
}

function resolveBaseRef() {
  const explicitBase = getArg('--base');
  if (explicitBase) return explicitBase;
  const ghBase = process.env.GITHUB_BASE_REF;
  if (ghBase) return `origin/${ghBase}`;
  return 'HEAD~1';
}

function resolveHeadRef() {
  return getArg('--head') ?? 'HEAD';
}

function resolveThreshold() {
  const raw = getArg('--min') ?? process.env.DIFF_COVERAGE_MIN ?? '90';
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
    throw new Error(`Valor inválido para diff coverage mínimo: ${raw}`);
  }
  return parsed;
}

function resolveIgnoreLineSubstrings() {
  const raw = getArg('--ignore-line-substring') ?? process.env.DIFF_COVERAGE_IGNORE_LINE_SUBSTRING ?? '';
  return String(raw)
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveIgnorePathSubstrings() {
  const raw =
    getArg('--ignore-path-substrings') ??
    process.env.DIFF_COVERAGE_IGNORE_PATH_SUBSTRINGS ??
    process.env.DIFF_COVERAGE_IGNORE_PATH_SUBSTRING ??
    '';
  return String(raw)
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isStructuralOnlyLine(sourceLine) {
  return /^[\s{}()[\];,]*$/.test(sourceLine);
}

async function buildFileLinesCache(touchedCoverable) {
  const cache = new Map();
  for (const file of touchedCoverable.keys()) {
    const normalizedFile = normalizeRelative(file);
    const absolute = path.join(rootDir, normalizedFile);
    try {
      const content = await fs.readFile(absolute, 'utf8');
      cache.set(normalizedFile, content.split(/\r?\n/));
    } catch {
      cache.set(normalizedFile, []);
    }
  }
  return cache;
}

async function main() {
  const minCoverage = resolveThreshold();
  const ignoreLineSubstrings = resolveIgnoreLineSubstrings();
  const ignorePathSubstrings = resolveIgnorePathSubstrings();
  const baseRef = resolveBaseRef();
  const headRef = resolveHeadRef();
  const selectedApps = resolveSelectedApps();

  const diffOutput = await runGitDiff(baseRef, headRef, selectedApps);
  const touched = parseTouchedLines(diffOutput);

  if (touched.size === 0) {
    console.log('[diff-coverage] No hay líneas modificadas en apps/*/src; gate en no-op.');
    return;
  }

  const touchedCoverable = new Map([...touched.entries()].filter(([file]) => isCoverableFile(file)));
  if (touchedCoverable.size === 0) {
    console.log('[diff-coverage] No hay líneas modificadas en archivos instrumentables por coverage; gate en no-op.');
    return;
  }

  const requiredApps = resolveRequiredApps(touchedCoverable, selectedApps);
  if (requiredApps.length === 0) {
    console.log('[diff-coverage] No hay apps con coverage aplicable en líneas tocadas; gate en no-op.');
    return;
  }

  console.log(`[diff-coverage] Apps evaluadas: ${requiredApps.map((app) => app.name).join(', ')}`);

  const coverageMap = await loadCoverageMaps(requiredApps);
  const fileLinesCache = await buildFileLinesCache(touchedCoverable);

  let total = 0;
  let covered = 0;
  let ignored = 0;
  let ignoredByPath = 0;
  let ignoredStructural = 0;
  const missing = [];

  for (const [file, lines] of touchedCoverable.entries()) {
    const normalizedFile = normalizeRelative(file);
    if (ignorePathSubstrings.some((entry) => normalizedFile.includes(entry))) {
      ignoredByPath += lines.size;
      continue;
    }
    const lineHits = coverageMap.get(normalizedFile);

    for (const line of lines) {
      if (ignoreLineSubstrings.length > 0) {
        const sourceLine = fileLinesCache.get(normalizedFile)?.[line - 1] ?? '';
        if (ignoreLineSubstrings.some((entry) => sourceLine.includes(entry))) {
          ignored += 1;
          continue;
        }
      }

      const sourceLine = fileLinesCache.get(normalizedFile)?.[line - 1] ?? '';
      if (isStructuralOnlyLine(sourceLine)) {
        ignoredStructural += 1;
        continue;
      }

      total += 1;
      const hits = lineHits?.get(line) ?? 0;
      if (hits > 0) {
        covered += 1;
      } else {
        missing.push(`${normalizedFile}:${line}`);
      }
    }
  }

  const percent = total === 0 ? 100 : Number(((covered / total) * 100).toFixed(2));
  console.log(`[diff-coverage] Base: ${baseRef} | Head: ${headRef}`);
  if (ignoreLineSubstrings.length > 0) {
    console.log(`[diff-coverage] Líneas ignoradas por subcadena: ${ignored} (${ignoreLineSubstrings.join(';')})`);
  }
  if (ignoredStructural > 0) {
    console.log(`[diff-coverage] Líneas estructurales ignoradas: ${ignoredStructural}`);
  }
  if (ignorePathSubstrings.length > 0) {
    console.log(`[diff-coverage] Líneas ignoradas por ruta: ${ignoredByPath} (${ignorePathSubstrings.join(';')})`);
  }
  console.log(`[diff-coverage] Líneas tocadas: ${total} | Cubiertas: ${covered} | Diff coverage: ${percent}% | Umbral: ${minCoverage}%`);

  if (percent < minCoverage) {
    const sample = missing.slice(0, 80).map((entry) => `  - ${entry}`).join('\n');
    console.error('[diff-coverage] FALLO: cobertura de diff por debajo del mínimo.');
    if (sample) {
      console.error('[diff-coverage] Líneas sin cobertura (muestra):');
      console.error(sample);
    }
    process.exit(1);
  }

  console.log('[diff-coverage] OK');
}

await main();
