import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { analizarOmr as analizarOmrCv, leerQrDesdeImagen } from '../src/modulos/modulo_escaneo_omr/servicioOmr';
import { ExamenGenerado } from '../src/modulos/modulo_generacion_pdf/modeloExamenGenerado';
import { BancoPregunta } from '../src/modulos/modulo_banco_preguntas/modeloBancoPregunta';

type BundleExamen = {
  paginasByNum: Map<number, unknown>;
  correctasByNumero: Map<number, string>;
};

export type EvalProfileOptions = {
  dataset: string;
  mode: 'omr';
  mongoUri: string;
  profileName: string;
};

export type EvalProfileSummary = {
  profile: string;
  mode: 'omr';
  dataset: string;
  totalReactivos: number;
  detectadas: number;
  correctas: number;
  deteccionRate: number;
  precisionSobreTotal: number;
  estados: Record<string, number>;
  imagenesConError: number;
};

const RX_QR = /EXAMEN:([A-Z0-9-]+):P(\d+)(?::TV\d+)?/i;

function parseArgs(argv: string[]): EvalProfileOptions {
  const args = argv.slice(2);
  const options: EvalProfileOptions = {
    dataset: '../../omr_samples',
    mode: 'omr',
    mongoUri: process.env.MONGODB_URI_HOST || 'mongodb://localhost:27017/evaluapro',
    profileName: process.env.OMR_PROFILE_NAME || 'actual'
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if ((arg === '--dataset' || arg === '-d') && next) {
      options.dataset = next;
      i += 1;
      continue;
    }
    if ((arg === '--mode' || arg === '-m') && next && next === 'omr') {
      options.mode = 'omr';
      i += 1;
      continue;
    }
    if (arg === '--mongo' && next) {
      options.mongoUri = next;
      i += 1;
      continue;
    }
    if ((arg === '--profile' || arg === '-p') && next) {
      options.profileName = next;
      i += 1;
      continue;
    }
  }

  return options;
}

