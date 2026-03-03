import { describe, expect, it } from 'vitest';
import { ANCHO_CARTA, ALTO_CARTA } from '../src/modulos/modulo_generacion_pdf/shared/tiposPdf';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf';
import type { MapaVariante, PreguntaBase } from '../src/modulos/modulo_generacion_pdf/servicioVariantes';

type Rect = { x: number; y: number; width: number; height: number };

function interseca(a: Rect, b: Rect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function assertRectDentroPagina(rect: Rect) {
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(ANCHO_CARTA);
  expect(rect.y + rect.height).toBeLessThanOrEqual(ALTO_CARTA);
}

function assertConteoPreguntasPorPagina(resultado: Awaited<ReturnType<typeof generarPdfExamen>>) {
  const conteoPorPagina = resultado.paginas.map((pagina) => {
    const del = Number(pagina.preguntasDel ?? 0);
    const al = Number(pagina.preguntasAl ?? 0);
    return del > 0 && al >= del ? al - del + 1 : 0;
  });

  for (const conteo of conteoPorPagina.filter((v) => v > 0)) {
    expect(conteo).toBeGreaterThanOrEqual(6);
    expect(conteo).toBeLessThanOrEqual(10);
  }
}

function assertBloquesHeader(pagina: Awaited<ReturnType<typeof generarPdfExamen>>['mapaOmr']['paginas'][number], header: Rect) {
  const dbg = pagina.layoutDebug;
  const qr = dbg?.qr as Rect;
  assertRectDentroPagina(header);
  assertRectDentroPagina(qr);

  if (pagina.numeroPagina === 1) {
    expect(interseca(header, qr)).toBe(true);
  }

  const bloquesHeader = Array.isArray(dbg?.headerTextBlocks) ? dbg.headerTextBlocks : [];
  const violaciones = Array.isArray(dbg?.lineHeightViolations) ? dbg.lineHeightViolations : [];
  expect(violaciones.length).toBe(0);
  for (let i = 0; i < bloquesHeader.length; i += 1) {
    const a = bloquesHeader[i] as Rect;
    assertRectDentroPagina(a);
    for (let j = i + 1; j < bloquesHeader.length; j += 1) {
      const b = bloquesHeader[j] as Rect;
      expect(interseca(a, b)).toBe(false);
    }
  }
}

function assertPreguntasLayout(pagina: Awaited<ReturnType<typeof generarPdfExamen>>['mapaOmr']['paginas'][number]) {
  const preguntas = Array.isArray(pagina.preguntas) ? pagina.preguntas : [];
  for (let i = 0; i < preguntas.length; i += 1) {
    const actual = preguntas[i];
    expect(Array.isArray(actual.textRuns)).toBe(true);
    expect((actual.textRuns ?? []).length).toBeGreaterThan(0);
    if (!actual.bboxPregunta) continue;
    const bbox = actual.bboxPregunta;
    assertRectDentroPagina(bbox);

    const omr = actual.cajaOmr;
    if (omr) {
      expect(interseca(bbox, omr)).toBe(true);
    }

    if (omr && actual.perfilOmr && Array.isArray(actual.opciones) && actual.opciones.length > 0) {
      const radio = Number(actual.perfilOmr.radio ?? 0);
      const pasoY = Number(actual.perfilOmr.pasoY ?? 0);
      expect(actual.opciones.length).toBe(5);
      for (let idx = 0; idx < actual.opciones.length; idx += 1) {
        const opcion = actual.opciones[idx]!;
        expect(opcion.x - radio).toBeGreaterThanOrEqual(omr.x - 0.01);
        expect(opcion.x + radio).toBeLessThanOrEqual(omr.x + omr.width + 0.01);
        expect(opcion.y - radio).toBeGreaterThanOrEqual(omr.y - 0.01);
        expect(opcion.y + radio).toBeLessThanOrEqual(omr.y + omr.height + 0.01);
        if (idx > 0) {
          const prev = actual.opciones[idx - 1]!;
          if (pasoY > 0) {
            expect(Math.abs((opcion.y - prev.y) - pasoY)).toBeLessThanOrEqual(0.25);
          }
        }
      }
    }

    if (i > 0 && preguntas[i - 1]?.bboxPregunta) {
      const prev = preguntas[i - 1]!.bboxPregunta as Rect;
      expect(interseca(prev, bbox)).toBe(false);
    }
  }
}

function crearParametros(cantidadPreguntas = 24) {
  const preguntas: PreguntaBase[] = [];
  const ordenPreguntas: string[] = [];
  const ordenOpcionesPorPregunta: Record<string, number[]> = {};

  for (let i = 1; i <= cantidadPreguntas; i += 1) {
    const id = `p${i}`;
    preguntas.push({
      id,
      enunciado: `Pregunta corta ${i}: selecciona la opcion correcta.`,
      opciones: [
        { texto: 'Opcion A', esCorrecta: i % 5 === 1 },
        { texto: 'Opcion B', esCorrecta: i % 5 === 2 },
        { texto: 'Opcion C', esCorrecta: i % 5 === 3 },
        { texto: 'Opcion D', esCorrecta: i % 5 === 4 },
        { texto: 'Opcion E', esCorrecta: i % 5 === 0 }
      ]
    });
    ordenPreguntas.push(id);
    ordenOpcionesPorPregunta[id] = [0, 1, 2, 3, 4];
  }

  const mapaVariante: MapaVariante = { ordenPreguntas, ordenOpcionesPorPregunta };
  return {
    titulo: 'Primer Parcial',
    folio: 'LAYOUT-GUARD-001',
    preguntas,
    mapaVariante,
    tipoExamen: 'parcial' as const,
    totalPaginas: 3,
    margenMm: 10,
    templateVersion: 3 as const
  };
}

describe('pdf layout visual guard', () => {
  it('valida no solapes, cajas dentro de pagina y densidad controlada por pagina', async () => {
    const resultado = await generarPdfExamen(crearParametros(24));
    expect(resultado.metricasLayout).toBeTruthy();
    expect((resultado.metricasLayout?.minLineHeightApplied ?? 0) >= 10.4).toBe(true);
    assertConteoPreguntasPorPagina(resultado);

    for (const pagina of resultado.mapaOmr.paginas) {
      const dbg = pagina.layoutDebug;
      expect(dbg).toBeTruthy();
      const header = dbg?.header as Rect;
      assertBloquesHeader(pagina, header);
      assertPreguntasLayout(pagina);
    }
  });
});
