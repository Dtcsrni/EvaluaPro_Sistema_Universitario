import { createRequire } from 'node:module';
import path from 'node:path';
import sharp from 'sharp';
import { createWorker, PSM } from 'tesseract.js';

export type ReferenciaPieOmr = { folio: string; numeroPagina: number; confianza: number };
export type LectorPieOmr = Awaited<ReturnType<typeof createWorker>>;
export type TrazaLecturaPieOmr = {
  rotacion: number;
  region: number;
  preparacion: number;
  segmentacion: string;
  confianza: number;
  texto: string;
};

export function limitarTiempoOcrPie<T>(operacion: Promise<T>, timeoutMs = 15_000): Promise<T> {
  let temporizador: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_resolve, reject) => {
    temporizador = setTimeout(() => {
      reject(Object.assign(new Error('El OCR auxiliar excedió el tiempo máximo'), { code: 'OMR_OCR_TIMEOUT' }));
    }, timeoutMs);
  });
  return Promise.race([operacion, limite]).finally(() => {
    if (temporizador) clearTimeout(temporizador);
  });
}

const require = createRequire(import.meta.url);
const UMBRAL_CONFIANZA_OCR_PIE = 65;
const ESCALA_OCR_PIE = 4;
const PATRON_REFERENCIA_PIE = /\b(?:FOLIO\s+)?([A-Z0-9][A-Z0-9_-]{3,47})\s*(?:[·•:/+-]\s*)?(?:PAGINA|P)\.?\s*(\d{1,2}|[IL|Z])(?:\s+DE\s+(?:\d{1,2}|[IL|Z]))?(?=$|[\s.,;])/g;

/** Construye el worker desde los assets locales para que el OCR no requiera red. */
export async function crearLectorPieOmr(): Promise<LectorPieOmr> {
  const rutaDatosSpa = path.join(path.dirname(require.resolve('@tesseract.js-data/spa')), '4.0.0_best_int');
  const worker = await createWorker('spa', 1, { langPath: rutaDatosSpa, gzip: true });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-.:·•+/|'
  });
  return worker;
}

export function extraerReferenciasPieOmr(texto: string): Array<{ folio: string; numeroPagina: number }> {
  const normalizado = String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  PATRON_REFERENCIA_PIE.lastIndex = 0;
  return Array.from(normalizado.matchAll(PATRON_REFERENCIA_PIE)).flatMap((coincidencia) => {
    const folio = String(coincidencia[1] ?? '').replace(/[^A-Z0-9_-]/g, '');
    const paginaLeida = String(coincidencia[2] ?? '');
    const numeroPagina = /^[IL|]$/.test(paginaLeida) ? 1 : paginaLeida === 'Z' ? 2 : Number(paginaLeida);
    return folio.length >= 4 && numeroPagina >= 1 && numeroPagina <= 50
      ? [{ folio, numeroPagina }]
      : [];
  });
}

/** Acepta identidad OCR únicamente con dos lecturas independientes exactas. */
export function consensuarReferenciasPieOmr(
  lecturas: [ReferenciaPieOmr | null, ReferenciaPieOmr | null]
): ReferenciaPieOmr | null {
  const [primera, segunda] = lecturas;
  if (!primera || !segunda) return null;
  if (primera.confianza < UMBRAL_CONFIANZA_OCR_PIE || segunda.confianza < UMBRAL_CONFIANZA_OCR_PIE) return null;
  if (primera.folio !== segunda.folio || primera.numeroPagina !== segunda.numeroPagina) return null;
  return { ...primera, confianza: Math.min(primera.confianza, segunda.confianza) };
}

