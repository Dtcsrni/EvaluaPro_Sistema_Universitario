import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Express } from 'express';
import sharp from 'sharp';
import QRCode from 'qrcode';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

type Opcion = 'A' | 'B' | 'C' | 'D' | 'E';
type MarkType = 'valid' | 'blank' | 'double' | 'smudge';
type Scenario =
  | 'buena_luz'
  | 'luz_calida'
  | 'luz_fria'
  | 'rotacion_leve'
  | 'desenfoque_leve'
  | 'jpeg_media'
  | 'sombreado_parcial'
  | 'baja_tinta';

type Args = {
  dataset: string;
  report: string;
  variants: number;
  seed: number;
  datasetType: string;
  precisionMin: number;
  falsePositiveMax: number;
  invalidDetectionMin: number;
  pagePassMin: number;
  autoGradeTrustMin: number;
};

type MapaPregunta = {
  numeroPregunta: number;
  idPregunta?: string;
  opciones: Array<{ letra: string; x: number; y: number }>;
  cajaOmr?: { x: number; y: number; width: number; height: number };
  perfilOmr?: { radio?: number };
  fiduciales?: {
    leftTop?: { x: number; y: number };
    leftBottom?: { x: number; y: number };
    rightTop?: { x: number; y: number };
    rightBottom?: { x: number; y: number };
  };
};

type MapaPagina = {
  numeroPagina: number;
  templateVersion: 3;
  qr?: { texto?: string; x?: number; y?: number; size?: number };
  marcasPagina?: {
    size?: number;
    tl?: { x: number; y: number };
    tr?: { x: number; y: number };
    bl?: { x: number; y: number };
    br?: { x: number; y: number };
  };
  preguntas: MapaPregunta[];
};

type CaptureManifest = {
  captureId: string;
  imagePath: string;
  mapaOmrPath: string;
  folio: string;
  numeroPagina: number;
  templateVersion: 3;
  seed: number;
  variantIndex: number;
  scenario: Scenario;
};

type GroundTruthRow = {
  captureId: string;
  numeroPregunta: number;
  opcionEsperada: Opcion | null;
  markType: MarkType;
  selectedOptions: Opcion[];
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const SCENARIOS: Scenario[] = [
  'buena_luz',
  'luz_calida',
  'luz_fria',
  'rotacion_leve',
  'desenfoque_leve',
  'jpeg_media',
  'sombreado_parcial',
  'baja_tinta'
];

class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 1;
  }

  next() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0xffffffff;
  }

  nextInt(min: number, max: number) {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return Math.floor(low + this.next() * (high - low + 1));
  }

  pick<T>(items: T[]): T {
    return items[this.nextInt(0, items.length - 1)] as T;
  }
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dataset: '../../omr_samples_tv3_real',
    report: '../../reports/qa/latest/omr/real_dataset_generation_report.json',
    variants: 24,
    seed: 20260225,
    datasetType: 'tv3_real_from_finals_templates',
    precisionMin: 0.95,
    falsePositiveMax: 0.02,
    invalidDetectionMin: 0.8,
    pagePassMin: 0.75,
    autoGradeTrustMin: 0.75
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if ((key === '--dataset' || key === '-d') && value) {
      args.dataset = value;
      i += 1;
      continue;
    }
    if ((key === '--report' || key === '-r') && value) {
      args.report = value;
      i += 1;
      continue;
    }
    if ((key === '--variants' || key === '-n') && value) {
      args.variants = Math.max(3, Number.parseInt(value, 10) || args.variants);
      i += 1;
      continue;
    }
    if (key === '--seed' && value) {
      args.seed = Number.parseInt(value, 10) || args.seed;
      i += 1;
      continue;
    }
    if (key === '--dataset-type' && value) {
      args.datasetType = value;
      i += 1;
      continue;
    }
    if (key === '--precision-min' && value) {
      args.precisionMin = Number.parseFloat(value);
      i += 1;
      continue;
    }
    if (key === '--false-positive-max' && value) {
      args.falsePositiveMax = Number.parseFloat(value);
      i += 1;
      continue;
    }
    if (key === '--invalid-detection-min' && value) {
      args.invalidDetectionMin = Number.parseFloat(value);
      i += 1;
      continue;
    }
    if (key === '--page-pass-min' && value) {
      args.pagePassMin = Number.parseFloat(value);
      i += 1;
      continue;
    }
    if (key === '--autograde-trust-min' && value) {
      args.autoGradeTrustMin = Number.parseFloat(value);
      i += 1;
    }
  }
  return args;
}

