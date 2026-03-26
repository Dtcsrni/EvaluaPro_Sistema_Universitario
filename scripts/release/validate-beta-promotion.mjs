#!/usr/bin/env node
/**
 * validate-beta-promotion
 *
 * Responsabilidad: decidir si un corte merece publicacion beta automatica.
 * Limites: clasifica alcance y prepara evidencia; no publica artefactos por si mismo.
 */
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function normalizeVersion(version) {
  const raw = String(version || '').trim().replace(/^v/i, '');
  const match = raw.match(/^(\d+\.\d+\.\d+)/);
  return match ? match[1] : raw;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function runGit(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git fallo (${args.join(' ')}): ${result.stderr || result.stdout}`);
  }
  return String(result.stdout || '').trim();
}

function readPackageVersion() {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return normalizeVersion(pkg?.version || '');
}

function isGeneratedOrDocsPath(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  return (
    normalized.startsWith('docs/') ||
    normalized.startsWith('reports/') ||
    normalized.startsWith('test-results/') ||
    normalized.startsWith('dist/') ||
    normalized === 'CHANGELOG.md' ||
    normalized === 'README.md'
  );
}

function isReleaseRelevantPath(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  return (
    normalized.startsWith('apps/') ||
    normalized.startsWith('scripts/') ||
    normalized.startsWith('ci/') ||
    normalized.startsWith('config/') ||
    normalized.startsWith('packaging/') ||
    normalized.startsWith('.github/workflows/') ||
    normalized === 'package.json' ||
    normalized === 'package-lock.json'
  );
}

export function classifyBetaScope(changedFiles = []) {
  const normalizedFiles = Array.from(
    new Set(
      changedFiles
        .map((file) => String(file || '').trim().replace(/\\/g, '/'))
        .filter(Boolean)
    )
  );

  const significantFiles = normalizedFiles.filter((file) => !isGeneratedOrDocsPath(file));
  const releaseRelevantFiles = significantFiles.filter((file) => isReleaseRelevantPath(file));
  const docsOnly = normalizedFiles.length > 0 && significantFiles.length === 0;
  const hasChanges = normalizedFiles.length > 0;
  const meaningfulReleaseChange = releaseRelevantFiles.length > 0;

  return {
    hasChanges,
    significant: meaningfulReleaseChange,
    docsOnly,
    changedFiles: normalizedFiles,
    significantFiles,
    releaseRelevantFiles
  };
}

export function resolveNextBetaVersion(baseVersion, existingTags = []) {
  const normalizedBase = normalizeVersion(baseVersion);
  const betaRegex = new RegExp(`^v?${escapeRegex(normalizedBase)}-beta\\.(\\d+)$`, 'i');
  let maxSuffix = 0;
  for (const tag of existingTags) {
    const match = String(tag || '').trim().match(betaRegex);
    if (!match) continue;
    maxSuffix = Math.max(maxSuffix, Number(match[1] || 0));
  }
  const nextSuffix = maxSuffix + 1;
  return {
    baseVersion: normalizedBase,
    betaVersion: `${normalizedBase}-beta.${nextSuffix}`,
    tagName: `v${normalizedBase}-beta.${nextSuffix}`
  };
}

function resolveBaseRef(headSha) {
  const sha = String(headSha || '').trim();
  if (!sha) return '';

  try {
    const candidate = runGit(['describe', '--tags', '--abbrev=0', '--match', 'v*', sha]);
    if (candidate) return candidate;
  } catch {
    // ignore and use fallback below
  }

  try {
    const tags = runGit(['tag', '--list', 'v*', '--sort=-creatordate']);
    const first = tags
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (first) return first;
  } catch {
    // ignore and use empty fallback
  }

  return '';
}

function resolveChangedFiles(baseRef, headSha) {
  const sha = String(headSha || '').trim() || 'HEAD';
  const ref = String(baseRef || '').trim();
  if (ref) {
    try {
      const diff = runGit(['diff', '--name-only', `${ref}..${sha}`]);
      return diff
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    } catch {
      // fall through
    }
  }

  try {
    const parent = runGit(['rev-parse', `${sha}^`]);
    const diff = runGit(['diff', '--name-only', `${parent}..${sha}`]);
    return diff
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    const files = runGit(['ls-files']);
    return files
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
}

async function writeJson(ruta, payload) {
  await fsPromises.mkdir(path.dirname(ruta), { recursive: true });
  await fsPromises.writeFile(ruta, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function writeText(ruta, contenido) {
  await fsPromises.mkdir(path.dirname(ruta), { recursive: true });
  await fsPromises.writeFile(ruta, `${contenido}\n`, 'utf8');
}

export function buildBetaNotes(report) {
  const significantList = Array.isArray(report.releaseRelevantFiles) ? report.releaseRelevantFiles : [];
  const changedList = Array.isArray(report.changedFiles) ? report.changedFiles : [];
  const lines = [
    `# Beta Release Notes ${report.betaVersion}`,
    '',
    `- Version base: ${report.baseVersion}`,
    `- Tag: ${report.tagName}`,
    `- Base ref: ${report.baseRef || 'N/A'}`,
    `- Head SHA: ${report.headSha || 'N/A'}`,
    `- Decision: ${report.decision}`,
    `- Motivo: ${report.reason}`,
    `- Motivo tecnico: ${report.scopeReason}`,
    `- Cambios detectados: ${changedList.length}`,
    `- Cambios relevantes beta: ${significantList.length}`,
    '',
    '## Superficies relevantes',
    ...(significantList.length > 0
      ? significantList.map((file) => `- ${file}`)
      : ['- Ninguna superficie de release relevante detectada.']),
    '',
    '## Archivos detectados',
    ...(changedList.length > 0
      ? changedList.map((file) => `- ${file}`)
      : ['- Sin cambios detectables desde la referencia base.'])
  ];
  return lines.join('\n');
}

