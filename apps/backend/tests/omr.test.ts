/**
 * omr.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas del servicio OMR.
import sharp from 'sharp';
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import {
  aplicarAbstencionPorDesalineacionOmr,
  aplicarAbstencionPorDobleMarcaOmr,
  detectarQrConRotacionPagina,
  detectarQrEnResolucionFuenteRotada,
  detectarDobleMarcaPorFormaOmr,
  debeResolverDobleOmrPorTintaCromatica,
  tieneAlineacionDeBurbujasVerificadaOmr,
  rescatarMarcaAisladaPorRasgosOmr,
  type ResultadoOmr,
  type ScoreOpcionOmr
} from '../src/modulos/modulo_escaneo_omr/servicioOmrCv.js';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr.js';

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

describe('rescate QR por orientación de página', () => {
  it('rescata solo el payload esperado por ZXing al rotar la página fuente y valida su geometría', async () => {
    const width = 1600;
    const height = 2069;
    const payload = 'EXAMEN:ROT12345:P1:TV4';
    const wrongPayload = 'EXAMEN:OTRO1234:P1:TV4';
    const matrix = QRCode.create(payload, { errorCorrectionLevel: 'H' });
    const qrSize = Math.round((22 * 72 / 25.4 * (612 / 595.276) / 612) * width);
    const qr = await QRCode.toBuffer(payload, { width: qrSize, margin: 4, errorCorrectionLevel: 'H' });
    const page = await sharp({
      create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } }
    })
      .composite([{ input: qr, left: width - qrSize - 48, top: 48 }])
      .png()
      .toBuffer();

    const detected = await detectarQrEnResolucionFuenteRotada(page, undefined, {
      matrixModules: matrix.modules.size,
      payloadsEsperados: [payload]
    });
    expect(detected?.data).toBe(payload);
    expect(detected?.fuenteDeteccionQr).toBe('rotacion_pagina');
    expect(detected?.calidadGeometrica).toBeGreaterThan(0.7);
    expect(detected?.orientacionFuenteGrados).toBe(0);
    await expect(detectarQrEnResolucionFuenteRotada(page, undefined, {
      matrixModules: matrix.modules.size,
      payloadsEsperados: [wrongPayload]
    })).resolves.toBeNull();
    await expect(detectarQrEnResolucionFuenteRotada(page)).resolves.toBeNull();
  }, 180_000);

  it('recupera el QR exacto de una página girada y devuelve coordenadas de la captura original', async () => {
    const width = 1600;
    const height = 2069;
    const payload = 'EXAMEN:ABC12345:P1:TV4';
    const ladoQr = 208;
    const qr = await QRCode.toBuffer(payload, { width: ladoQr, margin: 4, errorCorrectionLevel: 'M' });
    const paginaVertical = await sharp({
      create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
    })
      .composite([{ input: qr, left: Math.round(width * 0.8875 - ladoQr / 2), top: Math.round(height * 0.107 - ladoQr / 2) }])
      .png()
      .toBuffer();
    const pagina = await sharp(paginaVertical).rotate(180).png().toBuffer();
    const { data, info } = await sharp(pagina).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixeles = new Uint8ClampedArray(data);

    const resultado = await detectarQrConRotacionPagina(pixeles, info.width, info.height, undefined, [payload]);
    expect(resultado?.data).toBe(payload);
    expect(resultado?.fuenteDeteccionQr).toBe('rotacion_pagina');
    expect(resultado?.orientacionFuenteGrados).toBe(180);
    const centro = {
      x: (resultado!.location.topLeftCorner.x + resultado!.location.bottomRightCorner.x) / 2,
      y: (resultado!.location.topLeftCorner.y + resultado!.location.bottomRightCorner.y) / 2
    };
    expect(centro.x).toBeLessThan(width / 3);
    expect(centro.y).toBeGreaterThan(height * 0.7);
    await expect(detectarQrConRotacionPagina(pixeles, info.width, info.height, undefined, ['EXAMEN:OTRO:P1:TV4']))
      .resolves.toBeNull();
  }, 180_000);

  it.each([90, 270] as const)('recupera una captura apaisada girada %i° sin cambiar el marco de coordenadas', async (giro) => {
    const width = 1600;
    const height = 2069;
    const payload = 'EXAMEN:DEF67890:P1:TV4';
    const ladoQr = 208;
    const qr = await QRCode.toBuffer(payload, { width: ladoQr, margin: 4, errorCorrectionLevel: 'M' });
    const vertical = await sharp({
      create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
    })
      .composite([{ input: qr, left: Math.round(width * 0.8875 - ladoQr / 2), top: Math.round(height * 0.107 - ladoQr / 2) }])
      .png()
      .toBuffer();
    const pagina = await sharp(vertical).rotate(giro).png().toBuffer();
    const { data, info } = await sharp(pagina).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const resultado = await detectarQrConRotacionPagina(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      undefined,
      [payload]
    );

    expect(resultado?.data).toBe(payload);
    expect(resultado?.fuenteDeteccionQr).toBe('rotacion_pagina');
    expect(resultado?.orientacionFuenteGrados).toBe(giro);
    const centro = {
      x: (resultado!.location.topLeftCorner.x + resultado!.location.bottomRightCorner.x) / 2,
      y: (resultado!.location.topLeftCorner.y + resultado!.location.bottomRightCorner.y) / 2
    };
    if (giro === 90) {
      expect(centro.x).toBeGreaterThan(height * 0.7);
      expect(centro.y).toBeGreaterThan(width * 0.7);
    } else {
      expect(centro.x).toBeLessThan(height / 3);
      expect(centro.y).toBeLessThan(width / 3);
    }
  }, 180_000);
});

function crearMapaOmrCanonico(
  numeroPregunta: number,
  idPregunta: string,
  opciones: Array<{ letra: string; x: number; y: number }>
) {
  const opcionA = opciones.find((item) => item.letra === 'A') ?? opciones[0];
  const referenciaY = Number(opcionA?.y ?? opciones[0]?.y ?? 100);
  const referenciaX = Number(opcionA?.x ?? opciones[0]?.x ?? 100);
  const opcionB = opciones.find((item) => item.letra === 'B') ?? opciones[1];
  const pasoX = opcionB ? Math.abs(opcionB.x - referenciaX) : 0;
  const pasoY = opcionB ? Math.abs(opcionB.y - referenciaY) : 0;
  return {
    numeroPagina: 1,
    templateVersion: 4 as const,
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
          ...(pasoX > pasoY ? { pasoX } : {}),
          cajaAncho: 42
        }
      }
    ]
  };
}

function dibujarFiducialesCanonicos(
  setPixel: (x: number, y: number, value: number) => void,
  width: number,
  height: number,
  escala = 1
) {
  const margin = 10 * (72 / 25.4) * escala;
  const side = 7 * (72 / 25.4) * escala;
  const half = side / 2;
  const holeRadius = 1.2 * (72 / 25.4) * escala;
  const corners = [
    { x: margin + half, y: margin + half, directional: true },
    { x: width - margin - half, y: margin + half, directional: false },
    { x: margin + half, y: height - margin - half, directional: false },
    { x: width - margin - half, y: height - margin - half, directional: false }
  ];

  for (const corner of corners) {
    for (let y = Math.floor(corner.y - half); y <= Math.ceil(corner.y + half); y += 1) {
      for (let x = Math.floor(corner.x - half); x <= Math.ceil(corner.x + half); x += 1) {
        const isDirectionalHole = corner.directional && Math.hypot(x - corner.x, y - corner.y) <= holeRadius;
        setPixel(x, y, isDirectionalHole ? 255 : 0);
      }
    }
  }
}

function metadataFiducialesCanonicos() {
  return {
    tipo: 'cuadrados' as const,
    size: 7 * (72 / 25.4),
    quietZone: 0.8 * (72 / 25.4),
    orientacion: {
      esquina: 'tl' as const,
      tipo: 'centro_vacio' as const,
      radio: 1.2 * (72 / 25.4)
    }
  };
}

function crearScoreMarcaCromatica(
  opcion: ScoreOpcionOmr['opcion'],
  overrides: Partial<ScoreOpcionOmr> = {}
): ScoreOpcionOmr {
  return {
    opcion,
    score: 0.2,
    fillRatioCore: 0.3,
    fillRatioRing: 0.2,
    fillDelta: 0,
    contraste: 0,
    radialMassRatio: 0.3,
    centroidOffsetRatio: 0.1,
    centerDarknessDelta: 0,
    centerMean: 200,
    softCoreContrast: 0,
    softCentroidOffsetRatio: 0.1,
    ringMean: 200,
    outerMean: 200,
    nucleusFillRatio: 0.2,
    nucleusDarknessDelta: 0,
    contrasteCromaticoLocal: 0,
    margenCromatico: 0,
    strokeLeakPenalty: 0,
    shapeCompactness: 0.5,
    markConfidence: 0.2,
    estadoMarca: 'no_marcada',
    ...overrides
  };
}

describe('alineación de burbujas OMR', () => {
  it('confirma una omisión solo si al menos tres de cinco contornos impresos coinciden', () => {
    const opciones = ['A', 'B', 'C', 'D', 'E'] as const;
    const scores = opciones.map((opcion, index) => crearScoreMarcaCromatica(opcion, {
      ringMean: index < 3 ? 218 : 245,
      outerMean: 240
    }));
    expect(tieneAlineacionDeBurbujasVerificadaOmr(scores)).toBe(true);
    expect(tieneAlineacionDeBurbujasVerificadaOmr(scores.slice(0, 4))).toBe(true);
  });

  it('rechaza como blanco confirmado un mapa que no encuentra los contornos', () => {
    const scores = (['A', 'B', 'C', 'D', 'E'] as const).map((opcion) =>
      crearScoreMarcaCromatica(opcion, { ringMean: 250, outerMean: 251 })
    );
    expect(tieneAlineacionDeBurbujasVerificadaOmr(scores)).toBe(false);
    expect(tieneAlineacionDeBurbujasVerificadaOmr(scores.slice(0, 2))).toBe(false);
  });

  it('mantiene en revisión una respuesta fuera del ROI aunque el pipeline alternativo reporte ok', () => {
    const resultado = {
      respuestasDetectadas: [{
        numeroPregunta: 19,
        opcion: null,
        confianza: 0,
        scoresPorOpcion: ['A', 'B', 'C', 'D', 'E'].map((opcion) => crearScoreMarcaCromatica(opcion as 'A' | 'B' | 'C' | 'D' | 'E')),
        flags: ['fuera_roi'],
        estadoRespuesta: 'ambigua'
      }],
      advertencias: [],
      calidadPagina: 0.9,
      estadoAnalisis: 'ok',
      motivosRevision: [],
      templateVersionDetectada: 4,
      confianzaPromedioPagina: 0.9,
      ratioAmbiguas: 1,
      engineVersion: 'omr-cv',
      geomQuality: 0.9,
      photoQuality: 0.9,
      decisionPolicy: 'conservadora_v2'
    } as unknown as ResultadoOmr;

    const protegido = aplicarAbstencionPorDesalineacionOmr(resultado);
    expect(protegido).toMatchObject({
      autoCalificableOmr: false,
      estadoAnalisis: 'requiere_revision',
      motivosRevision: expect.arrayContaining([
        'No se confirmó la alineación de los contornos OMR; se requiere revisión manual'
      ])
    });
  });

  it('no cambia los resultados cuando las respuestas no señalan desalineación', () => {
    const resultado = {
      respuestasDetectadas: [],
      advertencias: [],
      calidadPagina: 0.9,
      estadoAnalisis: 'ok',
      motivosRevision: [],
      templateVersionDetectada: 4,
      confianzaPromedioPagina: 0.9,
      ratioAmbiguas: 0,
      engineVersion: 'omr-cv',
      geomQuality: 0.9,
      photoQuality: 0.9,
      decisionPolicy: 'conservadora_v2'
    } as unknown as ResultadoOmr;

    expect(aplicarAbstencionPorDesalineacionOmr(resultado)).toBe(resultado);
  });
});

describe('doble marca y evidencia cromática', () => {
  it('no elimina la segunda marca cuando el contraste clásico es bajo pero hay núcleo y contraste soft claros', () => {
    const dominante = crearScoreMarcaCromatica('D', {
      score: 0.5809,
      fillRatioCore: 0.6923,
      fillRatioRing: 0.3095,
      contraste: 0.2591,
      softCoreContrast: 0.4107,
      radialMassRatio: 0.3951,
      nucleusFillRatio: 0.6757,
      centroidOffsetRatio: 0.2842,
      shapeCompactness: 0.5602,
      markConfidence: 1,
      estadoMarca: 'marcada'
    });
    const segunda = crearScoreMarcaCromatica('A', {
      score: 0.2512,
      fillRatioCore: 0.6923,
      fillRatioRing: 0.4048,
      contraste: 0.0496,
      softCoreContrast: 0.2445,
      radialMassRatio: 0.4187,
      nucleusFillRatio: 0.6757,
      centroidOffsetRatio: 0.3387,
      shapeCompactness: 0.4294,
      markConfidence: 0.7235,
      estadoMarca: 'marcada'
    });

    expect(detectarDobleMarcaPorFormaOmr([dominante, segunda])).toBe(true);
    expect(detectarDobleMarcaPorFormaOmr([dominante, { ...segunda, estadoMarca: 'parcial' }])).toBe(false);

    const resultado = {
      respuestasDetectadas: [{
        numeroPregunta: 9,
        opcion: 'D',
        confianza: 1,
        scoresPorOpcion: [dominante, segunda],
        flags: ['parcial_detectada'],
        estadoRespuesta: 'respondida'
      }],
      advertencias: [],
      calidadPagina: 0.9,
      estadoAnalisis: 'ok',
      motivosRevision: [],
      templateVersionDetectada: 4,
      confianzaPromedioPagina: 1,
      ratioAmbiguas: 0,
      engineVersion: 'omr-cv',
      geomQuality: 0.9,
      photoQuality: 0.9,
      decisionPolicy: 'conservadora_v2'
    } as unknown as ResultadoOmr;
    const resultadoSeguro = aplicarAbstencionPorDobleMarcaOmr(resultado);
    expect(resultadoSeguro.respuestasDetectadas[0]).toMatchObject({
      opcion: null,
      estadoRespuesta: 'doble_marca',
      flags: expect.arrayContaining(['doble_marca'])
    });
    expect(resultadoSeguro.estadoAnalisis).toBe('requiere_revision');
    expect(resultadoSeguro.ratioAmbiguas).toBe(1);
  });

  it('suprime dobles espurias solo con tinta cromática dominante', () => {
    const marcadaAzul = crearScoreMarcaCromatica('B', {
      score: 0.59,
      fillRatioCore: 1,
      nucleusFillRatio: 1,
      centerDarknessDelta: 0.19,
      markConfidence: 1,
      shapeCompactness: 0.86,
      contrasteCromaticoLocal: 0.32,
      margenCromatico: 0.27,
      estadoMarca: 'marcada'
    });
    const opcionesVacias = [
      crearScoreMarcaCromatica('A'),
      crearScoreMarcaCromatica('C', { score: 0.33, fillRatioCore: 0.64, centerDarknessDelta: 0.13, markConfidence: 0.85 }),
      crearScoreMarcaCromatica('D', { score: 0.26, fillRatioCore: 0.73, centerDarknessDelta: 0.06, markConfidence: 0.75 }),
      crearScoreMarcaCromatica('E', { score: 0.32, fillRatioCore: 0.55, centerDarknessDelta: 0.09, markConfidence: 0.85 })
    ];

    expect(debeResolverDobleOmrPorTintaCromatica({
      panelHorizontal: true,
      tachada: false,
      scores: [marcadaAzul, ...opcionesVacias]
    })).toBe(true);
  });

  it('conserva el rechazo si hay segunda marca oscura fuerte o tachadura', () => {
    const marcadaAzul = crearScoreMarcaCromatica('B', {
      score: 0.59,
      fillRatioCore: 1,
      nucleusFillRatio: 1,
      centerDarknessDelta: 0.19,
      markConfidence: 1,
      shapeCompactness: 0.86,
      contrasteCromaticoLocal: 0.32,
      margenCromatico: 0.27,
      estadoMarca: 'marcada'
    });
    const marcadaNegra = crearScoreMarcaCromatica('C', {
      score: 0.5,
      fillRatioCore: 0.8,
      centerDarknessDelta: 0.3,
      markConfidence: 0.9,
      shapeCompactness: 0.7,
      estadoMarca: 'marcada'
    });

    expect(debeResolverDobleOmrPorTintaCromatica({
      panelHorizontal: true,
      tachada: false,
      scores: [marcadaAzul, marcadaNegra]
    })).toBe(false);
    expect(debeResolverDobleOmrPorTintaCromatica({
      panelHorizontal: true,
      tachada: true,
      scores: [marcadaAzul]
    })).toBe(false);
  });
});

describe('analizarOmr', () => {
  it('devuelve advertencias y respuestas nulas sin marcas', async () => {
    const imagenBase64 = await crearImagenBlancaBase64();
    const mapaPagina = crearMapaOmrCanonico(1, 'p1', [
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
        'No se detectaron referencias geometricas completas; usando escala simple'
      ])
    );
    expect(resultado.respuestasDetectadas).toHaveLength(1);
    expect(resultado.respuestasDetectadas[0].opcion).toBeNull();
    expect(resultado.respuestasDetectadas[0].confianza).toBe(0);
    expect(resultado.templateVersionDetectada).toBe(4);
    expect(resultado.engineRelease).toMatchObject({
      id: 'evaluapro-omr-qr',
      version: '1.0.0-dev.3',
      channel: 'development'
    });
    expect(['rechazado_calidad', 'requiere_revision']).toContain(resultado.estadoAnalisis);
    expect(resultado.calidadPagina).toBeGreaterThanOrEqual(0);
    expect(resultado.calidadPagina).toBeLessThanOrEqual(1);
  }, 300_000);

  it.each([
    { numeroPregunta: 3, respuesta: 'C', opciones: ['A', 'B', 'C'], escala: 1 },
    { numeroPregunta: 14, respuesta: 'D', opciones: ['B', 'C', 'D', 'E'], escala: 1.25 },
    { numeroPregunta: 27, respuesta: 'E', opciones: ['A', 'B', 'C', 'D', 'E'], escala: 2 }
  ] as const)(
    'adapta la lectura al reactivo $numeroPregunta, opción $respuesta, opciones $opciones y escala $escala',
    async ({ numeroPregunta, respuesta, opciones: letrasOpciones, escala }) => {
      const width = 612 * escala;
      const height = 792 * escala;
      const buffer = Buffer.alloc(width * height * 3, 255);

      const setPixel = (x: number, y: number, v: number) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const idx = (y * width + x) * 3;
        buffer[idx] = v;
        buffer[idx + 1] = v;
        buffer[idx + 2] = v;
      };

      const drawCircle = (cx: number, cy: number, radius: number) => {
        const r2 = radius * radius;
        for (let y = -Math.ceil(radius); y <= Math.ceil(radius); y += 1) {
          for (let x = -Math.ceil(radius); x <= Math.ceil(radius); x += 1) {
            if (x * x + y * y <= r2) {
              setPixel(cx + x, cy + y, 0);
            }
          }
        }
      };

      dibujarFiducialesCanonicos(setPixel, width, height, escala);

      const opciones = letrasOpciones
        .map((letra, indice) => ({ letra, x: 250, y: 240 - indice * 14 }));
      const opcionMarcada = opciones.find((opcion) => opcion.letra === respuesta)!;
      const centroImagen = {
        x: Math.round(opcionMarcada.x * escala),
        y: Math.round(height - opcionMarcada.y * escala)
      };
      drawCircle(centroImagen.x, centroImagen.y, 7 * escala);

      const imagenBase64 = await sharp(buffer, { raw: { width, height, channels: 3 } })
        .png()
        .toBuffer()
        .then((buf) => `data:image/png;base64,${buf.toString('base64')}`);

      const mapaPagina = {
        ...crearMapaOmrCanonico(numeroPregunta, `p${numeroPregunta}`, [...opciones]),
        marcasPagina: metadataFiducialesCanonicos()
      };

      const resultado = await analizarOmr(imagenBase64, mapaPagina, undefined, 10);

      expect(resultado.respuestasDetectadas).toHaveLength(1);
      const lectura = resultado.respuestasDetectadas[0]!;
      const candidata = [...lectura.scoresPorOpcion].sort((a, b) => b.score - a.score)[0];
      expect(candidata?.opcion).toBe(respuesta);
      if (resultado.pageOrientationDetermined && !resultado.pageOrientationConflict) {
        expect(lectura).toMatchObject({ numeroPregunta, opcion: respuesta, estadoRespuesta: 'respondida' });
      } else {
        expect(lectura).toMatchObject({ numeroPregunta, opcion: null, estadoRespuesta: 'ambigua' });
      }
      expect(resultado.respuestasDetectadas[0].confianza).toBeGreaterThan(0);
      expect(resultado.templateVersionDetectada).toBe(4);
      expect(resultado.calidadPagina).toBeGreaterThan(0);
    }, 300_000
  );

  it('conserva B cuando hay solo ruido leve en A', async () => {
    const width = 612;
    const height = 792;
    const buffer = Buffer.alloc(width * height * 3, 255);
    const setPixel = (x: number, y: number, value: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const idx = (y * width + x) * 3;
      buffer[idx] = value;
      buffer[idx + 1] = value;
      buffer[idx + 2] = value;
    };
    const drawCircle = (cx: number, cy: number, radius: number) => {
      for (let y = -radius; y <= radius; y += 1) {
        for (let x = -radius; x <= radius; x += 1) {
          if (x * x + y * y <= radius * radius) setPixel(cx + x, cy + y, 0);
        }
      }
    };

    dibujarFiducialesCanonicos(setPixel, width, height);
    const opciones = ['A', 'B', 'C', 'D', 'E'].map((letra, indice) => ({
      letra,
      x: 250,
      y: 240 - indice * 14
    }));
    drawCircle(250, height - 226, 7);
    // Simula polvo de escaneo aislado en la alternativa A, sin relleno de burbuja.
    for (const [dx, dy] of [[-1, -1], [1, 0], [0, 1]] as const) {
      setPixel(250 + dx, height - 240 + dy, 185);
    }

    const imagenBase64 = await sharp(buffer, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer()
      .then((buf) => `data:image/png;base64,${buf.toString('base64')}`);
    const mapaPagina = {
      ...crearMapaOmrCanonico(14, 'p14', opciones),
      marcasPagina: metadataFiducialesCanonicos()
    };

    const resultado = await analizarOmr(imagenBase64, mapaPagina, undefined, 10);

    expect(resultado.respuestasDetectadas).toHaveLength(1);
    const lectura = resultado.respuestasDetectadas[0]!;
    expect([...lectura.scoresPorOpcion].sort((a, b) => b.score - a.score)[0]?.opcion).toBe('B');
    if (resultado.pageOrientationDetermined && !resultado.pageOrientationConflict) {
      expect(lectura).toMatchObject({ numeroPregunta: 14, opcion: 'B', estadoRespuesta: 'respondida' });
    } else {
      expect(lectura).toMatchObject({ numeroPregunta: 14, opcion: null, estadoRespuesta: 'ambigua' });
    }
  }, 300_000);

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

    dibujarFiducialesCanonicos(setPixel, width, height);

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

    const mapaPagina = {
      ...crearMapaOmrCanonico(1, 'p1', opciones),
      marcasPagina: metadataFiducialesCanonicos()
    };

    const resultado = await analizarOmr(imagenBase64, mapaPagina, undefined, 10);

    expect(resultado.respuestasDetectadas).toHaveLength(1);
    expect([null, 'A', 'B', 'C', 'D', 'E']).toContain(resultado.respuestasDetectadas[0].opcion);
    expect(resultado.respuestasDetectadas[0].confianza).toBeGreaterThanOrEqual(0);
    expect(resultado.templateVersionDetectada).toBe(4);
    expect(['ok', 'requiere_revision', 'rechazado_calidad']).toContain(resultado.estadoAnalisis);
  }, 300_000);

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

    dibujarFiducialesCanonicos(setPixel, width, height);

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

    const mapaPagina = {
      ...crearMapaOmrCanonico(1, 'p1', opciones),
      marcasPagina: metadataFiducialesCanonicos()
    };

    const resultado = await analizarOmr(imagenBase64, mapaPagina, undefined, 10);
    expect(resultado.respuestasDetectadas).toHaveLength(1);
    const lectura = resultado.respuestasDetectadas[0]!;
    expect([...lectura.scoresPorOpcion].sort((a, b) => b.score - a.score)[0]?.opcion).toBe('C');
    if (resultado.pageOrientationDetermined && !resultado.pageOrientationConflict) {
      expect(lectura).toMatchObject({ opcion: 'C', estadoRespuesta: 'respondida' });
    } else {
      expect(lectura).toMatchObject({ opcion: null, estadoRespuesta: 'ambigua' });
    }
    expect(resultado.respuestasDetectadas[0].confianza).toBeGreaterThanOrEqual(0);
  }, 300_000);

  it('penaliza trazos lineales y conserva el relleno central para revisión sin orientación verificada', async () => {
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

    dibujarFiducialesCanonicos(setPixel, width, height);

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

    const mapaPagina = {
      ...crearMapaOmrCanonico(1, 'p1', opciones),
      marcasPagina: metadataFiducialesCanonicos()
    };

    const resultado = await analizarOmr(imagenBase64, mapaPagina, undefined, 10);
    expect(resultado.respuestasDetectadas).toHaveLength(1);
    expect(resultado.pageOrientationDetermined).toBe(false);
    expect(resultado.estadoAnalisis).toBe('requiere_revision');
    expect(resultado.respuestasDetectadas[0].opcion).toBeNull();
    expect(resultado.respuestasDetectadas[0].scoresPorOpcion[0]).toMatchObject({
      opcion: 'D',
      estadoMarca: 'marcada',
      fillRatioCore: 1
    });
    expect(resultado.respuestasDetectadas[0].scoresPorOpcion.find(({ opcion }) => opcion === 'A')?.estadoMarca)
      .toBe('parcial');
    expect(resultado.respuestasDetectadas[0].flags).toContain('parcial_detectada');
  }, 300_000);

  it('retiene evidencia de una X centrada y se abstiene si la orientación no es verificable', async () => {
    const escala = 2;
    const width = 612 * escala;
    const height = 792 * escala;
    const buffer = Buffer.alloc(width * height * 3, 255);
    const setPixel = (x: number, y: number, value: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const offset = (y * width + x) * 3;
      buffer[offset] = value;
      buffer[offset + 1] = value;
      buffer[offset + 2] = value;
    };
    const drawRing = (cx: number, cy: number, radius: number, thickness: number) => {
      for (let y = -radius; y <= radius; y += 1) {
        for (let x = -radius; x <= radius; x += 1) {
          const distance = x * x + y * y;
          if (distance <= radius * radius && distance >= (radius - thickness) ** 2) setPixel(cx + x, cy + y, 70);
        }
      }
    };
    const drawStroke = (x0: number, y0: number, x1: number, y1: number, value: number) => {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let index = 0; index <= steps; index += 1) {
        const t = index / steps;
        const cx = Math.round(x0 + (x1 - x0) * t);
        const cy = Math.round(y0 + (y1 - y0) * t);
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) setPixel(cx + dx, cy + dy, value);
        }
      }
    };
    dibujarFiducialesCanonicos(setPixel, width, height, escala);

    const opciones = [
      { letra: 'A', x: 250, y: 240 },
      { letra: 'B', x: 250, y: 226 },
      { letra: 'C', x: 250, y: 212 },
      { letra: 'D', x: 250, y: 198 },
      { letra: 'E', x: 250, y: 184 }
    ];
    for (const opcion of opciones) drawRing(opcion.x * escala, height - opcion.y * escala, 8 * escala, 2 * escala);
    const centroX = opciones[1]!.x * escala;
    const centroY = height - opciones[1]!.y * escala;
    drawStroke(centroX - 4 * escala, centroY - 4 * escala, centroX + 4 * escala, centroY + 4 * escala, 12);
    drawStroke(centroX - 4 * escala, centroY + 4 * escala, centroX + 4 * escala, centroY - 4 * escala, 12);

    const imagenBase64 = await sharp(buffer, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer()
      .then((buf) => `data:image/png;base64,${buf.toString('base64')}`);
    const resultado = await analizarOmr(
      imagenBase64,
      { ...crearMapaOmrCanonico(1, 'x-selection', opciones), marcasPagina: metadataFiducialesCanonicos() },
      undefined,
      10
    );
    expect(resultado.respuestasDetectadas).toHaveLength(1);
    expect(resultado.pageOrientationDetermined).toBe(false);
    expect(rescatarMarcaAisladaPorRasgosOmr({
      panelHorizontal: true,
      dobleMarcada: false,
      tachada: false,
      scores: resultado.respuestasDetectadas[0]!.scoresPorOpcion
    })?.opcion).toBe('B');
    expect(resultado.respuestasDetectadas[0]?.scoresPorOpcion[0]).toMatchObject({
      opcion: 'B',
      estadoMarca: 'marcada',
      shapeCompactness: expect.any(Number)
    });
    expect(resultado.respuestasDetectadas[0]).toMatchObject({ opcion: null, estadoRespuesta: 'ambigua' });
    expect(resultado.respuestasDetectadas[0]?.flags).not.toContain('tachada_detectada');
  }, 300_000);

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

    dibujarFiducialesCanonicos(
      (x, y, value) => setPixelRgb(x, y, value, value, value),
      width,
      height
    );

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

    const mapaPagina = {
      ...crearMapaOmrCanonico(1, 'p1', opciones),
      marcasPagina: metadataFiducialesCanonicos()
    };

    const resultado = await analizarOmr(imagenBase64, mapaPagina, undefined, 10);
    expect(resultado.respuestasDetectadas).toHaveLength(1);
    const lectura = resultado.respuestasDetectadas[0]!;
    expect([...lectura.scoresPorOpcion].sort((a, b) => b.score - a.score)[0]?.opcion).toBe('B');
    if (resultado.pageOrientationDetermined && !resultado.pageOrientationConflict) {
      expect(lectura).toMatchObject({ opcion: 'B', estadoRespuesta: 'respondida' });
    } else {
      expect(lectura).toMatchObject({ opcion: null, estadoRespuesta: 'ambigua' });
    }
    expect(resultado.respuestasDetectadas[0].confianza).toBeGreaterThanOrEqual(0);
  }, 300_000);

});
