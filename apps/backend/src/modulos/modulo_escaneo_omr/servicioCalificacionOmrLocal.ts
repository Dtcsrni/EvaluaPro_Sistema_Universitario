import { createHash } from 'node:crypto';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { extraerResumenQrExamen } from '../modulo_generacion_pdf/index.js';
import { analizarOmr, type ResultadoOmr } from './servicioOmr.js';
import { leerBonoVisibleOmr } from './infra/ocrPieOmr.js';

type PaginaCapturadaOmr = { numeroPagina: number; imagenBase64: string };
type PaginaMapaOmr = {
  numeroPagina: number;
  tipoPagina?: string;
  templateId?: string;
  preguntas?: Array<{ numeroPregunta?: number }>;
  qr?: { texto?: string };
  layoutDebug?: { headerFieldBoxes?: Array<{ id: string; x: number; y: number; width: number; height: number }> };
};
type PaginaExamenOmr = { numero?: number; qrTexto?: string };
type MapaOmrExamen = {
  templateVersion?: number;
  templateId?: string;
  margenMm?: number;
  paginas?: PaginaMapaOmr[];
};

type AnalizadorPaginaOmr = typeof analizarOmr;

export type ResultadoCalificacionOmrLocal = {
  respuestasDetectadas: ResultadoOmr['respuestasDetectadas'];
  analisis: {
    estadoAnalisis: ResultadoOmr['estadoAnalisis'];
    calidadPagina: number;
    confianzaPromedioPagina: number;
    ratioAmbiguas: number;
    templateVersionDetectada: 4;
    motivosRevision: string[];
    engineVersion: string;
    geomQuality: number;
    photoQuality: number;
    decisionPolicy: string;
    qrTexto: string;
    resumenRespuestas: NonNullable<ResultadoOmr['resumenRespuestas']>;
    bonoVisible: boolean;
    bonoOcrResuelto: boolean;
    bonoOcrConfianza: number;
  };
  paginas: Array<{
    numeroPagina: number;
    sha256Imagen: string;
    qrTexto: string;
    estadoAnalisis: ResultadoOmr['estadoAnalisis'];
    calidadPagina: number;
    confianzaPromedioPagina: number;
    ratioAmbiguas: number;
    engineVersion: string;
    decisionPolicy: string;
  }>;
};

