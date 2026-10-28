import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { leerBonoVisibleOmr } from '../src/modulos/modulo_escaneo_omr/infra/ocrPieOmr.js';

function lector(textos: string[], confianza = 90) {
  let indice = 0;
  return {
    setParameters: vi.fn(async () => undefined),
    recognize: vi.fn(async () => ({ data: { text: textos[indice++] ?? '', confidence: confianza } })),
    terminate: vi.fn(async () => undefined)
  };
}

describe('OCR local del bono de examen', () => {
  it('confirma +0.25 solo cuando dos preparaciones leen el literal con confianza suficiente', async () => {
    const png = await sharp({ create: { width: 1200, height: 1600, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const worker = lector(['+0.25', '+0.25']);

    const salida = await leerBonoVisibleOmr(
      `data:image/png;base64,${png.toString('base64')}`,
      { x: 100, y: 650, width: 180, height: 0.8 },
      { crearWorker: async () => worker as never }
    );

    expect(salida).toEqual({ bono: 0.25, confianza: 90 });
    expect(worker.recognize).toHaveBeenCalledTimes(2);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('no interpreta una lectura parcial o vacía como ausencia confirmada del bono', async () => {
    const png = await sharp({ create: { width: 1200, height: 1600, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const worker = lector(['+0.25', '+0.2']);

    const salida = await leerBonoVisibleOmr(
      `data:image/png;base64,${png.toString('base64')}`,
      { x: 100, y: 650, width: 180, height: 0.8 },
      { crearWorker: async () => worker as never }
    );

    expect(salida).toEqual({ bono: null, confianza: 0 });
  });

  it('marca como incierto un campo sin texto legible aunque ambas lecturas estén vacías', async () => {
    const png = await sharp({ create: { width: 1200, height: 1600, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const worker = lector(['', '']);

    const salida = await leerBonoVisibleOmr(
      `data:image/png;base64,${png.toString('base64')}`,
      { x: 100, y: 650, width: 180, height: 0.8 },
      { crearWorker: async () => worker as never }
    );

    expect(salida).toEqual({ bono: null, confianza: 0 });
  });

  it('inicializa Tesseract con assets locales y lee el literal dentro de la caja PDF', async () => {
    const texto = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="40"><text x="4" y="35" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="black">+0.25</text></svg>');
    const pagina = await sharp({ create: { width: 1275, height: 1650, channels: 3, background: '#ffffff' } })
      .composite([{ input: texto, left: 220, top: 270 }])
      .png()
      .toBuffer();

    const salida = await leerBonoVisibleOmr(
      `data:image/png;base64,${pagina.toString('base64')}`,
      { x: 100, y: 650, width: 180, height: 0.8 }
    );

    expect(salida.bono).toBe(0.25);
  }, 30_000);
});
