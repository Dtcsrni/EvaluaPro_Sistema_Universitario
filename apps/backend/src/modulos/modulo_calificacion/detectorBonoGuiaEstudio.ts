import { createRequire } from 'node:module';
import path from 'node:path';
import sharp, { type OutputInfo } from 'sharp';
import { createWorker, PSM } from 'tesseract.js';
import { ALTO_CARTA, ANCHO_CARTA, MM_A_PUNTOS } from '../modulo_generacion_pdf/index.js';
import { obtenerTransformacion } from '../modulo_escaneo_omr/index.js';

export const VERSION_DETECTOR_BONO_GUIA = 'score-zone-ocr-1.0.0';
export const UMBRAL_CONFIANZA_BONO_GUIA = 80;

export type LecturaBonoGuia = { texto: string; confianza: number; coincide: boolean };
export type ResultadoBonoGuia = {
  estado: 'detectado' | 'no_detectado' | 'requiere_revision';
  bonoSugerido: number;
  confianza: number | null;
  lecturas: LecturaBonoGuia[];
  numeroPagina: number | null;
  region: { x: number; y: number; width: number; height: number } | null;
  imagenRegionBase64?: string;
  versionDetector: string;
  motivo: string;
};

type Caja = { x: number; y: number; width: number; height: number };
type PaginaPlantilla = {
  numeroPagina?: number; numero?: number;
  qr?: { x: number; y: number; size: number; marginModules?: number; matrixModules?: number };
  marcasPagina?: { tipo?: 'lineas' | 'cuadrados'; size?: number; quietZone?: number; orientacion?: { esquina: 'tl'; tipo: 'centro_vacio'; radio: number }; tl?: { x: number; y: number }; tr?: { x: number; y: number }; bl?: { x: number; y: number }; br?: { x: number; y: number } };
  layoutDebug?: { pageShell?: Caja; headerTextBlocks?: Array<Caja & { id: string }>; headerFieldBoxes?: Array<Caja & { id: string }> };
};
type PaginaCaptura = { numeroPagina: number; imagenBase64: string };
type Lector = Awaited<ReturnType<typeof createWorker>>;
const require = createRequire(import.meta.url);
const rutaDatosEspanol = path.join(path.dirname(require.resolve('@tesseract.js-data/spa')), '4.0.0_best_int');

function extraerImagen(base64: string): Buffer | null {
  const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,([\s\S]+)$/i.exec(String(base64 ?? '').trim());
  const contenido = match?.[1] ?? String(base64 ?? '').trim();
  if (!contenido) return null;
  try { const bytes = Buffer.from(contenido.replace(/\s+/g, ''), 'base64'); return bytes.length ? bytes : null; } catch { return null; }
}
function contieneBono(texto: string): boolean {
  const normalizado = String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, '');
  return /\+0[.,]25/.test(normalizado);
}
export function consensuarLecturasBonoGuia(lecturas: [LecturaBonoGuia, LecturaBonoGuia]): ResultadoBonoGuia['estado'] {
  const [primera, segunda] = lecturas;
  if (primera.coincide && segunda.coincide && primera.confianza >= UMBRAL_CONFIANZA_BONO_GUIA && segunda.confianza >= UMBRAL_CONFIANZA_BONO_GUIA) return 'detectado';
  if (primera.coincide || segunda.coincide) return 'requiere_revision';
  return 'no_detectado';
}
async function crearLector(): Promise<Lector> {
  const worker = await createWorker('spa', 1, { langPath: rutaDatosEspanol, gzip: true });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, tessedit_char_whitelist: '+0123456789., ' });
  return worker;
}
function resolverZona(pagina: PaginaPlantilla): Caja | null {
  const layout = pagina.layoutDebug;
  const etiqueta = layout?.headerTextBlocks?.find((item) => item.id === 'calificacion-etiqueta');
  const linea = layout?.headerFieldBoxes?.find((item) => item.id === 'calificacion-linea');
  if (!etiqueta || !linea) return null;
  const x = Math.min(etiqueta.x, linea.x) - 3;
  const derecha = Math.max(etiqueta.x + etiqueta.width, linea.x + linea.width) + 3;
  const abajo = etiqueta.y - 6;
  const arriba = etiqueta.y + etiqueta.height + 38;
  const shell = layout?.pageShell;
  const x0 = Math.max(shell?.x ?? 0, x), y0 = Math.max(shell?.y ?? 0, abajo);
  const x1 = Math.min((shell?.x ?? 0) + (shell?.width ?? ANCHO_CARTA), derecha);
  const y1 = Math.min((shell?.y ?? 0) + (shell?.height ?? ALTO_CARTA), arriba);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}