/** Devuelve identidad solo si dos posiciones distintas del pie coinciden tras orientar la página. */
export async function leerReferenciaPieOmr(
  dataUrl: string,
  worker: LectorPieOmr,
  registrarTraza?: (lectura: TrazaLecturaPieOmr) => void
): Promise<ReferenciaPieOmr | null> {
  const separador = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:image/') || separador < 0) return null;
  const imagen = Buffer.from(dataUrl.slice(separador + 1), 'base64');
  const normalizada = await sharp(imagen).rotate().png().toBuffer();
  const metadata = await sharp(normalizada).metadata();
  const ancho = Number(metadata.width ?? 0);
  const alto = Number(metadata.height ?? 0);
  if (ancho < 160 || alto < 160) return null;

  const gradosCandidatos = alto >= ancho ? [0, 180] : [90, 270];
  const resultados: ReferenciaPieOmr[] = [];
  for (const grados of gradosCandidatos) {
    const pagina = grados === 0
      ? normalizada
      : await sharp(normalizada).rotate(grados).png().toBuffer();
    const info = await sharp(pagina).metadata();
    const paginaAncho = Number(info.width ?? 0);
    const paginaAlto = Number(info.height ?? 0);
    if (paginaAncho < 160 || paginaAlto < paginaAncho) continue;
    const posiciones = [
      { left: 0.1, width: 0.38 },
      { left: 0.52, width: 0.38 }
    ] as const;
    const lecturas: Array<ReferenciaPieOmr | null> = [];
    for (const [indiceRegion, posicion] of posiciones.entries()) {
      const left = Math.floor(paginaAncho * posicion.left);
      const width = Math.floor(paginaAncho * posicion.width);
      if (width < 3 || left + width > paginaAncho) {
        lecturas.push(null);
        continue;
      }
      const margenOcr = 32;
      const ventanas = [
        { top: 0.94, height: 0.055 },
        { top: 0.92, height: 0.055 },
        { top: 0.96, height: 0.035 }
      ] as const;
      let lecturaValida: ReferenciaPieOmr | undefined;
      const admiteModoAlternativo = typeof worker.setParameters === 'function';
      try {
        for (const [indiceVentana, ventana] of ventanas.entries()) {
          const top = Math.floor(paginaAlto * ventana.top);
          const height = Math.floor(paginaAlto * ventana.height);
          if (height < 3 || top + height > paginaAlto) continue;
          const recorte = sharp(pagina)
            .extract({ left, top, width, height })
            .greyscale()
            .normalise();
          const preparaciones = [
            () => recorte.clone().threshold(165).resize({ width: Math.floor(width * ESCALA_OCR_PIE) })
              .extend({ top: margenOcr, bottom: margenOcr, left: margenOcr, right: margenOcr, background: '#ffffff' }).png().toBuffer(),
            () => recorte.clone().resize({ width: Math.floor(width * ESCALA_OCR_PIE) })
              .extend({ top: margenOcr, bottom: margenOcr, left: margenOcr, right: margenOcr, background: '#ffffff' }).png().toBuffer(),
            () => recorte.clone().sharpen({ sigma: 1 }).resize({ width: Math.floor(width * ESCALA_OCR_PIE) })
              .extend({ top: margenOcr, bottom: margenOcr, left: margenOcr, right: margenOcr, background: '#ffffff' }).png().toBuffer()
          ];
          for (const [indicePreparacion, preparar] of preparaciones.entries()) {
            const variante = await preparar();
            const modosSegmentacion = admiteModoAlternativo
              ? [PSM.SINGLE_LINE, PSM.SINGLE_BLOCK, PSM.SPARSE_TEXT]
              : [PSM.SINGLE_LINE];
            for (const modoSegmentacion of modosSegmentacion) {
              if (admiteModoAlternativo) await worker.setParameters({ tessedit_pageseg_mode: modoSegmentacion });
              const { data } = await worker.recognize(variante);
              const confianza = Number(data.confidence ?? 0);
              registrarTraza?.({
                rotacion: grados,
                region: indiceRegion,
                preparacion: indiceVentana * preparaciones.length + indicePreparacion,
                segmentacion: modoSegmentacion,
                confianza,
                texto: String(data.text ?? '').slice(0, 240)
              });
              const referencias = Number.isFinite(confianza) && confianza >= UMBRAL_CONFIANZA_OCR_PIE
                ? extraerReferenciasPieOmr(String(data.text ?? ''))
                : [];
              if (referencias.length === 1) {
                lecturaValida = { ...referencias[0]!, confianza };
                break;
              }
            }
            if (lecturaValida) break;
          }
          if (lecturaValida) break;
        }
      } finally {
        if (admiteModoAlternativo) await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
      }
      lecturas.push(lecturaValida ?? null);
    }
    const consenso = consensuarReferenciasPieOmr([lecturas[0] ?? null, lecturas[1] ?? null]);
    if (consenso) resultados.push(consenso);
  }

  const identidades = new Map(resultados.map((resultado) => [`${resultado.folio}:${resultado.numeroPagina}`, resultado]));
  return identidades.size === 1 ? [...identidades.values()][0] ?? null : null;
}
