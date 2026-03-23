/**
 * workspace-hygiene
 *
 * Responsabilidad: Inspeccionar el workspace local y reportar mezcla de
 * código activo con artefactos regenerables o temporales.
 * Limites: No modifica el árbol; solo diagnostica y puede fallar en modo estricto.
 */
import { execFile as execFileCallback } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const repoRoot = process.cwd();
const strict = process.argv.includes('--strict');
const json = process.argv.includes('--json');
const qaManifestPath = 'reports/qa/latest/manifest.json';

const artefactosRegenerables = [
  { path: 'dist', allowTracked: ['dist/installer/'] },
  { path: 'reports', allowTracked: ['reports/release/', 'reports/plantillas/', qaManifestPath] },
  { path: 'logs', allowTracked: [] },
  { path: 'test-results', allowTracked: [] },
  {
    path: 'omr_samples_tv3',
    allowTracked: [
      'omr_samples_tv3/manifest.json',
      'omr_samples_tv3/answer_key.json',
      'omr_samples_tv3/ground_truth.jsonl',
      'omr_samples_tv3/quality_tags.json',
      'omr_samples_tv3/images.zip',
      'omr_samples_tv3/images/',
      'omr_samples_tv3/maps/'
    ]
  },
  { path: 'omr_samples_tv3_real_por_folio', allowTracked: ['omr_samples_tv3_real_por_folio/'] },
  { path: 'omr_samples_tv3_real_manual_min', allowTracked: ['omr_samples_tv3_real_manual_min/'] },
  { path: 'omr_samples_tv4', allowTracked: ['omr_samples_tv4/'] },
  { path: 'omr_samples_tv4_pilot_real', allowTracked: ['omr_samples_tv4_pilot_real/'] }
];

const archivosTemporales = ['lint_output.txt', 'tmp_missing_dirs.txt'];

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function bytesToMb(value) {
  return Math.round((value / (1024 * 1024)) * 100) / 100;
}

function isAllowedTracked(relativePath, allowTracked) {
  return allowTracked.some((prefix) => relativePath === prefix.replace(/\/$/, '') || relativePath.startsWith(prefix));
}

async function getGitTrackedFiles() {
  try {
    const { stdout } = await execFile('git', ['ls-files'], { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 });
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(toPosix);
  } catch {
    return [];
  }
}

async function safeStat(targetPath) {
  try {
    return await fs.stat(targetPath);
  } catch {
    return null;
  }
}

async function loadQaManifestAllowTracked() {
  try {
    const manifestRaw = await fs.readFile(path.join(repoRoot, qaManifestPath), 'utf8');
    const manifest = JSON.parse(manifestRaw);
    const artefactos = Array.isArray(manifest?.artefactos) ? manifest.artefactos : [];
    return artefactos
      .map((item) => toPosix(String(item?.archivo ?? '').trim()))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function measureDirectory(rootPath) {
  const stat = await safeStat(rootPath);
  if (!stat?.isDirectory()) {
    return { exists: false, bytes: 0, files: 0 };
  }

  let bytes = 0;
  let files = 0;
  const queue = [rootPath];
  while (queue.length) {
    const current = queue.pop();
    if (!current) continue;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolute);
        continue;
      }
      const entryStat = await safeStat(absolute);
      if (!entryStat?.isFile()) continue;
      bytes += entryStat.size;
      files += 1;
    }
  }

  return { exists: true, bytes, files };
}

async function main() {
  const qaManifestAllowTracked = await loadQaManifestAllowTracked();
  const buckets = artefactosRegenerables.map((bucket) =>
    bucket.path === 'reports'
      ? { ...bucket, allowTracked: [...bucket.allowTracked, ...qaManifestAllowTracked] }
      : bucket
  );
  const trackedFilesRaw = await getGitTrackedFiles();
  const trackedFileEntries = await Promise.all(
    trackedFilesRaw.map(async (file) => ({
      file,
      exists: Boolean(await safeStat(path.join(repoRoot, file)))
    }))
  );
  const trackedFiles = trackedFileEntries.filter((entry) => entry.exists).map((entry) => entry.file);
  const trackedByBucket = buckets.map((bucket) => {
    const tracked = trackedFiles.filter((file) => file === bucket.path || file.startsWith(`${bucket.path}/`));
    const unexpectedTracked = tracked.filter((file) => !isAllowedTracked(file, bucket.allowTracked));
    return { bucket, tracked, unexpectedTracked };
  });

  const bucketReports = await Promise.all(
    buckets.map(async (bucket) => {
      const absolute = path.join(repoRoot, bucket.path);
      const measure = await measureDirectory(absolute);
      return {
        path: bucket.path,
        exists: measure.exists,
        files: measure.files,
        sizeMb: bytesToMb(measure.bytes)
      };
    })
  );

  const tempFiles = await Promise.all(
    archivosTemporales.map(async (file) => ({
      path: file,
      exists: Boolean(await safeStat(path.join(repoRoot, file)))
    }))
  );

  const problemas = [
    ...trackedByBucket.flatMap(({ bucket, unexpectedTracked }) =>
      unexpectedTracked.map((tracked) => ({
        type: 'tracked-regenerable',
        bucket: bucket.path,
        path: tracked,
        message: `Archivo versionado dentro de artefacto regenerable: ${tracked}`
      }))
    ),
    ...tempFiles
      .filter((item) => item.exists)
      .map((item) => ({
        type: 'temp-file',
        bucket: 'root',
        path: item.path,
        message: `Archivo temporal detectado en raíz: ${item.path}`
      }))
  ];

  const payload = {
    generatedAt: new Date().toISOString(),
    strict,
    ok: problemas.length === 0,
    summary: {
      regenerableBuckets: bucketReports,
      tempFiles
    },
    problems: problemas
  };

  if (json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write('Workspace hygiene report\n');
    for (const bucket of bucketReports) {
      const status = bucket.exists ? `${bucket.files} archivos / ${bucket.sizeMb} MB` : 'ausente';
      process.stdout.write(`- ${bucket.path}: ${status}\n`);
    }
    for (const temp of tempFiles) {
      if (temp.exists) process.stdout.write(`- temporal detectado: ${temp.path}\n`);
    }
    if (problemas.length === 0) {
      process.stdout.write('- sin problemas bloqueantes de higiene\n');
    } else {
      for (const problem of problemas) {
        process.stdout.write(`- problema: ${problem.message}\n`);
      }
    }
  }

  if (strict && problemas.length > 0) {
    process.exitCode = 1;
  }
}

await main();
