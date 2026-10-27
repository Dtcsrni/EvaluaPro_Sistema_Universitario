import { describe, expect, it, vi } from 'vitest';
import { construirTextoQrExamenPagina } from '../src/modulos/modulo_generacion_pdf/domain/qrExamen.js';
import { recuperarQrIngestaPorGeometria, type ExamenRecuperacionQr } from '../src/modulos/modulo_escaneo_omr/recuperarQrIngesta.js';
import type { analizarOmr, ResultadoOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr.js';

function qr(folio: string) {
  return construirTextoQrExamenPagina({ folio, numeroPagina: 2, templateVersion: 4, compacto: true });
}

const qrFirmado = qr('FOLIO-RECUPERACION');

function examen(id: string, folio: string, raw: string): ExamenRecuperacionQr {
  return {
    id,
    folio,
    paginas: [{ numero: 2, qrTexto: raw }],
    mapaOmr: {
      templateVersion: 4,
      margenMm: 10,
      paginas: [{ numeroPagina: 2, tipoPagina: 'examen', qr: { x: 420, y: 670, size: 90, marginModules: 4, matrixModules: 33, texto: raw }, marcasPagina: { tipo: 'cuadrados', size: 20 }, preguntas: [] }]
    }
  };
}

function analizarConPayload(raw: string) {
  return vi.fn<Parameters<typeof analizarOmr>, ReturnType<typeof analizarOmr>>(async (_image, _map, expected) => ({
    qrTexto: expected?.includes(raw) ? raw : undefined,
    qrFuenteDeteccion: expected?.includes(raw) ? 'known_geometry_rescue' : undefined
  } as ResultadoOmr));
}

describe('recuperación QR de ingesta por geometría', () => {
  it('prueba los QR firmados del lote sin OCR y acepta solo el payload exacto registrado', async () => {
    const otroQr = qr('FOLIO-OTRO');
    const analizar = analizarConPayload(qrFirmado);

    const recuperado = await recuperarQrIngestaPorGeometria({
      imagenBase64: 'data:image/png;base64,original',
      examenes: [examen('exam-1', 'FOLIO-RECUPERACION', qrFirmado), examen('exam-2', 'FOLIO-OTRO', otroQr)],
      qrsRegistrados: new Map([
        ['EXAM-1:2', new Set([qrFirmado])],
        ['EXAM-2:2', new Set([otroQr])]
      ]),
      analizar
    });

    expect(analizar).toHaveBeenCalledOnce();
    expect(analizar.mock.calls[0]?.[2]).toEqual(expect.arrayContaining([qrFirmado, otroQr]));
    expect(recuperado?.qr.raw).toBe(qrFirmado);
    expect(recuperado?.qr.payloadSignatureValid).toBe(true);
    expect(recuperado).toMatchObject({ examenId: 'exam-1', numeroPagina: 2, fuenteDeteccion: 'known_geometry_rescue' });
  });

  it('se abstiene si la firma no es válida aunque el payload esté en la referencia', async () => {
    const ultimoCaracter = qrFirmado.at(-1)!;
    const qrSinFirma = `${qrFirmado.slice(0, -1)}${ultimoCaracter === 'A' ? 'B' : 'A'}`;
    const analizar = analizarConPayload(qrSinFirma);

    const recuperado = await recuperarQrIngestaPorGeometria({
      imagenBase64: 'data:image/png;base64,original',
      examenes: [examen('exam-1', 'FOLIO-RECUPERACION', qrSinFirma)],
      qrsRegistrados: new Map([['EXAM-1:2', new Set([qrSinFirma])]]),
      analizar
    });

    expect(recuperado).toBeNull();
    expect(analizar).toHaveBeenCalledOnce();
  });

  it('se abstiene si el QR leído no está cotejado con el PDF de referencia', async () => {
    const analizar = analizarConPayload(qrFirmado);

    const recuperado = await recuperarQrIngestaPorGeometria({
      imagenBase64: 'data:image/png;base64,original',
      examenes: [examen('exam-1', 'FOLIO-RECUPERACION', qrFirmado)],
      qrsRegistrados: new Map(),
      analizar
    });

    expect(recuperado).toBeNull();
    expect(analizar).not.toHaveBeenCalled();
  });

  it('se abstiene si los textos QR del examen y el mapa no coinciden', async () => {
    const mapa = examen('exam-1', 'FOLIO-RECUPERACION', qrFirmado);
    const mapaJson = JSON.parse(JSON.stringify(mapa.mapaOmr));
    mapaJson.paginas[0].qr.texto = 'QR-DIFERENTE';
    mapa.mapaOmr = mapaJson;
    const analizar = analizarConPayload(qrFirmado);

    const recuperado = await recuperarQrIngestaPorGeometria({
      imagenBase64: 'data:image/png;base64,original',
      examenes: [mapa],
      qrsRegistrados: new Map([['EXAM-1:2', new Set([qrFirmado])]]),
      analizar
    });

    expect(recuperado).toBeNull();
    expect(analizar).not.toHaveBeenCalled();
  });

  it('se abstiene si el payload firmado declara una página distinta a la registrada', async () => {
    const qrDePaginaUno = construirTextoQrExamenPagina({
      folio: 'FOLIO-RECUPERACION',
      numeroPagina: 1,
      templateVersion: 4,
      compacto: true
    });
    const analizar = analizarConPayload(qrDePaginaUno);

    const recuperado = await recuperarQrIngestaPorGeometria({
      imagenBase64: 'data:image/png;base64,original',
      examenes: [examen('exam-1', 'FOLIO-RECUPERACION', qrDePaginaUno)],
      qrsRegistrados: new Map([['EXAM-1:2', new Set([qrDePaginaUno])]]),
      analizar
    });

    expect(recuperado).toBeNull();
    expect(analizar).toHaveBeenCalledOnce();
  });

  it('se abstiene si el payload firmado declara otro examId', async () => {
    const qrDeOtroExamen = construirTextoQrExamenPagina({
      folio: 'FOLIO-RECUPERACION',
      numeroPagina: 2,
      templateVersion: 4,
      examId: 'exam-otro'
    });
    const analizar = analizarConPayload(qrDeOtroExamen);

    const recuperado = await recuperarQrIngestaPorGeometria({
      imagenBase64: 'data:image/png;base64,original',
      examenes: [examen('exam-1', 'FOLIO-RECUPERACION', qrDeOtroExamen)],
      qrsRegistrados: new Map([['EXAM-1:2', new Set([qrDeOtroExamen])]]),
      analizar
    });

    expect(recuperado).toBeNull();
    expect(analizar).toHaveBeenCalledOnce();
  });

  it('se abstiene si el mapa registrado no usa la geometría TV4', async () => {
    const mapa = examen('exam-1', 'FOLIO-RECUPERACION', qrFirmado);
    const mapaJson = JSON.parse(JSON.stringify(mapa.mapaOmr));
    mapaJson.templateVersion = 3;
    mapa.mapaOmr = mapaJson;
    const analizar = analizarConPayload(qrFirmado);

    const recuperado = await recuperarQrIngestaPorGeometria({
      imagenBase64: 'data:image/png;base64,original',
      examenes: [mapa],
      qrsRegistrados: new Map([['EXAM-1:2', new Set([qrFirmado])]]),
      analizar
    });

    expect(recuperado).toBeNull();
    expect(analizar).not.toHaveBeenCalled();
  });
});
