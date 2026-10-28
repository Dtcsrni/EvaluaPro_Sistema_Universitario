/**
 * SeccionCalificar
 *
 * Responsabilidad: Seccion funcional del shell docente.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * App docente: panel basico para banco, examenes, entrega y calificacion.
 */
import { useEffect, useMemo, useState } from 'react';
import { guardarTokenDocente, limpiarTokenDocente, obtenerTokenDocente } from '../../servicios_api/clienteApi';
import { accionToastSesionParaError, mensajeUsuarioDeErrorConSugerencia, onSesionInvalidada } from '../../servicios_api/clienteComun';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono, Spinner } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { TemaBoton } from '../../tema/TemaBoton';
import { AyudaFormulario } from './AyudaFormulario';
import { clienteApi } from './clienteApiDocente';
import { SeccionAutenticacion } from './SeccionAutenticacion';
import { SeccionAlumnos } from './SeccionAlumnos';
import { SeccionBanco } from './SeccionBanco';
import { SeccionCuenta } from './SeccionCuenta';
import { QrAccesoMovil, SeccionEscaneo } from './SeccionEscaneo';
import { SeccionPlantillas } from './SeccionPlantillas';
import { SeccionPeriodos, SeccionPeriodosArchivados } from './SeccionPeriodos';
import { registrarAccionDocente } from './telemetriaDocente';
import type {
  Alumno,
  Docente,
  EnviarConPermiso,
  ExamenGeneradoClave,
  Periodo,
  PermisosUI,
  Plantilla,
  Pregunta,
  PreviewCalificacion,
  PreviewPlantilla,
  RegistroSincronizacion,
  RespuestaSyncPull,
  RespuestaSyncPush,
  ResultadoAnalisisOmr,
  ResultadoOmr,
  RespuestaDetectadaOmr,
  RevisionExamenOmr,
  RevisionPaginaOmr
} from './tipos';
import {
  combinarRespuestasOmrPaginas,
  construirClaveCorrectaExamen,
  consolidarResultadoOmrExamen,
  esMensajeError,
  etiquetaMateria,
  mensajeDeError,
  normalizarResultadoOmr,
  obtenerSesionDocenteId,
  obtenerVistaInicial,
} from './utilidades';


