/**
 * etapaScoring
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import type { ContextoPipelineOmr } from '../types.js';
import { analizarOmr as analizarOmrCv, type ResultadoOmr, type RespuestaDetectadaOmr } from '../../servicioOmrCv.js';
import { debeIntentarMotorCv, describirErrorCv, preprocesarImagenOmrCv } from '../../infra/omrCvEngine.js';

function necesitaRescateSinPreproceso(resultado: ResultadoOmr) {
  return (
    resultado.estadoAnalisis !== 'ok' ||
    resultado.respuestasDetectadas.some(
      (respuesta) =>
        respuesta.opcion == null &&
        (respuesta.flags.includes('bajo_contraste') || respuesta.flags.includes('parcial_detectada'))
    )
  );
}

function puedeRescatarDobleMarca(base: RespuestaDetectadaOmr, rescate: RespuestaDetectadaOmr) {
  if (
    rescate.opcion == null ||
    rescate.confianza < 0.75 ||
    rescate.flags.includes('doble_marca') ||
    rescate.flags.includes('tachada_detectada')
  ) {
    return false;
  }
  const orden = [...base.scoresPorOpcion].sort((a, b) => b.score - a.score);
  const dominante = orden[0]?.score ?? 0;
  const segunda = orden[1]?.score ?? 0;
  const relacion = segunda / Math.max(0.0001, dominante);
  const diferencia = dominante - segunda;
  // Se rescata únicamente el patrón observado en una marca válida degradada:
  // segunda señal cercana, pero no casi empatada. Dobles marcas francas y
  // manchas ambiguas conservan la decisión conservadora.
  const rescateConSegundaDebil =
    segunda < 0.3 && dominante >= 0.7 && rescate.confianza >= 0.85;
  return (
    (relacion >= 0.58 && diferencia >= 0.22 && diferencia <= 0.42) ||
    rescateConSegundaDebil
  );
}

function fusionarRespuestasSinPreproceso(
  base: ResultadoOmr,
  rescate: ResultadoOmr,
  permitirRescateDeDobleMarca = false
): ResultadoOmr {
  const rescatePorPregunta = new Map(rescate.respuestasDetectadas.map((respuesta) => [respuesta.numeroPregunta, respuesta]));
  const puntuarEvidencia = (respuesta: RespuestaDetectadaOmr) => {
    const mejorScore = Math.max(0, ...respuesta.scoresPorOpcion.map((item) => Number(item.score) || 0));
    const mejorForma = Math.max(0, ...respuesta.scoresPorOpcion.map((item) => Number(item.markConfidence) || 0));
    return mejorScore + mejorForma * 0.08 + (respuesta.opcion ? 0.01 : 0);
  };
  let cambios = 0;
  const respuestasDetectadas = base.respuestasDetectadas.map((respuestaBase): RespuestaDetectadaOmr => {
    const respuestaRescate = rescatePorPregunta.get(respuestaBase.numeroPregunta);
    const dobleMarcaRescatable = Boolean(
      permitirRescateDeDobleMarca &&
      respuestaBase.flags.includes('doble_marca') &&
      respuestaRescate &&
      puedeRescatarDobleMarca(respuestaBase, respuestaRescate)
    );
    const baseInvalida = respuestaBase.flags.includes('doble_marca') || respuestaBase.flags.includes('tachada_detectada');
    const rescateInvalido = Boolean(
      respuestaRescate?.flags.includes('doble_marca') || respuestaRescate?.flags.includes('tachada_detectada')
    );
    const rescateLimpio = Boolean(respuestaRescate?.opcion != null && !rescateInvalido);
    const baseParcial = respuestaBase.flags.includes('parcial_detectada');
    const rescateMejorEnConflicto = Boolean(
      rescateLimpio &&
      respuestaBase.opcion != null &&
      !baseInvalida &&
      respuestaRescate &&
      respuestaRescate.opcion !== respuestaBase.opcion &&
      (baseParcial || puntuarEvidencia(respuestaRescate) > puntuarEvidencia(respuestaBase) + 0.03)
    );
    if (
      (respuestaBase.opcion != null && !rescateMejorEnConflicto) ||
      (baseInvalida && !dobleMarcaRescatable) ||
      respuestaBase.flags.includes('tachada_detectada')
    ) {
      return respuestaBase;
    }

    if (
      !respuestaRescate ||
      respuestaRescate.opcion == null ||
      respuestaRescate.confianza < 0.75 ||
      respuestaRescate.flags.includes('doble_marca') ||
      respuestaRescate.flags.includes('tachada_detectada')
    ) {
      return respuestaBase;
    }

    cambios += 1;
    return respuestaRescate;
  });

  if (cambios === 0) return base;

  const confianzaPromedioPagina =
    respuestasDetectadas.reduce((acumulado, respuesta) => acumulado + Math.max(0, respuesta.confianza), 0) /
    Math.max(1, respuestasDetectadas.length);
  const ratioAmbiguas =
    respuestasDetectadas.filter((respuesta) => respuesta.opcion == null).length / Math.max(1, respuestasDetectadas.length);

  return {
    ...base,
    respuestasDetectadas,
    advertencias: Array.from(
      new Set([...base.advertencias, `Rescate por imagen original aplicado en ${cambios} preguntas`])
    ),
    confianzaPromedioPagina,
    ratioAmbiguas
  };
}

export async function ejecutarEtapaScoring(contexto: ContextoPipelineOmr) {
  const mapaPagina = contexto.mapaPagina as Parameters<typeof analizarOmrCv>[1];
  const templateVersion =
    Number((mapaPagina as { templateVersion?: unknown })?.templateVersion ?? contexto.debugInfo?.templateVersionDetectada ?? 4);
  const engineVersion = 'omr-cv' as const;
  const perfilHorizontalCompacto = mapaPagina.preguntas.some(
    (pregunta) => Number.isFinite(pregunta.perfilOmr?.pasoX) && Number(pregunta.perfilOmr?.pasoX) > 0.4
  );

  let resultado: ResultadoOmr;
  if (debeIntentarMotorCv(templateVersion)) {
    try {
      // El reescalado/realce externo puede engrosar círculos contiguos del
      // perfil horizontal compacto y mover la dominante a la opción vecina.
      // En este perfil la imagen original conserva mejor la separación; el
      // preprocesado queda como rescate si la lectura inicial es insuficiente.
      const imagenCv = perfilHorizontalCompacto
        ? contexto.imagenBase64
        : await preprocesarImagenOmrCv(contexto.imagenBase64);
      resultado = await analizarOmrCv(
        imagenCv,
        mapaPagina,
        contexto.qrEsperado,
        contexto.margenMm,
        contexto.debugInfo,
        {}
      );
      resultado.engineVersion = engineVersion;

      // El preproceso externo mejora fotos degradadas, pero puede borrar una
      // marca tenue en el panel vertical v4. Solo se hace un segundo análisis
      // cuando hay señales de baja calidad y solo se rescatan respuestas
      // limpias; una doble/tachada detectada por el primer pase conserva
      // siempre prioridad conservadora.
      if (necesitaRescateSinPreproceso(resultado)) {
        const imagenRescate = perfilHorizontalCompacto
          ? await preprocesarImagenOmrCv(contexto.imagenBase64)
          : contexto.imagenBase64;
        const resultadoRescate = await analizarOmrCv(
          imagenRescate,
          mapaPagina,
          contexto.qrEsperado,
          contexto.margenMm,
          contexto.debugInfo,
          // En el perfil horizontal compacto el rescate debe evaluarse sobre
          // la imagen preprocesada, sin entregar además la imagen original al
          // motor, porque eso puede reactivar una doble marca entre burbujas.
          { noRetry: true }
        );
        // En el panel horizontal compacto una segunda burbuja puede perderse
        // parcialmente por perspectiva. Nunca se permite que ese rescate
        // transforme una doble marca confirmada en una respuesta calificable;
        // solo se rescatan respuestas nulas por bajo contraste.
        resultado = fusionarRespuestasSinPreproceso(resultado, resultadoRescate, false);
      }
    } catch (error) {
      resultado = await analizarOmrCv(
        contexto.imagenBase64,
        mapaPagina,
        contexto.qrEsperado,
        contexto.margenMm,
        contexto.debugInfo,
        {}
      );
      resultado.engineVersion = engineVersion;
      resultado.motivosRevision = Array.from(
        new Set([...(resultado.motivosRevision ?? []), `CV_PREPROCESO_REINTENTO:${describirErrorCv(error)}`])
      ).slice(0, 24);
    }
  } else {
    resultado = await analizarOmrCv(
      contexto.imagenBase64,
      mapaPagina,
      contexto.qrEsperado,
      contexto.margenMm,
      contexto.debugInfo,
      {}
    );
    resultado.engineVersion = engineVersion;
  }

  contexto.resultado = resultado as ResultadoOmr;
  return contexto;
}
