import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import type { MapaOmr, PaginaOmr } from '../shared/tiposPdf.js';

const CARTA = { width: 612, height: 792 } as const;
const TOLERANCIA_PUNTOS = 0.5;

export type ValidacionPdfLote = {
  pdfBytes: Uint8Array;
  paginasMaximas: number;
  preguntasEsperadas: number;
  folio: string;
  mapaOmr: Pick<MapaOmr, 'paginas'>;
};

export type ResumenPdfLote = {
  paginas: number;
  sha256: string;
  bytes: number;
};

function fallar(codigo: string, mensaje: string, detalles?: Record<string, unknown>): never {
  const error = new Error(mensaje) as Error & { code: string; detalles?: Record<string, unknown> };
  error.code = codigo;
  if (detalles) error.detalles = detalles;
  throw error;
}

function validarPaginasOmr(paginasOmr: PaginaOmr[], paginasEsperadas: number, folio?: string, preguntasEsperadas?: number) {
  if (paginasOmr.length !== paginasEsperadas) {
    fallar('LOTE_MAPA_PAGINAS_INVALIDO', 'El mapa OMR no coincide con las páginas del PDF.', {
      paginasMapa: paginasOmr.length,
      paginasEsperadas
    });
  }

  const preguntas = paginasOmr.flatMap((pagina) => pagina.preguntas ?? []);
  if (preguntasEsperadas !== undefined) {
    const ids = preguntas.map((pregunta) => String(pregunta.idPregunta ?? '').trim());
    if (ids.some((id) => !id) || ids.length !== preguntasEsperadas || new Set(ids).size !== preguntasEsperadas) {
      fallar('LOTE_REACTIVOS_INVALIDOS', 'Las páginas OMR tienen reactivos faltantes o duplicados.', {
        preguntasEncontradas: ids.length,
        preguntasEsperadas,
        idsUnicos: new Set(ids).size
      });
    }
  }

  for (let indice = 0; indice < paginasOmr.length; indice += 1) {
    const pagina = paginasOmr[indice]!;
    if (pagina.numeroPagina !== indice + 1) {
      fallar('LOTE_ORDEN_PAGINAS_INVALIDO', 'La numeración lógica de páginas no es continua.', {
        indice,
        numeroPagina: pagina.numeroPagina
      });
    }
    if (pagina.tipoPagina === 'reverso-vacio') {
      if (pagina.preguntas.length || pagina.qr || pagina.marcasPagina) {
        fallar('LOTE_REVERSO_INVALIDO', 'Un reverso vacío contiene elementos OMR.', { numeroPagina: pagina.numeroPagina });
      }
      continue;
    }
    if (!pagina.preguntas.length || !pagina.qr?.texto) {
      fallar('LOTE_PAGINA_SIN_CONTENIDO', 'Una página de examen no tiene reactivos o QR.', { numeroPagina: pagina.numeroPagina });
    }
    if (folio && !pagina.qr.texto.includes(folio)) {
      fallar('LOTE_QR_FOLIO_INVALIDO', 'El QR de una página no corresponde al folio del examen.', {
        numeroPagina: pagina.numeroPagina,
        folio
      });
    }
  }
}

export async function validarPdfIndividualLote(input: ValidacionPdfLote): Promise<ResumenPdfLote> {
  if (!Number.isInteger(input.paginasMaximas) || input.paginasMaximas < 1) {
    fallar('LOTE_CONFIGURACION_PAGINAS_INVALIDA', 'El máximo de páginas debe ser un entero positivo.');
  }
  if (!(input.pdfBytes instanceof Uint8Array) || input.pdfBytes.byteLength === 0) {
    fallar('LOTE_PDF_VACIO', 'El PDF individual no contiene bytes.');
  }

  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(input.pdfBytes);
  } catch {
    fallar('LOTE_PDF_INVALIDO', 'No se pudo abrir el PDF individual generado.');
  }

  const paginas = pdf.getPages();
  if (paginas.length > input.paginasMaximas) {
    fallar('LOTE_CANTIDAD_PAGINAS_INVALIDA', `El PDF individual tiene ${paginas.length} página(s); el máximo configurado es ${input.paginasMaximas}.`, {
      paginasEncontradas: paginas.length,
      paginasMaximas: input.paginasMaximas
    });
  }
  paginas.forEach((pagina, indice) => {
    const tamano = pagina.getSize();
    if (
      Math.abs(tamano.width - CARTA.width) > TOLERANCIA_PUNTOS ||
      Math.abs(tamano.height - CARTA.height) > TOLERANCIA_PUNTOS
    ) {
      fallar('LOTE_TAMANO_PAGINA_INVALIDO', 'Todas las páginas del lote deben ser tamaño Carta.', {
        numeroPagina: indice + 1,
        ancho: tamano.width,
        alto: tamano.height
      });
    }
  });
  validarPaginasOmr(input.mapaOmr.paginas, paginas.length, input.folio, input.preguntasEsperadas);

  const pdfBytes = new Uint8Array(input.pdfBytes);
  return {
    paginas: paginas.length,
    sha256: createHash('sha256').update(pdfBytes).digest('hex'),
    bytes: pdfBytes.byteLength
  };
}

export async function validarPdfConsolidadoLote(pdfBytes: Uint8Array, paginasEsperadas: number): Promise<ResumenPdfLote> {
  if (!Number.isInteger(paginasEsperadas) || paginasEsperadas < 1 || pdfBytes.byteLength === 0) {
    fallar('LOTE_CONFIGURACION_INVALIDA', 'El consolidado debe tener bytes y una cantidad positiva de páginas esperada.');
  }

  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(pdfBytes);
  } catch {
    fallar('LOTE_PDF_CONSOLIDADO_INVALIDO', 'No se pudo abrir el PDF consolidado del lote.');
  }
  const paginas = pdf.getPages();
  if (paginas.length !== paginasEsperadas) {
    fallar('LOTE_CONSOLIDADO_PAGINAS_INVALIDAS', 'El consolidado no coincide con la suma de páginas de sus exámenes.', {
      paginasEncontradas: paginas.length,
      paginasEsperadas
    });
  }
  paginas.forEach((pagina, indice) => {
    const tamano = pagina.getSize();
    if (
      Math.abs(tamano.width - CARTA.width) > TOLERANCIA_PUNTOS ||
      Math.abs(tamano.height - CARTA.height) > TOLERANCIA_PUNTOS
    ) {
      fallar('LOTE_CONSOLIDADO_TAMANO_INVALIDO', 'Todas las páginas consolidadas deben ser tamaño Carta.', {
        numeroPagina: indice + 1,
        ancho: tamano.width,
        alto: tamano.height
      });
    }
  });
  return {
    paginas: paginas.length,
    sha256: createHash('sha256').update(new Uint8Array(pdfBytes)).digest('hex'),
    bytes: pdfBytes.byteLength
  };
}
