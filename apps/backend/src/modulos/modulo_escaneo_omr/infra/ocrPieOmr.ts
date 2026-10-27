import { createRequire } from 'node:module';
import path from 'node:path';
import sharp from 'sharp';
import { createWorker, PSM } from 'tesseract.js';

export type ReferenciaPieOmr = { folio: string; numeroPagina: number; confianza: number };
export type LectorPieOmr = Awaited<ReturnType<typeof createWorker>>;

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
const UMBRAL_CONFIANZA_OCR_PIE = 75;
const ESCALA_OCR_PIE = 4;
const LISTA_CARACTERES_OCR_PIE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-.:·•+/|';
const PATRON_REFERENCIA_PIE = /\b(?:FOLIO\s+)?([A-Z0-9][A-Z0-9_-]{3,47})\s*(?:[·•:/+-]\s*)?(?:P\s*A\s*G?\s*I\s*N\s*A|P)\.?\s*(\d{1,2}|[IL|Z])(?:\s*DE\s*\d{1,2})?(?=$|[\s.,;])/g;

/** Construye el worker desde los assets locales para que el OCR no requiera red. */
export async function crearLectorPieOmr(): Promise<LectorPieOmr> {
  const rutaDatosSpa = path.join(path.dirname(require.resolve('@tesseract.js-data/spa')), '4.0.0_best_int');
  const worker = await createWorker('spa', 1, { langPath: rutaDatosSpa, gzip: true });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    tessedit_char_whitelist: LISTA_CARACTERES_OCR_PIE
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
  lecturas: [ReferenciaPieOmr | null, ReferenciaPieOmr | null],
  umbralConfianza = UMBRAL_CONFIANZA_OCR_PIE
): ReferenciaPieOmr | null {
  const [primera, segunda] = lecturas;
  if (!primera || !segunda) return null;
  if (primera.confianza < umbralConfianza || segunda.confianza < umbralConfianza) return null;
  if (primera.folio !== segunda.folio || primera.numeroPagina !== segunda.numeroPagina) return null;
  return { ...primera, confianza: Math.min(primera.confianza, segunda.confianza) };
}