async function listarImagenes(dir: string): Promise<string[]> {
  const out: string[] = [];
  const items = await fs.readdir(dir, { withFileTypes: true });
  for (const item of items) {
    const abs = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...(await listarImagenes(abs)));
    else if (/\.(jpg|jpeg|png)$/i.test(item.name)) out.push(abs);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

async function aDataUrl(file: string): Promise<string> {
  const ext = path.extname(file).toLowerCase();
  const buf = await fs.readFile(file);
  if (ext === '.png') return `data:image/png;base64,${buf.toString('base64')}`;
  if (ext === '.jpg' || ext === '.jpeg') return `data:image/jpeg;base64,${buf.toString('base64')}`;
  const png = await sharp(buf).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

function letraCorrecta(opciones: Array<{ esCorrecta: boolean }>, orden: number[]): string | null {
  const idxReal = opciones.findIndex((o) => o.esCorrecta);
  if (idxReal < 0) return null;
  const idxMostrado = orden.findIndex((n) => n === idxReal);
  if (idxMostrado < 0 || idxMostrado > 25) return null;
  return String.fromCharCode(65 + idxMostrado);
}

async function cargarBundleExamen(folio: string): Promise<BundleExamen | null> {
  const examen = await ExamenGenerado.findOne({ folio }).lean();
  if (!examen) return null;

  const paginas = (examen as { mapaOmr?: { paginas?: Array<unknown> } })?.mapaOmr?.paginas ?? [];
  const ordenPreguntas = Array.isArray((examen as { mapaVariante?: { ordenPreguntas?: unknown[] } })?.mapaVariante?.ordenPreguntas)
    ? ((examen as { mapaVariante?: { ordenPreguntas?: unknown[] } }).mapaVariante?.ordenPreguntas ?? []).map((x) => String(x))
    : [];

  const preguntasDb = await BancoPregunta.find({ _id: { $in: ordenPreguntas } }).lean();
  const porId = new Map(preguntasDb.map((p: unknown) => [String((p as { _id: unknown })._id), p as {
    versiones?: Array<{ numeroVersion?: number; opciones?: Array<{ esCorrecta: boolean }> }>;
    versionActual?: number;
  }]));

  const correctasByNumero = new Map<number, string>();
  for (let idx = 0; idx < ordenPreguntas.length; idx += 1) {
    const id = ordenPreguntas[idx];
    const pregunta = porId.get(id);
    if (!pregunta) continue;
    const version = (pregunta.versiones ?? []).find((v) => v.numeroVersion === pregunta.versionActual) ?? (pregunta.versiones ?? [])[0];
    if (!version?.opciones) continue;

    const mapaVariante = (examen as { mapaVariante?: { ordenOpcionesPorPregunta?: Record<string, number[]> } }).mapaVariante;
    const ordenOpc = (mapaVariante?.ordenOpcionesPorPregunta?.[id] ?? [0, 1, 2, 3, 4]).map(Number);
    const letra = letraCorrecta(version.opciones, ordenOpc);
    if (letra) correctasByNumero.set(idx + 1, letra);
  }

  return {
    paginasByNum: new Map((paginas as Array<{ numeroPagina: number }>).map((p) => [Number(p.numeroPagina), p])),
    correctasByNumero
  };
}

export async function evaluateProfile(options: EvalProfileOptions): Promise<EvalProfileSummary> {
  const datasetRoot = path.resolve(process.cwd(), options.dataset);
  const analizar = analizarOmrCv;

  const cacheExamen = new Map<string, BundleExamen | null>();
  const states: Record<string, number> = {};
  let totalReactivos = 0;
  let detectadas = 0;
  let correctas = 0;
  let imagenesConError = 0;

  await mongoose.connect(options.mongoUri);
  try {
    const imagenes = await listarImagenes(datasetRoot);
    for (const file of imagenes) {
      try {
        const imagenBase64 = await aDataUrl(file);
        const qr = (await leerQrDesdeImagen(imagenBase64)) || '';
        const match = RX_QR.exec(qr);
        if (!match) {
          imagenesConError += 1;
          continue;
        }

        const folio = String(match[1]).toUpperCase();
        const pagina = Number(match[2]);

        if (!cacheExamen.has(folio)) {
          cacheExamen.set(folio, await cargarBundleExamen(folio));
        }
        const bundle = cacheExamen.get(folio);
        if (!bundle) {
          imagenesConError += 1;
          continue;
        }

        const mapaPagina = bundle.paginasByNum.get(pagina);
        if (!mapaPagina) {
          imagenesConError += 1;
          continue;
        }

        const resultado = await analizar(
          imagenBase64,
          mapaPagina as never,
          [folio, `EXAMEN:${folio}:P${pagina}`],
          10
        );

        const estado = String((resultado as { estadoAnalisis?: string })?.estadoAnalisis ?? 'sin_estado');
        states[estado] = (states[estado] ?? 0) + 1;

        const respuestas = (resultado as { respuestasDetectadas?: Array<{ numeroPregunta: number; opcion: string | null }> }).respuestasDetectadas ?? [];
        for (const r of respuestas) {
          totalReactivos += 1;
          const detectada = r.opcion ? String(r.opcion).toUpperCase() : null;
          if (detectada) detectadas += 1;
          const correcta = bundle.correctasByNumero.get(Number(r.numeroPregunta)) ?? null;
          if (detectada && correcta && detectada === correcta) correctas += 1;
        }
      } catch {
        imagenesConError += 1;
      }
    }

    const summary: EvalProfileSummary = {
      profile: options.profileName,
      mode: options.mode,
      dataset: datasetRoot,
      totalReactivos,
      detectadas,
      correctas,
      deteccionRate: totalReactivos > 0 ? detectadas / totalReactivos : 0,
      precisionSobreTotal: totalReactivos > 0 ? correctas / totalReactivos : 0,
      estados: states,
      imagenesConError
    };

    return summary;
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }
}

async function main() {
  const options = parseArgs(process.argv);
  const summary = await evaluateProfile(options);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href : false;

if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
    process.exit(1);
  });
}

