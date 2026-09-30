type WorkerOcr = {
  recognize(image: string): Promise<{ data?: { text?: string; confidence?: number } }>;
  terminate(): Promise<unknown>;
};

export type ReferenciaPieOmr = { folio: string; numeroPagina: number };
export type RecortePieOmr = {
  left: number;
  top: number;
  width: number;
  height: number;
  rotacionGrados: 0 | 90 | 180 | 270;
};

/** Franjas candidatas del pie según la orientación de la captura. */
export function calcularRecortesPieOmr(ancho: number, alto: number): RecortePieOmr[] {
  if (!Number.isFinite(ancho) || !Number.isFinite(alto) || ancho < 160 || alto < 160) return [];
  if (ancho >= alto) {
    return [
      { left: 0.01, top: 0.2, width: 0.09, height: 0.6, rotacionGrados: 270 },
      { left: 0.9, top: 0.2, width: 0.09, height: 0.6, rotacionGrados: 90 }
    ];
  }
  return [
    { left: 0.2, top: 0.91, width: 0.6, height: 0.08, rotacionGrados: 0 },
    { left: 0.2, top: 0.01, width: 0.6, height: 0.08, rotacionGrados: 180 }
  ];
}

/** Import diferido estático para que Vite empaquete Tesseract en lugar de dejar
 * un import bare que el navegador no puede resolver sin un import map. */
export function cargarModuloTesseract() {
  return import('tesseract.js');
}

export async function leerTextoConOcrDetallado(
  dataUrl: string,
  crearWorker: (languages: string) => Promise<WorkerOcr>
): Promise<{ texto: string; confianza: number }> {
  const [lectura] = await leerTextosConOcrDetallado([dataUrl], crearWorker);
  return lectura ?? { texto: '', confianza: 0 };
}

/** Reutiliza un único worker al inspeccionar varias franjas de una misma hoja. */
export async function leerTextosConOcrDetallado(
  dataUrls: readonly string[],
  crearWorker: (languages: string) => Promise<WorkerOcr>
): Promise<Array<{ texto: string; confianza: number }>> {
  if (dataUrls.length === 0) return [];
  const worker = await crearWorker('spa+eng');
  try {
    const lecturas: Array<{ texto: string; confianza: number }> = [];
    for (const dataUrl of dataUrls) {
      const resultado = await worker.recognize(dataUrl);
      const confianza = Number(resultado.data?.confidence ?? 0);
      lecturas.push({
        texto: String(resultado.data?.text ?? '').trim(),
        confianza: Number.isFinite(confianza) ? Math.max(0, Math.min(100, confianza)) : 0
      });
    }
    return lecturas;
  } finally {
    await worker.terminate();
  }
}

export async function leerTextoConOcr(
  dataUrl: string,
  crearWorker: (languages: string) => Promise<WorkerOcr>
): Promise<string> {
  return (await leerTextoConOcrDetallado(dataUrl, crearWorker)).texto;
}

/** Extrae solo un folio y una página inequívocos del texto impreso del pie. */
export function extraerReferenciaPieOmr(texto: string): ReferenciaPieOmr | null {
  const normalizado = String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  const coincidencias = Array.from(
    normalizado.matchAll(/\b([A-Z0-9][A-Z0-9_-]{3,47})\s*(?:[·•:/-]\s*)?(?:PAGINA|P)\.?\s*(\d{1,2}|[IL|])(?=$|[\s.,;])/g)
  ).map((coincidencia) => {
    const tokenPagina = String(coincidencia[2] ?? '');
    return {
      folio: String(coincidencia[1] ?? '').replace(/[^A-Z0-9_-]/g, ''),
      // OCR suele confundir el dígito 1 con I, l (normalizada arriba a L) o
      // una barra vertical. Solo se normaliza este token; el folio sigue
      // exigiendo coincidencia literal y el backend valida examen y página.
      numeroPagina: /^[IL|]$/.test(tokenPagina) ? 1 : Number(tokenPagina)
    };
  }).filter((item) => item.folio.length >= 4 && item.numeroPagina >= 1 && item.numeroPagina <= 50);

  if (coincidencias.length === 0) return null;
  const unicas = new Map(coincidencias.map((item) => [`${item.folio}:${item.numeroPagina}`, item]));
  return unicas.size === 1 ? [...unicas.values()][0] ?? null : null;
}

/** Acepta una identidad solo si las lecturas con confianza suficiente coinciden. */
export function resolverReferenciaPieOmr(
  lecturas: readonly { texto: string; confianza: number }[],
  confianzaMinima = 75
): ReferenciaPieOmr | null {
  const candidatas = lecturas.flatMap((lectura) => {
    if (!Number.isFinite(lectura.confianza) || lectura.confianza < confianzaMinima) return [];
    const referencia = extraerReferenciaPieOmr(lectura.texto);
    return referencia ? [referencia] : [];
  });
  const unicas = new Map(candidatas.map((referencia) => [`${referencia.folio}:${referencia.numeroPagina}`, referencia]));
  return unicas.size === 1 ? [...unicas.values()][0] ?? null : null;
}

/** Un QR decodificado no identifica la página si el backend reportó mismatch. */
export function qrIdentificaPagina(qrTexto: string | undefined, advertencias: readonly string[] = []): boolean {
  if (!qrTexto?.trim()) return false;
  return !advertencias.some((advertencia) =>
    String(advertencia ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('qr no coincide')
  );
}

export async function analizarOmrConFallbackPie<T>(params: {
  folioManual: string;
  paginaManual: number;
  analizar: (folio: string, numeroPagina: number) => Promise<T>;
  leerPie: () => Promise<ReferenciaPieOmr | null>;
  tieneQr: (resultado: T) => boolean;
  puedeUsarFallback: (error: unknown) => boolean;
}): Promise<{ resultado: T; referenciaPie: ReferenciaPieOmr | null }> {
  const folio = params.folioManual.trim().toUpperCase();
  const pagina = params.paginaManual > 0 ? params.paginaManual : 0;
  let resultado: T;
  try {
    resultado = await params.analizar(folio, pagina);
  } catch (error) {
    if (!params.puedeUsarFallback(error) || (folio && pagina > 0)) throw error;
    const referenciaPie = await params.leerPie();
    if (!referenciaPie) throw error;
    validarCoincidenciaManual(folio, pagina, referenciaPie);
    resultado = await params.analizar(referenciaPie.folio, referenciaPie.numeroPagina);
    return { resultado, referenciaPie };
  }

  if (params.tieneQr(resultado) || (folio && pagina > 0)) {
    return { resultado, referenciaPie: null };
  }
  const referenciaPie = await params.leerPie();
  if (!referenciaPie) {
    throw new Error('No se leyó el QR ni se identificó con claridad el folio y la página del pie; captura ambos datos manualmente.');
  }
  validarCoincidenciaManual(folio, pagina, referenciaPie);
  resultado = await params.analizar(referenciaPie.folio, referenciaPie.numeroPagina);
  return { resultado, referenciaPie };
}

function validarCoincidenciaManual(folio: string, pagina: number, referenciaPie: ReferenciaPieOmr) {
  if ((folio && folio !== referenciaPie.folio) || (pagina > 0 && pagina !== referenciaPie.numeroPagina)) {
    throw new Error('El folio o la página del pie no coincide con los datos indicados; revisa la captura manualmente.');
  }
}
