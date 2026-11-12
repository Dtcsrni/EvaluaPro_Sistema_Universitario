import fs from 'node:fs/promises';
import path from 'node:path';

type GroundTruth = {
  captureId: string;
  numeroPregunta: number;
  opcionEsperada: string | null;
  markType: string;
  selectedOptions: string[];
};

const args = process.argv.slice(2);
const datasetRoot = path.resolve(args[args.indexOf('--dataset') + 1] ?? '../../omr_samples_tv4');
const captureFlagIndex = args.indexOf('--capture');
const requested = captureFlagIndex < 0
  ? []
  : args.slice(captureFlagIndex + 1).filter((value) => value && !value.startsWith('--'));
const datasetManifest = JSON.parse(
  await fs.readFile(path.join(datasetRoot, 'manifest.json'), 'utf8')
) as { thresholds?: { omrParams?: Record<string, number> } };
const omrParams = {
  OMR_RESPUESTA_CONF_MIN: datasetManifest.thresholds?.omrParams?.OMR_RESPUESTA_CONF_MIN ?? 0.78,
  OMR_SCORE_MIN: datasetManifest.thresholds?.omrParams?.OMR_SCORE_MIN ?? 0.08,
  OMR_DELTA_MIN: datasetManifest.thresholds?.omrParams?.OMR_DELTA_MIN ?? 0.02
};
for (const [name, value] of Object.entries(omrParams)) process.env[name] = String(value);
const { analizarOmr } = await import('../src/modulos/modulo_escaneo_omr/servicioOmr.js');

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
    respuestas: result.respuestasDetectadas
      .map((respuesta) => ({
        numeroPregunta: respuesta.numeroPregunta,
        esperado: truthByQuestion.get(respuesta.numeroPregunta)?.opcionEsperada ?? null,
        markType: truthByQuestion.get(respuesta.numeroPregunta)?.markType ?? null,
        selectedOptions: truthByQuestion.get(respuesta.numeroPregunta)?.selectedOptions ?? [],
        detectado: respuesta.opcion,
        confianza: respuesta.confianza,
        flags: respuesta.flags,
        scoresPorOpcion: respuesta.scoresPorOpcion.slice(0, 3).map((score) => ({
          opcion: score.opcion,
          score: score.score,
          fillRatioCore: score.fillRatioCore,
          fillRatioRing: score.fillRatioRing,
          fillDelta: score.fillDelta,
          contraste: score.contraste,
          margenCromatico: score.margenCromatico,
          estadoMarca: score.estadoMarca
        }))
      }))
      .filter((respuesta) => respuesta.detectado !== respuesta.esperado)
  });
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
