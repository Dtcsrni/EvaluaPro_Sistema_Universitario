import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { leerQrDesdeImagen } from '../src/modulos/modulo_escaneo_omr/servicioOmr';
import { extraerResumenQrExamen } from '../src/modulos/modulo_generacion_pdf/domain/qrExamen';

type ItemReporte = {
  archivoOriginal: string;
  qrTexto?: string;
  folioId: string;
  pagina?: number;
  metodo: 'qr' | 'inferido_par' | 'sin_qr';
  destino: string;
  nota?: string;
};

type ItemTrabajo = {
  archivoOriginal: string;
  qrTexto?: string;
  folioId: string;
  pagina?: number;
  metodo: 'qr' | 'inferido_par' | 'sin_qr';
};

function parseArgs(argv: string[]) {
  const args = {
    inputDir: '../../omr_samples_tv3/images/Sin Clasificar',
    outputDir: '../../omr_samples_tv3/images/Por Folio'
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if ((key === '--input' || key === '-i') && value) {
      args.inputDir = value;
      i += 1;
      continue;
    }
    if ((key === '--output' || key === '-o') && value) {
      args.outputDir = value;
      i += 1;
    }
  }

  return args;
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/[\r\n\t]/g, '_')
    .split('')
    .map((char) => (char.charCodeAt(0) < 32 ? '_' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFolioAndPage(qrTexto?: string): { folioId: string; pagina?: number } {
  const clean = String(qrTexto ?? '').trim();
  if (!clean) return { folioId: 'SIN_QR' };

  const resumenExamen = extraerResumenQrExamen(clean);
  if (resumenExamen) {
    return {
      folioId: String(resumenExamen.folio ?? '').toUpperCase(),
      pagina: Number.parseInt(String(resumenExamen.numeroPagina ?? ''), 10)
    };
  }

  const omr1Match = /^OMR1:([^:]+):[^:]+:\d+:(\d+):[^:]+$/i.exec(clean);
  if (omr1Match) {
    return {
      folioId: String(omr1Match[1] ?? '').toUpperCase(),
      pagina: Number.parseInt(String(omr1Match[2] ?? ''), 10)
    };
  }

  return { folioId: 'SIN_QR' };
}

function toDataUrl(buffer: Buffer, mime: string) {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function detectarQrConRescate(inputBuffer: Buffer, mime: string): Promise<string | undefined> {
  const direct = await leerQrDesdeImagen(toDataUrl(inputBuffer, mime)).catch(() => undefined);
  if (direct) return direct;

  const meta = await sharp(inputBuffer).metadata();
  const width = Number(meta.width ?? 0);
  const height = Number(meta.height ?? 0);

  const variantes: Buffer[] = [];
  for (const angle of [90, 180, 270, -5, 5, -10, 10]) {
    const rotated = await sharp(inputBuffer)
      .rotate(angle, { background: '#ffffff' })
      .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
      .toBuffer();
    variantes.push(rotated);
  }

  if (width > 0 && height > 0) {
    const boxW = Math.max(220, Math.floor(width * 0.45));
    const boxH = Math.max(220, Math.floor(height * 0.45));
    const corners = [
      { left: 0, top: 0 },
      { left: Math.max(0, width - boxW), top: 0 },
      { left: 0, top: Math.max(0, height - boxH) },
      { left: Math.max(0, width - boxW), top: Math.max(0, height - boxH) }
    ];

    for (const c of corners) {
      const crop = await sharp(inputBuffer)
        .extract({ left: c.left, top: c.top, width: boxW, height: boxH })
        .resize(boxW * 2, boxH * 2, { fit: 'fill' })
        .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
        .toBuffer();
      variantes.push(crop);
    }
  }

  for (const candidate of variantes) {
    const qr = await leerQrDesdeImagen(toDataUrl(candidate, 'image/jpeg')).catch(() => undefined);
    if (qr) return qr;
  }

  return undefined;
}

function splitPairSuffix(fileName: string): { prefix: string; n: number } | null {
  const ext = path.extname(fileName);
  const base = fileName.slice(0, fileName.length - ext.length);
  const match = /^(.*_)(\d+)$/.exec(base);
  if (!match) return null;
  const prefix = String(match[1] ?? '');
  const n = Number.parseInt(String(match[2] ?? ''), 10);
  if (!Number.isFinite(n)) return null;
  return { prefix, n };
}

function inferirSinQrPorPar(items: ItemTrabajo[]) {
  const porNombre = new Map<string, ItemTrabajo>();
  const porPrefijoNumero = new Map<string, Map<number, ItemTrabajo>>();

  for (const item of items) {
    porNombre.set(item.archivoOriginal, item);
    const pair = splitPairSuffix(item.archivoOriginal);
    if (!pair) continue;
    if (!porPrefijoNumero.has(pair.prefix)) porPrefijoNumero.set(pair.prefix, new Map<number, ItemTrabajo>());
    porPrefijoNumero.get(pair.prefix)?.set(pair.n, item);
  }

  for (const item of items) {
    if (item.folioId !== 'SIN_QR') continue;
    const pair = splitPairSuffix(item.archivoOriginal);
    if (!pair) continue;

    const siblings = porPrefijoNumero.get(pair.prefix);
    if (!siblings) continue;

    const candidatoPrevio = siblings.get(pair.n - 1);
    if (candidatoPrevio && candidatoPrevio.folioId !== 'SIN_QR') {
      item.folioId = candidatoPrevio.folioId;
      item.pagina = Number.isFinite(candidatoPrevio.pagina) ? (candidatoPrevio.pagina as number) + 1 : undefined;
      item.metodo = 'inferido_par';
      continue;
    }

    const candidatoSiguiente = siblings.get(pair.n + 1);
    if (candidatoSiguiente && candidatoSiguiente.folioId !== 'SIN_QR') {
      item.folioId = candidatoSiguiente.folioId;
      item.pagina = Number.isFinite(candidatoSiguiente.pagina)
        ? Math.max(1, (candidatoSiguiente.pagina as number) - 1)
        : undefined;
      item.metodo = 'inferido_par';
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const cwd = process.cwd();
  const inputDir = path.resolve(cwd, args.inputDir);
  const outputDir = path.resolve(cwd, args.outputDir);

  await fs.mkdir(outputDir, { recursive: true });

  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /\.(jpg|jpeg|png)$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'es'));

  const trabajo: ItemTrabajo[] = [];

  for (const fileName of files) {
    const fullPath = path.join(inputDir, fileName);
    const buffer = await fs.readFile(fullPath);
    const ext = path.extname(fileName).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    const qrTexto = await detectarQrConRescate(buffer, mime).catch(() => undefined);
    const parsed = extractFolioAndPage(qrTexto);

    trabajo.push({
      archivoOriginal: fileName,
      qrTexto,
      folioId: parsed.folioId,
      pagina: parsed.pagina,
      metodo: parsed.folioId === 'SIN_QR' ? 'sin_qr' : 'qr'
    });
  }

  inferirSinQrPorPar(trabajo);

  const report: ItemReporte[] = [];

  for (const item of trabajo) {
    const folioDir = path.join(outputDir, item.folioId);
    await fs.mkdir(folioDir, { recursive: true });

    const baseName = sanitizeFileName(path.basename(item.archivoOriginal));
    const prefijoPagina = Number.isFinite(item.pagina) ? `P${String(item.pagina).padStart(2, '0')}_` : '';
    const outputName = sanitizeFileName(`${prefijoPagina}${baseName}`);
    const destino = path.join(folioDir, outputName);
    const origen = path.join(inputDir, item.archivoOriginal);

    await fs.copyFile(origen, destino);

    report.push({
      archivoOriginal: item.archivoOriginal,
      qrTexto: item.qrTexto,
      folioId: item.folioId,
      pagina: item.pagina,
      metodo: item.metodo,
      nota: item.folioId === 'SIN_QR' ? 'Folio no detectable; requiere revisión/vinculación manual' : undefined,
      destino: path.relative(cwd, destino).replace(/\\/g, '/')
    });
  }

  const reportPath = path.join(outputDir, '_organizacion_por_folio.json');
  await fs.writeFile(reportPath, `${JSON.stringify({ total: report.length, items: report }, null, 2)}\n`, 'utf8');

  const conteoPorFolio = report.reduce<Record<string, number>>((acc, item) => {
    acc[item.folioId] = (acc[item.folioId] ?? 0) + 1;
    return acc;
  }, {});

  console.log('[organizar-omr-por-alumno] OK');
  console.log(`- Input: ${inputDir}`);
  console.log(`- Output: ${outputDir}`);
  console.log(`- Archivos procesados: ${report.length}`);
  const inferidos = report.filter((item) => item.metodo === 'inferido_par').length;
  const sinQr = report.filter((item) => item.folioId === 'SIN_QR').length;

  console.log(`- Folios detectados: ${Object.keys(conteoPorFolio).length}`);
  console.log(`- Asignados por QR: ${report.length - inferidos - sinQr}`);
  console.log(`- Asignados por inferencia de par: ${inferidos}`);
  console.log(`- Sin folio detectable (SIN_QR): ${sinQr}`);
  for (const [folioId, total] of Object.entries(conteoPorFolio).sort((a, b) => a[0].localeCompare(b[0], 'es'))) {
    console.log(`  - ${folioId}: ${total}`);
  }
  console.log(`- Reporte: ${path.relative(cwd, reportPath).replace(/\\/g, '/')}`);
}

main().catch((error) => {
  console.error('[organizar-omr-por-alumno] ERROR');
  console.error(error);
  process.exit(1);
});