function numeroFinito(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hashCapturaOriginal(imagenBase64: string, numeroPagina: number) {
  const coincidencia = /^data:image\/[^;,]+;base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(imagenBase64.trim());
  if (!coincidencia) {
    throw new ErrorAplicacion('OMR_CAPTURA_IMAGEN_INVALIDA', 'La captura original no es una imagen base64 válida.', 422, { numeroPagina });
  }
  const bytes = Buffer.from(coincidencia[1]!.replace(/\s/g, ''), 'base64');
  if (bytes.length === 0) {
    throw new ErrorAplicacion('OMR_CAPTURA_IMAGEN_INVALIDA', 'La captura original está vacía.', 422, { numeroPagina });
  }
  return createHash('sha256').update(bytes).digest('hex');
}

function qrEsperadoDePagina(paginaMapa: PaginaMapaOmr, paginasExamen: PaginaExamenOmr[], numeroPagina: number) {
  const paginasCoincidentes = paginasExamen.filter((pagina) => Number(pagina.numero) === numeroPagina);
  if (paginasCoincidentes.length > 1) {
    throw new ErrorAplicacion('OMR_PAGINA_EXAMEN_DUPLICADA', 'Los metadatos del examen repiten el número de una página OMR.', 409, {
      numeroPagina
    });
  }

  const qrMapa = String(paginaMapa.qr?.texto ?? '').trim();
  const qrExamen = String(paginasCoincidentes[0]?.qrTexto ?? '').trim();
  if (qrMapa && qrExamen && qrMapa !== qrExamen) {
    throw new ErrorAplicacion('OMR_QR_MANIFIESTO_CONFLICTIVO', 'El QR del mapa OMR no coincide con el QR registrado para la página del examen.', 409, {
      numeroPagina
    });
  }
  return qrExamen || qrMapa;
}

function validarQrPagina(params: {
  qrTexto: string;
  qrEsperado: string;
  folio: string;
  numeroPagina: number;
  templateId: string;
}) {
  const { qrTexto, qrEsperado, folio, numeroPagina, templateId } = params;
  const resumen = extraerResumenQrExamen(String(qrTexto ?? '').trim());
  if (!resumen || resumen.raw !== qrEsperado) {
    throw new ErrorAplicacion('OMR_QR_NO_COINCIDE_MANIFIESTO', 'El QR de la imagen no coincide con el examen y página esperados.', 409, {
      numeroPagina
    });
  }
  if (resumen.payloadSignature && resumen.payloadSignatureValid !== true) {
    throw new ErrorAplicacion('OMR_QR_FIRMA_INVALIDA', 'El QR de la imagen no supera la validación de integridad.', 409, {
      numeroPagina,
      signatureMode: resumen.payloadSignatureMode ?? 'desconocido'
    });
  }
  if (
    String(resumen.folio ?? '').trim().toUpperCase() !== folio ||
    Number(resumen.numeroPagina) !== numeroPagina ||
    Number(resumen.templateVersion) !== 4 ||
    String(resumen.templateId ?? '') !== templateId
  ) {
    throw new ErrorAplicacion('OMR_QR_IDENTIDAD_NO_COINCIDE', 'El QR no corresponde al folio, página o plantilla esperados.', 409, {
      numeroPagina
    });
  }
}

function crearResumenAgregado(resultados: ResultadoOmr[]) {
  const respuestas = resultados.flatMap((resultado) => resultado.respuestasDetectadas);
  const totales = resultados.map((resultado) => resultado.resumenRespuestas).filter(Boolean);
  const totalReactivos = respuestas.length;
  const reactivosRespondidos = respuestas.filter((respuesta) => respuesta.estadoRespuesta === 'respondida').length;
  const reactivosSinMarca = respuestas.filter((respuesta) => respuesta.estadoRespuesta === 'sin_marca').length;
  const reactivosAmbiguos = respuestas.filter((respuesta) => respuesta.estadoRespuesta === 'ambigua').length;
  const reactivosInvalidos = respuestas.filter((respuesta) => ['doble_marca', 'tachada'].includes(respuesta.estadoRespuesta ?? '')).length;
  const examenVacio = totales.length === resultados.length && totales.every((resumen) => resumen?.examenVacio);
  const examenVacioProbable = !examenVacio && totales.some((resumen) => resumen?.examenVacioProbable);
  const estadoExamen = examenVacio
    ? 'vacio_confirmado'
    : examenVacioProbable || reactivosAmbiguos > 0 || reactivosInvalidos > 0
      ? 'requiere_revision'
      : 'con_respuestas';

  return {
    totalReactivos,
    reactivosRespondidos,
    reactivosSinMarca,
    reactivosAmbiguos,
    reactivosInvalidos,
    examenVacio,
    examenVacioProbable,
    estadoExamen
  } as const;
}

export async function analizarPaginasOmrParaCalificacion(params: {
  folio: string;
  mapaOmr: MapaOmrExamen;
  paginasExamen: PaginaExamenOmr[];
  paginasCapturadas: PaginaCapturadaOmr[];
  totalPreguntasEsperadas: number;
  analizar?: AnalizadorPaginaOmr;
  leerBono?: typeof leerBonoVisibleOmr;
}): Promise<ResultadoCalificacionOmrLocal> {
  const { folio, mapaOmr, paginasExamen, paginasCapturadas, totalPreguntasEsperadas } = params;
  const analizarPagina = params.analizar ?? analizarOmr;
  const folioNormalizado = String(folio ?? '').trim().toUpperCase();
  const templateId = String(mapaOmr?.templateId ?? '').trim();
  const paginasMapa = Array.isArray(mapaOmr?.paginas)
    ? mapaOmr.paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio')
    : [];

  if (!folioNormalizado || Number(mapaOmr?.templateVersion) !== 4 || !templateId || templateId === 'omr-inline-exam-v1') {
    throw new ErrorAplicacion('OMR_TEMPLATE_NO_COMPATIBLE', 'La calificación automática exige un mapa OMR canónico versionado.', 422);
  }
  if (!Number.isInteger(totalPreguntasEsperadas) || totalPreguntasEsperadas <= 0 || paginasMapa.length === 0) {
    throw new ErrorAplicacion('OMR_MAPA_VARIANTE_INVALIDO', 'El mapa OMR no define páginas y reactivos válidos.', 409);
  }
  const numerosPaginaMapa = paginasMapa.map((pagina) => Number(pagina.numeroPagina));
  if (numerosPaginaMapa.some((numero) => !Number.isSafeInteger(numero) || numero < 1) || new Set(numerosPaginaMapa).size !== numerosPaginaMapa.length) {
    throw new ErrorAplicacion('OMR_MAPA_PAGINAS_INVALIDAS', 'El mapa OMR contiene números de página ausentes, inválidos o duplicados.', 409);
  }
  const preguntasMapa = paginasMapa.flatMap((pagina) => (pagina.preguntas ?? []).map((pregunta) => Number(pregunta.numeroPregunta)));
  if (
    preguntasMapa.length !== totalPreguntasEsperadas ||
    new Set(preguntasMapa).size !== totalPreguntasEsperadas ||
    preguntasMapa.some((numero) => !Number.isSafeInteger(numero) || numero < 1 || numero > totalPreguntasEsperadas)
  ) {
    throw new ErrorAplicacion('OMR_MAPA_REACTIVOS_INVALIDOS', 'Los reactivos del mapa OMR no cubren exactamente la variante del examen.', 409);
  }
  if (paginasCapturadas.length !== paginasMapa.length) {
    throw new ErrorAplicacion('OMR_PAGINAS_INCOMPLETAS', 'Se requiere una captura por cada página OMR del examen.', 422, {
      paginasEsperadas: paginasMapa.length,
      paginasRecibidas: paginasCapturadas.length
    });
  }

  const capturasPorNumero = new Map<number, PaginaCapturadaOmr>();
  const hashesImagenPorPagina = new Map<number, string>();
  for (const captura of paginasCapturadas) {
    const numeroPagina = Number(captura.numeroPagina);
    if (!Number.isInteger(numeroPagina) || !captura.imagenBase64?.trim() || capturasPorNumero.has(numeroPagina)) {
      throw new ErrorAplicacion('OMR_PAGINA_DUPLICADA_O_INVALIDA', 'Hay capturas OMR con número duplicado o imagen vacía.', 422);
    }
    capturasPorNumero.set(numeroPagina, captura);
    hashesImagenPorPagina.set(numeroPagina, hashCapturaOriginal(captura.imagenBase64, numeroPagina));
  }

  const resultados: ResultadoOmr[] = [];
  const auditoriaPaginas: ResultadoCalificacionOmrLocal['paginas'] = [];
  for (const mapaPagina of [...paginasMapa].sort((a, b) => a.numeroPagina - b.numeroPagina)) {
    const numeroPagina = Number(mapaPagina.numeroPagina);
    const captura = capturasPorNumero.get(numeroPagina);
    const qrEsperado = qrEsperadoDePagina(mapaPagina, paginasExamen, numeroPagina);
    if (!captura || !qrEsperado) {
      throw new ErrorAplicacion('OMR_PAGINA_ESPERADA_AUSENTE', 'Falta la captura o el QR esperado de una página del examen.', 409, {
        numeroPagina
      });
    }

    const resultado = await analizarPagina(
      captura.imagenBase64,
      mapaPagina as Parameters<AnalizadorPaginaOmr>[1],
      qrEsperado,
      numeroFinito(mapaOmr.margenMm, 10),
      { folio: folioNormalizado, numeroPagina, templateVersionDetectada: 4 }
    );
    validarQrPagina({
      qrTexto: String(resultado.qrTexto ?? ''),
      qrEsperado,
      folio: folioNormalizado,
      numeroPagina,
      templateId
    });

    const preguntasEsperadas = (mapaPagina.preguntas ?? []).map((pregunta) => Number(pregunta.numeroPregunta));
    const preguntasDetectadas = resultado.respuestasDetectadas.map((respuesta) => Number(respuesta.numeroPregunta));
    if (
      preguntasEsperadas.length === 0 ||
      preguntasDetectadas.length !== preguntasEsperadas.length ||
      new Set(preguntasDetectadas).size !== preguntasDetectadas.length ||
      preguntasDetectadas.some((numero) => !preguntasEsperadas.includes(numero))
    ) {
      throw new ErrorAplicacion('OMR_REACTIVOS_PAGINA_NO_COINCIDEN', 'Los reactivos leídos no coinciden con el mapa de esa página.', 409, {
        numeroPagina
      });
    }
    resultados.push(resultado);
    auditoriaPaginas.push({
      numeroPagina,
      sha256Imagen: hashesImagenPorPagina.get(numeroPagina)!,
      qrTexto: String(resultado.qrTexto),
      estadoAnalisis: resultado.estadoAnalisis,
      calidadPagina: resultado.calidadPagina,
      confianzaPromedioPagina: resultado.confianzaPromedioPagina,
      ratioAmbiguas: resultado.ratioAmbiguas,
      engineVersion: resultado.engineVersion,
      decisionPolicy: resultado.decisionPolicy
    });
  }

  const respuestasDetectadas = resultados.flatMap((resultado, indice) =>
    resultado.respuestasDetectadas.map((respuesta) => ({
      ...respuesta,
      numeroPaginaFuente: auditoriaPaginas[indice]!.numeroPagina
    }))
  ).sort((a, b) => a.numeroPregunta - b.numeroPregunta);
  const preguntasLeidas = respuestasDetectadas.map((respuesta) => respuesta.numeroPregunta);
  if (
    respuestasDetectadas.length !== totalPreguntasEsperadas ||
    new Set(preguntasLeidas).size !== totalPreguntasEsperadas ||
    preguntasLeidas.some((numero) => numero < 1 || numero > totalPreguntasEsperadas)
  ) {
    throw new ErrorAplicacion('OMR_REACTIVOS_EXAMEN_NO_COINCIDEN', 'La lectura del examen no cubre exactamente la variante registrada.', 409, {
      preguntasEsperadas: totalPreguntasEsperadas,
      preguntasLeidas: respuestasDetectadas.length
    });
  }

  const estadoAnalisis = resultados.some((resultado) => resultado.estadoAnalisis === 'rechazado_calidad')
    ? 'rechazado_calidad'
    : resultados.every((resultado) => resultado.estadoAnalisis === 'ok') ? 'ok' : 'requiere_revision';
  const calidadPagina = Math.min(...resultados.map((resultado) => numeroFinito(resultado.calidadPagina, 0)));
  const confianzaPromedioPagina = Math.min(...resultados.map((resultado) => numeroFinito(resultado.confianzaPromedioPagina, 0)));
  const ratioAmbiguas = Math.max(...resultados.map((resultado) => numeroFinito(resultado.ratioAmbiguas, 1)));
  const resumenRespuestas = crearResumenAgregado(resultados);
  const primerQr = auditoriaPaginas[0]?.qrTexto ?? '';
  const paginaBono = paginasMapa.find((pagina) => Number(pagina.numeroPagina) === 1);
  const campoBono = paginaBono?.layoutDebug?.headerFieldBoxes?.find((campo) => campo.id === 'calificacion-linea');
  const capturaBono = capturasPorNumero.get(1);
  const lecturaBono = campoBono && capturaBono
    ? await (params.leerBono ?? leerBonoVisibleOmr)(capturaBono.imagenBase64, campoBono)
    : { bono: null, confianza: 0 };

  return {
    respuestasDetectadas,
    analisis: {
      estadoAnalisis,
      calidadPagina,
      confianzaPromedioPagina,
      ratioAmbiguas,
      templateVersionDetectada: 4,
      motivosRevision: resultados.flatMap((resultado, indice) =>
        (resultado.motivosRevision ?? []).map((motivo) => `P${auditoriaPaginas[indice]?.numeroPagina ?? indice + 1}: ${motivo}`)
      ),
      engineVersion: resultados.every((resultado) => resultado.engineVersion === resultados[0]?.engineVersion)
        ? String(resultados[0]?.engineVersion ?? 'omr-cv')
        : 'omr-cv-mixed',
      geomQuality: Math.min(...resultados.map((resultado) => numeroFinito(resultado.geomQuality, 0))),
      photoQuality: Math.min(...resultados.map((resultado) => numeroFinito(resultado.photoQuality, 0))),
      decisionPolicy: resultados.every((resultado) => resultado.decisionPolicy === resultados[0]?.decisionPolicy)
        ? String(resultados[0]?.decisionPolicy ?? 'unknown')
        : 'mixed',
      qrTexto: primerQr,
      resumenRespuestas,
      bonoVisible: lecturaBono.bono === 0.25,
      bonoOcrResuelto: lecturaBono.bono !== null,
      bonoOcrConfianza: lecturaBono.confianza
    },
    paginas: auditoriaPaginas
  };
}
