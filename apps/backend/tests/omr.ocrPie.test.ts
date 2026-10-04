import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { consensuarReferenciasPieOmr, extraerReferenciasPieOmr, leerReferenciaPieOmr, limitarTiempoOcrPie } from '../src/modulos/modulo_escaneo_omr/infra/ocrPieOmr.js';

describe('OCR de identidad impresa en el pie OMR', () => {
  it('extrae folio y página explícitos sin depender del QR', () => {
    expect(extraerReferenciasPieOmr('13CEDC79 · Página 2')).toEqual([
      { folio: '13CEDC79', numeroPagina: 2 }
    ]);
  });

  it('tolera separadores OCR y confusión de 1 por I solo en página', () => {
    expect(extraerReferenciasPieOmr('21CD759C + Pagina I')).toEqual([
      { folio: '21CD759C', numeroPagina: 1 }
    ]);
  });

  it('se abstiene ante ausencia, página fuera de rango o más de una identidad', () => {
    expect(extraerReferenciasPieOmr('texto sin identificación')).toEqual([]);
    expect(extraerReferenciasPieOmr('13CEDC79 Página 0')).toEqual([]);
    expect(extraerReferenciasPieOmr('13CEDC79 P1 y 21CD759C P2')).toHaveLength(2);
  });

  it('requiere dos posiciones con coincidencia exacta de folio y página', () => {
    const lectura = { folio: '589010B0', numeroPagina: 2, confianza: 92 };
    expect(consensuarReferenciasPieOmr([lectura, { ...lectura, confianza: 88 }]))
      .toEqual({ ...lectura, confianza: 88 });
    expect(consensuarReferenciasPieOmr([lectura, null])).toBeNull();
    expect(consensuarReferenciasPieOmr([lectura, { ...lectura, folio: '589010BO' }])).toBeNull();
    expect(consensuarReferenciasPieOmr([lectura, { ...lectura, numeroPagina: 3 }])).toBeNull();
    expect(consensuarReferenciasPieOmr([lectura, { ...lectura, confianza: 74 }])).toBeNull();
  });

  it.each([
    ['portrait', 612, 792],
    ['sideways', 792, 612]
  ])('lee las dos posiciones periféricas tras normalizar página %s', async (_orientacion, width, height) => {
    const imagen = await sharp({ create: { width, height, channels: 3, background: '#ffffff' } }).png().toBuffer();
    let llamadas = 0;
    const worker = {
      async recognize() {
        llamadas += 1;
        return { data: { text: '24681357 · Pagina 2', confidence: 90 } };
      }
    } as any;
    const referencia = await leerReferenciaPieOmr(`data:image/png;base64,${imagen.toString('base64')}`, worker);
    expect(referencia).toEqual({ folio: '24681357', numeroPagina: 2, confianza: 90 });
    expect(llamadas).toBe(4);
  });

  it('corta un reconocimiento que no responde con un código de timeout estable', async () => {
    await expect(limitarTiempoOcrPie(new Promise<never>(() => undefined), 5))
      .rejects.toMatchObject({ code: 'OMR_OCR_TIMEOUT' });
  });
});
