import { describe, expect, it } from 'vitest';
import { PDFDocument, rgb } from 'pdf-lib';
import { validarPdfConsolidadoLote, validarPdfIndividualLote } from '../src/modulos/modulo_generacion_pdf/domain/validacionLotePdf.js';
import type { PaginaOmr } from '../src/modulos/modulo_generacion_pdf/shared/tiposPdf.js';

async function crearPdf(paginas: Array<{ width?: number; height?: number; texto?: string }>) {
  const pdf = await PDFDocument.create();
  for (const especificacion of paginas) {
    const page = pdf.addPage([especificacion.width ?? 612, especificacion.height ?? 792]);
    if (especificacion.texto) {
      page.drawText(especificacion.texto, { x: 32, y: 740, size: 12, color: rgb(0, 0, 0) });
    }
  }
  return new Uint8Array(await pdf.save());
}

function crearPaginaOmr(numeroPagina: number, idPregunta: string, folio = 'FOLIO01'): PaginaOmr {
  return {
    numeroPagina,
    preguntas: [{
      numeroPregunta: numeroPagina,
      idPregunta,
      opciones: ['A', 'B', 'C', 'D', 'E'].map((letra, indice) => ({ letra, x: 100 + indice * 20, y: 300 }))
    }],
    qr: { texto: `${folio} · P${numeroPagina}`, x: 20, y: 20, size: 40, padding: 2 },
    marcasPagina: {
      tipo: 'cuadrados', size: 8, quietZone: 2,
      tl: { x: 10, y: 10 }, tr: { x: 570, y: 10 }, bl: { x: 10, y: 750 }, br: { x: 570, y: 750 }
    }
  };
}

describe('integridad PDF de lotes', () => {
  it('acepta un examen de dos páginas Carta con reactivos únicos y QR del mismo folio', async () => {
    const pdfBytes = await crearPdf([{ texto: 'Reactivo uno' }, { texto: 'Reactivo dos' }]);
    const resultado = await validarPdfIndividualLote({
      pdfBytes,
      paginasMaximas: 2,
      preguntasEsperadas: 2,
      folio: 'FOLIO01',
      mapaOmr: { paginas: [crearPaginaOmr(1, 'q1'), crearPaginaOmr(2, 'q2')] }
    });
    expect(resultado).toMatchObject({ paginas: 2, bytes: pdfBytes.byteLength });
    expect(resultado.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('acepta menos páginas que el máximo, pero rechaza excederlo', async () => {
    const pdfBytes = await crearPdf([{ texto: 'Sólo una página' }]);
    await expect(validarPdfIndividualLote({
      pdfBytes,
      paginasMaximas: 2,
      preguntasEsperadas: 1,
      folio: 'FOLIO01',
      mapaOmr: { paginas: [crearPaginaOmr(1, 'q1')] }
    })).resolves.toMatchObject({ paginas: 1 });

    const pdfSobreMaximo = await crearPdf([{ texto: 'Uno' }, { texto: 'Dos' }, { texto: 'Tres' }]);
    await expect(validarPdfIndividualLote({
      pdfBytes: pdfSobreMaximo,
      paginasMaximas: 2,
      preguntasEsperadas: 3,
      folio: 'FOLIO01',
      mapaOmr: { paginas: [crearPaginaOmr(1, 'q1'), crearPaginaOmr(2, 'q2'), crearPaginaOmr(3, 'q3')] }
    })).rejects.toMatchObject({ code: 'LOTE_CANTIDAD_PAGINAS_INVALIDA' });
  });

  it('rechaza página de tamaño distinto a Carta y reactivos duplicados', async () => {
    const fueraDeCarta = await crearPdf([{ width: 595, height: 842, texto: 'A4' }]);
    await expect(validarPdfIndividualLote({
      pdfBytes: fueraDeCarta,
      paginasMaximas: 1,
      preguntasEsperadas: 1,
      folio: 'FOLIO01',
      mapaOmr: { paginas: [crearPaginaOmr(1, 'q1')] }
    })).rejects.toMatchObject({ code: 'LOTE_TAMANO_PAGINA_INVALIDO' });

    const duplicados = await crearPdf([{ texto: 'Dos reactivos' }]);
    await expect(validarPdfIndividualLote({
      pdfBytes: duplicados,
      paginasMaximas: 1,
      preguntasEsperadas: 2,
      folio: 'FOLIO01',
      mapaOmr: { paginas: [{ ...crearPaginaOmr(1, 'q1'), preguntas: [
        { numeroPregunta: 1, idPregunta: 'q1', opciones: [] },
        { numeroPregunta: 2, idPregunta: 'q1', opciones: [] }
      ] }] }
    })).rejects.toMatchObject({ code: 'LOTE_REACTIVOS_INVALIDOS' });
  });

  it('rechaza QR de otra identidad y consolidados con páginas inesperadas', async () => {
    const pdfBytes = await crearPdf([{ texto: 'Reactivo' }]);
    await expect(validarPdfIndividualLote({
      pdfBytes,
      paginasMaximas: 1,
      preguntasEsperadas: 1,
      folio: 'FOLIO01',
      mapaOmr: { paginas: [crearPaginaOmr(1, 'q1', 'OTRO0001')] }
    })).rejects.toMatchObject({ code: 'LOTE_QR_FOLIO_INVALIDO' });

    await expect(validarPdfConsolidadoLote(pdfBytes, 2)).rejects.toMatchObject({
      code: 'LOTE_CONSOLIDADO_PAGINAS_INVALIDAS'
    });
  });
});
