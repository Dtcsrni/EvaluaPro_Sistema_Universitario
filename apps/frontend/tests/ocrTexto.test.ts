import { describe, expect, it, vi } from 'vitest';
import {
  calcularRecortesPieOmr,
  extraerReferenciaPieOmr,
  analizarOmrConFallbackPie,
  cargarModuloTesseract,
  leerTextoConOcr,
  leerTextoConOcrDetallado,
  leerTextosConOcrDetallado,
  qrIdentificaPagina,
  resolverReferenciaPieOmr
} from '../src/apps/app_docente/ocrTexto';

describe('lectura OCR con Tesseract.js', () => {
  it('resuelve Tesseract mediante el import diferido que procesa Vite', async () => {
    const modulo = await cargarModuloTesseract();
    expect(typeof modulo.createWorker).toBe('function');
  });

  it('crea worker en español e inglés, devuelve texto y lo termina', async () => {
    const recognize = vi.fn().mockResolvedValue({ data: { text: '  Ana Pérez  ' } });
    const terminate = vi.fn().mockResolvedValue(undefined);
    const createWorker = vi.fn().mockResolvedValue({ recognize, terminate });

    await expect(leerTextoConOcr('data:image/png;base64,abc', createWorker)).resolves.toBe('Ana Pérez');
    expect(createWorker).toHaveBeenCalledWith('spa+eng');
    expect(recognize).toHaveBeenCalledWith('data:image/png;base64,abc');
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('termina worker aunque falle el reconocimiento', async () => {
    const terminate = vi.fn().mockResolvedValue(undefined);
    const createWorker = vi.fn().mockResolvedValue({
      recognize: vi.fn().mockRejectedValue(new Error('OCR failed')),
      terminate
    });

    await expect(leerTextoConOcr('data:image/png;base64,abc', createWorker)).rejects.toThrow('OCR failed');
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('conserva el nivel de confianza OCR para decidir si se puede usar el pie', async () => {
    const terminate = vi.fn().mockResolvedValue(undefined);
    const createWorker = vi.fn().mockResolvedValue({
      recognize: vi.fn().mockResolvedValue({ data: { text: 'C5051CA1 · Pagina 2', confidence: 87.6 } }),
      terminate
    });

    await expect(leerTextoConOcrDetallado('data:image/png;base64,abc', createWorker)).resolves.toEqual({
      texto: 'C5051CA1 · Pagina 2',
      confianza: 87.6
    });
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('reconoce varias franjas con un solo worker y siempre lo termina', async () => {
    const recognize = vi.fn()
      .mockResolvedValueOnce({ data: { text: 'sin identificador', confidence: 42 } })
      .mockResolvedValueOnce({ data: { text: 'C5051CA1 · Pagina 2', confidence: 88 } });
    const terminate = vi.fn().mockResolvedValue(undefined);
    const createWorker = vi.fn().mockResolvedValue({ recognize, terminate });

    await expect(leerTextosConOcrDetallado(['recorte-1', 'recorte-2'], createWorker)).resolves.toEqual([
      { texto: 'sin identificador', confianza: 42 },
      { texto: 'C5051CA1 · Pagina 2', confianza: 88 }
    ]);
    expect(createWorker).toHaveBeenCalledOnce();
    expect(recognize).toHaveBeenNthCalledWith(1, 'recorte-1');
    expect(recognize).toHaveBeenNthCalledWith(2, 'recorte-2');
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('no crea worker para una lista vacía y termina el worker ante error en cualquier recorte', async () => {
    const createWorker = vi.fn();
    await expect(leerTextosConOcrDetallado([], createWorker)).resolves.toEqual([]);
    expect(createWorker).not.toHaveBeenCalled();

    const terminate = vi.fn().mockResolvedValue(undefined);
    const worker = { recognize: vi.fn().mockRejectedValue(new Error('OCR failed')), terminate };
    await expect(leerTextosConOcrDetallado(['recorte'], vi.fn().mockResolvedValue(worker))).rejects.toThrow('OCR failed');
    expect(terminate).toHaveBeenCalledOnce();
  });
});

describe('referencia OMR impresa en el pie', () => {
  it('busca el pie abajo/arriba en retrato y en laterales con giros correctos en paisaje', () => {
    expect(calcularRecortesPieOmr(1200, 1800)).toEqual([
      { left: 0.2, top: 0.91, width: 0.6, height: 0.08, rotacionGrados: 0 },
      { left: 0.2, top: 0.01, width: 0.6, height: 0.08, rotacionGrados: 180 }
    ]);
    expect(calcularRecortesPieOmr(1800, 1200)).toEqual([
      { left: 0.01, top: 0.2, width: 0.09, height: 0.6, rotacionGrados: 270 },
      { left: 0.9, top: 0.2, width: 0.09, height: 0.6, rotacionGrados: 90 }
    ]);
    expect(calcularRecortesPieOmr(100, 100)).toEqual([]);
  });

  it('extrae folio y página aunque el OCR devuelva acentos o saltos de línea', () => {
    expect(extraerReferenciaPieOmr('C5051CA1 · PÁGINA\n2')).toEqual({ folio: 'C5051CA1', numeroPagina: 2 });
  });

  it('normaliza I, L o barra vertical a 1 solo en el token OCR de página', () => {
    expect(extraerReferenciaPieOmr('C5051CA1 · Pagina l')).toEqual({ folio: 'C5051CA1', numeroPagina: 1 });
    expect(extraerReferenciaPieOmr('C5051CA1 · Pagina |')).toEqual({ folio: 'C5051CA1', numeroPagina: 1 });
    expect(extraerReferenciaPieOmr('C5051CA1 · Pagina 2')).toEqual({ folio: 'C5051CA1', numeroPagina: 2 });
  });

  it('rechaza texto sin referencia, página fuera de rango o referencias contradictorias', () => {
    expect(extraerReferenciaPieOmr('C5051CA1')).toBeNull();
    expect(extraerReferenciaPieOmr('C5051CA1 · Pagina 0')).toBeNull();
    expect(extraerReferenciaPieOmr('C5051CA1 · Pagina 2\nD8703B17 · Pagina 1')).toBeNull();
  });

  it('acepta recortes coincidentes con confianza suficiente y se abstiene ante conflicto o baja confianza', () => {
    expect(resolverReferenciaPieOmr([
      { texto: 'C5051CA1 · Pagina 2', confianza: 81 },
      { texto: 'C5051CA1 · Pagina 2', confianza: 92 }
    ])).toEqual({ folio: 'C5051CA1', numeroPagina: 2 });
    expect(resolverReferenciaPieOmr([
      { texto: 'C5051CA1 · Pagina 2', confianza: 81 },
      { texto: 'D8703B17 · Pagina 1', confianza: 92 }
    ])).toBeNull();
    expect(resolverReferenciaPieOmr([{ texto: 'C5051CA1 · Pagina 2', confianza: 74 }])).toBeNull();
  });

  it('no considera utilizable un QR decodificado con folio/página en conflicto', () => {
    expect(qrIdentificaPagina('EXAMEN:OTRO:P1:TV4', [])).toBe(true);
    expect(qrIdentificaPagina('EXAMEN:OTRO:P1:TV4', ['El QR no coincide con el examen esperado'])).toBe(false);
    expect(qrIdentificaPagina(undefined, [])).toBe(false);
  });

  it('conserva prioridad QR y no ejecuta OCR cuando el payload ya fue leído', async () => {
    const leerPie = vi.fn().mockResolvedValue({ folio: 'C5051CA1', numeroPagina: 2 });
    const analizar = vi.fn().mockResolvedValue({ qrTexto: 'qr-valido' });

    await expect(analizarOmrConFallbackPie({
      folioManual: '',
      paginaManual: 0,
      analizar,
      leerPie,
      tieneQr: (resultado) => Boolean(resultado.qrTexto),
      puedeUsarFallback: () => true
    })).resolves.toEqual({ resultado: { qrTexto: 'qr-valido' }, referenciaPie: null });
    expect(leerPie).not.toHaveBeenCalled();
    expect(analizar).toHaveBeenCalledOnce();
  });

  it('reintenta con folio y página del pie solo tras un error elegible de identidad', async () => {
    const errorQr = new Error('no QR');
    const resultado = { qrTexto: undefined };
    const analizar = vi.fn().mockRejectedValueOnce(errorQr).mockResolvedValueOnce(resultado);
    const referenciaPie = { folio: 'C5051CA1', numeroPagina: 2 };

    await expect(analizarOmrConFallbackPie({
      folioManual: '',
      paginaManual: 0,
      analizar,
      leerPie: vi.fn().mockResolvedValue(referenciaPie),
      tieneQr: (value) => Boolean(value.qrTexto),
      puedeUsarFallback: (error) => error === errorQr
    })).resolves.toEqual({ resultado, referenciaPie });
    expect(analizar).toHaveBeenNthCalledWith(1, '', 0);
    expect(analizar).toHaveBeenNthCalledWith(2, 'C5051CA1', 2);
  });

  it('usa el pie OCR si existe texto QR pero el backend reporta que no valida esta página', async () => {
    const referenciaPie = { folio: 'C5051CA1', numeroPagina: 2 };
    const qrEnConflicto = {
      qrTexto: 'EXAMEN:OTRO:P1:TV4',
      advertencias: ['El QR no coincide con el examen esperado']
    };
    const analizar = vi.fn().mockResolvedValue(qrEnConflicto);
    const leerPie = vi.fn().mockResolvedValue(referenciaPie);

    await expect(analizarOmrConFallbackPie({
      folioManual: '',
      paginaManual: 0,
      analizar,
      leerPie,
      tieneQr: (resultado) => qrIdentificaPagina(resultado.qrTexto, resultado.advertencias),
      puedeUsarFallback: () => true
    })).resolves.toEqual({ resultado: qrEnConflicto, referenciaPie });
    expect(analizar).toHaveBeenNthCalledWith(1, '', 0);
    expect(analizar).toHaveBeenNthCalledWith(2, 'C5051CA1', 2);
    expect(leerPie).toHaveBeenCalledOnce();
  });

  it('se abstiene si el OCR contradice un dato manual o no encuentra folio y página', async () => {
    const errorQr = new Error('no QR');
    const analizar = vi.fn().mockRejectedValue(errorQr);
    const leerPie = vi.fn().mockResolvedValue({ folio: 'D8703B17', numeroPagina: 1 });
    const params = {
      folioManual: 'C5051CA1',
      paginaManual: 0,
      analizar,
      leerPie,
      tieneQr: () => false,
      puedeUsarFallback: () => true
    };

    await expect(analizarOmrConFallbackPie(params)).rejects.toThrow('no coincide');
    expect(analizar).toHaveBeenCalledOnce();

    analizar.mockClear();
    await expect(analizarOmrConFallbackPie({ ...params, leerPie: vi.fn().mockResolvedValue(null) })).rejects.toBe(errorQr);
    expect(analizar).toHaveBeenCalledOnce();
  });

  it('no acepta la página por defecto si el backend respondió sin QR y el pie no es legible', async () => {
    const analizar = vi.fn().mockResolvedValue({ qrTexto: undefined });

    await expect(analizarOmrConFallbackPie({
      folioManual: 'C5051CA1',
      paginaManual: 0,
      analizar,
      leerPie: vi.fn().mockResolvedValue(null),
      tieneQr: (resultado) => Boolean(resultado.qrTexto),
      puedeUsarFallback: () => true
    })).rejects.toThrow('captura ambos datos manualmente');
  });
});
