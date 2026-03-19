import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf';
import type { MapaVariante, PreguntaBase } from '../src/modulos/modulo_generacion_pdf/servicioVariantes';

function crearParametros(cantidadPreguntas = 12) {
  const preguntas: PreguntaBase[] = [];
  const ordenPreguntas: string[] = [];
  const ordenOpcionesPorPregunta: Record<string, number[]> = {};

  for (let i = 1; i <= cantidadPreguntas; i += 1) {
    const id = `p${i}`;
    preguntas.push({
      id,
      enunciado: `Pregunta ${i}`,
      opciones: [
        { texto: 'A', esCorrecta: i % 5 === 1 },
        { texto: 'B', esCorrecta: i % 5 === 2 },
        { texto: 'C', esCorrecta: i % 5 === 3 },
        { texto: 'D', esCorrecta: i % 5 === 4 },
        { texto: 'E', esCorrecta: i % 5 === 0 }
      ]
    });
    ordenPreguntas.push(id);
    ordenOpcionesPorPregunta[id] = [0, 1, 2, 3, 4];
  }

  const mapaVariante: MapaVariante = { ordenPreguntas, ordenOpcionesPorPregunta };
  return {
    titulo: 'TV4 Contract',
    folio: 'TV4-TEST-001',
    preguntas,
    mapaVariante,
    tipoExamen: 'parcial' as const,
    totalPaginas: 2,
    margenMm: 10,
    templateVersion: 4 as const
  };
}

describe('pdf tv4 contract', () => {
  it('genera PDF carta válido y mapa OMR TV4', async () => {
    const resultado = await generarPdfExamen(crearParametros(16));

    expect(resultado.pdfBytes.byteLength).toBeGreaterThan(10_000);
    expect(resultado.mapaOmr.templateVersion).toBe(4);
    expect(resultado.mapaOmr.markerSpec?.family).toBe('aruco_4x4_50');
    expect(resultado.mapaOmr.blockSpec?.opcionesPorPregunta).toBe(5);
    expect(resultado.mapaOmr.engineHints?.preferredEngine).toBe('cv');
    expect(Array.isArray(resultado.mapaOmr.paginas)).toBe(true);
    expect(resultado.mapaOmr.paginas.length).toBeGreaterThan(0);

    const doc = await PDFDocument.load(resultado.pdfBytes);
    const first = doc.getPage(0);
    const { width, height } = first.getSize();
    expect(width).toBeCloseTo(612, 0);
    expect(height).toBeCloseTo(792, 0);
  });

  it('mantiene consistencia de QR TV4 por página', async () => {
    const resultado = await generarPdfExamen(crearParametros(8));

    for (const pagina of resultado.paginas) {
      expect(pagina.qrTexto).toContain(':TV4');
    }
    for (const paginaOmr of resultado.mapaOmr.paginas) {
      expect(paginaOmr.qr.texto).toContain(':TV4');
    }
  });
});
