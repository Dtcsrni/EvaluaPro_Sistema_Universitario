/**
 * Prepare an external, lossless OMR camera dataset.
 *
 * The source images are copied byte-for-byte and are never rewritten. The
 * generated archive is a QA/training artifact; it is not part of the
 * Installer Hub payload.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

function fail(message) {
  throw new Error(message);
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function normalizePathForKey(value) {
  return String(value || '').replaceAll('\\', '/').toLowerCase();
}

function parseExifCamera(exif) {
  if (!Buffer.isBuffer(exif) || exif.length < 14) {
    return { exifBlockPresent: false, camera: null, gpsPresent: false, serialNumberPresent: false };
  }

  const marker = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
  const start = exif.indexOf(marker);
  if (start < 0 || exif.length < start + 14) {
    return { exifBlockPresent: true, camera: null, gpsPresent: false, serialNumberPresent: false };
  }

  const tiffStart = start + marker.length;
  const byteOrder = exif.toString('ascii', tiffStart, tiffStart + 2);
  const little = byteOrder === 'II';
  if (!little && byteOrder !== 'MM') {
    return { exifBlockPresent: true, camera: null, gpsPresent: false, serialNumberPresent: false };
  }
  const readU16 = (offset) => little ? exif.readUInt16LE(offset) : exif.readUInt16BE(offset);
  const readU32 = (offset) => little ? exif.readUInt32LE(offset) : exif.readUInt32BE(offset);
  const readI32 = (offset) => little ? exif.readInt32LE(offset) : exif.readInt32BE(offset);
  const readRational = (offset) => {
    const denominator = readU32(offset + 4);
    if (!denominator) return null;
    return readU32(offset) / denominator;
  };
  const readSignedRational = (offset) => {
    const denominator = readI32(offset + 4);
    if (!denominator) return null;
    return readI32(offset) / denominator;
  };

  const ifdOffset = readU32(tiffStart + 4);
  const visited = new Set();
  const values = new Map();
  let gpsPresent = false;
  let serialNumberPresent = false;

  const readValue = (entryOffset, type, count) => {
    const widths = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
    const width = widths[type];
    if (!width) return null;
    const total = width * count;
    const inline = entryOffset + 8;
    const valueOffset = total <= 4 ? inline : tiffStart + readU32(inline);
    if (valueOffset < 0 || valueOffset + total > exif.length) return null;
    if (type === 2 || type === 7) {
      return exif.toString('utf8', valueOffset, valueOffset + count).replace(/\0+$/g, '').trim();
    }
    if (type === 3) return count === 1 ? readU16(valueOffset) : Array.from({ length: count }, (_, i) => readU16(valueOffset + i * 2));
    if (type === 4) return count === 1 ? readU32(valueOffset) : Array.from({ length: count }, (_, i) => readU32(valueOffset + i * 4));
    if (type === 5) return count === 1 ? readRational(valueOffset) : Array.from({ length: count }, (_, i) => readRational(valueOffset + i * 8));
    if (type === 9) return count === 1 ? readI32(valueOffset) : Array.from({ length: count }, (_, i) => readI32(valueOffset + i * 4));
    if (type === 10) return count === 1 ? readSignedRational(valueOffset) : Array.from({ length: count }, (_, i) => readSignedRational(valueOffset + i * 8));
    return null;
  };

  const visitIfd = (relativeOffset, depth = 0) => {
    if (!relativeOffset || depth > 3 || visited.has(relativeOffset)) return;
    const offset = tiffStart + relativeOffset;
    if (offset + 2 > exif.length) return;
    visited.add(relativeOffset);
    const count = readU16(offset);
    for (let i = 0; i < count; i += 1) {
      const entryOffset = offset + 2 + i * 12;
      if (entryOffset + 12 > exif.length) break;
      const tag = readU16(entryOffset);
      const type = readU16(entryOffset + 2);
      const itemCount = readU32(entryOffset + 4);
      if (tag === 0x8825) {
        gpsPresent = true;
        const pointer = readValue(entryOffset, type, itemCount);
        if (typeof pointer === 'number') visitIfd(pointer, depth + 1);
      } else if (tag === 0x8769) {
        const pointer = readValue(entryOffset, type, itemCount);
        if (typeof pointer === 'number') visitIfd(pointer, depth + 1);
      } else {
        const value = readValue(entryOffset, type, itemCount);
        if (value !== null) values.set(tag, value);
      }
    }
    const nextOffset = offset + 2 + count * 12;
    if (nextOffset + 4 <= exif.length) {
      const next = readU32(nextOffset);
      if (next && depth === 0) visitIfd(next, depth + 1);
    }
  };

  try {
    if (readU16(tiffStart) !== 42) {
      return { exifBlockPresent: true, camera: null, gpsPresent: false, serialNumberPresent: false };
    }
    visitIfd(ifdOffset);
  } catch {
    return { exifBlockPresent: true, camera: null, gpsPresent: false, serialNumberPresent: false };
  }

  const stringValue = (...tags) => tags.map((tag) => values.get(tag)).find((value) => typeof value === 'string' && value) || null;
  const numberValue = (...tags) => tags.map((tag) => values.get(tag)).find((value) => typeof value === 'number' && Number.isFinite(value)) ?? null;
  serialNumberPresent = Boolean(stringValue(0xA431, 0xA435));
  const camera = {
    make: stringValue(0x010F),
    model: stringValue(0x0110),
    lensModel: stringValue(0xA434),
    software: stringValue(0x0131),
    focalLengthMm: numberValue(0x920A),
    fNumber: numberValue(0x829D),
    exposureTimeSeconds: numberValue(0x829A),
    iso: numberValue(0x8827),
    dateTimeOriginal: stringValue(0x9003)
  };
  if (Object.values(camera).every((value) => value === null)) return { exifBlockPresent: true, camera: null, gpsPresent, serialNumberPresent };
  return { exifBlockPresent: true, camera, gpsPresent, serialNumberPresent };
}

function getFiles(inputDir) {
  const files = fs.readdirSync(inputDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(jpe?g)$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));
  if (files.length === 0) fail(`No se encontraron imágenes JPEG en ${inputDir}.`);
  return files;
}

function loadReport(reportPath) {
  if (!reportPath) return { rows: [], reportSha256: null };
  const raw = fs.readFileSync(reportPath, 'utf8');
  const report = JSON.parse(raw);
  return { rows: Array.isArray(report.rows) ? report.rows : [], reportSha256: sha256File(reportPath) };
}

function indexReport(rows) {
  const byName = new Map();
  for (const row of rows) {
    const key = normalizePathForKey(row?.file);
    if (key) byName.set(key, row);
  }
  return byName;
}

function asLabel(row, sourceFile, mappingSource = 'none') {
  if (!row) return { available: false, mappingSource, sourceFile };
  return {
    available: true,
    mappingSource,
    sourceFile,
    folio: row.folio ?? null,
    page: row.page ?? null,
    response: row.response ?? null,
    key: row.key ?? null,
    observed: row.observed ?? null,
    responseDetails: Array.isArray(row.responseDetails) ? row.responseDetails : [],
    metrics: {
      determined: row.determined ?? null,
      ambiguous: row.ambiguous ?? null,
      blank: row.blank ?? null,
      invalid: row.invalid ?? null,
      estado: row.estado ?? null,
      calidadPagina: row.calidadPagina ?? null,
      confianzaPromedioPagina: row.confianzaPromedioPagina ?? null,
      photoQuality: row.photoQuality ?? null,
      geomQuality: row.geomQuality ?? null,
      geometryMode: row.geometryMode ?? null,
      qrDetectionMode: row.qrDetectionMode ?? null,
      flags: row.flags ?? {}
    }
  };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createArchive(stagingDir, archivePath) {
  if (process.platform !== 'win32') fail('La creación ZIP portable de este preparador requiere PowerShell en Windows; use --no-archive fuera de Windows.');
  const powershell = process.env.ComSpec ? 'powershell.exe' : 'pwsh.exe';
  const env = { ...process.env, EP_DATASET_SOURCE: stagingDir, EP_DATASET_ARCHIVE: archivePath };
  execFileSync(powershell, [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
    'Compress-Archive -Path (Join-Path $env:EP_DATASET_SOURCE "*") -DestinationPath $env:EP_DATASET_ARCHIVE -CompressionLevel Optimal -Force'
  ], { env, stdio: 'pipe' });
}

function verifyArchive(stagingDir, archivePath) {
  const verifyDir = `${stagingDir}.verify-${process.pid}-${Date.now()}`;
  try {
    const powershell = process.env.ComSpec ? 'powershell.exe' : 'pwsh.exe';
    const env = { ...process.env, EP_DATASET_ARCHIVE: archivePath, EP_DATASET_VERIFY: verifyDir };
    execFileSync(powershell, [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
      'Expand-Archive -LiteralPath $env:EP_DATASET_ARCHIVE -DestinationPath $env:EP_DATASET_VERIFY -Force'
    ], { env, stdio: 'pipe' });
    const expected = new Map();
    for (const file of getFiles(path.join(stagingDir, 'images'))) expected.set(file, sha256File(path.join(stagingDir, 'images', file)));
    const actual = new Map();
    for (const file of getFiles(path.join(verifyDir, 'images'))) actual.set(file, sha256File(path.join(verifyDir, 'images', file)));
    if (expected.size !== actual.size) fail(`Verificación ZIP incompleta: se esperaban ${expected.size} imágenes y se obtuvieron ${actual.size}.`);
    for (const [file, hash] of expected) if (actual.get(file) !== hash) fail(`Verificación ZIP falló para ${file}.`);
    return { imageCount: expected.size, hashMismatches: 0 };
  } finally {
    if (fs.existsSync(verifyDir)) fs.rmSync(verifyDir, { recursive: true, force: true });
  }
}

export async function prepareDataset({ inputDir, outputDir, reportPath = '', attachedPaths = [], archive = true }) {
  const sourceDir = path.resolve(inputDir);
  const stagingDir = path.resolve(outputDir);
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) fail(`No existe el directorio de entrada: ${sourceDir}`);
  if (fs.existsSync(stagingDir)) fail(`La salida ya existe; no se sobrescribe: ${stagingDir}`);
  fs.mkdirSync(path.join(stagingDir, 'images'), { recursive: true });
  fs.mkdirSync(path.join(stagingDir, 'source'), { recursive: true });

  let sharp;
  try {
    sharp = require('sharp');
  } catch (error) {
    fail(`No se pudo cargar sharp para leer metadatos JPEG: ${error?.message || error}`);
  }

  const files = getFiles(sourceDir);
  const { rows, reportSha256 } = loadReport(reportPath);
  const reportByName = indexReport(rows);
  const attachedByHash = new Map();
  for (const attachedPath of attachedPaths) {
    if (!attachedPath || !fs.existsSync(attachedPath)) continue;
    attachedByHash.set(sha256File(attachedPath), attachedPath);
  }

  const labels = [];
  let exifCount = 0;
  let gpsCount = 0;
  const hashes = [];
  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(stagingDir, 'images', file);
    const sourceHash = sha256File(sourcePath);
    fs.copyFileSync(sourcePath, targetPath);
    const metadata = await sharp(sourcePath).metadata();
    const cameraData = parseExifCamera(metadata.exif);
    if (cameraData.exifBlockPresent) exifCount += 1;
    if (cameraData.gpsPresent) gpsCount += 1;
    const directRow = reportByName.get(normalizePathForKey(file));
    let row = directRow;
    let mappingSource = directRow ? 'omr_report_filename' : 'none';
    const duplicateAttachment = attachedByHash.get(sourceHash) || null;
    if (!row && duplicateAttachment) {
      const duplicateName = path.basename(duplicateAttachment);
      row = reportByName.get(normalizePathForKey(duplicateName));
      if (row) mappingSource = 'duplicate_hash_match';
    }
    const rel = `images/${file}`;
    hashes.push(`${sourceHash}  ${rel}`);
    labels.push({
      schemaVersion: 1,
      captureId: `sha256:${sourceHash.slice(0, 16)}`,
      sourceFile: file,
      sourceRelativePath: rel,
      sourceSha256: sourceHash,
      sourceBytes: fs.statSync(sourcePath).size,
      cameraAttribution: file.startsWith('CamScanner ') ? 'filename:CamScanner' : 'filename:unverified',
      camera: {
        identity: cameraData.camera ? 'exif' : 'unavailable: JPEGs contain no EXIF camera block',
        exifBlockPresent: cameraData.exifBlockPresent,
        gpsPresent: cameraData.gpsPresent,
        serialNumberPresent: cameraData.serialNumberPresent,
        details: cameraData.camera
      },
      media: {
        format: metadata.format || 'jpeg',
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        density: metadata.density ?? null,
        hasIccProfile: Boolean(metadata.icc),
        orientation: metadata.orientation ?? null
      },
      duplicate: duplicateAttachment ? { matchedBy: 'sha256', externalFile: path.basename(duplicateAttachment) } : null,
      label: asLabel(row, file, mappingSource)
    });
  }

  const report = reportPath ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : null;
  const manifest = {
    schemaVersion: 1,
    datasetSchema: 'omr-camera-dataset/1',
    generatedAt: new Date().toISOString(),
    purpose: 'External OMR camera QA and labeling artifact; not an Installer Hub payload.',
    source: {
      directory: sourceDir,
      fileCount: files.length,
      sourceMutation: false,
      sourceBytes: files.reduce((total, file) => total + fs.statSync(path.join(sourceDir, file)).size, 0),
      exifFiles: exifCount,
      gpsFiles: gpsCount,
      reportPath: reportPath ? path.resolve(reportPath) : null,
      reportSha256
    },
    cameraIdentity: exifCount > 0 ? 'partial: inspect labels.jsonl camera.details' : 'unavailable: JPEGs contain no EXIF camera block',
    labeling: {
      method: reportPath ? 'OMR report supplied by the repository QA pipeline' : 'unlabeled',
      reportStats: report ? {
        processed: report.processed ?? null,
        determined: report.determined ?? null,
        ambiguous: report.ambiguous ?? null,
        blank: report.blank ?? null,
        qrDetected: report.qrDetected ?? null,
        errors: Array.isArray(report.errors) ? report.errors.length : null
      } : null
    },
    compression: { container: 'zip', algorithm: 'Deflate', lossless: true, imagesRecompressed: false },
    duplicateHandling: { attachedPaths: attachedPaths.map((item) => path.resolve(item)), matchedCount: labels.filter((item) => item.duplicate).length },
    files: { images: files.length, labels: labels.length, sha256sums: true }
  };
  writeJson(path.join(stagingDir, 'manifest.json'), manifest);
  fs.writeFileSync(path.join(stagingDir, 'labels.jsonl'), `${labels.map((item) => JSON.stringify(item)).join('\n')}\n`, 'utf8');
  fs.writeFileSync(path.join(stagingDir, 'sha256sums.txt'), `${hashes.join('\n')}\n`, 'utf8');
  writeJson(path.join(stagingDir, 'source', 'provenance.json'), {
    schemaVersion: 1,
    sourceDirectory: sourceDir,
    sourceMutation: false,
    files: files.map((file) => ({ file, sha256: sha256File(path.join(sourceDir, file)), bytes: fs.statSync(path.join(sourceDir, file)).size }))
  });
  fs.writeFileSync(path.join(stagingDir, 'README.md'), [
    '# EvaluaPro OMR camera dataset',
    '',
    'Artefacto externo para QA/etiquetado. No forma parte del ejecutable ni del payload del Installer Hub.',
    '',
    '- Las imágenes de `images/` son copias byte a byte de la fuente.',
    '- `labels.jsonl` contiene metadatos de cámara disponibles y etiquetas derivadas del reporte OMR.',
    '- `manifest.json` y `source/provenance.json` describen procedencia y límites de evidencia.',
    '- El ZIP usa Deflate sin pérdida; no se recomprimieron las imágenes JPEG.',
    '- La ausencia de EXIF impide afirmar marca, modelo, lente, exposición, ISO o GPS de la cámara física.',
    ''
  ].join('\n'), 'utf8');

  let archivePath = null;
  let archiveSha256Path = null;
  let archiveVerification = null;
  if (archive) {
    archivePath = `${stagingDir}.zip`;
    createArchive(stagingDir, archivePath);
    archiveVerification = verifyArchive(stagingDir, archivePath);
    archiveSha256Path = `${archivePath}.sha256`;
    fs.writeFileSync(archiveSha256Path, `${sha256File(archivePath)}  ${path.basename(archivePath)}\n`, 'utf8');
  }
  return { stagingDir, archivePath, archiveSha256Path, manifest, labels, archiveVerification };
}

export function parseArgs(argv) {
  const values = { archive: true, attachedPaths: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--no-archive') { values.archive = false; continue; }
    if (arg === '--attached') { values.attachedPaths.push(path.resolve(argv[++i] || '')); continue; }
    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      values[key] = argv[++i] || '';
    }
  }
  if (!values.input || !values.output) fail('Uso: node tools/omr-camera-dataset/prepare.mjs --input <dir> --output <dir> [--report <json>] [--attached <file>] [--no-archive]');
  return values;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await prepareDataset({
      inputDir: options.input,
      outputDir: options.output,
      reportPath: options.report,
      attachedPaths: options.attachedPaths,
      archive: options.archive
    });
    process.stdout.write(`${JSON.stringify({ stagingDir: result.stagingDir, archivePath: result.archivePath, archiveSha256Path: result.archiveSha256Path, imageCount: result.labels.length, archiveVerification: result.archiveVerification }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exitCode = 1;
  }
}
