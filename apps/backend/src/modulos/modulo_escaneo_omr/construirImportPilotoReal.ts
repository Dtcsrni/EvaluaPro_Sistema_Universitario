import type { MapaOmr, RecoveryManifest } from '../modulo_generacion_pdf/index.js';
import type { GroundTruthRowPorFolio, MapaOmrPaginaPorFolio, OpcionOmr } from './porFolioDataset.js';

const OPCIONES = new Set<OpcionOmr>(['A', 'B', 'C', 'D', 'E']);

function obligatorio<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`OMR_PILOT_MAP_FIELD_MISSING:${label}`);
  return value;
}

export function extraerClaveCompletaRecoveryManifest(manifest: RecoveryManifest) {
  if (manifest.answerKeySnapshot.schema !== 'omr-answer-key-v1' || !Array.isArray(manifest.answerKeySnapshot.entries)) {
    throw new Error('OMR_PILOT_SIGNED_ANSWER_KEY_INVALID');
  }
  const answerKey: Record<number, OpcionOmr> = {};
  for (const entry of manifest.answerKeySnapshot.entries) {
    const questionNumber = Number(entry.visibleNumber);
    const option = String(entry.correctLetterVisible).toUpperCase() as OpcionOmr;
    if (!Number.isInteger(questionNumber) || questionNumber < 1 || !OPCIONES.has(option) || answerKey[questionNumber]) {
      throw new Error('OMR_PILOT_SIGNED_ANSWER_KEY_INVALID');
    }
    answerKey[questionNumber] = option;
  }
  if (Object.keys(answerKey).length !== manifest.totalPreguntas) throw new Error('OMR_PILOT_SIGNED_ANSWER_KEY_INCOMPLETE');
  return Object.fromEntries(Object.entries(answerKey).sort(([a], [b]) => Number(a) - Number(b)));
}

export function construirMapaOmrPaginaPilotoReal(mapaOmr: MapaOmr, numeroPagina: number): MapaOmrPaginaPorFolio {
  if (Number(mapaOmr.templateVersion) !== 4) throw new Error('OMR_PILOT_TEMPLATE_VERSION_UNSUPPORTED');
  const pagina = mapaOmr.paginas.find((item) => Number(item.numeroPagina) === numeroPagina && item.tipoPagina !== 'reverso-vacio');
  if (!pagina) throw new Error('OMR_PILOT_MAP_PAGE_MISSING');
  const qr = obligatorio(pagina.qr, 'qr');
  const marcasPagina = obligatorio(pagina.marcasPagina, 'marcasPagina');
  const markerSpec = obligatorio(pagina.markerSpec ?? mapaOmr.markerSpec, 'markerSpec');
  if (markerSpec.family !== 'solid_square_4pt_v1' || !Number.isFinite(markerSpec.sizeMm) || markerSpec.sizeMm <= 0 || !Number.isFinite(markerSpec.quietZoneMm) || markerSpec.quietZoneMm < 0 || marcasPagina.tipo !== 'cuadrados') {
    throw new Error('OMR_PILOT_TEMPLATE_GEOMETRY_UNSUPPORTED');
  }
  const preguntas = pagina.preguntas.map((pregunta) => {
    const numeroPregunta = Number(pregunta.numeroPregunta);
    const opciones = pregunta.opciones.map((opcion) => {
      const letra = String(opcion.letra).toUpperCase() as OpcionOmr;
      if (!OPCIONES.has(letra) || !Number.isFinite(opcion.x) || !Number.isFinite(opcion.y)) {
        throw new Error('OMR_PILOT_MAP_OPTIONS_INVALID');
      }
      return { letra, x: opcion.x, y: opcion.y };
    });
    const cajaOmr = obligatorio(pregunta.cajaOmr, `pregunta.${numeroPregunta}.cajaOmr`);
    const perfilOmr = obligatorio(pregunta.perfilOmr, `pregunta.${numeroPregunta}.perfilOmr`);
    const fiduciales = obligatorio(pregunta.fiduciales, `pregunta.${numeroPregunta}.fiduciales`);
    if (new Set(opciones.map((item) => item.letra)).size !== 5 || opciones.length !== 5) throw new Error('OMR_PILOT_MAP_OPTIONS_INVALID');
    return {
      numeroPregunta,
      idPregunta: String(pregunta.idPregunta),
      opciones,
      cajaOmr,
      perfilOmr: { radio: perfilOmr.radio, pasoY: perfilOmr.pasoY, cajaAncho: perfilOmr.cajaAncho },
      fiduciales: {
        leftTop: fiduciales.leftTop,
        leftBottom: fiduciales.leftBottom,
        rightTop: fiduciales.rightTop,
        rightBottom: fiduciales.rightBottom
      }
    };
  });
  if (!preguntas.length || preguntas.some((item) => !Number.isInteger(item.numeroPregunta) || !item.idPregunta)) throw new Error('OMR_PILOT_MAP_QUESTIONS_INVALID');
  return {
    numeroPagina,
    templateVersion: 4,
    markerSpec: {
      family: markerSpec.family,
      sizeMm: markerSpec.sizeMm,
      quietZoneMm: markerSpec.quietZoneMm
    },
    engineHints: {
      preferredEngine: 'cv',
      conservativeDecision: true,
      forceSimpleScale: pagina.engineHints?.forceSimpleScale ?? false,
      useMapCoordinatesStrict: pagina.engineHints?.useMapCoordinatesStrict ?? false,
      ...(pagina.engineHints?.localSearchRadiusPx === undefined ? {} : { localSearchRadiusPx: pagina.engineHints.localSearchRadiusPx })
    },
    qr: {
      texto: qr.texto,
      x: qr.x,
      y: qr.y,
      size: qr.size,
      padding: qr.padding,
      ...(qr.marginModules === undefined ? {} : { marginModules: qr.marginModules }),
      ...(qr.matrixModules === undefined ? {} : { matrixModules: qr.matrixModules })
    },
    marcasPagina: {
      tipo: marcasPagina.tipo,
      size: marcasPagina.size,
      quietZone: marcasPagina.quietZone,
      tl: marcasPagina.tl,
      tr: marcasPagina.tr,
      bl: marcasPagina.bl,
      br: marcasPagina.br
    },
    preguntas
  };
}

