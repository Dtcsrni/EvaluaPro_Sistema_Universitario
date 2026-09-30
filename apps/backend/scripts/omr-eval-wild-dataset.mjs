#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('CSV contiene comillas sin cerrar');
  fields.push(field);
  return fields;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    if (values.length !== headers.length) throw new Error(`CSV fila ${index + 2}: número de columnas inesperado`);
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
}

function readArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (!arg.startsWith('--')) throw new Error(`Argumento desconocido: ${arg}`);
    const [key, inline] = arg.slice(2).split('=', 2);
    if ((key === 'resume' || key === 'no-retry' || key === 'include-scores') && inline === undefined) {
      values[key] = 'true';
      continue;
    }
    const value = inline ?? argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`Falta valor para --${key}`);
    values[key] = value;
  }
  return values;
}

function usage() {
  return [
    'Uso: node --import tsx apps/backend/scripts/omr-eval-wild-dataset.mjs --root <corpus> --output <reporte.jsonl> [opciones]',
    'Opciones: --offset <n> --limit <n> --resume --no-retry --include-scores --map-coordinates-strict <true|false>',
    'El modo inicial crea el reporte sin sobrescribir. --resume continúa anexando y omite filenames ya registradas.'
  ].join('\n');
}

function punto(xMm, yMm) {
  const mmToPt = 72 / 25.4;
  return { x: xMm * mmToPt * (612 / 595.276), y: yMm * mmToPt * (792 / 841.89) };
}

function crearMapa(row, geometria, useMapCoordinatesStrict = true) {
  const preguntas = [];
  for (let numero = 1; numero <= 40; numero += 1) {
    const burbujas = geometria.bubbles[`q${numero}`];
    const opciones = Object.entries(burbujas).map(([letra, [u, v]]) => ({
      letra,
      ...punto(12 + u * geometria.frame_w_mm, 285 - v * geometria.frame_h_mm)
    }));
    const primera = opciones[0];
    preguntas.push({
      numeroPregunta: numero,
      idPregunta: `wild-${numero}`,
      opciones,
      cajaOmr: {
        x: primera.x - 7 * 72 / 25.4 * (612 / 595.276),
        y: primera.y - 4 * 72 / 25.4 * (792 / 841.89),
        width: 40 * 72 / 25.4 * (612 / 595.276),
        height: 8 * 72 / 25.4 * (792 / 841.89)
      },
      perfilOmr: {
        radio: 2.5 * 72 / 25.4 * (612 / 595.276),
        pasoY: 0,
        pasoX: 8 * 72 / 25.4 * (612 / 595.276),
        cajaAncho: 40 * 72 / 25.4 * (612 / 595.276)
      }
    });
  }
  return {
    numeroPagina: 1,
    templateVersion: 4,
    markerSpec: { family: 'solid_square_4pt_v1', sizeMm: 8, quietZoneMm: 0 },
    marcasPagina: {
      tipo: 'cuadrados', size: 8 * 72 / 25.4 * (612 / 595.276), quietZone: 0,
      tl: punto(12, 285), tr: punto(198, 285), bl: punto(12, 12), br: punto(198, 12)
    },
    qr: {
      texto: row.sheet_id,
      x: 176 * 72 / 25.4 * (612 / 595.276),
      y: 258 * 72 / 25.4 * (792 / 841.89),
      size: 22 * 72 / 25.4 * (612 / 595.276),
      padding: 0,
      matrixModules: 21,
      marginModules: 4
    },
    engineHints: { preferredEngine: 'cv', conservativeDecision: true, useMapCoordinatesStrict },
    preguntas
  };
}

const args = readArgs(process.argv.slice(2));
const mapCoordinatesStrict = String(args['map-coordinates-strict'] ?? 'true').toLowerCase();
if (mapCoordinatesStrict !== 'true' && mapCoordinatesStrict !== 'false') throw new Error('--map-coordinates-strict debe ser true o false');
if (args.help) {
  console.log(usage());
  process.exit(0);
}
if (!args.root || !args.output) throw new Error(usage());
const root = path.resolve(args.root);
const outputPath = path.resolve(args.output);
const offset = Number(args.offset ?? 0);
const limit = args.limit === undefined ? Number.POSITIVE_INFINITY : Number(args.limit);
if (!Number.isInteger(offset) || offset < 0 || !(Number.isInteger(limit) || limit === Number.POSITIVE_INFINITY) || limit < 1) {
  throw new Error('--offset debe ser >=0 y --limit debe ser un entero positivo');
}
const relativeOutput = path.relative(root, outputPath);
if (relativeOutput && !relativeOutput.startsWith('..') && !path.isAbsolute(relativeOutput)) {
  throw new Error('El reporte debe guardarse fuera del directorio fuente del dataset');
}

