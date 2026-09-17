/**
 * omr.geometry.reference
 *
 * Verifica que las marcas de página canónicas (L) se conviertan en vértices
 * físicos y que la geometría canónica conserve una referencia estable.
 */
import { describe, expect, it } from 'vitest';
import { obtenerTransformacion } from '../src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCanonico.js';

const ANCHO_CARTA = 612;
const ALTO_CARTA = 792;
const MM_A_PUNTOS = 72 / 25.4;

function crearHojaConMarcasL() {
  const gray = new Uint8ClampedArray(ANCHO_CARTA * ALTO_CARTA).fill(255);
  const margen = Math.round(10 * MM_A_PUNTOS);
  const brazo = Math.round(5.8 * MM_A_PUNTOS);
  const grosor = 2;
  const poner = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < ANCHO_CARTA && y < ALTO_CARTA) gray[y * ANCHO_CARTA + x] = 0;
  };
  const dibujarL = (x: number, y: number, dx: number, dy: number) => {
    for (let paso = 0; paso <= brazo; paso += 1) {
      for (let ancho = 0; ancho < grosor; ancho += 1) {
        poner(x + dx * paso + (dy === 0 ? 0 : dx * ancho), y + dy * paso + (dx === 0 ? 0 : dy * ancho));
      }
    }
  };

  // Coordenadas de imagen: cada L abre hacia el interior de la página.
  dibujarL(margen, margen, 1, 0);
  dibujarL(margen, margen, 0, 1);
  dibujarL(ANCHO_CARTA - margen, margen, -1, 0);
  dibujarL(ANCHO_CARTA - margen, margen, 0, 1);
  dibujarL(margen, ALTO_CARTA - margen, 1, 0);
  dibujarL(margen, ALTO_CARTA - margen, 0, -1);
  dibujarL(ANCHO_CARTA - margen, ALTO_CARTA - margen, -1, 0);
  dibujarL(ANCHO_CARTA - margen, ALTO_CARTA - margen, 0, -1);
  return gray;
}

function crearHojaConCuadrados() {
  const gray = new Uint8ClampedArray(ANCHO_CARTA * ALTO_CARTA).fill(255);
  const margen = Math.round(10 * MM_A_PUNTOS);
  const lado = Math.round(5.8 * MM_A_PUNTOS);
  const poner = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < ANCHO_CARTA && y < ALTO_CARTA) gray[y * ANCHO_CARTA + x] = 0;
  };
  for (let y = margen; y < margen + lado; y += 1) {
    for (let x = margen; x < margen + lado; x += 1) {
      poner(x, y);
      poner(ANCHO_CARTA - margen - lado + (x - margen), y);
      poner(x, ALTO_CARTA - margen - lado + (y - margen));
      poner(ANCHO_CARTA - margen - lado + (x - margen), ALTO_CARTA - margen - lado + (y - margen));
    }
  }
  return gray;
}

describe('referencia global de página OMR', () => {
  it('estima el vértice de las cuatro marcas L canónicas', () => {
    const gray = crearHojaConMarcasL();
    const resultado = obtenerTransformacion(gray, ANCHO_CARTA, ALTO_CARTA, [], null, {
      margenMm: 10,
      qrSizePts: 72,
      anchoCarta: ANCHO_CARTA,
      altoCarta: ALTO_CARTA,
      mmAPuntos: MM_A_PUNTOS,
      marcasPagina: { tipo: 'lineas', size: 5.8 * MM_A_PUNTOS }
    });

    expect(resultado.tipo).toBe('homografia');
    expect(resultado.referenciaPagina.tipo).toBe('marcas_esquina');
    expect(resultado.referenciaPagina.puntosDetectados).toBe(4);
    expect(resultado.referenciaPagina.calidad).toBeGreaterThanOrEqual(0.72);
  });

  it('localiza los cuadrados sólidos de la plantilla canónica', () => {
    const gray = crearHojaConCuadrados();
    const resultado = obtenerTransformacion(gray, ANCHO_CARTA, ALTO_CARTA, [], null, {
      margenMm: 10,
      qrSizePts: 72,
      anchoCarta: ANCHO_CARTA,
      altoCarta: ALTO_CARTA,
      mmAPuntos: MM_A_PUNTOS,
      marcasPagina: { tipo: 'cuadrados', size: 5.8 * MM_A_PUNTOS }
    });

    expect(resultado.tipo).toBe('homografia');
    expect(resultado.referenciaPagina.tipo).toBe('marcas_esquina');
    expect(resultado.referenciaPagina.puntosDetectados).toBe(4);
    expect(resultado.referenciaPagina.calidad).toBeGreaterThanOrEqual(0.72);
    const puntoCentral = resultado.transformar({ x: 300, y: 400 });
    expect(puntoCentral.x).toBeCloseTo(300, 0);
    expect(puntoCentral.y).toBeCloseTo(ALTO_CARTA - 400, 0);
  });
});