/** Devuelve identidad solo si dos posiciones distintas del pie coinciden tras orientar la página. */
export async function leerReferenciaPieOmr(
  dataUrl: string,
  worker: LectorPieOmr
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
    const resultadosAntesOrientacion = resultados.length;
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
    // Los escáneres móviles agregan márgenes blancos y desplazan el pie hacia
    // arriba respecto al PDF canónico. Conserva primero la banda original y
    // prueba una banda superior solo si no logra consenso.
    for (const topRatio of [0.94, 0.88]) {
      const lecturas: Array<ReferenciaPieOmr | null> = [];
      for (const posicion of posiciones) {
        const left = Math.floor(paginaAncho * posicion.left);
        const top = Math.floor(paginaAlto * topRatio);
        const width = Math.floor(paginaAncho * posicion.width);
        const height = Math.floor(paginaAlto * 0.055);
        if (width < 3 || height < 3 || left + width > paginaAncho || top + height > paginaAlto) {
          lecturas.push(null);
          continue;
        }
        const recorte = sharp(pagina)
          .extract({ left, top, width, height })
          .greyscale()
          .normalise();
        const preparaciones = [
          () => recorte.clone().threshold(165).resize({ width: Math.floor(width * ESCALA_OCR_PIE) }).png().toBuffer(),
          () => recorte.clone().resize({ width: Math.floor(width * ESCALA_OCR_PIE) }).png().toBuffer(),
          () => recorte.clone().sharpen({ sigma: 1 }).resize({ width: Math.floor(width * ESCALA_OCR_PIE) }).png().toBuffer()
        ];
        let lecturaValida: ReferenciaPieOmr | undefined;
        for (const preparar of preparaciones) {
          const variante = await preparar();
          const { data } = await worker.recognize(variante);
          const confianza = Number(data.confidence ?? 0);
          const referencias = Number.isFinite(confianza) && confianza >= UMBRAL_CONFIANZA_OCR_PIE
            ? extraerReferenciasPieOmr(String(data.text ?? ''))
            : [];
          if (referencias.length === 1) {
            lecturaValida = { ...referencias[0]!, confianza };
            break;
          }
        }
        lecturas.push(lecturaValida ?? null);
      }
      const consenso = consensuarReferenciasPieOmr([lecturas[0] ?? null, lecturas[1] ?? null]);
      if (consenso) {
        resultados.push(consenso);
        break;
      }
    }

    // CamScanner agrega una banda blanca bajo la hoja y desplaza el pie
    // impreso. En ese formato, los dos rótulos no caen dentro de las ventanas
    // horizontales canónicas. Lee dos bandas verticales del rótulo derecho;
    // solo acepta referencias exactas si ambas superan el umbral y coinciden.
    if (resultados.length === resultadosAntesOrientacion) {
      const perfilCamScanner = [
        { top: 0.908, alto: 0.02, umbral: 155 },
        { top: 0.912, alto: 0.018, umbral: 165 }
      ] as const;
      const lecturas: Array<ReferenciaPieOmr | null> = [];
      await worker.setParameters({ tessedit_char_whitelist: '' });
      try {
        for (const perfil of perfilCamScanner) {
          const left = Math.floor(paginaAncho * 0.61);
          const top = Math.floor(paginaAlto * perfil.top);
          const width = Math.floor(paginaAncho * 0.29);
          const height = Math.floor(paginaAlto * perfil.alto);
          if (width < 3 || height < 3 || left + width > paginaAncho || top + height > paginaAlto) {
            lecturas.push(null);
            continue;
          }
          const variante = await sharp(pagina)
            .extract({ left, top, width, height })
            .greyscale()
            .normalise()
            .threshold(perfil.umbral)
            .resize({ width: width * 8 })
            .png()
            .toBuffer();
          const { data } = await worker.recognize(variante);
          const confianza = Number(data.confidence ?? 0);
          const referencias = Number.isFinite(confianza) && confianza >= UMBRAL_CONFIANZA_OCR_PIE
            ? extraerReferenciasPieOmr(String(data.text ?? ''))
            : [];
          lecturas.push(referencias.length === 1
            ? { ...referencias[0]!, confianza }
            : null);
        }
      } finally {
        await worker.setParameters({ tessedit_char_whitelist: LISTA_CARACTERES_OCR_PIE });
      }
      const consenso = consensuarReferenciasPieOmr([lecturas[0] ?? null, lecturas[1] ?? null]);
      if (consenso) resultados.push(consenso);
    }

    // CamScanner puede estirar el pie y mover las dos referencias a la misma
    // banda. Lee sus mitades por separado: un consenso moderado solo genera
    // una sugerencia para confirmación visual, nunca valida el QR ni autoriza
    // la calificación.
    if (resultados.length === resultadosAntesOrientacion) {
      const posicionesPie = [
        { left: 0.05, top: 0.915, width: 0.45, height: 0.03 },
        { left: 0.5, top: 0.91, width: 0.45, height: 0.025 }
      ] as const;
      const lecturas: Array<ReferenciaPieOmr | null> = [];
      for (const posicion of posicionesPie) {
        const left = Math.floor(paginaAncho * posicion.left);
        const top = Math.floor(paginaAlto * posicion.top);
        const width = Math.floor(paginaAncho * posicion.width);
        const height = Math.floor(paginaAlto * posicion.height);
        if (width < 3 || height < 3 || left + width > paginaAncho || top + height > paginaAlto) {
          lecturas.push(null);
          continue;
        }
        const variante = await sharp(pagina)
          .extract({ left, top, width, height })
          .greyscale()
          .normalise()
          .resize({ width: width * 7 })
          .png()
          .toBuffer();
        const { data } = await worker.recognize(variante);
        const confianza = Number(data.confidence ?? 0);
        const referencias = Number.isFinite(confianza) && confianza >= 50
          ? extraerReferenciasPieOmr(String(data.text ?? ''))
          : [];
        lecturas.push(referencias.length === 1 ? { ...referencias[0]!, confianza } : null);
      }
      const consenso = consensuarReferenciasPieOmr(
        [lecturas[0] ?? null, lecturas[1] ?? null],
        50
      );
      if (consenso) resultados.push(consenso);
    }
  }

  const identidades = new Map(resultados.map((resultado) => [`${resultado.folio}:${resultado.numeroPagina}`, resultado]));
  return identidades.size === 1 ? [...identidades.values()][0] ?? null : null;
}

