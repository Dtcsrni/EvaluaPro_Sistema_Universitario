// Pruebas del servicio OMR.
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr';

async function crearImagenBlancaBase64() {
  const buffer = await sharp({
    create: {
      width: 200,
      height: 200,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

describe('analizarOmr', () => {
  it('devuelve advertencias y respuestas nulas sin marcas', async () => {
    const imagenBase64 = await crearImagenBlancaBase64();
    const mapaPagina = {
      numeroPagina: 1,
      preguntas: [
        {
          numeroPregunta: 1,
          idPregunta: 'p1',
          opciones: [
            { letra: 'A', x: 100, y: 100 },
            { letra: 'B', x: 120, y: 100 },
            { letra: 'C', x: 140, y: 100 },
            { letra: 'D', x: 160, y: 100 }
          ]
        }
      ]
    };

    const resultado = await analizarOmr(imagenBase64, mapaPagina, ['TEST', 'EXAMEN:TEST:P1'], 10);

    expect(resultado.qrTexto).toBeUndefined();
    expect(resultado.advertencias).toEqual(
      expect.arrayContaining([
        'No se detecto QR en la imagen',
        'No se detectaron todas las marcas de registro; usando escala simple'
      ])
    );
    expect(resultado.respuestasDetectadas).toHaveLength(1);
    expect(resultado.respuestasDetectadas[0].opcion).toBeNull();
    expect(resultado.respuestasDetectadas[0].confianza).toBe(0);
  });

  it('detecta una opcion marcada con referencias de registro', async () => {
    const width = 612;
    const height = 792;
    const buffer = Buffer.alloc(width * height * 3, 255);

    const setPixel = (x: number, y: number, v: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const idx = (y * width + x) * 3;
      buffer[idx] = v;
      buffer[idx + 1] = v;
      buffer[idx + 2] = v;
    };

    const drawSquare = (cx: number, cy: number, size: number) => {
      const half = Math.floor(size / 2);
      for (let y = cy - half; y <= cy + half; y += 1) {
        for (let x = cx - half; x <= cx + half; x += 1) {
          setPixel(x, y, 0);
        }
      }
    };

    const drawCircle = (cx: number, cy: number, radius: number) => {
      const r2 = radius * radius;
      for (let y = -radius; y <= radius; y += 1) {
        for (let x = -radius; x <= radius; x += 1) {
          if (x * x + y * y <= r2) {
            setPixel(cx + x, cy + y, 0);
          }
        }
      }
    };

    const margen = Math.round(10 * (72 / 25.4));
    drawSquare(margen, margen, 18);
    drawSquare(width - margen, margen, 18);
    drawSquare(margen, height - margen, 18);
    drawSquare(width - margen, height - margen, 18);

    const opcionMarcada = { letra: 'C', x: 240, y: 200 };
    const centroImagen = { x: opcionMarcada.x, y: height - opcionMarcada.y };
    drawCircle(centroImagen.x, centroImagen.y, 7);

    const imagenBase64 = await sharp(buffer, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer()
      .then((buf) => `data:image/png;base64,${buf.toString('base64')}`);

    const mapaPagina = {
      numeroPagina: 1,
      preguntas: [
        {
          numeroPregunta: 1,
          idPregunta: 'p1',
          opciones: [
            { letra: 'A', x: 200, y: 200 },
            { letra: 'B', x: 220, y: 200 },
            { letra: 'C', x: 240, y: 200 },
            { letra: 'D', x: 260, y: 200 },
            { letra: 'E', x: 280, y: 200 }
          ]
        }
      ]
    };

    const resultado = await analizarOmr(imagenBase64, mapaPagina, undefined, 10);

    expect(resultado.respuestasDetectadas).toHaveLength(1);
    expect(resultado.respuestasDetectadas[0].opcion).toBe('C');
    expect(resultado.respuestasDetectadas[0].confianza).toBeGreaterThan(0.2);
  });

  it('marca como ambiguo si hay doble respuesta', async () => {
    const width = 612;
    const height = 792;
    const buffer = Buffer.alloc(width * height * 3, 255);

    const setPixel = (x: number, y: number, v: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const idx = (y * width + x) * 3;
      buffer[idx] = v;
      buffer[idx + 1] = v;
      buffer[idx + 2] = v;
    };

    const drawSquare = (cx: number, cy: number, size: number) => {
      const half = Math.floor(size / 2);
      for (let y = cy - half; y <= cy + half; y += 1) {
        for (let x = cx - half; x <= cx + half; x += 1) {
          setPixel(x, y, 0);
        }
      }
    };

    const drawCircle = (cx: number, cy: number, radius: number) => {
      const r2 = radius * radius;
      for (let y = -radius; y <= radius; y += 1) {
        for (let x = -radius; x <= radius; x += 1) {
          if (x * x + y * y <= r2) {
            setPixel(cx + x, cy + y, 0);
          }
        }
      }
    };

    const margen = Math.round(10 * (72 / 25.4));
    drawSquare(margen, margen, 18);
    drawSquare(width - margen, margen, 18);
    drawSquare(margen, height - margen, 18);
    drawSquare(width - margen, height - margen, 18);

    const opciones = [
      { letra: 'A', x: 200, y: 200 },
      { letra: 'B', x: 220, y: 200 },
      { letra: 'C', x: 240, y: 200 },
      { letra: 'D', x: 260, y: 200 },
      { letra: 'E', x: 280, y: 200 }
    ];

    const centroA = { x: opciones[0].x, y: height - opciones[0].y };
    const centroB = { x: opciones[1].x, y: height - opciones[1].y };
    drawCircle(centroA.x, centroA.y, 7);
    drawCircle(centroB.x, centroB.y, 7);

    const imagenBase64 = await sharp(buffer, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer()
      .then((buf) => `data:image/png;base64,${buf.toString('base64')}`);

    const mapaPagina = {
      numeroPagina: 1,
      preguntas: [
        {
          numeroPregunta: 1,
          idPregunta: 'p1',
          opciones
        }
      ]
    };

    const resultado = await analizarOmr(imagenBase64, mapaPagina, undefined, 10);

    expect(resultado.respuestasDetectadas).toHaveLength(1);
    expect(resultado.respuestasDetectadas[0].opcion).toBeNull();
    expect(resultado.respuestasDetectadas[0].confianza).toBe(0);
  });
});