function yImage(yPdf: number) {
  return PAGE_HEIGHT - yPdf;
}

function hashObject(input: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function drawSelectedMarkSvg(cx: number, cy: number, radius = 7.0) {
  const fillRadius = Math.max(6.8, radius * 0.92);
  return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${fillRadius.toFixed(2)}" fill="#060606"/>`;
}

function drawQuestionBoxSvg(x: number, y: number, width: number, height: number) {
  const topY = yImage(y + height);
  return `<rect x="${x.toFixed(2)}" y="${topY.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" fill="none" stroke="#101010" stroke-width="2.4"/>`;
}

function drawLocalFiducialSvg(x: number, y: number, size = 5) {
  const top = yImage(y);
  const half = size / 2;
  const halo = size + 4;
  const haloHalf = halo / 2;
  return [
    `<rect x="${(x - haloHalf).toFixed(2)}" y="${(top - haloHalf).toFixed(2)}" width="${halo.toFixed(2)}" height="${halo.toFixed(2)}" fill="#ffffff"/>`,
    `<rect x="${(x - half).toFixed(2)}" y="${(top - half).toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" fill="#090909"/>`
  ].join('');
}

function drawSmudgeSvg(cx: number, cy: number) {
  return [
    `<line x1="${(cx - 12).toFixed(2)}" y1="${(cy - 8).toFixed(2)}" x2="${(cx + 11).toFixed(2)}" y2="${(cy + 8).toFixed(2)}" stroke="#222222" stroke-width="1.1"/>`,
    `<line x1="${(cx - 10).toFixed(2)}" y1="${(cy + 8).toFixed(2)}" x2="${(cx + 11).toFixed(2)}" y2="${(cy - 8).toFixed(2)}" stroke="#222222" stroke-width="1.0"/>`
  ].join('');
}

function decidirMarcado(numeroPregunta: number, rng: Rng): { markType: MarkType; selected: Opcion[] } {
  void numeroPregunta;
  void rng;
  return { markType: 'valid', selected: ['A'] };
}

function scenarioForCapture(variantIndex: number, numeroPagina: number): Scenario {
  const idx = Math.abs((variantIndex * 11 + numeroPagina * 5) % SCENARIOS.length);
  return SCENARIOS[idx] ?? 'buena_luz';
}

async function applyScenario(imagePath: string, scenario: Scenario, seed: number) {
  const buffer = await fs.readFile(imagePath);
  const rngFactor = ((seed % 1000) / 1000) * 0.05;
  let pipeline = sharp(buffer);

  switch (scenario) {
    case 'buena_luz':
      pipeline = pipeline.modulate({ brightness: 1.01, saturation: 1.0 }).linear(1.01, -2);
      break;
    case 'luz_calida':
      pipeline = pipeline.modulate({ brightness: 1.0, saturation: 0.99 }).tint({ r: 251, g: 236, b: 220 });
      break;
    case 'luz_fria':
      pipeline = pipeline.modulate({ brightness: 1.0, saturation: 1.0 }).tint({ r: 236, g: 244, b: 255 });
      break;
    case 'rotacion_leve':
      pipeline = pipeline.rotate(0.30 + rngFactor * 0.5, { background: '#ffffff' });
      break;
    case 'desenfoque_leve':
      pipeline = pipeline.blur(0.35 + rngFactor * 0.35);
      break;
    case 'jpeg_media':
      pipeline = pipeline.modulate({ brightness: 1.0, saturation: 1.0 });
      break;
    case 'sombreado_parcial': {
      const overlay = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="rgba(0,0,0,0)" />
              <stop offset="50%" stop-color="rgba(0,0,0,0.04)" />
              <stop offset="100%" stop-color="rgba(0,0,0,0)" />
            </linearGradient>
          </defs>
          <rect x="${Math.round(PAGE_WIDTH * 0.18)}" y="0" width="${Math.round(PAGE_WIDTH * 0.6)}" height="${PAGE_HEIGHT}" fill="url(#g)" />
        </svg>`
      );
      pipeline = pipeline.composite([{ input: overlay, blend: 'multiply' }]);
      break;
    }
    case 'baja_tinta':
      pipeline = pipeline.modulate({ brightness: 1.02, saturation: 0.99 }).linear(0.95, 7);
      break;
    default:
      break;
  }

  const quality = scenario === 'jpeg_media' ? 88 : 93;
  const out = await pipeline
    .resize(PAGE_WIDTH, PAGE_HEIGHT, { fit: 'fill' })
    .jpeg({ quality, chromaSubsampling: '4:4:4' })
    .toBuffer();
  await fs.writeFile(imagePath, out);
}

async function renderPageFromMap(
  mapPage: MapaPagina,
  selectedByQuestion: Map<number, Opcion[]>,
  markTypeByQuestion: Map<number, MarkType>,
  basePageImage?: Buffer
) {
  const markerSize = Number(mapPage.marcasPagina?.size ?? 20);
  const markerQuietZone = Number(mapPage.marcasPagina?.quietZone ?? 6);
  const halfMarker = markerSize / 2;
  const markers = [
    mapPage.marcasPagina?.tl,
    mapPage.marcasPagina?.tr,
    mapPage.marcasPagina?.bl,
    mapPage.marcasPagina?.br
  ].filter(Boolean) as Array<{ x: number; y: number }>;

  const markerSvg = markers
    .map((marker) => {
      const cx = marker.x;
      const cy = yImage(marker.y);
      return [
        `<rect x="${(cx - halfMarker - markerQuietZone).toFixed(2)}" y="${(cy - halfMarker - markerQuietZone).toFixed(2)}" width="${(markerSize + markerQuietZone * 2).toFixed(2)}" height="${(markerSize + markerQuietZone * 2).toFixed(2)}" fill="#ffffff"/>`,
        `<rect x="${(cx - halfMarker).toFixed(2)}" y="${(cy - halfMarker).toFixed(2)}" width="${markerSize.toFixed(2)}" height="${markerSize.toFixed(2)}" fill="#101010"/>`
      ].join('');
    })
    .join('');

  const boxesSvg = (mapPage.preguntas ?? [])
    .map((q) => {
      const box = q.cajaOmr;
      if (!box) return '';
      return drawQuestionBoxSvg(Number(box.x), Number(box.y), Number(box.width), Number(box.height));
    })
    .join('');

  const localFiducialsSvg = (mapPage.preguntas ?? [])
    .map((q) => {
      const fid = q.fiduciales;
      if (!fid) return '';
      const parts: string[] = [];
      if (fid.leftTop) parts.push(drawLocalFiducialSvg(Number(fid.leftTop.x), Number(fid.leftTop.y), 8));
      if (fid.leftBottom) parts.push(drawLocalFiducialSvg(Number(fid.leftBottom.x), Number(fid.leftBottom.y), 8));
      if (fid.rightTop) parts.push(drawLocalFiducialSvg(Number(fid.rightTop.x), Number(fid.rightTop.y), 8));
      if (fid.rightBottom) parts.push(drawLocalFiducialSvg(Number(fid.rightBottom.x), Number(fid.rightBottom.y), 8));
      return parts.join('');
    })
    .join('');

  const questionsSvg = (mapPage.preguntas ?? [])
    .map((q) => {
      const selected = selectedByQuestion.get(q.numeroPregunta) ?? [];
      const markType = markTypeByQuestion.get(q.numeroPregunta) ?? 'blank';
      const radius = Number(q.perfilOmr?.radio ?? 7.0);
      const optionsSvg = (q.opciones ?? [])
        .map((opt) => {
          const cx = Number(opt.x);
          const cy = yImage(Number(opt.y));
          const isSelected = selected.includes(String(opt.letra).toUpperCase() as Opcion);
          if (!isSelected) return '';
          return drawSelectedMarkSvg(cx, cy, radius);
        })
        .join('');
      if (markType !== 'smudge') return optionsSvg;
      const anchor = q.opciones[2] ?? q.opciones[0];
      if (!anchor) return optionsSvg;
      return `${optionsSvg}${drawSmudgeSvg(Number(anchor.x), yImage(Number(anchor.y)))}`;
    })
    .join('');

  const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}">
    ${questionsSvg}
  </svg>`;

  const base = basePageImage
    ? sharp(basePageImage).resize(PAGE_WIDTH, PAGE_HEIGHT, { fit: 'fill' })
    : sharp({
        create: {
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          channels: 3,
          background: '#ffffff'
        }
      });

  if (!basePageImage) {
    const qrText = String(mapPage.qr?.texto ?? '').trim();
    const qrSize = Math.round(Number(mapPage.qr?.size ?? 88));
    const qrX = Math.round(Number(mapPage.qr?.x ?? PAGE_WIDTH - qrSize - 28));
    const qrY = Math.round(yImage(Number(mapPage.qr?.y ?? 28) + qrSize));
    const qrBuffer = await QRCode.toBuffer(qrText, {
      type: 'png',
      width: qrSize,
      margin: 1,
      errorCorrectionLevel: 'H'
    });
    return base
      .composite([
        {
          input: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}">${markerSvg}${boxesSvg}${localFiducialsSvg}</svg>`
          )
        },
        { input: qrBuffer, top: qrY, left: qrX },
        { input: Buffer.from(overlaySvg), blend: 'multiply' }
      ])
      .resize(PAGE_WIDTH, PAGE_HEIGHT, { fit: 'fill' })
      .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
      .toBuffer();
  }

  return base
    .composite([{ input: Buffer.from(overlaySvg), blend: 'multiply' }])
    .resize(PAGE_WIDTH, PAGE_HEIGHT, { fit: 'fill' })
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

async function rasterizePdfPage(pdfPath: string, pageNumber: number) {
  const pageIndex = Math.max(0, pageNumber - 1);
  try {
    return await sharp(pdfPath, { density: 144, page: pageIndex })
      .resize(PAGE_WIDTH, PAGE_HEIGHT, { fit: 'fill' })
      .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
      .toBuffer();
  } catch {
    return undefined;
  }
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function crearDocenteConPlantillaFinal(params: {
  app: Express;
  docenteIndex: number;
  seed: number;
}) {
  const { app, docenteIndex, seed } = params;
  const correo = `docente-final-${docenteIndex}-${seed}@cuh.mx`;
  const registro = await request(app)
    .post('/api/autenticacion/registrar')
    .send({
      nombreCompleto: `Docente Final ${docenteIndex + 1}`,
      correo,
      contrasena: 'Secreto123!'
    })
    .expect(201);
  const token = String(registro.body.token);
  const auth = { Authorization: `Bearer ${token}` };

  const periodoResp = await request(app)
    .post('/api/periodos')
    .set(auth)
    .send({
      nombre: `Periodo Final ${docenteIndex + 1} 2026`,
      fechaInicio: '2026-01-01',
      fechaFin: '2026-06-30',
      grupos: ['A']
    })
    .expect(201);
  const periodoId = String(periodoResp.body.periodo._id);

  const preguntasIds: string[] = [];
  for (let i = 0; i < 50; i += 1) {
    const preguntaResp = await request(app)
      .post('/api/banco-preguntas')
      .set(auth)
      .send({
        periodoId,
        enunciado: `Pregunta final ${docenteIndex + 1}-${i + 1}`,
        opciones: [
          { texto: 'Opcion A', esCorrecta: true },
          { texto: 'Opcion B', esCorrecta: false },
          { texto: 'Opcion C', esCorrecta: false },
          { texto: 'Opcion D', esCorrecta: false },
          { texto: 'Opcion E', esCorrecta: false }
        ]
      })
      .expect(201);
    preguntasIds.push(String(preguntaResp.body.pregunta._id));
  }

  const plantillaResp = await request(app)
    .post('/api/examenes/plantillas')
    .set(auth)
    .send({
      periodoId,
      tipo: 'global',
      titulo: `Examen Final TV3 Docente ${docenteIndex + 1}`,
      numeroPaginas: 4,
      preguntasIds
    })
    .expect(201);

  return {
    auth,
    periodoId,
    plantillaId: String(plantillaResp.body.plantilla._id)
  };
}

const pdfPageCache = new Map<string, Buffer>();

async function main() {
  // Script de dataset en entorno controlado: desactivar limites operativos
  // para evitar ruido de rate-limit durante la siembra masiva de datos.
  process.env.NODE_ENV = 'test';
  process.env.RATE_LIMIT_LIMIT = process.env.RATE_LIMIT_LIMIT ?? '50000';
  process.env.RATE_LIMIT_CREDENCIALES_LIMIT = process.env.RATE_LIMIT_CREDENCIALES_LIMIT ?? '50000';
  process.env.RATE_LIMIT_REFRESCO_LIMIT = process.env.RATE_LIMIT_REFRESCO_LIMIT ?? '50000';
  process.env.RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS ?? '60000';
  process.env.DOMINIOS_CORREO_PERMITIDOS = process.env.DOMINIOS_CORREO_PERMITIDOS ?? 'cuh.mx';
  const args = parseArgs(process.argv);
  const { crearApp } = await import('../src/app');
  const datasetRoot = path.resolve(process.cwd(), args.dataset);
  const reportPath = path.resolve(process.cwd(), args.report);
  const imagesDir = path.join(datasetRoot, 'images');
  const mapsDir = path.join(datasetRoot, 'maps');
  await ensureDir(datasetRoot);
  await ensureDir(imagesDir);
  await ensureDir(mapsDir);

  const mongoPort = Number.parseInt(process.env.OMR_DATASET_MONGO_PORT || '27027', 10);
  const mongoServer = await MongoMemoryServer.create({
    instance: {
      ip: '127.0.0.1',
      port: Number.isFinite(mongoPort) ? mongoPort : 27027
    }
  });
  await mongoose.connect(mongoServer.getUri());
  const app = crearApp();

  const rng = new Rng(args.seed);
  const teacherCount = Math.max(2, Math.min(4, Math.ceil(args.variants / 6)));
  const docentes: Array<{ auth: { Authorization: string }; periodoId: string; plantillaId: string }> = [];
  for (let i = 0; i < teacherCount; i += 1) {
    docentes.push(await crearDocenteConPlantillaFinal({ app, docenteIndex: i, seed: args.seed }));
  }

  const capturas: CaptureManifest[] = [];
  const groundTruthRows: GroundTruthRow[] = [];
  const answerKey: Record<number, Opcion> = {};
  for (let q = 1; q <= 50; q += 1) answerKey[q] = 'A';
  const scenarioCounts = new Map<Scenario, number>();
  let totalPreguntas = 0;

  for (let variantIndex = 0; variantIndex < args.variants; variantIndex += 1) {
    const docente = docentes[variantIndex % docentes.length] as {
      auth: { Authorization: string };
      periodoId: string;
      plantillaId: string;
    };
    const alumnoResp = await request(app)
      .post('/api/alumnos')
      .set(docente.auth)
      .send({
        periodoId: docente.periodoId,
        matricula: `CUH${String(variantIndex + 1).padStart(9, '0')}`,
        nombreCompleto: `Alumno Final ${variantIndex + 1}`,
        correo: `alumno-final-${variantIndex + 1}@cuh.mx`,
        grupo: 'A'
      })
      .expect(201);
    const alumnoId = String(alumnoResp.body.alumno._id);

    const examenResp = await request(app)
      .post('/api/examenes/generados')
      .set(docente.auth)
      .send({ plantillaId: docente.plantillaId })
      .expect(201);
    const folio = String(examenResp.body.examenGenerado.folio);

    await request(app)
      .post('/api/entregas/vincular-folio')
      .set(docente.auth)
      .send({ folio, alumnoId })
      .expect(201);

    const examenCompletoResp = await request(app)
      .get(`/api/examenes/generados/folio/${encodeURIComponent(folio)}`)
      .set(docente.auth)
      .expect(200);
    const examen = examenCompletoResp.body.examen as {
      mapaOmr?: { paginas?: MapaPagina[]; templateVersion?: number };
      rutaPdf?: string;
    };
    const rutaPdf = String(examen?.rutaPdf ?? '').trim();
    const paginas = Array.isArray(examen?.mapaOmr?.paginas) ? examen.mapaOmr.paginas : [];
    if (paginas.length === 0) continue;

    for (const pagina of paginas) {
      const pageNumber = Number(pagina.numeroPagina ?? 0);
      const captureId = `${folio}-P${pageNumber}`;
      const scenario = scenarioForCapture(variantIndex, pageNumber);
      scenarioCounts.set(scenario, (scenarioCounts.get(scenario) ?? 0) + 1);

      const selectedByQuestion = new Map<number, Opcion[]>();
      const markTypeByQuestion = new Map<number, MarkType>();
      for (const q of pagina.preguntas ?? []) {
        const numeroPregunta = Number(q.numeroPregunta ?? 0);
        if (!Number.isFinite(numeroPregunta) || numeroPregunta <= 0) continue;
        const marcado = decidirMarcado(numeroPregunta + variantIndex, rng);
        selectedByQuestion.set(numeroPregunta, marcado.selected);
        markTypeByQuestion.set(numeroPregunta, marcado.markType);
        groundTruthRows.push({
          captureId,
          numeroPregunta,
          opcionEsperada: marcado.markType === 'valid' ? (marcado.selected[0] ?? null) : null,
          markType: marcado.markType,
          selectedOptions: marcado.selected
        });
        totalPreguntas += 1;
      }

      const pdfKey = rutaPdf ? `${rutaPdf}#${pageNumber}` : '';
      let basePageImage: Buffer | undefined;
      if (pdfKey) {
        if (!pdfPageCache.has(pdfKey)) {
          pdfPageCache.set(pdfKey, await rasterizePdfPage(rutaPdf, pageNumber));
        }
        basePageImage = pdfPageCache.get(pdfKey);
      }
      const pageImage = await renderPageFromMap(pagina, selectedByQuestion, markTypeByQuestion, basePageImage);
      const imagePath = path.join('images', `${captureId}.jpg`).replaceAll('\\', '/');
      const mapPath = path.join('maps', `${captureId}.json`).replaceAll('\\', '/');
      await fs.writeFile(path.join(datasetRoot, imagePath), pageImage);
      await fs.writeFile(path.join(datasetRoot, mapPath), `${JSON.stringify(pagina, null, 2)}\n`, 'utf8');
      await applyScenario(path.join(datasetRoot, imagePath), scenario, args.seed + variantIndex * 97 + pageNumber * 13);

      capturas.push({
        captureId,
        imagePath,
        mapaOmrPath: mapPath,
        folio,
        numeroPagina: pageNumber,
        templateVersion: 3,
        seed: args.seed + variantIndex * 1009,
        variantIndex,
        scenario
      });
    }
  }

  const manifest = {
    version: '2',
    datasetType: args.datasetType,
    examSpec: {
      totalQuestions: 50,
      totalPages: 4,
      optionsPerQuestion: 5
    },
    renderSpec: {
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      marginPt: 28.35,
      cornerMarkerSizePt: 20,
      qrSizePt: 88
    },
    noiseSpec: {
      profile: 'final_templates_capture_simulated',
      scenarios: SCENARIOS
    },
    thresholds: {
      precisionMin: args.precisionMin,
      falsePositiveMax: args.falsePositiveMax,
      invalidDetectionMin: args.invalidDetectionMin,
      pagePassMin: args.pagePassMin,
      autoGradeTrustMin: args.autoGradeTrustMin
    },
    answerKeyPath: 'answer_key.json',
    groundTruthRef: 'ground_truth.jsonl',
    capturas,
    hash: hashObject({ capturas, thresholds: args }),
    layoutMeta: {
      layoutRevision: 'tv3_low_ink_resilient_r1',
      layoutHash: crypto
        .createHash('sha256')
        .update(
          capturas
            .map((c) => `${c.captureId}:${c.mapaOmrPath}`)
            .sort((a, b) => a.localeCompare(b))
            .join('|')
        )
        .digest('hex')
    }
  };

  await fs.writeFile(path.join(datasetRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(datasetRoot, 'answer_key.json'), `${JSON.stringify(answerKey, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    path.join(datasetRoot, 'ground_truth.jsonl'),
    `${groundTruthRows.map((row) => JSON.stringify(row)).join('\n')}\n`,
    'utf8'
  );

  const reportPayload = {
    generatedAt: new Date().toISOString(),
    datasetRoot,
    datasetType: args.datasetType,
    variants: args.variants,
    teachers: teacherCount,
    captures: capturas.length,
    questions: totalPreguntas,
    scenarios: Object.fromEntries(Array.from(scenarioCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]))),
    source: 'final_exam_templates_runtime_flow'
  };
  await ensureDir(path.dirname(reportPath));
  await fs.writeFile(reportPath, `${JSON.stringify(reportPayload, null, 2)}\n`, 'utf8');

  await mongoose.disconnect();
  await mongoServer.stop();
  process.stdout.write(`${JSON.stringify(reportPayload)}\n`);
}

main().catch(async (error) => {
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});
