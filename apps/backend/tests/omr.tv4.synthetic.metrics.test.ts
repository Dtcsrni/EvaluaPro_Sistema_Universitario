import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr.js';
import {
  analizarOmr as analizarOmrCv,
  preguntasParaRelecturaLocalOmr,
  recuperarOmisionesConCoordenadasEstrictasOmr,
  type RespuestaDetectadaOmr
} from '../src/modulos/modulo_escaneo_omr/servicioOmrCv.js';
import {
  debeIncluirIssueSintetico,
  esRechazoSeguroMarcaInvalida,
  resumirConfianzaCoberturaAutoCalificacion
} from '../scripts/omr-tv4-synthetic-lib.js';
import { evaluarAutoCalificableOmr } from '../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js';

describe('métricas del evaluador sintético TV4', () => {
  it('recupera un blanco solo con pase estricto sin tinta y contornos alineados', () => {
    const score = (opcion: string, estadoMarca: string, alineado: boolean) => ({
      opcion,
      estadoMarca,
      outerMean: alineado ? 120 : 110,
      ringMean: 110
    });
    const base = [{
      numeroPregunta: 19,
      opcion: null,
      confianza: 0.5,
      estadoRespuesta: 'ambigua',
      flags: ['bajo_contraste', 'parcial_detectada'],
      scoresPorOpcion: []
    }] as unknown as RespuestaDetectadaOmr[];
    const strictBlank = {
      ...base[0],
      estadoRespuesta: 'sin_marca',
      flags: [],
      scoresPorOpcion: [
        score('A', 'no_marcada', true),
        score('B', 'no_marcada', true),
        score('C', 'no_marcada', true),
        score('D', 'no_marcada', false),
        score('E', 'no_marcada', false)
      ]
    } as unknown as RespuestaDetectadaOmr;

    expect(recuperarOmisionesConCoordenadasEstrictasOmr(base, [strictBlank])[0]).toBe(strictBlank);
  });

  it('limita la relectura geométrica local a filas ambiguas con cinco opciones vacías y contorno no localizado', () => {
    const vacias = ['A', 'B', 'C', 'D', 'E'].map((opcion) => ({
      opcion,
      estadoMarca: 'no_marcada',
      outerMean: 120,
      ringMean: 120
    }));
    const filas = [{
      numeroPregunta: 18,
      opcion: null,
      confianza: 0,
      estadoRespuesta: 'ambigua',
      flags: ['fuera_roi'],
      scoresPorOpcion: vacias
    }, {
      numeroPregunta: 19,
      opcion: null,
      confianza: 0.5,
      estadoRespuesta: 'ambigua',
      flags: ['parcial_detectada'],
      scoresPorOpcion: vacias
    }, {
      numeroPregunta: 20,
      opcion: null,
      confianza: 0.5,
      estadoRespuesta: 'ambigua',
      flags: ['doble_marca'],
      scoresPorOpcion: vacias
    }] as unknown as RespuestaDetectadaOmr[];

    expect(preguntasParaRelecturaLocalOmr(filas)).toEqual([18]);
  });

  it('no reemplaza respuestas determinadas ni confirma blancos con tinta o contornos insuficientes', () => {
    const base = [{
      numeroPregunta: 19,
      opcion: 'A',
      confianza: 0.9,
      estadoRespuesta: 'respondida',
      flags: [],
      scoresPorOpcion: []
    }, {
      numeroPregunta: 20,
      opcion: null,
      confianza: 0.5,
      estadoRespuesta: 'ambigua',
      flags: ['bajo_contraste'],
      scoresPorOpcion: []
    }] as unknown as RespuestaDetectadaOmr[];
    const strict = [{
      ...base[0],
      opcion: null,
      estadoRespuesta: 'sin_marca',
      scoresPorOpcion: []
    }, {
      ...base[1],
      estadoRespuesta: 'sin_marca',
      flags: [],
      scoresPorOpcion: ['A', 'B', 'C', 'D', 'E'].map((opcion) => ({
        opcion,
        estadoMarca: opcion === 'E' ? 'parcial' : 'no_marcada',
        outerMean: 120,
        ringMean: 110
      }))
    }] as unknown as RespuestaDetectadaOmr[];

    expect(recuperarOmisionesConCoordenadasEstrictasOmr(base, strict)).toEqual(base);
  });

  it('reutiliza el QR exacto sin cambiar las respuestas OMR frente a una decodificación independiente', async () => {
    const datasetRoot = path.resolve(process.cwd(), '../../omr_samples_tv4');
    const manifest = JSON.parse(
      await readFile(path.join(datasetRoot, 'manifest.json'), 'utf8')
    ) as { capturas: Array<{ captureId: string; imagePath: string; mapaOmrPath: string }> };
    const captura = manifest.capturas.find((item) => item.captureId === 'TV4-SYNTH-005-P2');
    expect(captura).toBeDefined();
    if (!captura) return;
    const [imageBuffer, mapaRaw] = await Promise.all([
      readFile(path.join(datasetRoot, captura.imagePath)),
      readFile(path.join(datasetRoot, captura.mapaOmrPath), 'utf8')
    ]);
    const mapa = JSON.parse(mapaRaw) as { qr: { texto: string }; numeroPagina: number };
    const imagen = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
    const debugInfo = { folio: captura.captureId, numeroPagina: mapa.numeroPagina, templateVersionDetectada: 4 as const };
    const base = await analizarOmrCv(imagen, mapa as never, mapa.qr.texto, 10, debugInfo, { noRetry: true });
    const reutilizado = await analizarOmrCv(imagen, mapa as never, mapa.qr.texto, 10, debugInfo, {
      noRetry: true,
      qrTextoPrevalidado: mapa.qr.texto
    });
    const hintIncorrecto = await analizarOmrCv(imagen, mapa as never, mapa.qr.texto, 10, debugInfo, {
      noRetry: true,
      qrTextoPrevalidado: 'EXAMEN:OTRO_LOTE:OTRO_FOLIO'
    });

    expect(reutilizado.qrTexto).toBe(mapa.qr.texto);
    expect(reutilizado.qrFuenteDeteccion).toBe('pipeline_validated_payload');
    expect(hintIncorrecto.qrTexto).toBe(mapa.qr.texto);
    expect(hintIncorrecto.qrFuenteDeteccion).not.toBe('pipeline_validated_payload');
    expect(reutilizado.respuestasDetectadas.map(({ numeroPregunta, opcion, flags, estadoRespuesta }) => ({
      numeroPregunta,
      opcion,
      flags,
      estadoRespuesta
    }))).toEqual(base.respuestasDetectadas.map(({ numeroPregunta, opcion, flags, estadoRespuesta }) => ({
      numeroPregunta,
      opcion,
      flags,
      estadoRespuesta
    })));
    expect(hintIncorrecto.respuestasDetectadas.map(({ numeroPregunta, opcion, flags, estadoRespuesta }) => ({
      numeroPregunta,
      opcion,
      flags,
      estadoRespuesta
    }))).toEqual(base.respuestasDetectadas.map(({ numeroPregunta, opcion, flags, estadoRespuesta }) => ({
      numeroPregunta,
      opcion,
      flags,
      estadoRespuesta
    })));
  }, 120_000);

  it('recupera el blanco Q19 y no acredita la señal débil Q11 sin evidencia de marca clara', async () => {
    const datasetRoot = path.resolve(process.cwd(), '../../omr_samples_tv4');
    const manifest = JSON.parse(
      await readFile(path.join(datasetRoot, 'manifest.json'), 'utf8')
    ) as { capturas: Array<{ captureId: string; imagePath: string; mapaOmrPath: string }> };
    const captura = manifest.capturas.find((item) => item.captureId === 'TV4-SYNTH-003-P2');
    expect(captura).toBeDefined();
    if (!captura) return;
    const [imageBuffer, mapaRaw] = await Promise.all([
      readFile(path.join(datasetRoot, captura.imagePath)),
      readFile(path.join(datasetRoot, captura.mapaOmrPath), 'utf8')
    ]);
    const mapa = JSON.parse(mapaRaw) as { qr: { texto: string }; numeroPagina: number; preguntas: unknown[] };
    const resultado = await analizarOmr(
      `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
      mapa as never,
      mapa.qr.texto,
      10,
      { folio: captura.captureId, numeroPagina: mapa.numeroPagina, templateVersionDetectada: 4 },
      captura.captureId
    );

    expect(resultado.respuestasDetectadas.find((respuesta) => respuesta.numeroPregunta === 19)).toMatchObject({
      opcion: null,
      estadoRespuesta: 'sin_marca'
    });
    expect(resultado.respuestasDetectadas.find((respuesta) => respuesta.numeroPregunta === 11)).toMatchObject({
      opcion: null,
      estadoRespuesta: 'ambigua'
    });
    const decision = evaluarAutoCalificableOmr({
      estadoAnalisis: resultado.estadoAnalisis,
      calidadPagina: resultado.calidadPagina,
      confianzaPromedioPagina: resultado.confianzaPromedioPagina,
      ratioAmbiguas: resultado.ratioAmbiguas,
      coberturaDeteccion: resultado.respuestasDetectadas.length / mapa.preguntas.length,
      respuestasDetectadas: resultado.respuestasDetectadas
    });
    expect(decision.autoCalificableOmr).toBe(false);
    expect(decision.motivos.length).toBeGreaterThan(0);
  }, 180_000);

  it('rechaza la señal mínima y conserva la marca débil única del corpus', async () => {
      const datasetRoot = path.resolve(process.cwd(), '../../omr_samples_tv4');
      const manifest = JSON.parse(
        await readFile(path.join(datasetRoot, 'manifest.json'), 'utf8')
      ) as { capturas: Array<{ captureId: string; imagePath: string; mapaOmrPath: string }> };
      const captura = manifest.capturas.find((item) => item.captureId === 'TV4-SYNTH-001-P1');
      expect(captura, 'falta captura que contiene solapamiento de panel').toBeDefined();
      if (!captura) return;
      const [imageBuffer, mapaRaw] = await Promise.all([
        readFile(path.join(datasetRoot, captura.imagePath)),
        readFile(path.join(datasetRoot, captura.mapaOmrPath), 'utf8')
      ]);
      const mapa = JSON.parse(mapaRaw) as { qr: { texto: string }; numeroPagina: number };
      const resultado = await analizarOmr(
        `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
        mapa as never,
        mapa.qr.texto,
        10,
        { folio: captura.captureId, numeroPagina: mapa.numeroPagina, templateVersionDetectada: 4 },
        captura.captureId
      );
      const respuesta = resultado.respuestasDetectadas.find(
        (item) => item.numeroPregunta === 7
      );

      expect(respuesta?.opcion, 'la señal de solapamiento no debe dar crédito').toBeNull();
      expect(respuesta?.estadoRespuesta).toBe('sin_marca');
    }, 180_000);

  it('acepta marcas débiles aisladas y rechaza dobles claras en todas las capturas del corpus', async () => {
    const datasetRoot = path.resolve(process.cwd(), '../../omr_samples_tv4');
    const [manifestRaw, truthRaw] = await Promise.all([
      readFile(path.join(datasetRoot, 'manifest.json'), 'utf8'),
      readFile(path.join(datasetRoot, 'ground_truth.jsonl'), 'utf8')
    ]);
    const manifest = JSON.parse(manifestRaw) as {
      capturas: Array<{ captureId: string; imagePath: string; mapaOmrPath: string }>;
    };
    const truth = truthRaw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as {
      captureId: string;
      numeroPregunta: number;
      opcionEsperada: string | null;
      markType: string;
    });
    const weakCaptureIds = new Set(truth.filter((row) => row.markType === 'weak').map((row) => row.captureId));
    const cases = truth.filter((row) =>
      weakCaptureIds.has(row.captureId) && (row.markType === 'weak' || row.markType === 'double')
    );
    const captureIds = [...weakCaptureIds];

    for (const captureId of captureIds) {
      const capture = manifest.capturas.find((item) => item.captureId === captureId);
      expect(capture, `falta captura ${captureId}`).toBeDefined();
      if (!capture) continue;
      const [imageBuffer, mapRaw] = await Promise.all([
        readFile(path.join(datasetRoot, capture.imagePath)),
        readFile(path.join(datasetRoot, capture.mapaOmrPath), 'utf8')
      ]);
      const map = JSON.parse(mapRaw) as { qr: { texto: string }; numeroPagina: number };
      const result = await analizarOmr(
        `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
        map as never,
        map.qr.texto,
        10,
        { folio: captureId, numeroPagina: map.numeroPagina, templateVersionDetectada: 4 },
        captureId
      );
      for (const row of cases.filter((item) => item.captureId === captureId)) {
        const response = result.respuestasDetectadas.find((item) => item.numeroPregunta === row.numeroPregunta);
        if (row.markType === 'weak') {
          if (captureId === 'TV4-SYNTH-003-P2' && row.numeroPregunta === 11) {
            expect(response?.opcion, `${captureId} Q${row.numeroPregunta}: una marca tenue sin evidencia geométrica suficiente no recibe crédito`).toBeNull();
            expect(response?.estadoRespuesta, `${captureId} Q${row.numeroPregunta}`).toBe('ambigua');
            continue;
          }
          expect(response?.opcion, `${captureId} Q${row.numeroPregunta}`).toBe(row.opcionEsperada);
          expect(response?.estadoRespuesta, `${captureId} Q${row.numeroPregunta}`).toBe('respondida');
        } else {
          expect(response?.opcion, `${captureId} Q${row.numeroPregunta}`).toBeNull();
          expect(['ambigua', 'doble_marca', 'tachada']).toContain(response?.estadoRespuesta);
        }
      }
    }
  }, 300_000);

  it('considera rechazo seguro una marca doble aunque exista una opción candidata', () => {
    expect(esRechazoSeguroMarcaInvalida('doble_marca', 'A')).toBe(true);
  });

  it('considera rechazo seguro una respuesta ambigua con o sin opción candidata', () => {
    expect(esRechazoSeguroMarcaInvalida('ambigua', null)).toBe(true);
    expect(esRechazoSeguroMarcaInvalida('ambigua', 'B')).toBe(true);
  });

  it('solo cuenta como sin marca segura el estado sin_marca sin opción', () => {
    expect(esRechazoSeguroMarcaInvalida('sin_marca', null)).toBe(true);
    expect(esRechazoSeguroMarcaInvalida('sin_marca', 'C')).toBe(false);
    expect(esRechazoSeguroMarcaInvalida('respondida', 'C')).toBe(false);
    expect(esRechazoSeguroMarcaInvalida(undefined, null)).toBe(false);
  });

  it('registra falsos positivos antes de cerrar el cálculo de confusión', () => {
    expect(debeIncluirIssueSintetico('blank', null, 'A')).toBe(true);
    expect(debeIncluirIssueSintetico('valid', 'A', 'B')).toBe(true);
    expect(debeIncluirIssueSintetico('valid', 'A', 'A')).toBe(false);
    expect(debeIncluirIssueSintetico('double', null, null)).toBe(true);
    expect(debeIncluirIssueSintetico('weak', 'B', 'B')).toBe(false);
    expect(debeIncluirIssueSintetico('weak', 'B', null)).toBe(true);
  });

  it('mide confianza solo en notas automáticas y cobertura contra páginas claramente elegibles', () => {
    const metricas = resumirConfianzaCoberturaAutoCalificacion([
      { groundTruthComplete: true, claramenteElegible: true, autoCalificable: true, calificacionCoincide: true },
      { groundTruthComplete: true, claramenteElegible: true, autoCalificable: false, calificacionCoincide: false },
      { groundTruthComplete: false, claramenteElegible: false, autoCalificable: false, calificacionCoincide: false }
    ]);

    expect(metricas).toMatchObject({
      autoEligibleCaptures: 1,
      groundTruthCompleteCaptures: 2,
      clearlyEligibleCaptures: 2,
      autoCoverageRate: 0.5,
      autoGradeTrustRate: 1,
      automaticGradeDiscordances: 0
    });
  });

  it('falla confianza si la nota difiere o si se autocalifica con evidencia incompleta', () => {
    const metricas = resumirConfianzaCoberturaAutoCalificacion([
      { groundTruthComplete: true, claramenteElegible: true, autoCalificable: true, calificacionCoincide: false },
      { groundTruthComplete: false, claramenteElegible: false, autoCalificable: true, calificacionCoincide: true }
    ]);

    expect(metricas).toMatchObject({
      autoEligibleCaptures: 2,
      groundTruthCompleteCaptures: 1,
      clearlyEligibleCaptures: 1,
      autoCoverageRate: 1,
      autoGradeTrustRate: 0,
      automaticGradeDiscordances: 2
    });
  });

  it('no presenta la abstención total como falta de cobertura resuelta', () => {
    const metricas = resumirConfianzaCoberturaAutoCalificacion([
      { groundTruthComplete: true, autoCalificable: false, calificacionCoincide: false }
    ]);

    expect(metricas).toMatchObject({ autoEligibleCaptures: 0, autoCoverageRate: 0 });
  });

  it('excluye páginas de marcas dobles de la cobertura y penaliza si aun así se autocalifican', () => {
    const metricas = resumirConfianzaCoberturaAutoCalificacion([
      { groundTruthComplete: true, claramenteElegible: true, autoCalificable: true, calificacionCoincide: true },
      { groundTruthComplete: true, claramenteElegible: false, autoCalificable: false, calificacionCoincide: true }
    ]);

    expect(metricas).toMatchObject({
      groundTruthCompleteCaptures: 2,
      clearlyEligibleCaptures: 1,
      autoEligibleCaptures: 1,
      autoCoverageRate: 1,
      autoGradeTrustRate: 1,
      automaticGradeDiscordances: 0
    });

    const autoSobreDoble = resumirConfianzaCoberturaAutoCalificacion([
      { groundTruthComplete: true, claramenteElegible: false, autoCalificable: true, calificacionCoincide: true }
    ]);
    expect(autoSobreDoble).toMatchObject({ autoCoverageRate: 0, autoGradeTrustRate: 0, automaticGradeDiscordances: 1 });
  });
});
