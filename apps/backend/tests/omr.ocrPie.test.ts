import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { consensuarReferenciasPieOmr, extraerReferenciasPieOmr, leerReferenciaPieOmr, limitarTiempoOcrPie, sugerirFolioCercanoOmr } from '../src/modulos/modulo_escaneo_omr/infra/ocrPieOmr.js';

describe('OCR de identidad impresa en el pie OMR', () => {
  it('extrae folio y página explícitos sin depender del QR', () => {
    expect(extraerReferenciasPieOmr('13CEDC79 · Página 2')).toEqual([
      { folio: '13CEDC79', numeroPagina: 2 }
    ]);
  });

  it('reconoce el formato visual del nuevo pie y omite el total de páginas', () => {
    expect(extraerReferenciasPieOmr('FOLIO OCR-SERIAL-TEST-01 · Pagina 2 de 12')).toEqual([
      { folio: 'OCR-SERIAL-TEST-01', numeroPagina: 2 }
    ]);
  });

  it('tolera separadores OCR y confusión de 1 por I solo en página', () => {
    expect(extraerReferenciasPieOmr('21CD759C + Pagina I')).toEqual([
      { folio: '21CD759C', numeroPagina: 1 }
    ]);
    expect(extraerReferenciasPieOmr('FOLIO FEEDFACE - PAGINA Z DE 2')).toEqual([
      { folio: 'FEEDFACE', numeroPagina: 2 }
    ]);
  });

  it('se abstiene ante ausencia, página fuera de rango o más de una identidad', () => {
    expect(extraerReferenciasPieOmr('texto sin identificación')).toEqual([]);
    expect(extraerReferenciasPieOmr('13CEDC79 Página 0')).toEqual([]);
    expect(extraerReferenciasPieOmr('13CEDC79 P1 y 21CD759C P2')).toHaveLength(2);
    expect(extraerReferenciasPieOmr('FOLIO 13CEDC79 Pagina 1 de 2 21CD759C Pagina 2 de 2')).toHaveLength(2);
  });

  it('requiere dos posiciones con coincidencia exacta de folio y página', () => {
    const lectura = { folio: '589010B0', numeroPagina: 2, confianza: 92 };
    expect(consensuarReferenciasPieOmr([lectura, { ...lectura, confianza: 88 }]))
      .toEqual({ ...lectura, confianza: 88 });
    expect(consensuarReferenciasPieOmr([lectura, null])).toBeNull();
    expect(consensuarReferenciasPieOmr([lectura, { ...lectura, folio: '589010BO' }])).toBeNull();
    expect(consensuarReferenciasPieOmr([lectura, { ...lectura, numeroPagina: 3 }])).toBeNull();
    expect(consensuarReferenciasPieOmr([lectura, { ...lectura, confianza: 74 }])).toBeNull();
    expect(consensuarReferenciasPieOmr([lectura, { ...lectura, confianza: 50 }], 50))
      .toEqual({ ...lectura, confianza: 50 });
  });

  it('corrige una sustitución de carácter solo si el folio del lote es único', () => {
    expect(sugerirFolioCercanoOmr('19533762', ['19F33762'])).toBe('19F33762');
    expect(sugerirFolioCercanoOmr('19533762', ['19F33762', '19533762'])).toBeNull();
    expect(sugerirFolioCercanoOmr('19533762', ['19F33762', '19533763'])).toBeNull();
    expect(sugerirFolioCercanoOmr('13762', ['19F33762'])).toBe('19F33762');
    expect(sugerirFolioCercanoOmr('13762', ['19F33762', 'AB13762X'])).toBeNull();
    expect(sugerirFolioCercanoOmr('633762', ['19F33762'])).toBe('19F33762');
    expect(sugerirFolioCercanoOmr('633762', ['19F33762', 'AB33762Q'])).toBeNull();
    expect(sugerirFolioCercanoOmr('3762', ['19F33762'])).toBeNull();
    expect(sugerirFolioCercanoOmr('19F33762', ['19F33762'])).toBeNull();
  });

  it('recupera una banda inferior desplazada con mayoría exacta de umbrales y conserva la confianza mínima', async () => {
    const imagen = await sharp({ create: { width: 612, height: 792, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const lecturas = [
      { text: '19F33762 · Pagina 1', confidence: 63 },
      { text: '19F33762- P 1', confidence: 44 },
      { text: '19633762 - P 1', confidence: 75 },
      { text: '', confidence: 0 },
      { text: '19F33762 - P 1', confidence: 51 },
      { text: '19F33762 - P 1', confidence: 49 },
      { text: '19533762 - P 1', confidence: 60 },
      { text: '', confidence: 0 }
    ];
    let llamadas = 0;
    const worker = {
      async setParameters() {},
      async recognize() {
        const llamada = llamadas++;
        return { data: llamada < 12 ? { text: '', confidence: 0 } : lecturas[llamada - 12] };
      }
    } as any;

    const referencia = await leerReferenciaPieOmr(`data:image/png;base64,${imagen.toString('base64')}`, worker);

    expect(referencia).toEqual({ folio: '19F33762', numeroPagina: 1, confianza: 44, posicionesCoincidentes: 2 });
    expect(llamadas).toBe(20);
  });

  it('acepta una mitad del pie cuando la otra solo produce fragmentos sin candidato rival', async () => {
    const imagen = await sharp({ create: { width: 612, height: 792, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const lecturas = [
      { text: '19F33762 - P 2', confidence: 67 },
      { text: '19F33762- P 2', confidence: 59 },
      { text: '19F33762 - P I 2', confidence: 49 },
      { text: '', confidence: 0 },
      { text: '33762 - P 2', confidence: 50 },
      { text: '1F33762 - P 2', confidence: 56 },
      { text: '633762 - P 2', confidence: 75 },
      { text: 'F33762 - P 2', confidence: 72 }
    ];
    let llamadas = 0;
    const worker = {
      async setParameters() {},
      async recognize() {
        const llamada = llamadas++;
        return { data: llamada < 12 ? { text: '', confidence: 0 } : lecturas[llamada - 12] };
      }
    } as any;

    const referencia = await leerReferenciaPieOmr(`data:image/png;base64,${imagen.toString('base64')}`, worker);

    expect(referencia).toEqual({ folio: '19F33762', numeroPagina: 2, confianza: 59, posicionesCoincidentes: 1 });
    expect(llamadas).toBe(20);
  });

  it('concilia las referencias repetidas de una banda completa contra el folio único del lote', async () => {
    const imagen = await sharp({ create: { width: 792, height: 612, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const lecturas = [
      { text: '19533762 + Pagina 2', confidence: 59 },
      { text: '19533762 - Pagina 2\n19F33762 - Pagina 2', confidence: 73 }
    ];
    let llamadas = 0;
    const worker = {
      async setParameters() {},
      async recognize() {
        const llamada = llamadas++;
        return { data: llamada < 20 ? { text: '', confidence: 0 } : lecturas[llamada - 20] };
      }
    } as any;

    const referencia = await leerReferenciaPieOmr(
      `data:image/png;base64,${imagen.toString('base64')}`,
      worker,
      ['19F33762']
    );

    expect(referencia).toEqual({ folio: '19533762', numeroPagina: 2, confianza: 59, posicionesCoincidentes: 2 });
    expect(sugerirFolioCercanoOmr(referencia!.folio, ['19F33762'])).toBe('19F33762');
    expect(llamadas).toBe(22);
  });

  it.each([
    ['portrait', 612, 792],
    ['sideways', 792, 612]
  ])('lee las dos posiciones periféricas tras normalizar página %s', async (_orientacion, width, height) => {
    const imagen = await sharp({ create: { width, height, channels: 3, background: '#ffffff' } }).png().toBuffer();
    let llamadas = 0;
    const worker = {
      async setParameters() {},
      async recognize() {
        llamadas += 1;
        return { data: { text: '24681357 · Pagina 2', confidence: 90 } };
      }
    } as any;
    const referencia = await leerReferenciaPieOmr(`data:image/png;base64,${imagen.toString('base64')}`, worker);
    expect(referencia).toEqual({ folio: '24681357', numeroPagina: 2, confianza: 90, posicionesCoincidentes: 2 });
    expect(llamadas).toBe(2);
  });

  it('corta un reconocimiento que no responde con un código de timeout estable', async () => {
    await expect(limitarTiempoOcrPie(new Promise<never>(() => undefined), 5))
      .rejects.toMatchObject({ code: 'OMR_OCR_TIMEOUT' });
  });
});
