import { describe, expect, it } from 'vitest';
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.js';

function extraerContenidoPagina(pdf: PDFDocument, pagina: ReturnType<PDFDocument['getPages']>[number]) {
  const contenido = pagina.node.Contents();
  const objetos = contenido instanceof PDFArray
    ? contenido.asArray().map((referencia) => pdf.context.lookup(referencia))
    : contenido ? [contenido] : [];
  return objetos
    .flatMap((objeto) => {
      if (objeto instanceof PDFRawStream) return [new TextDecoder().decode(decodePDFRawStream(objeto).decode())];
      if (objeto && 'getUnencodedContents' in objeto && typeof objeto.getUnencodedContents === 'function') {
        return [new TextDecoder().decode(objeto.getUnencodedContents())];
      }
      return [];
    })
    .join('\n');
}

describe('PDF: Ecofont y fuente OCR del pie', () => {
  it('mantiene Ecofont en texto de reactivos y limita Helvetica a las dos referencias OCR', async () => {
    const preguntas = Array.from({ length: 24 }, (_, indice) => ({
      id: `ecofont-${indice + 1}`,
      enunciado: '**Pregunta** de verificación _tipográfica_ con `código`.',
      opciones: [
        { texto: '**Opción A**', esCorrecta: true },
        { texto: 'Opción B', esCorrecta: false },
        { texto: 'Opción C', esCorrecta: false },
        { texto: 'Opción D', esCorrecta: false },
        { texto: 'Opción E', esCorrecta: false }
      ]
    }));
    const ordenPreguntas = preguntas.map((pregunta) => pregunta.id);
    const resultado = await generarPdfExamen({
        titulo: 'Ecofont QA',
        folio: 'ECOFONT-QA-001',
        preguntas,
        mapaVariante: {
          ordenPreguntas,
          ordenOpcionesPorPregunta: Object.fromEntries(ordenPreguntas.map((id) => [id, [0, 1, 2, 3, 4]]))
        },
        tipoExamen: 'parcial',
        totalPaginas: 1,
        margenMm: 10,
        templateVersion: 4
      });

    expect(resultado.layoutEngine).toBe('pdf-lib-canonical');
    const pdf = await PDFDocument.load(resultado.pdfBytes);
    const fuentesIncrustadas = pdf.context.enumerateIndirectObjects().filter(([, objeto]) => {
      return objeto instanceof PDFDict && objeto.has(PDFName.of('FontFile2'));
    });
    expect(fuentesIncrustadas.length).toBeGreaterThan(0);
    const fuentesStandard = pdf.context.enumerateIndirectObjects()
      .flatMap(([, objeto]) => objeto instanceof PDFDict ? [objeto.get(PDFName.of('BaseFont'))?.toString()] : [])
      .filter((fuente): fuente is string => Boolean(fuente));
    expect(fuentesStandard).toContain('/Helvetica');
    const paginasExamen = resultado.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina === 'examen');
    expect(paginasExamen.length).toBeGreaterThan(1);
    for (const paginaOmr of paginasExamen) {
      const paginaPdf = pdf.getPages()[paginaOmr.numeroPagina - 1]!;
      const recursosFuentes = paginaPdf.node.Resources()?.lookup(PDFName.of('Font'), PDFDict);
      const baseFontPorAlias = new Map((recursosFuentes?.entries() ?? []).map(([alias, referencia]) => {
        const fuentePdf = pdf.context.lookup(referencia, PDFDict);
        return [alias.toString().slice(1), fuentePdf.get(PDFName.of('BaseFont'))?.toString() ?? ''];
      }));
      const contenidoPagina = extraerContenidoPagina(pdf, paginaPdf);
      const usosFuente = Array.from(contenidoPagina.matchAll(/\/([^\s/]+)\s+[\d.]+\s+Tf\b/g))
        .map((coincidencia) => coincidencia[1]!);
      const familiasUsadas = new Set(usosFuente.map((alias) => baseFontPorAlias.get(alias) ?? ''));
      expect(familiasUsadas).toContain('/Helvetica');
      expect([...familiasUsadas].filter((familia) => familia && familia !== '/Helvetica' && !familia.includes('Vera_Sans')))
        .toEqual([]);
      const aliasesHelvetica = new Set([...baseFontPorAlias]
        .filter(([, nombre]) => nombre === '/Helvetica')
        .map(([alias]) => alias));
      expect(aliasesHelvetica.size).toBeGreaterThan(0);
      expect(usosFuente.filter((alias) => aliasesHelvetica.has(alias))).toHaveLength(2);
    }
    const fuentesRuns = new Set(
      resultado.mapaOmr.paginas
        .flatMap((pagina) => pagina.preguntas)
        .flatMap((pregunta) => pregunta.textRuns ?? [])
        .map((run) => run.fuente)
    );
    expect(fuentesRuns).toEqual(new Set(['Ecofont Vera Sans']));
    const referenciasPie = resultado.mapaOmr.paginas
      .filter((pagina) => pagina.tipoPagina === 'examen')
      .flatMap((pagina) => pagina.layoutDebug?.footerReferences ?? []);
    expect(referenciasPie).toHaveLength(paginasExamen.length * 2);
    expect(referenciasPie.every((referencia) => referencia.fontFamily === 'Helvetica' && referencia.size >= 8.5)).toBe(true);
    const copiasPorReferencia = new Map<string, number>();
    for (const referencia of referenciasPie) {
      copiasPorReferencia.set(referencia.text, (copiasPorReferencia.get(referencia.text) ?? 0) + 1);
    }
    expect(copiasPorReferencia.size).toBe(paginasExamen.length);
    expect([...copiasPorReferencia.values()].every((copias) => copias === 2)).toBe(true);
  });
});