export function construirGroundTruthManualOmr(args: {
  captureId: string;
  folio: string;
  numeroPagina: number;
  pageImageSha256: string;
  sourcePage: number;
  bonusVisible?: boolean;
  humanReview: NonNullable<GroundTruthRowPorFolio['humanReview']>;
  responses: Array<{
    numeroPregunta: number;
    opcion: string | null;
    tipoMarcaManual: 'valid' | 'blank' | 'double' | 'smudge';
    selectedOptions: OpcionOmr[];
  }>;
}): GroundTruthRowPorFolio[] {
  if (!/^[a-f0-9]{64}$/i.test(args.pageImageSha256)) throw new Error('OMR_PILOT_IMAGE_HASH_INVALID');
  return args.responses.map((response) => {
    const option = response.opcion === null ? null : String(response.opcion).toUpperCase() as OpcionOmr;
    const selectedOptions = [...new Set(response.selectedOptions.map((value) => String(value).toUpperCase() as OpcionOmr))];
    if (!Number.isInteger(response.numeroPregunta) || response.numeroPregunta < 1 || (option !== null && !OPCIONES.has(option)) || selectedOptions.some((value) => !OPCIONES.has(value))) {
      throw new Error('OMR_PILOT_MANUAL_LABEL_INVALID');
    }
    if (response.tipoMarcaManual === 'valid' && (option === null || selectedOptions.length !== 1 || selectedOptions[0] !== option)) throw new Error('OMR_PILOT_MANUAL_LABEL_INVALID');
    if (response.tipoMarcaManual === 'blank' && (option !== null || selectedOptions.length !== 0)) throw new Error('OMR_PILOT_MANUAL_LABEL_INVALID');
    if (response.tipoMarcaManual === 'double' && (option !== null || selectedOptions.length < 2)) throw new Error('OMR_PILOT_MANUAL_LABEL_INVALID');
    if (response.tipoMarcaManual === 'smudge' && (option !== null || selectedOptions.length !== 0)) throw new Error('OMR_PILOT_MANUAL_LABEL_INVALID');
    return {
      captureId: args.captureId,
      folio: args.folio,
      numeroPagina: args.numeroPagina,
      numeroPregunta: response.numeroPregunta,
      opcionEsperada: response.tipoMarcaManual === 'valid' ? option : null,
      markType: response.tipoMarcaManual,
      selectedOptions,
      ...(args.bonusVisible === undefined ? {} : { bonusVisible: args.bonusVisible }),
      humanReview: args.humanReview,
      sourceEvidence: {
        detector: 'manual_visual_review',
        sourcePage: args.sourcePage,
        pageImageSha256: args.pageImageSha256
      }
    };
  });
}