export function buildBetaDiffSummary(report) {
  const changedFiles = Array.isArray(report.changedFiles) ? report.changedFiles : [];
  const significantFiles = Array.isArray(report.significantFiles) ? report.significantFiles : [];
  const releaseRelevantFiles = Array.isArray(report.releaseRelevantFiles) ? report.releaseRelevantFiles : [];

  return {
    schemaVersion: 1,
    betaVersion: report.betaVersion,
    baseVersion: report.baseVersion,
    tagName: report.tagName,
    baseRef: report.baseRef || '',
    headSha: report.headSha || '',
    decision: report.decision,
    reason: report.reason,
    scopeReason: report.scopeReason,
    counts: {
      changedFiles: changedFiles.length,
      significantFiles: significantFiles.length,
      releaseRelevantFiles: releaseRelevantFiles.length
    },
    files: {
      changed: changedFiles,
      significant: significantFiles,
      releaseRelevant: releaseRelevantFiles
    },
    generatedAt: report.timestamp || new Date().toISOString()
  };
}

export async function evaluateBetaPromotion(options) {
  const baseVersion = normalizeVersion(options.version || readPackageVersion());
  const headSha = String(options.headSha || process.env.GITHUB_SHA || 'HEAD').trim();
  const baseRef = String(options.baseRef || '').trim() || resolveBaseRef(headSha);
  const reason = String(options.reason || process.env.RELEASE_BETA_REASON || '').trim();
  const existingTags = Array.isArray(options.existingTags)
    ? options.existingTags
    : (() => {
        try {
          return runGit(['tag', '--list', `v${baseVersion}-beta.*`])
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        } catch {
          return [];
        }
      })();
  const versionInfo = resolveNextBetaVersion(baseVersion, existingTags);
  const changedFiles = resolveChangedFiles(baseRef, headSha);
  const scope = classifyBetaScope(changedFiles);
  const scopeReason = !scope.hasChanges
    ? 'No hay cambios detectables desde la referencia base.'
    : scope.significant
      ? 'El diff incluye cambios funcionales o de contrato relevantes para beta.'
      : 'El diff no toca superficies de release relevantes; no amerita beta automatica.';
  const releaseReason = reason || scopeReason;
  const decision = scope.significant ? 'Go' : 'No-Go';

  return {
    timestamp: new Date().toISOString(),
    baseVersion,
    betaVersion: versionInfo.betaVersion,
    tagName: versionInfo.tagName,
    baseRef,
    headSha,
    decision,
    reason: releaseReason,
    scopeReason,
    significant: scope.significant,
    hasChanges: scope.hasChanges,
    docsOnly: scope.docsOnly,
    changedFiles: scope.changedFiles,
    significantFiles: scope.significantFiles,
    releaseRelevantFiles: scope.releaseRelevantFiles
  };
}

export async function main() {
  const version = getArg('version', '');
  const baseRefArg = getArg('base-ref', '');
  const headSha = getArg('head-sha', process.env.GITHUB_SHA || 'HEAD');
  const reportDirArg = getArg('report-dir', '');
  const reportDir = reportDirArg
    ? path.resolve(process.cwd(), reportDirArg)
    : path.resolve(process.cwd(), 'reports', 'release', 'beta');

  const result = await evaluateBetaPromotion({
    version,
    baseRef: baseRefArg,
    headSha,
    reason: getArg('reason', process.env.RELEASE_BETA_REASON || '')
  });

  const decisionPath = path.join(reportDir, result.betaVersion, 'decision.json');
  const report = {
    ...result,
    decisionPath
  };
  const notesPath = path.join(reportDir, result.betaVersion, 'notes.md');
  const diffSummaryPath = path.join(reportDir, result.betaVersion, 'diff-summary.json');
  const notes = buildBetaNotes(report);
  const diffSummary = buildBetaDiffSummary(report);
  report.notesPath = notesPath;
  report.notesBody = notes;
  report.diffSummaryPath = diffSummaryPath;

  await writeJson(decisionPath, report);
  await writeText(notesPath, notes);
  await writeJson(diffSummaryPath, diffSummary);
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.stdout.write(`[release:beta] Evidencia escrita en ${decisionPath}\n`);

  if (report.decision !== 'Go') {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[release:beta] ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