const [metadataCsv, keysText, geometryText] = await Promise.all([
  fs.readFile(path.join(root, 'metadata.csv'), 'utf8'),
  fs.readFile(path.join(root, 'protocol', 'answer_keys.json'), 'utf8'),
  fs.readFile(path.join(root, 'protocol', 'template_geometry.json'), 'utf8')
]);
const metadata = parseCsv(metadataCsv);
const answerKeys = JSON.parse(keysText);
const geometry = JSON.parse(geometryText);
if (metadata.length !== 769) throw new Error(`Se esperaban 769 capturas etiquetadas; se encontraron ${metadata.length}`);
for (const row of metadata) {
  if (!row.filename || !row.sheet_id || !answerKeys[row.sheet_id] || answerKeys[row.sheet_id].gt?.length !== 40) {
    throw new Error(`Metadatos o etiqueta faltante para ${row.filename ?? '(sin nombre)'}`);
  }
}

const prior = new Set();
if (args.resume === 'true' || args.resume === '') {
  const priorText = await fs.readFile(outputPath, 'utf8');
  for (const line of priorText.split(/\r?\n/).filter(Boolean)) {
    const record = JSON.parse(line);
    if (record.filename) prior.add(record.filename);
  }
} else {
  const handle = await fs.open(outputPath, 'wx');
  await handle.close();
}

const { analizarOmr } = await import('../src/modulos/modulo_escaneo_omr/servicioOmrCv.ts');
const selected = metadata.slice(offset, Number.isFinite(limit) ? offset + limit : undefined);
const output = await fs.open(outputPath, 'a');
let processed = 0;
let failures = 0;
let peakRssMiB = Math.round(process.memoryUsage().rss / 1024 / 1024);
const runStart = performance.now();
try {
  for (const row of selected) {
    if (prior.has(row.filename)) continue;
    const started = performance.now();
    let record;
    try {
      const image = await fs.readFile(path.join(root, 'images', row.filename));
      const result = await analizarOmr(image.toString('base64'), crearMapa(row, geometry, mapCoordinatesStrict === 'true'), row.sheet_id, 8, {
        folio: row.sheet_id,
        numeroPagina: 1,
        templateVersionDetectada: 4
      }, { noRetry: args['no-retry'] === 'true' });
      const answers = result.respuestasDetectadas ?? [];
      let emitted = 0;
      let correct = 0;
      let wrong = 0;
      let blank = 0;
      let ambiguous = 0;
      for (let i = 0; i < 40; i += 1) {
        const detected = answers[i];
        const choice = detected?.opcion ?? null;
        if (choice) emitted += 1;
        if (choice === answerKeys[row.sheet_id].gt[i]) correct += 1;
        else if (choice) wrong += 1;
        else if (detected?.estadoRespuesta === 'sin_marca') blank += 1;
        else ambiguous += 1;
      }
      record = {
        filename: row.filename,
        sheetId: row.sheet_id,
        scenario: answerKeys[row.sheet_id].scenario ?? null,
        device: row.device,
        condition: row.condition,
        sha256: row.sha256,
        engineRelease: result.engineRelease ?? null,
        evaluationProfile: args['no-retry'] === 'true' ? 'single_pass' : 'production_flow',
        mapCoordinatesStrict: mapCoordinatesStrict === 'true',
        qrExact: result.qrTexto === row.sheet_id,
        qrText: result.qrTexto ?? null,
        qrSource: result.qrFuenteDeteccion ?? null,
        orientationDetermined: result.pageOrientationDetermined ?? false,
        rotationDegrees: result.pageRotationDegrees ?? null,
        geometryMode: result.geometryMode ?? null,
        geometryReferencePoints: result.geometryReferencePoints ?? null,
        geometryReferenceQuality: result.geometryReferenceQuality ?? null,
        emitted, correct, wrong, blank, ambiguous,
        analysisState: result.estadoAnalisis ?? null,
        reviewReasons: result.motivosRevision ?? [],
        ...(args['include-scores'] === 'true' ? {
          answerFeatures: answers.map((answer) => ({
            question: answer.numeroPregunta,
            expected: answerKeys[row.sheet_id].gt[answer.numeroPregunta - 1],
            selected: answer.opcion,
            state: answer.estadoRespuesta ?? null,
            confidence: answer.confianza,
            flags: answer.flags,
            options: answer.scoresPorOpcion
          }))
        } : {}),
        elapsedMs: Math.round(performance.now() - started),
        rssMiB: Math.round(process.memoryUsage().rss / 1024 / 1024)
      };
    } catch (error) {
      failures += 1;
      record = {
        filename: row.filename, sheetId: row.sheet_id, device: row.device, condition: row.condition,
        sha256: row.sha256, error: error instanceof Error ? error.message : String(error),
        elapsedMs: Math.round(performance.now() - started),
        rssMiB: Math.round(process.memoryUsage().rss / 1024 / 1024)
      };
    }
    await output.appendFile(`${JSON.stringify(record)}\n`, 'utf8');
    await output.sync();
    processed += 1;
    peakRssMiB = Math.max(peakRssMiB, record.rssMiB);
    console.log(JSON.stringify({ index: offset + processed, totalSelected: selected.length, filename: row.filename, elapsedMs: record.elapsedMs, rssMiB: record.rssMiB, error: record.error ?? null }));
  }
} finally {
  await output.close();
}
console.log(JSON.stringify({
  processed,
  skippedExisting: prior.size,
  failures,
  durationMs: Math.round(performance.now() - runStart),
  peakObservedRssMiB: peakRssMiB,
  output: outputPath
}));



