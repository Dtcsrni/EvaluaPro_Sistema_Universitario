import { describe, expect, it, vi } from 'vitest';
import { construirTextoQrExamenPagina } from '../src/modulos/modulo_generacion_pdf/domain/qrExamen.js';
import type { ResultadoOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr.js';
import { analizarPaginasOmrParaCalificacion } from '../src/modulos/modulo_escaneo_omr/index.js';

const FOLIO = 'FOL-OMR-LOCAL-01';
const TEMPLATE_ID = 'omr-canonical-v4';

function qr(numeroPagina: number) {
  return construirTextoQrExamenPagina({
    folio: FOLIO,
    numeroPagina,
    templateVersion: 4,
    templateId: TEMPLATE_ID,
    compacto: true
  });
}

function resultado(qrTexto: string, numeroPregunta: number, calidadPagina: number): ResultadoOmr {
  return {
    respuestasDetectadas: [{
      numeroPregunta,
      opcion: 'A',
      confianza: 0.99,
      scoresPorOpcion: [],
      flags: [],
      estadoRespuesta: 'respondida'
    }],
    advertencias: [],
    qrTexto,
    calidadPagina,
    estadoAnalisis: 'ok',
    motivosRevision: [],
    templateVersionDetectada: 4,
    confianzaPromedioPagina: 0.98,
    ratioAmbiguas: 0,
    engineVersion: 'omr-cv-test',
    geomQuality: 0.95,
    photoQuality: calidadPagina,
    decisionPolicy: 'test-v1',
    resumenRespuestas: {
      totalReactivos: 1,
      reactivosRespondidos: 1,
      reactivosSinMarca: 0,
      reactivosAmbiguos: 0,
      reactivosInvalidos: 0,
      examenVacio: false,
      examenVacioProbable: false,
      estadoExamen: 'con_respuestas'
    }
  } as ResultadoOmr;
}

function entrada(paginasCapturadas = [
  { numeroPagina: 1, imagenBase64: 'data:image/png;base64,AA==' },
  { numeroPagina: 2, imagenBase64: 'data:image/png;base64,AA==' }
]) {
  return {
    folio: FOLIO,
    mapaOmr: {
      templateVersion: 4,
      templateId: TEMPLATE_ID,
      margenMm: 9,
      paginas: [
        { numeroPagina: 1, preguntas: [{ numeroPregunta: 1 }], qr: { texto: qr(1) } },
        { numeroPagina: 2, preguntas: [{ numeroPregunta: 2 }], qr: { texto: qr(2) } }
      ]
    },
    paginasExamen: [
      { numero: 1, qrTexto: qr(1) },
      { numero: 2, qrTexto: qr(2) }
    ],
    paginasCapturadas,
    totalPreguntasEsperadas: 2
  };
}

describe('calificacion OMR local desde capturas originales', () => {
  it('vuelve a analizar todas las páginas en el servidor y coteja cada QR con su folio y página', async () => {
    const llamada = vi.fn(async (_imagen: string, mapa: { numeroPagina: number }, qrEsperado: string) =>
      resultado(qrEsperado, mapa.numeroPagina, mapa.numeroPagina === 1 ? 0.94 : 0.91)
    );

    const salida = await analizarPaginasOmrParaCalificacion({ ...entrada(), analizar: llamada as never });

    expect(llamada).toHaveBeenCalledTimes(2);
    expect(salida.respuestasDetectadas.map((respuesta) => respuesta.numeroPregunta)).toEqual([1, 2]);
    expect(salida.respuestasDetectadas.map((respuesta) => respuesta.numeroPaginaFuente)).toEqual([1, 2]);
    expect(salida.analisis.estadoAnalisis).toBe('ok');
    expect(salida.analisis.calidadPagina).toBe(0.91);
    expect(salida.analisis.resumenRespuestas.totalReactivos).toBe(2);
    expect(salida.paginas.map((pagina) => pagina.numeroPagina)).toEqual([1, 2]);
    expect(salida.paginas.every((pagina) => /^[a-f0-9]{64}$/.test(pagina.sha256Imagen))).toBe(true);
  });

  it('rechaza capturas incompletas antes de ejecutar OMR', async () => {
    const analizar = vi.fn();

    await expect(analizarPaginasOmrParaCalificacion({
      ...entrada([{ numeroPagina: 1, imagenBase64: 'data:image/png;base64,AA==' }]),
      analizar: analizar as never
    })).rejects.toMatchObject({ codigo: 'OMR_PAGINAS_INCOMPLETAS' });
    expect(analizar).not.toHaveBeenCalled();
  });

  it('rechaza un templateId ausente sin sustituirlo por el valor canónico por defecto', async () => {
    const datos = entrada();
    const mapaOmr = {
      templateVersion: datos.mapaOmr.templateVersion,
      margenMm: datos.mapaOmr.margenMm,
      paginas: datos.mapaOmr.paginas
    };
    const analizar = vi.fn();

    await expect(analizarPaginasOmrParaCalificacion({
      ...datos,
      mapaOmr,
      analizar: analizar as never
    })).rejects.toMatchObject({ codigo: 'OMR_TEMPLATE_NO_COMPATIBLE' });
    expect(analizar).not.toHaveBeenCalled();
  });

  it('rechaza páginas OMR duplicadas en el mapa antes de leer capturas', async () => {
    const datos = entrada();
    datos.mapaOmr.paginas[1]!.numeroPagina = 1;
    const analizar = vi.fn();

    await expect(analizarPaginasOmrParaCalificacion({ ...datos, analizar: analizar as never }))
      .rejects.toMatchObject({ codigo: 'OMR_MAPA_PAGINAS_INVALIDAS' });
    expect(analizar).not.toHaveBeenCalled();
  });

  it('rechaza un mapa cuya lista de reactivos no cubre la variante antes de leer capturas', async () => {
    const datos = entrada();
    datos.mapaOmr.paginas[1]!.preguntas[0]!.numeroPregunta = 1;
    const analizar = vi.fn();

    await expect(analizarPaginasOmrParaCalificacion({ ...datos, analizar: analizar as never }))
      .rejects.toMatchObject({ codigo: 'OMR_MAPA_REACTIVOS_INVALIDOS' });
    expect(analizar).not.toHaveBeenCalled();
  });

  it('rechaza una captura no decodificable antes de ejecutar OMR', async () => {
    const analizar = vi.fn();
    const paginasCapturadas = entrada().paginasCapturadas.map((pagina) => ({ ...pagina }));
    paginasCapturadas[0]!.imagenBase64 = 'data:text/plain;base64,YQ==';

    await expect(analizarPaginasOmrParaCalificacion({
      ...entrada(paginasCapturadas),
      analizar: analizar as never
    })).rejects.toMatchObject({ codigo: 'OMR_CAPTURA_IMAGEN_INVALIDA' });
    expect(analizar).not.toHaveBeenCalled();
  });

  it('rechaza un QR que no corresponde exactamente a la página generada', async () => {
    const analizar = vi.fn(async () => resultado(qr(2), 1, 0.94));

    await expect(analizarPaginasOmrParaCalificacion({ ...entrada(), analizar: analizar as never }))
      .rejects.toMatchObject({ codigo: 'OMR_QR_NO_COINCIDE_MANIFIESTO' });
  });

  it('se abstiene antes de OMR cuando los metadatos repiten la página', async () => {
    const datos = entrada();
    datos.paginasExamen.push({ numero: 1, qrTexto: qr(1) });
    const analizar = vi.fn();

    await expect(analizarPaginasOmrParaCalificacion({ ...datos, analizar: analizar as never }))
      .rejects.toMatchObject({ codigo: 'OMR_PAGINA_EXAMEN_DUPLICADA' });
    expect(analizar).not.toHaveBeenCalled();
  });

  it('se abstiene antes de OMR cuando el QR del mapa y del registro de página difieren', async () => {
    const datos = entrada();
    datos.paginasExamen[0]!.qrTexto = qr(2);
    const analizar = vi.fn();

    await expect(analizarPaginasOmrParaCalificacion({ ...datos, analizar: analizar as never }))
      .rejects.toMatchObject({ codigo: 'OMR_QR_MANIFIESTO_CONFLICTIVO' });
    expect(analizar).not.toHaveBeenCalled();
  });

  it('solo refleja el bono de OCR cuando el campo está en la primera página del examen', async () => {
    const datos = entrada();
    const paginaInicial = datos.mapaOmr.paginas[0]! as typeof datos.mapaOmr.paginas[number] & {
      layoutDebug?: { headerFieldBoxes: Array<{ id: string; x: number; y: number; width: number; height: number }> };
    };
    paginaInicial.layoutDebug = {
      headerFieldBoxes: [{ id: 'calificacion-linea', x: 120, y: 700, width: 140, height: 0.8 }]
    };
    const leerBono = vi.fn(async () => ({ bono: 0.25 as const, confianza: 86 }));
    const analizar = vi.fn(async (_imagen: string, pagina: { numeroPagina: number }, qrEsperado: string) =>
      resultado(qrEsperado, pagina.numeroPagina, 0.9)
    );
    const salida = await analizarPaginasOmrParaCalificacion({ ...datos, analizar: analizar as never, leerBono });

    expect(leerBono).toHaveBeenCalledWith(datos.paginasCapturadas[0]!.imagenBase64, paginaInicial.layoutDebug!.headerFieldBoxes[0]);
    expect(salida.analisis.bonoVisible).toBe(true);
    expect(salida.analisis.bonoOcrResuelto).toBe(true);
    expect(salida.analisis.bonoOcrConfianza).toBe(86);
  });

  it('expone que el bono no fue determinado cuando el OCR no confirma +0.25', async () => {
    const datos = entrada();
    const paginaInicial = datos.mapaOmr.paginas[0]! as typeof datos.mapaOmr.paginas[number] & {
      layoutDebug?: { headerFieldBoxes: Array<{ id: string; x: number; y: number; width: number; height: number }> };
    };
    paginaInicial.layoutDebug = {
      headerFieldBoxes: [{ id: 'calificacion-linea', x: 120, y: 700, width: 140, height: 0.8 }]
    };
    const leerBono = vi.fn(async () => ({ bono: null, confianza: 0 }));
    const analizar = vi.fn(async (_imagen: string, pagina: { numeroPagina: number }, qrEsperado: string) =>
      resultado(qrEsperado, pagina.numeroPagina, 0.9)
    );

    const salida = await analizarPaginasOmrParaCalificacion({ ...datos, analizar: analizar as never, leerBono });

    expect(salida.analisis.bonoVisible).toBe(false);
    expect(salida.analisis.bonoOcrResuelto).toBe(false);
    expect(salida.analisis.bonoOcrConfianza).toBe(0);
  });
});