export type CajaCampoPdfOmr = { x: number; y: number; width: number; height: number };

/**
 * Reconoce el bono solo si dos preparaciones independientes leen literalmente
 * `+0.25` dentro de la caja de calificación indicada por el mapa del PDF.
 * Una lectura negativa no demuestra que el campo esté vacío: ante ausencia de
 * caja, baja confianza o error de OCR devuelve null para forzar revisión.
 */
export async function leerBonoVisibleOmr(
  dataUrl: string,
  cajaPdf: CajaCampoPdfOmr,
  opciones: { crearWorker?: typeof crearLectorPieOmr; umbralConfianza?: number } = {}
) : Promise<{ bono: 0 | 0.25 | null; confianza: number }> {
  const separador = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:image/') || separador < 0) return { bono: null, confianza: 0 };
  if (![cajaPdf.x, cajaPdf.y, cajaPdf.width, cajaPdf.height].every(Number.isFinite) || cajaPdf.width <= 0 || cajaPdf.height <= 0) {
    return { bono: null, confianza: 0 };
  }

  const imagen = Buffer.from(dataUrl.slice(separador + 1), 'base64');
  const rotada = await sharp(imagen).rotate().png().toBuffer();
  const metadata = await sharp(rotada).metadata();
  const width = Number(metadata.width ?? 0);
  const height = Number(metadata.height ?? 0);
  if (width < 160 || height < 160) return { bono: null, confianza: 0 };

  // `layoutDebug` usa puntos PDF con origen inferior izquierdo; sharp usa
  // píxeles desde arriba a la izquierda. Se amplía la línea de escritura 7 pt.
  const escalaX = width / 612;
  const escalaY = height / 792;
  const pad = Math.round(7 * escalaY);
  const left = Math.max(0, Math.floor(cajaPdf.x * escalaX));
  const top = Math.max(0, Math.floor((792 - cajaPdf.y - cajaPdf.height) * escalaY) - pad);
  const right = Math.min(width, Math.ceil((cajaPdf.x + cajaPdf.width) * escalaX));
  const bottom = Math.min(height, Math.ceil((792 - cajaPdf.y) * escalaY) + pad);
  if (right <= left || bottom <= top) return { bono: null, confianza: 0 };

  const ancho = right - left;
  const alto = bottom - top;
  let worker: LectorPieOmr | undefined;
  try {
    worker = await (opciones.crearWorker ?? crearLectorPieOmr)();
    const lectorActivo = worker;
    await lectorActivo.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist: '+0123456789.'
    });
    const base = sharp(rotada).extract({ left, top, width: ancho, height: alto }).greyscale().normalise();
    const variantes = await Promise.all([
      base.clone().threshold(165).resize({ width: Math.max(400, ancho * 5) }).withMetadata({ density: 300 }).png().toBuffer(),
      base.clone().threshold(210).resize({ width: Math.max(400, ancho * 5) }).withMetadata({ density: 300 }).png().toBuffer()
    ]);
    const lecturas = await Promise.all(variantes.map((variante) => lectorActivo.recognize(variante)));
    const umbral = opciones.umbralConfianza ?? UMBRAL_CONFIANZA_OCR_PIE;
    const lecturasValidas = lecturas.map(({ data }) => ({
      coincide: /(?:^|\s)\+\s*0\.25(?:\s|$)/.test(String(data.text ?? '').replace(/\s+/g, ' ').trim()),
      confianza: Number(data.confidence ?? 0)
    }));
    const confianza = Math.min(...lecturasValidas.map((lectura) => Number.isFinite(lectura.confianza) ? lectura.confianza : 0));
    const confirmado = lecturasValidas.length === 2 && lecturasValidas.every((lectura) => lectura.coincide && lectura.confianza >= umbral);
    return { bono: confirmado ? 0.25 : null, confianza: confirmado ? confianza : 0 };
  } catch {
    return { bono: null, confianza: 0 };
  } finally {
    if (worker) await worker.terminate().catch(() => undefined);
  }
}
