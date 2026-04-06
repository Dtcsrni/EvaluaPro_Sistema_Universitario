import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { analizarOmr as analizarOmrCv, leerQrDesdeImagen } from '../src/modulos/modulo_escaneo_omr/servicioOmr';
import { ExamenGenerado } from '../src/modulos/modulo_generacion_pdf/modeloExamenGenerado';

type ModoOmr = 'omr';

type Opciones = {
  dataset: string;
  mode: ModoOmr;
  out: string;
  mongoUri: string;
  top: number;
};

type BundleExamen = {
  paginasByNum: Map<number, unknown>;
};

type EstadoOmr = 'ok' | 'requiere_revision' | 'rechazado_calidad' | 'sin_estado';

type Caso = {
  archivo: string;
  folio: string;
  pagina: number;
  estado: EstadoOmr;
  calidadPagina: number;
  confianzaPromedioPagina: number;
  ratioAmbiguas: number;
  motivosRevision: string[];
  respuestasDetectadas: number;
};

const RX_QR = /EXAMEN:([A-Z0-9-]+):P(\d+)(?::TV\d+)?/i;

function parseArgs(argv: string[]): Opciones {
  const args = argv.slice(2);
  const options: Opciones = {
    dataset: '../../omr_samples',
    mode: 'omr',
    out: '../../reports/qa/latest/omr_rechazo_diagnostico.json',
    mongoUri: process.env.MONGODB_URI_HOST || 'mongodb://localhost:27017/evaluapro',
    top: 20
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
    if ((arg === '--out' || arg === '-o') && next) {
      options.out = next;
      i += 1;
      continue;
    }
    if (arg === '--mongo' && next) {
      options.mongoUri = next;
      i += 1;
      continue;
    }
    if (arg === '--top' && next) {
      options.top = Math.max(5, Math.min(100, Number.parseInt(next, 10) || 20));
      i += 1;
    }
  }

  return options;
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((acc, n) => acc + n, 0) / values.length;
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function normalizarMotivo(motivo: string) {
  return String(motivo || '').trim().replace(/\s+/g, ' ');
}

function snapshotThresholds() {
  return {
    qualityRejectMin: Number.parseFloat(process.env.OMR_QUALITY_REJECT_MIN || '0.65'),
    qualityReviewMin: Number.parseFloat(process.env.OMR_QUALITY_REVIEW_MIN || '0.8'),
    autoConfMin: Number.parseFloat(process.env.OMR_AUTO_CONF_MIN || '0.82'),
    autoAmbiguasMax: Number.parseFloat(process.env.OMR_AUTO_AMBIGUAS_MAX || '0.06'),
    autoDeteccionMin: Number.parseFloat(process.env.OMR_AUTO_DETECCION_MIN || '0.85'),
    autoRescueQualityMin: Number.parseFloat(process.env.OMR_AUTO_RESCUE_QUALITY_MIN || '0.58'),
    autoRescueConfMin: Number.parseFloat(process.env.OMR_AUTO_RESCUE_CONF_MIN || '0.84'),
    autoRescueAmbigMax: Number.parseFloat(process.env.OMR_AUTO_RESCUE_AMBIG_MAX || '0.04')
  };
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

async function cargarBundleExamen(folio: string): Promise<BundleExamen | null> {
  const examen = await ExamenGenerado.findOne({ folio }).lean();
  if (!examen) return null;
  const paginas = (examen as { mapaOmr?: { paginas?: Array<unknown> } })?.mapaOmr?.paginas ?? [];
  return {
    paginasByNum: new Map((paginas as Array<{ numeroPagina: number }>).map((p) => [Number(p.numeroPagina), p]))
  };
}

async function main() {
  const options = parseArgs(process.argv);
  const datasetRoot = path.resolve(process.cwd(), options.dataset);
  const outputPath = path.resolve(process.cwd(), options.out);
  const analizar = analizarOmrCv;

  const cacheExamen = new Map<string, BundleExamen | null>();
  const estadoCounts: Record<EstadoOmr, number> = {
    ok: 0,
    requiere_revision: 0,
    rechazado_calidad: 0,
    sin_estado: 0
  };
  const motivoCounts = new Map<string, number>();
  const motivoPorEstado = {
    ok: new Map<string, number>(),
    requiere_revision: new Map<string, number>(),
    rechazado_calidad: new Map<string, number>(),
    sin_estado: new Map<string, number>()
  } as const;

  const casos: Caso[] = [];
  const calidadPorEstado: Record<EstadoOmr, number[]> = {
    ok: [],
    requiere_revision: [],
    rechazado_calidad: [],
    sin_estado: []
  };
  const confianzaPorEstado: Record<EstadoOmr, number[]> = {
    ok: [],
    requiere_revision: [],
    rechazado_calidad: [],
    sin_estado: []
  };
  const ambiguasPorEstado: Record<EstadoOmr, number[]> = {
    ok: [],
    requiere_revision: [],
    rechazado_calidad: [],
    sin_estado: []
  };

  let imagenesConError = 0;
  let qrNoDetectado = 0;
  let examenNoEncontrado = 0;
  let paginaNoEncontrada = 0;

  await mongoose.connect(options.mongoUri);
  try {
    const imagenes = await listarImagenes(datasetRoot);
    for (const file of imagenes) {
      try {
        const imagenBase64 = await aDataUrl(file);
        const qr = (await leerQrDesdeImagen(imagenBase64)) || '';
        const match = RX_QR.exec(qr);
        if (!match) {
          qrNoDetectado += 1;
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
          examenNoEncontrado += 1;
          imagenesConError += 1;
          continue;
        }

        const mapaPagina = bundle.paginasByNum.get(pagina);
        if (!mapaPagina) {
          paginaNoEncontrada += 1;
          imagenesConError += 1;
          continue;
        }

        const resultado = await analizar(imagenBase64, mapaPagina as never, [folio, `EXAMEN:${folio}:P${pagina}`], 10);
        const estadoRaw = String((resultado as { estadoAnalisis?: string })?.estadoAnalisis ?? 'sin_estado');
        const estado: EstadoOmr =
          estadoRaw === 'ok' || estadoRaw === 'requiere_revision' || estadoRaw === 'rechazado_calidad'
            ? estadoRaw
            : 'sin_estado';
        estadoCounts[estado] += 1;

        const calidad = Number((resultado as { calidadPagina?: number }).calidadPagina ?? 0);
        const confianza = Number((resultado as { confianzaPromedioPagina?: number }).confianzaPromedioPagina ?? 0);
        const ratioAmbiguas = Number((resultado as { ratioAmbiguas?: number }).ratioAmbiguas ?? 1);
        const respuestasDetectadas = Array.isArray((resultado as { respuestasDetectadas?: unknown[] }).respuestasDetectadas)
          ? ((resultado as { respuestasDetectadas?: unknown[] }).respuestasDetectadas ?? []).length
          : 0;
        const motivosRevisionRaw = Array.isArray((resultado as { motivosRevision?: string[] }).motivosRevision)
          ? ((resultado as { motivosRevision?: string[] }).motivosRevision ?? [])
          : [];
        const motivosRevision = motivosRevisionRaw.map(normalizarMotivo).filter(Boolean);

        calidadPorEstado[estado].push(calidad);
        confianzaPorEstado[estado].push(confianza);
        ambiguasPorEstado[estado].push(ratioAmbiguas);

        for (const motivo of motivosRevision) {
          motivoCounts.set(motivo, (motivoCounts.get(motivo) ?? 0) + 1);
          motivoPorEstado[estado].set(motivo, (motivoPorEstado[estado].get(motivo) ?? 0) + 1);
        }

        casos.push({
          archivo: path.relative(datasetRoot, file),
          folio,
          pagina,
          estado,
          calidadPagina: round(calidad),
          confianzaPromedioPagina: round(confianza),
          ratioAmbiguas: round(ratioAmbiguas),
          motivosRevision,
          respuestasDetectadas
        });
      } catch {
        imagenesConError += 1;
      }
    }
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }

  const totalProcesadas = casos.length;
  const totalIntentadas = totalProcesadas + imagenesConError;

  const topMotivos = Array.from(motivoCounts.entries())
    .map(([motivo, total]) => ({ motivo, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 25);

  const resumenPorEstado = (Object.keys(estadoCounts) as EstadoOmr[]).map((estado) => ({
    estado,
    total: estadoCounts[estado],
    ratio: totalProcesadas > 0 ? round(estadoCounts[estado] / totalProcesadas, 6) : 0,
    calidadPromedio: round(mean(calidadPorEstado[estado])),
    confianzaPromedio: round(mean(confianzaPorEstado[estado])),
    ratioAmbiguasPromedio: round(mean(ambiguasPorEstado[estado])),
    topMotivos: Array.from(motivoPorEstado[estado].entries())
      .map(([motivo, total]) => ({ motivo, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }));

  const casosCriticos = [...casos]
    .sort((a, b) => {
      if (a.estado !== b.estado) {
        if (a.estado === 'rechazado_calidad') return -1;
        if (b.estado === 'rechazado_calidad') return 1;
        if (a.estado === 'requiere_revision') return -1;
        if (b.estado === 'requiere_revision') return 1;
      }
      if (a.calidadPagina !== b.calidadPagina) return a.calidadPagina - b.calidadPagina;
      return a.confianzaPromedioPagina - b.confianzaPromedioPagina;
    })
    .slice(0, options.top);

  const reporte = {
    generadoEn: new Date().toISOString(),
    dataset: datasetRoot,
    mode: options.mode,
    thresholds: snapshotThresholds(),
    totals: {
      totalIntentadas,
      totalProcesadas,
      imagenesConError,
      qrNoDetectado,
      examenNoEncontrado,
      paginaNoEncontrada
    },
    estados: resumenPorEstado,
    topMotivos,
    casosCriticos
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(reporte, null, 2)}\n`, 'utf8');

  process.stdout.write(
    `${JSON.stringify({
      outputPath,
      totals: reporte.totals,
      topMotivos: reporte.topMotivos.slice(0, 5),
      estados: resumenPorEstado.map((item) => ({
        estado: item.estado,
        total: item.total,
        calidadPromedio: item.calidadPromedio,
        confianzaPromedio: item.confianzaPromedio,
        ratioAmbiguasPromedio: item.ratioAmbiguasPromedio
      }))
    })}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});