function construirResultado(args: Partial<ResultadoBonoGuia> & Pick<ResultadoBonoGuia, 'estado' | 'motivo'>): ResultadoBonoGuia {
  return { bonoSugerido: args.estado === 'detectado' ? 0.25 : 0, confianza: args.confianza ?? null, lecturas: args.lecturas ?? [], numeroPagina: args.numeroPagina ?? null, region: args.region ?? null, ...(args.imagenRegionBase64 ? { imagenRegionBase64: args.imagenRegionBase64 } : {}), versionDetector: VERSION_DETECTOR_BONO_GUIA, estado: args.estado, motivo: args.motivo };
}

export async function detectarBonoGuiaEstudio(args: {
  capturas: PaginaCaptura[]; paginasPlantilla: PaginaPlantilla[]; margenMm: number; qrSizePts: number;
}): Promise<ResultadoBonoGuia> {
  const paginaPlantilla = (Array.isArray(args.paginasPlantilla) ? args.paginasPlantilla : []).find((pagina) => {
    const layout = pagina.layoutDebug;
    return Boolean(layout?.headerTextBlocks?.some((item) => item.id === 'calificacion-etiqueta') && layout.headerFieldBoxes?.some((item) => item.id === 'calificacion-linea'));
  });
  if (!paginaPlantilla) return construirResultado({ estado: 'requiere_revision', motivo: 'La plantilla no define una zona identificable para la marca de guía de estudio.' });
  const numeroPagina = Number(paginaPlantilla.numeroPagina ?? paginaPlantilla.numero ?? 1);
  const captura = (Array.isArray(args.capturas) ? args.capturas : []).find((pagina) => Number(pagina.numeroPagina) === numeroPagina);
  if (!captura) return construirResultado({ estado: 'requiere_revision', numeroPagina, motivo: 'Falta la captura de la página que contiene la zona de calificación.' });
  const zona = resolverZona(paginaPlantilla), origen = extraerImagen(captura.imagenBase64);
  if (!zona || !origen) return construirResultado({ estado: 'requiere_revision', numeroPagina, motivo: 'No se pudo ubicar o decodificar la zona de calificación.' });
  let imagen: { data: Buffer; info: OutputInfo };
  try { imagen = await sharp(origen).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true }); }
  catch { return construirResultado({ estado: 'requiere_revision', numeroPagina, motivo: 'No se pudo preparar la captura para el OCR.' }); }
  const { width: ancho, height: alto, channels } = imagen.info;
  if (ancho < 500 || alto < 500 || channels !== 4) return construirResultado({ estado: 'requiere_revision', numeroPagina, motivo: 'La captura tiene resolución insuficiente para OCR manuscrito.' });
  const rgba = new Uint8ClampedArray(imagen.data.buffer, imagen.data.byteOffset, imagen.data.byteLength), gray = new Uint8ClampedArray(ancho * alto);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p += 1) gray[p] = Math.round(0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!);
  const transformacion = obtenerTransformacion(gray, ancho, alto, [], null, { margenMm: args.margenMm, qrSizePts: args.qrSizePts, qrGeometry: paginaPlantilla.qr, marcasPagina: paginaPlantilla.marcasPagina, anchoCarta: ANCHO_CARTA, altoCarta: ALTO_CARTA, mmAPuntos: MM_A_PUNTOS });
  if (transformacion.tipo === 'escala' || Number(transformacion.referenciaPagina?.calidad ?? 0) < 0.68) return construirResultado({ estado: 'requiere_revision', numeroPagina, motivo: 'No hay fiduciales/QR con geometría suficiente para ubicar la zona con precisión.' });
  const puntos = [transformacion.transformar({ x: zona.x, y: zona.y + zona.height }), transformacion.transformar({ x: zona.x + zona.width, y: zona.y + zona.height }), transformacion.transformar({ x: zona.x + zona.width, y: zona.y }), transformacion.transformar({ x: zona.x, y: zona.y })];
  const izquierda = Math.floor(Math.min(...puntos.map((p) => p.x))), arriba = Math.floor(Math.min(...puntos.map((p) => p.y)));
  const derecha = Math.ceil(Math.max(...puntos.map((p) => p.x))), abajo = Math.ceil(Math.max(...puntos.map((p) => p.y)));
  const region = { x: Math.max(0, izquierda), y: Math.max(0, arriba), width: Math.min(ancho, derecha) - Math.max(0, izquierda), height: Math.min(alto, abajo) - Math.max(0, arriba) };
  if (region.width < 80 || region.height < 24) return construirResultado({ estado: 'requiere_revision', numeroPagina, region, motivo: 'La zona proyectada quedó fuera de límites o es demasiado pequeña.' });
  const recorteRect = { left: region.x, top: region.y, width: region.width, height: region.height }, recorte = sharp(imagen.data, { raw: { width: ancho, height: alto, channels: 4 } }).extract(recorteRect).removeAlpha().greyscale().normalise();
  let varianteA: Buffer, varianteB: Buffer, evidencia: Buffer;
  try { [varianteA, varianteB, evidencia] = await Promise.all([recorte.clone().threshold(155).resize({ width: 1600 }).png().toBuffer(), recorte.clone().sharpen({ sigma: 1 }).threshold(185).resize({ width: 1600 }).png().toBuffer(), sharp(imagen.data, { raw: { width: ancho, height: alto, channels: 4 } }).extract(recorteRect).png().toBuffer()]); }
  catch { return construirResultado({ estado: 'requiere_revision', numeroPagina, region, motivo: 'No se pudo extraer la zona proyectada de calificación.' }); }
  let worker: Lector;
  try { worker = await crearLector(); } catch { return construirResultado({ estado: 'requiere_revision', numeroPagina, region, motivo: 'El OCR local no está disponible; no se concedió el bono.' }); }
  try {
    const [a, b] = await Promise.all([worker.recognize(varianteA), worker.recognize(varianteB)]);
    const lecturas: [LecturaBonoGuia, LecturaBonoGuia] = [{ texto: String(a.data.text ?? '').trim(), confianza: Number(a.data.confidence ?? 0), coincide: contieneBono(String(a.data.text ?? '')) }, { texto: String(b.data.text ?? '').trim(), confianza: Number(b.data.confidence ?? 0), coincide: contieneBono(String(b.data.text ?? '')) }];
    const estado = consensuarLecturasBonoGuia(lecturas);
    return construirResultado({ estado, motivo: estado === 'detectado' ? 'Dos lecturas OCR independientes coinciden en +0.25 dentro de la zona de calificación.' : estado === 'requiere_revision' ? 'Lectura parcial o confianza insuficiente; el bono no se aplica automáticamente.' : 'No se detectó +0.25 en la zona de calificación.', confianza: Math.min(...lecturas.map((lectura) => lectura.confianza)), lecturas, numeroPagina, region, imagenRegionBase64: `data:image/png;base64,${evidencia.toString('base64')}` });
  } finally { await worker.terminate(); }
}
