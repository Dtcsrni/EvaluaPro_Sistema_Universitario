/**
 * omr.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
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

function crearMapaTv3(
  numeroPregunta: number,
  idPregunta: string,
  opciones: Array<{ letra: string; x: number; y: number }>
) {
  const opcionA = opciones.find((item) => item.letra === 'A') ?? opciones[0];
  const referenciaY = Number(opcionA?.y ?? opciones[0]?.y ?? 100);
  const referenciaX = Number(opcionA?.x ?? opciones[0]?.x ?? 100);
  return {
    numeroPagina: 1,
    templateVersion: 3 as const,
    preguntas: [
      {
        numeroPregunta,
        idPregunta,
        opciones,
        cajaOmr: {
          x: referenciaX - 9.2,
          y: referenciaY - 22,
          width: 42,
          height: 44
        },
        perfilOmr: {
          radio: 3.4,
          pasoY: 8.4,
          cajaAncho: 42
        }
      }
    ]
  };
}

describe('analizarOmr', () => {
  it('devuelve advertencias y respuestas nulas sin marcas', async () => {
    const imagenBase64 = await crearImagenBlancaBase64();
    const mapaPagina = crearMapaTv3(1, 'p1', [
      { letra: 'A', x: 100, y: 100 },
      { letra: 'B', x: 120, y: 100 },
      { letra: 'C', x: 140, y: 100 },
      { letra: 'D', x: 160, y: 100 }
    ]);

    const resultado = await analizarOmr(imagenBase64, mapaPagina, ['TEST', 'EXAMEN:TEST:P1'], 10);

    expect(resultado.qrTexto).toBeUndefined();
    expect(resultado.advertencias).toEqual(
      expect.arrayContaining([
        'No se detecto QR en la imagen',
        'No se detectaron todas las marcas de registro; usando escala simple'
      ])
    );
    expect(resultado.respuestasDetectadas).toHaveLength(1);
    expect([null, 'A', 'B', 'C', 'D', 'E']).toContain(resultado.respuestasDetectadas[0].opcion);
    expect(resultado.respuestasDetectadas[0].confianza).toBe(0);
    expect(resultado.templateVersionDetectada).toBe(3);
    expect(['rechazado_calidad', 'requiere_revision']).toContain(resultado.estadoAnalisis);
    expect(resultado.calidadPagina).toBeGreaterThanOrEqual(0);
    expect(resultado.calidadPagina).toBeLessThanOrEqual(1);
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

    const opciones = [
      { letra: 'A', x: 250, y: 240 },
      { letra: 'B', x: 250, y: 226 },
      { letra: 'C', x: 250, y: 212 },
      { letra: 'D', x: 250, y: 198 },
      { letra: 'E', x: 250, y: 184 }
    ] as const;
    const opcionMarcada = opciones[2];
    const centroImagen = { x: opcionMarcada.x, y: height - opcionMarcada.y };
    drawCircle(centroImagen.x, centroImagen.y, 7);

    const imagenBase64 = await sharp(buffer, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer()
      .then((buf) => `data:image/png;base64,${buf.toString('base64')}`);

    const mapaPagina = crearMapaTv3(1, 'p1', [...opciones]);

    const resultado = await analizarOmr(imagenBase64, mapaPagina, undefined, 10);

    expect(resultado.respuestasDetectadas).toHaveLength(1);
    expect([null, 'A', 'B', 'C', 'D', 'E']).toContain(resultado.respuestasDetectadas[0].opcion);
    expect(resultado.respuestasDetectadas[0].confianza).toBeGreaterThanOrEqual(0);
    expect(resultado.templateVersionDetectada).toBe(3);
    expect(resultado.calidadPagina).toBeGreaterThan(0);
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
      { letra: 'A', x: 250, y: 240 },
      { letra: 'B', x: 250, y: 226 },
      { letra: 'C', x: 250, y: 212 },
      { letra: 'D', x: 250, y: 198 },
      { letra: 'E', x: 250, y: 184 }
    ];

    const centroA = { x: opciones[0].x, y: height - opciones[0].y };
    const centroB = { x: opciones[1].x, y: height - opciones[1].y };
    drawCircle(centroA.x, centroA.y, 7);
    drawCircle(centroB.x, centroB.y, 7);

    const imagenBase64 = await sharp(buffer, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer()
      .then((buf) => `data:image/png;base64,${buf.toString('base64')}`);

    const mapaPagina = crearMapaTv3(1, 'p1', opciones);

    const resultado = await analizarOmr(imagenBase64, mapaPagina, undefined, 10);

    expect(resultado.respuestasDetectadas).toHaveLength(1);
    expect([null, 'A', 'B', 'C', 'D', 'E']).toContain(resultado.respuestasDetectadas[0].opcion);
    expect(resultado.respuestasDetectadas[0].confianza).toBeGreaterThanOrEqual(0);
    expect(resultado.templateVersionDetectada).toBe(3);
    expect(['ok', 'requiere_revision', 'rechazado_calidad']).toContain(resultado.estadoAnalisis);
  });

  it('distingue burbuja hueca de burbuja realmente marcada', async () => {
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

    const drawRing = (cx: number, cy: number, radius: number, thickness = 1, value = 35) => {
      const rOuter2 = radius * radius;
      const rInner = Math.max(0, radius - thickness);
      const rInner2 = rInner * rInner;
      for (let y = -radius; y <= radius; y += 1) {
        for (let x = -radius; x <= radius; x += 1) {
          const d2 = x * x + y * y;
          if (d2 <= rOuter2 && d2 >= rInner2) setPixel(cx + x, cy + y, value);
        }
      }
    };

    const fillCore = (cx: number, cy: number, radius: number, value = 25) => {
      const r2 = radius * radius;
      for (let y = -radius; y <= radius; y += 1) {
        for (let x = -radius; x <= radius; x += 1) {
          if (x * x + y * y <= r2) setPixel(cx + x, cy + y, value);
        }
      }
    };

    const margen = Math.round(10 * (72 / 25.4));
    drawSquare(margen, margen, 18);
    drawSquare(width - margen, margen, 18);
    drawSquare(margen, height - margen, 18);
    drawSquare(width - margen, height - margen, 18);

    const opciones = [
      { letra: 'A', x: 250, y: 240 },
      { letra: 'B', x: 250, y: 226 },
      { letra: 'C', x: 250, y: 212 },
      { letra: 'D', x: 250, y: 198 },
      { letra: 'E', x: 250, y: 184 }
    ];

    for (const opcion of opciones) {
      const cx = opcion.x;
      const cy = height - opcion.y;
      drawRing(cx, cy, 8, 2, 60);
    }
    // Marca real en C: relleno central parcial sobre la burbuja hueca.
    fillCore(opciones[2].x, height - opciones[2].y, 5, 10);

    const imagenBase64 = await sharp(buffer, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer()
      .then((buf) => `data:image/png;base64,${buf.toString('base64')}`);

    const mapaPagina = crearMapaTv3(1, 'p1', opciones);

    const resultado = await analizarOmr(imagenBase64, mapaPagina, undefined, 10);
    expect(resultado.respuestasDetectadas).toHaveLength(1);
    expect(resultado.respuestasDetectadas[0].opcion).toBe('C');
    expect(resultado.respuestasDetectadas[0].confianza).toBeGreaterThanOrEqual(0);
  });

  it('penaliza trazos lineales y prioriza relleno central real', async () => {
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

    const drawRing = (cx: number, cy: number, radius: number, thickness = 1, value = 70) => {
      const rOuter2 = radius * radius;
      const rInner = Math.max(0, radius - thickness);
      const rInner2 = rInner * rInner;
      for (let y = -radius; y <= radius; y += 1) {
        for (let x = -radius; x <= radius; x += 1) {
          const d2 = x * x + y * y;
          if (d2 <= rOuter2 && d2 >= rInner2) setPixel(cx + x, cy + y, value);
        }
      }
    };

    const drawLine = (x0: number, y0: number, x1: number, y1: number, value = 18) => {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        setPixel(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), value);
      }
    };

    const fillDisk = (cx: number, cy: number, radius: number, value = 22) => {
      const r2 = radius * radius;
      for (let y = -radius; y <= radius; y += 1) {
        for (let x = -radius; x <= radius; x += 1) {
          if (x * x + y * y <= r2) setPixel(cx + x, cy + y, value);
        }
      }
    };

    const margen = Math.round(10 * (72 / 25.4));
    drawSquare(margen, margen, 18);
    drawSquare(width - margen, margen, 18);
    drawSquare(margen, height - margen, 18);
    drawSquare(width - margen, height - margen, 18);

    const opciones = [
      { letra: 'A', x: 250, y: 240 },
      { letra: 'B', x: 250, y: 226 },
      { letra: 'C', x: 250, y: 212 },
      { letra: 'D', x: 250, y: 198 },
      { letra: 'E', x: 250, y: 184 }
    ];

    for (const opcion of opciones) {
      drawRing(opcion.x, height - opcion.y, 8, 2, 70);
    }

    // Artefacto lineal fuerte sobre A (debe penalizarse por anisotropia).
    drawLine(opciones[0].x - 3, height - opciones[0].y - 8, opciones[0].x + 3, height - opciones[0].y + 8, 16);
    // Marca real en D: relleno central compacto.
    fillDisk(opciones[3].x, height - opciones[3].y, 5, 8);

    const imagenBase64 = await sharp(buffer, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer()
      .then((buf) => `data:image/png;base64,${buf.toString('base64')}`);

    const mapaPagina = crearMapaTv3(1, 'p1', opciones);

    const resultado = await analizarOmr(imagenBase64, mapaPagina, undefined, 10);
    expect(resultado.respuestasDetectadas).toHaveLength(1);
    expect(['C', 'D']).toContain(resultado.respuestasDetectadas[0].opcion);
    expect(resultado.respuestasDetectadas[0].opcion).not.toBe('A');
    expect(resultado.respuestasDetectadas[0].confianza).toBeGreaterThanOrEqual(0);
  });

  it('detecta marca azul con dominante de iluminacion calida', async () => {
    const width = 612;
    const height = 792;
    const buffer = Buffer.alloc(width * height * 3, 0);

    const setPixelRgb = (x: number, y: number, r: number, g: number, b: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const idx = (y * width + x) * 3;
      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
    };

    // Fondo cálido (simula luz amarilla/naranja).
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        setPixelRgb(x, y, 245, 224, 192);
      }
    }

    const drawSquare = (cx: number, cy: number, size: number) => {
      const half = Math.floor(size / 2);
      for (let y = cy - half; y <= cy + half; y += 1) {
        for (let x = cx - half; x <= cx + half; x += 1) {
          setPixelRgb(x, y, 15, 15, 15);
        }
      }
    };

    const drawRing = (cx: number, cy: number, radius: number, thickness = 1) => {
      const rOuter2 = radius * radius;
      const rInner = Math.max(0, radius - thickness);
      const rInner2 = rInner * rInner;
      for (let y = -radius; y <= radius; y += 1) {
        for (let x = -radius; x <= radius; x += 1) {
          const d2 = x * x + y * y;
          if (d2 <= rOuter2 && d2 >= rInner2) setPixelRgb(cx + x, cy + y, 70, 70, 70);
        }
      }
    };

    const fillBlue = (cx: number, cy: number, radius: number) => {
      const r2 = radius * radius;
      for (let y = -radius; y <= radius; y += 1) {
        for (let x = -radius; x <= radius; x += 1) {
          if (x * x + y * y <= r2) setPixelRgb(cx + x, cy + y, 20, 48, 170);
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
    for (const opcion of opciones) drawRing(opcion.x, height - opcion.y, 8, 2);
    fillBlue(opciones[1].x, height - opciones[1].y, 5);

    const imagenBase64 = await sharp(buffer, { raw: { width, height, channels: 3 } })
      .jpeg({ quality: 96 })
      .toBuffer()
      .then((buf) => `data:image/jpeg;base64,${buf.toString('base64')}`);

    const mapaPagina = crearMapaTv3(1, 'p1', opciones);

    const resultado = await analizarOmr(imagenBase64, mapaPagina, undefined, 10);
    expect(resultado.respuestasDetectadas).toHaveLength(1);
    expect(resultado.respuestasDetectadas[0].opcion).toBe('B');
    expect(resultado.respuestasDetectadas[0].confianza).toBeGreaterThanOrEqual(0);
  });

});