export function SeccionCalificar({
  examenId,
  alumnoId,
  examenEtiqueta,
  alumnoNombre,
  resultadoOmr,
  revisionOmrConfirmada,
  respuestasDetectadas,
  modoManual = false,
  paginasCapturaManual = [],
  onActualizarRespuestaManual,
  claveCorrectaPorNumero,
  ordenPreguntasClave,
  contextoManual,
  etiquetaTipoExamen,
  soloLectura = false,
  resumenPersistido,
  onCalificar,
  puedeCalificar,
  avisarSinPermiso
}: {
  examenId: string | null;
  alumnoId: string | null;
  examenEtiqueta?: string | null;
  alumnoNombre?: string | null;
  resultadoOmr: ResultadoOmr | null;
  revisionOmrConfirmada: boolean;
  respuestasDetectadas: RespuestaDetectadaOmr[];
  modoManual?: boolean;
  paginasCapturaManual?: Array<{ numeroPagina: number; imagenBase64: string; preguntas: number[] }>;
  onActualizarRespuestaManual?: (numeroPregunta: number, opcion: string | null | undefined) => void;
  claveCorrectaPorNumero: Record<number, string>;
  ordenPreguntasClave: number[];
  contextoManual?: string | null;
  etiquetaTipoExamen?: string | null;
  soloLectura?: boolean;
  resumenPersistido?: {
    aciertos: number;
    totalReactivos: number;
    calificacionFinalSobre5: number;
    calificacionEquivalenteSobre10Texto?: string;
    estadoAprobatorio?: 'Aprobatoria' | 'No aprobatoria';
    origen?: string;
  };
  onCalificar: (payload: {
    examenGeneradoId: string;
    alumnoId?: string | null;
    aciertos?: number;
    totalReactivos?: number;
    bonoSolicitado?: number;
    retroalimentacion?: string;
    respuestasDetectadas?: RespuestaDetectadaOmr[];
    paginasCaptura?: Array<{ numeroPagina: number; imagenBase64: string }>;
    omrAnalisis?: {
      estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
      calidadPagina: number;
      confianzaPromedioPagina: number;
      ratioAmbiguas: number;
      templateVersionDetectada: 4;
      motivosRevision: string[];
      revisionConfirmada: boolean;
      bonoVisibleConfirmado?: boolean;
      qrTexto?: string;
      engineVersion: string;
      geomQuality: number;
      photoQuality: number;
      decisionPolicy: string;
      resumenRespuestas?: {
        totalReactivos: number;
        reactivosRespondidos: number;
        reactivosSinMarca: number;
        reactivosAmbiguos: number;
        reactivosInvalidos: number;
        examenVacio: boolean;
        examenVacioProbable: boolean;
        estadoExamen: 'vacio_confirmado' | 'vacio_probable' | 'con_respuestas' | 'requiere_revision';
      };
    };
  }) => Promise<unknown>;
  puedeCalificar: boolean;
  avisarSinPermiso: (mensaje: string) => void;
}) {
  const normalizarOpcion = (valor: string | null | undefined) => {
    const limpio = String(valor ?? '').trim().toUpperCase();
    return limpio.length > 0 ? limpio : null;
  };
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [paginaCapturaActiva, setPaginaCapturaActiva] = useState<number | null>(null);
  const [zoomCaptura, setZoomCaptura] = useState(100);
  const [bonoVisibleConfirmado, setBonoVisibleConfirmado] = useState<boolean | null>(null);

  useEffect(() => {
    setPaginaCapturaActiva(null);
    setZoomCaptura(100);
    setBonoVisibleConfirmado(null);
  }, [examenId]);

  const respuestasSeguras = useMemo(
    () => (Array.isArray(respuestasDetectadas) ? respuestasDetectadas : []),
    [respuestasDetectadas]
  );
  const respuestasPorNumero = useMemo(
    () =>
      new Map(
        respuestasSeguras
          .filter((item) => Number.isFinite(Number(item?.numeroPregunta)))
          .map((item) => [Number(item.numeroPregunta), item])
      ),
    [respuestasSeguras]
  );
  const ordenPreguntas = useMemo(() => {
    if (Array.isArray(ordenPreguntasClave) && ordenPreguntasClave.length > 0) return ordenPreguntasClave;
    const desdeRespuestas = respuestasSeguras
      .map((item) => Number(item?.numeroPregunta))
      .filter((numero) => Number.isFinite(numero));
    const desdeClave = Object.keys(claveCorrectaPorNumero)
      .map((numero) => Number(numero))
      .filter((numero) => Number.isFinite(numero));
    return Array.from(new Set([...desdeClave, ...desdeRespuestas])).sort((a, b) => a - b);
  }, [claveCorrectaPorNumero, ordenPreguntasClave, respuestasSeguras]);

  const respuestasTrabajo = useMemo(
    () =>
      respuestasSeguras
        .filter((item) => Number.isFinite(Number(item?.numeroPregunta)) && Number(item.numeroPregunta) > 0)
        .map((item) => ({
          numeroPregunta: Number(item.numeroPregunta),
          opcion: normalizarOpcion(typeof item?.opcion === 'string' ? item.opcion : null),
          confianza: Number.isFinite(Number(item?.confianza)) ? Number(item?.confianza) : 0,
          ...(item.estadoRespuesta ? { estadoRespuesta: item.estadoRespuesta } : {}),
          ...(Array.isArray(item.flags) ? { flags: item.flags } : {})
        }))
        .sort((a, b) => a.numeroPregunta - b.numeroPregunta),
    [respuestasSeguras]
  );

  const respuestasTrabajoPorNumero = useMemo(
    () => new Map(respuestasTrabajo.map((item) => [item.numeroPregunta, item])),
    [respuestasTrabajo]
  );

  const resumenDinamico = useMemo(() => {
    const numerosEvaluables =
      Array.isArray(ordenPreguntasClave) && ordenPreguntasClave.length > 0
        ? ordenPreguntasClave
            .map((numero) => Number(numero))
            .filter((numero) => Number.isFinite(numero) && numero > 0)
        : ordenPreguntas;
    if (numerosEvaluables.length === 0) {
      return { total: 0, aciertos: 0, contestadas: 0, notaExamenSobre5: 0 };
    }
    let aciertos = 0;
    let contestadas = 0;
    for (const numero of numerosEvaluables) {
      const correcta = normalizarOpcion(claveCorrectaPorNumero[numero] ?? null);
      const opcion = normalizarOpcion(respuestasTrabajoPorNumero.get(numero)?.opcion ?? null);
      if (opcion) contestadas += 1;
      if (correcta && opcion && correcta === opcion) aciertos += 1;
    }
    const total = numerosEvaluables.length;
    const notaExamenSobre5 = total > 0 && aciertos === total ? 5 : Number(((aciertos / Math.max(1, total)) * 5).toFixed(2));
    return { total, aciertos, contestadas, notaExamenSobre5 };
  }, [claveCorrectaPorNumero, ordenPreguntas, ordenPreguntasClave, respuestasTrabajoPorNumero]);
  const aciertosMostrados = soloLectura && resumenPersistido ? Number(resumenPersistido.aciertos || 0) : resumenDinamico.aciertos;
  const totalMostrado = soloLectura && resumenPersistido ? Number(resumenPersistido.totalReactivos || 0) : resumenDinamico.total;
  const notaFinalMostrada = soloLectura && resumenPersistido
    ? Number(Number(resumenPersistido.calificacionFinalSobre5 || 0).toFixed(2))
    : resumenDinamico.notaExamenSobre5;
  const bonoPendiente = !soloLectura && (
    (modoManual && bonoVisibleConfirmado === null) || (!modoManual && Boolean(resultadoOmr))
  );
  const notaFinalProyectada = soloLectura
    ? notaFinalMostrada
    : Math.min(5, notaFinalMostrada + (modoManual && bonoVisibleConfirmado === true ? 0.25 : 0));
  const notaFinalSobre5Exacta =
    soloLectura && resumenPersistido
      ? Number(resumenPersistido.calificacionFinalSobre5 || 0)
      : Math.min(
          5,
          (resumenDinamico.total > 0 ? (resumenDinamico.aciertos * 5) / resumenDinamico.total : 0)
        );
  const notaEquivalenteSobre10 =
    soloLectura && resumenPersistido?.calificacionEquivalenteSobre10Texto
      ? Number(resumenPersistido.calificacionEquivalenteSobre10Texto)
      : notaFinalSobre5Exacta * 2;
  const esAprobatoriaExtraordinario =
    soloLectura && resumenPersistido?.estadoAprobatorio
      ? resumenPersistido.estadoAprobatorio === 'Aprobatoria'
      : totalMostrado > 0 &&
        20 * aciertosMostrados > 12 * totalMostrado;
  const esExtraordinario = String(etiquetaTipoExamen ?? '').trim().toLowerCase().includes('extraordinario');

  const estadoOmrEtiqueta = useMemo(() => {
    if (!resultadoOmr) return 'requiere_revision';
    if (resultadoOmr.estadoAnalisis === 'rechazado_calidad') {
      return revisionOmrConfirmada ? 'revisado_manual' : 'requiere_revision';
    }
    return resultadoOmr.estadoAnalisis;
  }, [resultadoOmr, revisionOmrConfirmada]);
  const estadoOmrTexto =
    estadoOmrEtiqueta === 'ok'
      ? 'OK'
      : estadoOmrEtiqueta === 'revisado_manual'
        ? 'Revisado manual'
        : 'En revisión';
  const estadoOmrClase = estadoOmrEtiqueta === 'ok' ? 'ok' : 'warning';

  const reactivosOficiales = useMemo(
    () =>
      (Array.isArray(ordenPreguntasClave) ? ordenPreguntasClave : [])
        .map((numero) => Number(numero))
        .filter((numero) => Number.isFinite(numero) && numero > 0),
    [ordenPreguntasClave]
  );
  const reactivosSinClave = useMemo(
    () =>
      reactivosOficiales.filter((numero) => {
        const correcta = normalizarOpcion(claveCorrectaPorNumero[numero]);
        return String(correcta ?? '').trim().length === 0;
      }),
    [claveCorrectaPorNumero, reactivosOficiales]
  );
  const bloqueoPorSeleccionIncompleta = !examenId || !alumnoId;
  const bloqueoPorClaveIncompleta = reactivosOficiales.length === 0 || reactivosSinClave.length > 0;
  const bloqueoPorSoloLectura = Boolean(soloLectura);
  const respuestasCompletas =
    reactivosOficiales.length > 0 &&
    respuestasTrabajo.length === reactivosOficiales.length &&
    new Set(respuestasTrabajo.map((respuesta) => respuesta.numeroPregunta)).size === reactivosOficiales.length &&
    respuestasTrabajo.every((respuesta) => reactivosOficiales.includes(respuesta.numeroPregunta));
  const respuestasOmrSinResolver = resultadoOmr
    ? reactivosOficiales.filter((numero) => {
        const respuesta = respuestasTrabajoPorNumero.get(numero);
        if (!respuesta) return true;
        if (respuesta.estadoRespuesta === 'respondida') return !respuesta.opcion;
        if (respuesta.estadoRespuesta === 'sin_marca') return respuesta.opcion !== null;
        if (respuesta.estadoRespuesta) return true;
        return !respuesta.opcion || Boolean(respuesta.flags?.length);
      })
    : [];
  const revisionOmrRespuestasCompleta = respuestasOmrSinResolver.length === 0;
  const revisionManualCompleta = !modoManual || reactivosOficiales.every((numero) => {
    const respuesta = respuestasTrabajoPorNumero.get(numero);
    return respuesta?.estadoRespuesta === 'respondida' || respuesta?.estadoRespuesta === 'sin_marca';
  });
  const paginaCapturaSeleccionada = paginasCapturaManual.find((pagina) => pagina.numeroPagina === paginaCapturaActiva)
    ?? paginasCapturaManual[0];
  const preguntasPaginaCaptura = paginaCapturaSeleccionada?.preguntas.length
    ? reactivosOficiales.filter((numero) => paginaCapturaSeleccionada.preguntas.includes(numero))
    : reactivosOficiales;
  const capturasManualesPorReactivo = new Map<number, number>();
  for (const pagina of paginasCapturaManual) {
    for (const numeroPregunta of pagina.preguntas) {
      capturasManualesPorReactivo.set(numeroPregunta, (capturasManualesPorReactivo.get(numeroPregunta) ?? 0) + 1);
    }
  }
  const lecturaAutomaticaApta = Boolean(resultadoOmr?.autoCalificableOmr && respuestasCompletas);
  const requiereRevisionConfirmacion = Boolean(resultadoOmr && !revisionOmrConfirmada && !lecturaAutomaticaApta);
  const capturasManualesCompletas = !modoManual || (
    paginasCapturaManual.length > 0 &&
    paginasCapturaManual.every((pagina) => Number.isInteger(pagina.numeroPagina) && pagina.numeroPagina > 0 && pagina.imagenBase64.trim().length > 0) &&
    reactivosOficiales.every((numeroPregunta) => capturasManualesPorReactivo.get(numeroPregunta) === 1) &&
    String(resultadoOmr?.qrTexto ?? '').trim().length > 0
  );
  const puedeCalificarLocal =
    !bloqueoPorSeleccionIncompleta &&
    !requiereRevisionConfirmacion &&
    !bloqueoPorSoloLectura &&
    !bloqueoPorClaveIncompleta &&
    respuestasCompletas &&
    revisionOmrRespuestasCompleta &&
    revisionManualCompleta &&
    (!modoManual || bonoVisibleConfirmado !== null) &&
    capturasManualesCompletas;
  const bloqueoCalificar = !puedeCalificar;

  async function calificar() {
    if (bloqueoPorSoloLectura) {
      setMensaje('Modo solo lectura: este examen ya está calificado.');
      return;
    }
    if (!examenId || !alumnoId) {
      setMensaje('Falta examen o alumno');
      return;
    }
    try {
      const inicio = Date.now();
      if (!puedeCalificar) {
        avisarSinPermiso('No tienes permiso para calificar.');
        return;
      }
      setGuardando(true);
      setMensaje('');
      await onCalificar({
        examenGeneradoId: examenId,
        alumnoId,
        aciertos: resumenDinamico.aciertos,
        totalReactivos: resumenDinamico.total,
        ...(modoManual || resultadoOmr ? { respuestasDetectadas: respuestasTrabajo } : {}),
        ...(modoManual
          ? { paginasCaptura: paginasCapturaManual.map(({ numeroPagina, imagenBase64 }) => ({ numeroPagina, imagenBase64 })) }
          : {}),
        omrAnalisis: resultadoOmr
          ? {
              estadoAnalisis: resultadoOmr.estadoAnalisis,
              calidadPagina: resultadoOmr.calidadPagina,
              confianzaPromedioPagina: resultadoOmr.confianzaPromedioPagina,
              ratioAmbiguas: resultadoOmr.ratioAmbiguas,
              templateVersionDetectada: resultadoOmr.templateVersionDetectada,
              motivosRevision: Array.isArray(resultadoOmr.motivosRevision) ? resultadoOmr.motivosRevision : [],
              revisionConfirmada: revisionOmrConfirmada,
              ...(modoManual && bonoVisibleConfirmado !== null ? { bonoVisibleConfirmado } : {}),
              qrTexto: typeof resultadoOmr.qrTexto === 'string' ? resultadoOmr.qrTexto : undefined,
              engineVersion: String(resultadoOmr.engineVersion ?? 'omr-cv-ui'),
              geomQuality: Number(resultadoOmr.geomQuality ?? 0),
              photoQuality: Number(resultadoOmr.photoQuality ?? 0),
              decisionPolicy: String(resultadoOmr.decisionPolicy ?? 'omr-ui-request-v1'),
              resumenRespuestas: resultadoOmr.resumenRespuestas
            }
          : undefined
      });
      setMensaje('Calificacion guardada');
      emitToast({ level: 'ok', title: 'Calificacion', message: 'Calificacion guardada', durationMs: 2200 });
      registrarAccionDocente('calificar', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo calificar');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo calificar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('calificar', false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="panel calif-grade-card">
      <div className="banco-section-title">
        <div className="banco-section-title__wrap">
          <span className="banco-section-pill">
            <span className="banco-section-pill__dot" aria-hidden="true" />
            <span>Mesa de Decisión & Rúbrica</span>
          </span>
          <h2 className="entregas-title-heading">
            <Icono nombre="calificar" /> Calificar examen{etiquetaTipoExamen ? ` · ${etiquetaTipoExamen}` : ''}
          </h2>
          <p className="nota">{modoManual
            ? 'Compara la captura del examen con la clave oficial, revisa cada respuesta y confirma si fue correcta o incorrecta.'
            : 'Consolida resultado OMR, validaciones y ajuste final de calificación en una sola tarjeta de decisión.'}</p>
        </div>
      </div>
      <div className="item-sub">Examen: {examenEtiqueta ?? examenId ?? 'Sin examen'}</div>
      <div className="item-sub">Alumno: {alumnoNombre ?? alumnoId ?? 'Sin alumno'}</div>
      {contextoManual && <InlineMensaje tipo="info">{contextoManual}</InlineMensaje>}
      {modoManual && (
        <section className="omr-review-grid omr-review-grid--visual" aria-label="Revisión manual con captura y clave">
          <div className="item-glass omr-review-card omr-review-card--imagen">
            <div className="omr-review-card__heading">
              <div>
                <span className="omr-review-card__eyebrow">Evidencia vinculada al folio</span>
                <h3>Captura del examen</h3>
              </div>
              {paginasCapturaManual.length > 1 && (
                <label className="campo manual-review-grid__page-picker">
                  Página
                  <select
                    aria-label="Página de captura para revisar"
                    value={paginaCapturaSeleccionada?.numeroPagina ?? ''}
                    onChange={(event) => setPaginaCapturaActiva(Number(event.target.value))}
                  >
                    {paginasCapturaManual.map((pagina) => (
                      <option key={pagina.numeroPagina} value={pagina.numeroPagina}>Página {pagina.numeroPagina}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="omr-image-controls" aria-label="Controles de visualización de captura">
              <button
                type="button"
                className="omr-image-control"
                aria-label="Reducir zoom de la captura"
                disabled={zoomCaptura <= 50}
                onClick={() => setZoomCaptura((actual) => Math.max(50, actual - 25))}
              >−</button>
              <span className="omr-image-zoom" aria-live="polite">{zoomCaptura}%</span>
              <button
                type="button"
                className="omr-image-control"
                aria-label="Aumentar zoom de la captura"
                disabled={zoomCaptura >= 200}
                onClick={() => setZoomCaptura((actual) => Math.min(200, actual + 25))}
              >+</button>
              <button
                type="button"
                className="omr-image-reset"
                aria-label="Ajustar captura al ancho"
                onClick={() => setZoomCaptura(100)}
              >Ajustar al ancho</button>
            </div>
            <div className="omr-review-card__image-wrap omr-review-card__image-viewport">
              {paginaCapturaSeleccionada ? (
                <img
                  className={`preview omr-review-card__image--zoomable omr-review-card__image--zoom-${zoomCaptura}`}
                  src={paginaCapturaSeleccionada.imagenBase64}
                  alt={`Captura original del examen, página ${paginaCapturaSeleccionada.numeroPagina}`}
                />
              ) : (
                <InlineMensaje tipo="error">No hay captura original vinculada a este examen. No se puede iniciar la calificación manual.</InlineMensaje>
              )}
            </div>
            <p className="omr-review-card__hint">Compara las marcas de esta captura con la clave de cada reactivo. Cambiar página no modifica las respuestas.</p>
          </div>
          <div className="item-glass omr-review-card omr-review-card--panel omr-review-card--comparador">
            <div className="omr-review-card__heading">
              <div>
                <span className="omr-review-card__eyebrow">Corrección docente por reactivo</span>
                <h3>Cotejo pregunta por pregunta</h3>
              </div>
              <span className="badge">{respuestasTrabajo.filter((respuesta) => respuesta.estadoRespuesta === 'respondida' || respuesta.estadoRespuesta === 'sin_marca').length}/{reactivosOficiales.length} revisadas</span>
            </div>
            <p className="omr-review-card__hint">Por cada pregunta, identifica en la captura la opción marcada o confirma que está en blanco. EvaluaPro la compara con la clave oficial.</p>
            <ol className="omr-respuesta-lista" aria-label="Respuestas observadas comparadas con la clave oficial">
              {preguntasPaginaCaptura.map((numero) => {
                const respuesta = respuestasTrabajoPorNumero.get(numero);
                const opcion = respuesta?.estadoRespuesta === 'sin_marca' ? '__BLANCO__' : respuesta?.opcion ?? '';
                const correcta = normalizarOpcion(claveCorrectaPorNumero[numero]);
                const revisada = respuesta?.estadoRespuesta === 'respondida' || respuesta?.estadoRespuesta === 'sin_marca';
                const esCorrecta = Boolean(opcion && correcta && opcion === correcta);
                const estado = !revisada ? 'Pendiente de revisar' : esCorrecta ? 'Correcta' : 'Incorrecta';
                const claseEstado = !revisada ? 'warning' : esCorrecta ? 'ok' : 'error';
                return (
                  <li className={`omr-answer-row omr-answer-row--${claseEstado}`} key={`manual-${numero}`}>
                    <div className="omr-answer-row__question"><strong>Pregunta {numero}</strong></div>
                    <label className="omr-answer-row__choice">
                      <span className="omr-answer-row__label">Marca observada</span>
                      <select
                        aria-label={`Marca observada en la captura, pregunta ${numero}`}
                        value={opcion}
                        onChange={(event) => {
                          const seleccion = event.target.value;
                          onActualizarRespuestaManual?.(
                            numero,
                            seleccion === '' ? undefined : seleccion === '__BLANCO__' ? null : seleccion
                          );
                        }}
                      >
                        <option value="">Pendiente de revisar</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                        <option value="E">E</option>
                        <option value="__BLANCO__">En blanco</option>
                      </select>
                    </label>
                    <div className="omr-answer-row__choice omr-answer-row__key"><span className="omr-answer-row__label">Clave correcta</span><strong>{correcta ?? 'Sin clave'}</strong></div>
                    <div className="omr-answer-row__status"><span className="omr-answer-row__label">Resultado del cotejo</span><span className={`badge ${claseEstado}`} aria-live="polite">{estado}</span></div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      )}
      {modoManual && (
        <fieldset className="item-glass omr-bonus-confirmation">
          <legend>Revisión del bono · primera página</legend>
          <p className="omr-review-card__hint">Revisa la página 1 de la captura. El bono solo se agrega si aparece escrito literalmente “+0.25”.</p>
          {paginasCapturaManual.some((pagina) => pagina.numeroPagina === 1) && (
            <button type="button" className="omr-image-reset" onClick={() => setPaginaCapturaActiva(1)}>Mostrar página 1</button>
          )}
          <label className="omr-bonus-confirmation__choice">
            <input type="radio" name={`bono-visible-${examenId ?? 'examen'}`} checked={bonoVisibleConfirmado === true} onChange={() => setBonoVisibleConfirmado(true)} />
            Sí, aparece “+0.25”
          </label>
          <label className="omr-bonus-confirmation__choice">
            <input type="radio" name={`bono-visible-${examenId ?? 'examen'}`} checked={bonoVisibleConfirmado === false} onChange={() => setBonoVisibleConfirmado(false)} />
            No aparece
          </label>
          {bonoVisibleConfirmado === null && <InlineMensaje tipo="warning">Confirma el área de calificaciones para habilitar el guardado.</InlineMensaje>}
        </fieldset>
      )}
      <div className="item-meta calif-grade-card__stats">
        <span>Respuestas listas: {respuestasSeguras.length}</span>
        <span>
          Aciertos: {aciertosMostrados}/{totalMostrado}
        </span>
        <span>{bonoPendiente ? 'Nota base (bono OCR pendiente)' : 'Calificación final'}: {notaFinalProyectada.toFixed(2)} / 5.00</span>
        {esExtraordinario && totalMostrado > 0 ? (
          <>
            <span>Equivalente: {notaEquivalenteSobre10.toFixed(2)} / 10.00</span>
            <span>{esAprobatoriaExtraordinario ? 'Aprobatoria' : 'No aprobatoria'}</span>
          </>
        ) : null}
        {soloLectura && resumenPersistido?.origen ? <span>Origen: {resumenPersistido.origen}</span> : null}
      </div>
      {resultadoOmr && (
        <div className="item-meta">
          <span className={`badge ${estadoOmrClase}`}>
            OMR: {estadoOmrTexto}
          </span>
          <span>Calidad {Math.round(resultadoOmr.calidadPagina * 100)}%</span>
          <span>Confianza {Math.round(resultadoOmr.confianzaPromedioPagina * 100)}%</span>
          <span>Ambiguas {(resultadoOmr.ratioAmbiguas * 100).toFixed(1)}%</span>
        </div>
      )}
      {resultadoOmr?.resumenRespuestas?.examenVacio ? (
        <InlineMensaje tipo="warning">
          Examen vacío confirmado: no se detectaron respuestas marcadas en {resultadoOmr.resumenRespuestas.totalReactivos} reactivos.
        </InlineMensaje>
      ) : null}
      {resultadoOmr?.resumenRespuestas && !resultadoOmr.resumenRespuestas.examenVacio && (
        resultadoOmr.resumenRespuestas.reactivosSinMarca > 0 ||
        resultadoOmr.resumenRespuestas.reactivosAmbiguos > 0 ||
        resultadoOmr.resumenRespuestas.reactivosInvalidos > 0
      ) ? (
        <InlineMensaje tipo="warning">
          Revisión sugerida: {resultadoOmr.resumenRespuestas.reactivosSinMarca} sin marca, {resultadoOmr.resumenRespuestas.reactivosAmbiguos} ambiguos y {resultadoOmr.resumenRespuestas.reactivosInvalidos} inválidos.
        </InlineMensaje>
      ) : null}
      <InlineMensaje tipo="info">
        {modoManual
          ? 'EvaluaPro guardará tus respuestas por reactivo junto con la captura original. Revisa la primera página y confirma si aparece +0.25; el resultado final no supera 5.00.'
          : 'La calificación se calcula automáticamente a partir de resultados OMR confirmados. EvaluaPro solo agrega +0.25 si el OCR local confirma ese texto en el área de calificaciones; la captura del examen por sí sola no concede bono. El resultado final nunca supera 5.00.'}
      </InlineMensaje>
      {bloqueoPorSoloLectura ? (
        <InlineMensaje tipo="info">Examen calificado cargado en modo solo lectura.</InlineMensaje>
      ) : null}
      {requiereRevisionConfirmacion && (
        <InlineMensaje tipo="warning">Debes confirmar la revisión OMR para habilitar el cálculo y guardado de la calificación.</InlineMensaje>
      )}
      {modoManual && !revisionManualCompleta && (
        <InlineMensaje tipo="warning">Revisa cada pregunta: selecciona A–E o confirma explícitamente «En blanco». Las pendientes no se califican.</InlineMensaje>
      )}
      {modoManual && bonoVisibleConfirmado === null && (
        <InlineMensaje tipo="warning">Revisa visualmente la primera página y confirma si aparece +0.25; sin esa decisión no se guarda la nota.</InlineMensaje>
      )}
      {modoManual && !capturasManualesCompletas && (
        <InlineMensaje tipo="error">Calificación bloqueada: falta una captura original, el vínculo de alguna pregunta con su página o el QR analizado del examen.</InlineMensaje>
      )}
      {resultadoOmr && respuestasOmrSinResolver.length > 0 && (
        <InlineMensaje tipo="warning">
          Calificación bloqueada: resuelve visualmente {respuestasOmrSinResolver.length} pregunta(s) pendiente(s) o con marca ambigua, doble o tachada antes de confirmar.
        </InlineMensaje>
      )}
      {bloqueoPorSeleccionIncompleta ? (
        <InlineMensaje tipo="warning">Calificación bloqueada: selecciona primero examen y alumno.</InlineMensaje>
      ) : null}
      {!bloqueoPorSeleccionIncompleta && bloqueoPorClaveIncompleta && (
        <InlineMensaje tipo="error">
          {reactivosOficiales.length === 0
            ? 'Calificación bloqueada: el examen no tiene clave oficial disponible.'
            : `Calificación bloqueada: faltan claves correctas en ${reactivosSinClave.length} reactivo(s) (${reactivosSinClave.slice(0, 8).join(', ')}${reactivosSinClave.length > 8 ? ', …' : ''}).`}
        </InlineMensaje>
      )}
      <Boton
        type="button"
        icono={<Icono nombre="calificar" />}
        cargando={guardando}
        disabled={!puedeCalificarLocal || bloqueoCalificar || bloqueoPorSoloLectura}
        onClick={calificar}
      >
        {guardando ? 'Guardando…' : bloqueoPorSoloLectura ? 'Calificación registrada (solo lectura)' : 'Guardar calificación'}
      </Boton>
      {mensaje && (
        <InlineMensaje tipo={esMensajeError(mensaje) ? 'error' : 'ok'}>{mensaje}</InlineMensaje>
      )}
      <details className="colapsable">
        <summary>Ayuda para calificar</summary>
        <ul className="lista nota">
          <li>La nota final se recalcula en el servidor sobre 5.00; el bono de +0.25 requiere detección OCR confirmada en el examen.</li>
          <li>
            Si el estado es <code>requiere_revision</code>, confirma la revisión manual antes de guardar.
          </li>
        </ul>
      </details>
    </div>
  );
}
