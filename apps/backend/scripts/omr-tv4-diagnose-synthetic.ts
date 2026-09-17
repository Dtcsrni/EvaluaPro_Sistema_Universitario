import fs from 'node:fs/promises';
import path from 'node:path';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr.js';

type GroundTruth = {
  captureId: string;
  numeroPregunta: number;
  opcionEsperada: string | null;
  markType: string;
  selectedOptions: string[];
};

const args = process.argv.slice(2);
const datasetRoot = path.resolve(args[args.indexOf('--dataset') + 1] ?? '../../omr_samples_tv4');
const requested = args
  .slice(args.indexOf('--capture') + 1)
  .filter((value) => value && !value.startsWith('--'));

const truthRows = (await fs.readFile(path.join(datasetRoot, 'ground_truth.jsonl'), 'utf8'))
  .split(/\r?\n/g)
  .filter(Boolean)
  .map((line) => JSON.parse(line) as GroundTruth);
const captureIds = requested.length > 0 ? requested : [...new Set(truthRows.map((row) => row.captureId))];
const output: Array<Record<string, unknown>> = [];

for (const captureId of captureIds) {
  const mapPath = path.join(datasetRoot, 'maps', `${captureId}.json`);
  const imagePath = path.join(datasetRoot, 'images', `${captureId}.jpg`);
  const mapa = JSON.parse(await fs.readFile(mapPath, 'utf8')) as { qr?: { texto?: string } };
  const image = await fs.readFile(imagePath);
  const result = await analizarOmr(
    `data:image/jpeg;base64,${image.toString('base64')}`,
    mapa as never,
    mapa.qr?.texto,
    10,
    { folio: captureId, numeroPagina: 1, templateVersionDetectada: 4 },
    `diagnose-${captureId}`
  );
  const truthByQuestion = new Map(
    truthRows.filter((row) => row.captureId === captureId).map((row) => [row.numeroPregunta, row])
  );
  output.push({
    captureId,
    estadoAnalisis: result.estadoAnalisis,
    calidadPagina: result.calidadPagina,
    geomQuality: result.geomQuality,
    photoQuality: result.photoQuality,
    advertencias: result.advertencias,
    motivosRevision: result.motivosRevision,
    respuestas: result.respuestasDetectadas.map((respuesta) => ({
      numeroPregunta: respuesta.numeroPregunta,
      esperado: truthByQuestion.get(respuesta.numeroPregunta)?.opcionEsperada ?? null,
      markType: truthByQuestion.get(respuesta.numeroPregunta)?.markType ?? null,
      selectedOptions: truthByQuestion.get(respuesta.numeroPregunta)?.selectedOptions ?? [],
      detectado: respuesta.opcion,
      confianza: respuesta.confianza,
      flags: respuesta.flags,
      scoresPorOpcion: respuesta.scoresPorOpcion
    }))
  });
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
