#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import sharp from 'sharp';
import { detectarQrDetalleZxing } from '../src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCanonico.ts';
import { detectarQrZxingPaginaFuente } from '../src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCv.ts';

const QR_SIZE_PTS = 22 * 72 / 25.4 * (612 / 595.276);

function readArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!['--input', '--root', '--output'].includes(key)) throw new Error(`Argumento desconocido: ${key}`);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`Falta valor para ${key}`);
    args[key.slice(2)] = path.resolve(value);
  }
  for (const key of ['input', 'root', 'output']) if (!args[key]) throw new Error(`Uso: --input <jsonl> --root <corpus> --output <jsonl>`);
  return args;
}

const args = readArgs(process.argv.slice(2));
const input = (await fs.readFile(args.input, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
if (input.length !== 769 || new Set(input.map((row) => row.filename)).size !== 769) {
  throw new Error(`Se esperan 769 capturas únicas; se encontraron ${input.length}`);
}
const misses = input.filter((row) => row.qrExact !== true);
const output = await fs.open(args.output, 'wx');
const counts = { misses: misses.length, recoveredExact: 0, geometryVerifiedRescue: 0, wrongPayloadsObserved: 0, rotationsTried: 0 };
const start = performance.now();
try {
  for (let i = 0; i < misses.length; i += 1) {
    const row = misses[i];
    const bytes = await fs.readFile(path.join(args.root, 'images', row.filename));
    const candidates = [];
    for (const degrees of [90, 180, 270]) {
      const raw = await sharp(bytes).rotate(degrees).greyscale().raw().toBuffer({ resolveWithObject: true });
      const detail = detectarQrDetalleZxing(raw.data, raw.info.width, raw.info.height);
      counts.rotationsTried += 1;
      if (detail?.data) {
        const expectedDetail = detail.data === row.sheetId
          ? detectarQrZxingPaginaFuente(
              new Uint8ClampedArray(raw.data),
              raw.info.width,
              raw.info.height,
              QR_SIZE_PTS,
              612,
              { matrixModules: 21, payloadsEsperados: [row.sheetId] }
            )
          : null;
        candidates.push({ degrees, text: detail.data, exactPayload: detail.data === row.sheetId, geometryVerified: Boolean(expectedDetail) });
        counts.geometryVerifiedRescue += Number(Boolean(expectedDetail));
      }
    }
    const exact = candidates.find((candidate) => candidate.text === row.sheetId);
    if (exact) counts.recoveredExact += 1;
    if (candidates.some((candidate) => candidate.text !== row.sheetId)) counts.wrongPayloadsObserved += 1;
    const record = {
      filename: row.filename,
      sheetId: row.sheetId,
      device: row.device,
      condition: row.condition,
      scenario: row.scenario,
      exactRotationDegrees: exact?.degrees ?? null,
      candidatePayloads: candidates,
      elapsedMs: Math.round(performance.now() - start)
    };
    await output.appendFile(`${JSON.stringify(record)}\n`, 'utf8');
    await output.sync();
    console.log(JSON.stringify({ index: i + 1, total: misses.length, filename: row.filename, exact: Boolean(exact), candidateCount: candidates.length }));
  }
} finally {
  await output.close();
}
console.log(JSON.stringify({ ...counts, durationMs: Math.round(performance.now() - start), output: args.output }));
