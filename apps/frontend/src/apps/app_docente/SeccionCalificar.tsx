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
  claveCorrectaPorNumero,
  ordenPreguntasClave,
  contextoManual,
  capturaManualAciertos = false,
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
  claveCorrectaPorNumero: Record<number, string>;
  ordenPreguntasClave: number[];
  contextoManual?: string | null;
  capturaManualAciertos?: boolean;
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
    soloPreview?: boolean;
    omitirBonoAcordeon?: boolean;
    confirmarBonoAcordeonManual?: boolean;
    retroalimentacion?: string;
    respuestasDetectadas?: RespuestaDetectadaOmr[];
    omrAnalisis?: {
      estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
      calidadPagina: number;
      confianzaPromedioPagina: number;
      ratioAmbiguas: number;
      templateVersionDetectada: 4;
      motivosRevision: string[];
      revisionConfirmada: boolean;
      qrTexto?: string;
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
  const [bonusActivo, setBonusActivo] = useState(false);
  const [previewBono, setPreviewBono] = useState<PreviewCalificacion['bonoGuiaEstudio'] | null>(null);
  const [previewListo, setPreviewListo] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmacionSinRespuestas, setConfirmacionSinRespuestas] = useState(false);
  const [aciertosManualesTexto, setAciertosManualesTexto] = useState('');
  const edicionManualAciertos = Boolean(capturaManualAciertos && !resultadoOmr && !soloLectura);
  const examenVisible = String(examenEtiqueta ?? '').trim() || (examenId ? 'Examen sin folio disponible' : 'Sin examen');
  const alumnoVisible = String(alumnoNombre ?? '').trim() || (alumnoId ? 'Alumno no disponible' : 'Sin alumno');

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
  const aciertosManualesNumero = aciertosManualesTexto.trim() === '' ? null : Number(aciertosManualesTexto);
  const aciertosManualesValidos = Boolean(
    aciertosManualesNumero !== null
      && Number.isInteger(aciertosManualesNumero)
      && aciertosManualesNumero >= 0
      && aciertosManualesNumero <= resumenDinamico.total
  );
  const bloqueoPorAciertosManuales = edicionManualAciertos && !aciertosManualesValidos;
  const errorAciertosManuales = aciertosManualesTexto.trim() !== '' && !aciertosManualesValidos;
  const aciertosParaCalificar = edicionManualAciertos && aciertosManualesValidos
    ? Number(aciertosManualesNumero)
    : resumenDinamico.aciertos;
  const notaBaseParaCalificar = edicionManualAciertos && !aciertosManualesValidos
    ? null
    : Number(((aciertosParaCalificar * 5) / Math.max(1, resumenDinamico.total)).toFixed(2));
  useEffect(() => {
    setAciertosManualesTexto('');
    setConfirmacionSinRespuestas(false);
  }, [capturaManualAciertos, examenId, alumnoId, resumenDinamico.total]);
  const bonusBloqueadoPorMaximo = (notaBaseParaCalificar ?? resumenDinamico.notaExamenSobre5) >= 5;
  useEffect(() => {
    if (!bonusBloqueadoPorMaximo) return;
    if (bonusActivo) setBonusActivo(false);
  }, [bonusActivo, bonusBloqueadoPorMaximo]);
  const notaFinalSobre5 = useMemo(() => {
    const bonusAplicado = bonusActivo && !bonusBloqueadoPorMaximo ? 0.25 : 0;
    const final = Math.min(5, (notaBaseParaCalificar ?? resumenDinamico.notaExamenSobre5) + bonusAplicado);
    return Number(final.toFixed(2));
  }, [bonusActivo, bonusBloqueadoPorMaximo, notaBaseParaCalificar, resumenDinamico.notaExamenSobre5]);
  const aciertosMostrados = soloLectura && resumenPersistido ? Number(resumenPersistido.aciertos || 0) : aciertosParaCalificar;
  const totalMostrado = soloLectura && resumenPersistido ? Number(resumenPersistido.totalReactivos || 0) : resumenDinamico.total;
  const notaFinalMostrada = soloLectura && resumenPersistido
    ? Number(Number(resumenPersistido.calificacionFinalSobre5 || 0).toFixed(2))
    : notaFinalSobre5;
  const notaFinalSobre5Exacta =
    soloLectura && resumenPersistido
      ? Number(resumenPersistido.calificacionFinalSobre5 || 0)
      : Math.min(
          5,
          (resumenDinamico.total > 0 ? (aciertosParaCalificar * 5) / resumenDinamico.total : 0) +
            (bonusActivo && !bonusBloqueadoPorMaximo ? 0.25 : 0)
        );
  const notaEquivalenteSobre10 =
    soloLectura && resumenPersistido?.calificacionEquivalenteSobre10Texto
      ? Number(resumenPersistido.calificacionEquivalenteSobre10Texto)
      : notaFinalSobre5Exacta * 2;
  const esAprobatoriaExtraordinario =
    soloLectura && resumenPersistido?.estadoAprobatorio
      ? resumenPersistido.estadoAprobatorio === 'Aprobatoria'
      : totalMostrado > 0 &&
        20 * aciertosMostrados +
          (bonusActivo && !bonusBloqueadoPorMaximo ? totalMostrado : 0) >
          12 * totalMostrado;
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

  const requiereRevisionConfirmacion = Boolean(resultadoOmr && !revisionOmrConfirmada);
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
  const calificacionCeroManual = Boolean(edicionManualAciertos && aciertosManualesValidos && aciertosManualesNumero === 0);
  const calificacionSinRespuestas = Boolean(
    !resultadoOmr
      && !edicionManualAciertos
      && !bloqueoPorSoloLectura
      && reactivosOficiales.length > 0
      && respuestasTrabajo.every((respuesta) => !respuesta.opcion)
  );
  const firmaActualSinRespuestas = [
    examenId ?? '',
    alumnoId ?? '',
    notaFinalSobre5.toFixed(2),
    respuestasTrabajo.map((respuesta) => `${respuesta.numeroPregunta}:${respuesta.opcion ?? ''}`).join(','),
    aciertosManualesTexto
  ].join('|');
  const firmaCalificacionPreview = [
    examenId ?? '',
    alumnoId ?? '',
    resumenDinamico.total,
    aciertosParaCalificar,
    respuestasTrabajo.map((respuesta) => `${respuesta.numeroPregunta}:${respuesta.opcion ?? ''}`).join(','),
    aciertosManualesTexto
  ].join('|');
  useEffect(() => {
    setPreviewBono(null);
    setPreviewListo(false);
    setBonusActivo(false);
  }, [firmaCalificacionPreview]);
  useEffect(() => setConfirmacionSinRespuestas(false), [firmaActualSinRespuestas]);
  const confirmacionSinRespuestasVigente = confirmacionSinRespuestas;
  const requiereConfirmacionSinRespuestas = (calificacionSinRespuestas || calificacionCeroManual) && !confirmacionSinRespuestasVigente;
  const descripcionBotonGuardar = [
    !puedeCalificar ? 'calificar-permiso-ayuda' : null,
    requiereConfirmacionSinRespuestas ? 'calificacion-sin-respuestas-ayuda' : null,
    bloqueoPorAciertosManuales ? 'calificacion-aciertos-manuales-ayuda' : null,
    errorAciertosManuales ? 'calificacion-aciertos-manuales-error' : null
  ].filter(Boolean).join(' ') || undefined;
  const puedeCalificarLocal =
    !bloqueoPorSeleccionIncompleta &&
    !requiereRevisionConfirmacion &&
    !bloqueoPorSoloLectura &&
    !bloqueoPorClaveIncompleta &&
    !bloqueoPorAciertosManuales &&
    !requiereConfirmacionSinRespuestas;
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
      if (edicionManualAciertos && !aciertosManualesValidos) {
        setMensaje('Registra un número entero de aciertos entre cero y el total de reactivos.');
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
      const payloadBase = {
        examenGeneradoId: examenId,
        alumnoId,
        aciertos: aciertosParaCalificar,
        totalReactivos: resumenDinamico.total,
        ...(resultadoOmr ? { respuestasDetectadas: respuestasTrabajo } : {}),
        omrAnalisis: resultadoOmr
          ? {
              estadoAnalisis: resultadoOmr.estadoAnalisis,
              calidadPagina: resultadoOmr.calidadPagina,
              confianzaPromedioPagina: resultadoOmr.confianzaPromedioPagina,
              ratioAmbiguas: resultadoOmr.ratioAmbiguas,
              templateVersionDetectada: resultadoOmr.templateVersionDetectada,
              motivosRevision: Array.isArray(resultadoOmr.motivosRevision) ? resultadoOmr.motivosRevision : [],
              revisionConfirmada: revisionOmrConfirmada,
              qrTexto: typeof resultadoOmr.qrTexto === 'string' ? resultadoOmr.qrTexto : undefined,
              resumenRespuestas: resultadoOmr.resumenRespuestas
            }
          : undefined
      };
      if (!previewListo) {
        const respuesta = await onCalificar({ ...payloadBase, soloPreview: true });
        const preview = (respuesta as { preview?: PreviewCalificacion } | null)?.preview;
        const bono = preview?.bonoGuiaEstudio ?? null;
        setPreviewBono(bono);
        setPreviewListo(true);
        setBonusActivo(Boolean(bono?.evidencia.estado === 'detectado' && !bonusBloqueadoPorMaximo));
        setMensaje(bono?.evidencia.motivo ?? 'Vista previa lista. No se guardó la calificación.');
        registrarAccionDocente('preview_calificacion', true, Date.now() - inicio);
        return;
      }
      await onCalificar({
        ...payloadBase,
        omitirBonoAcordeon: !bonusActivo,
        confirmarBonoAcordeonManual: bonusActivo && previewBono?.evidencia.estado !== 'detectado'
      });
      setMensaje('Calificación guardada');
      registrarAccionDocente('calificar', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo calificar');
      setMensaje(msg);
      const accionSesion = accionToastSesionParaError(error, 'docente');
      if (accionSesion) {
        emitToast({
          level: 'warn',
          title: 'Renueva tu sesión docente',
          message: 'El detalle está en «Revisión y calificación». Cierra sesión y vuelve a entrar para renovar el acceso.',
          action: accionSesion
        });
      }
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
            <span>Revisión y calificación</span>
          </span>
          <h2 className="entregas-title-heading">
            <Icono nombre="calificar" /> Calificar examen{etiquetaTipoExamen ? ` · ${etiquetaTipoExamen}` : ''}
          </h2>
          <p className="nota">
            {resultadoOmr
              ? 'Consolida resultado OMR, validaciones y ajuste final de calificación en una sola tarjeta de decisión.'
              : edicionManualAciertos
                ? 'Registra los aciertos de la revisión física y revisa la nota antes de guardar.'
                : 'Revisa las respuestas cargadas y el cálculo antes de guardar.'}
          </p>
        </div>
      </div>
      <div className="item-sub">Examen: {examenVisible}</div>
      <div className="item-sub">Alumno: {alumnoVisible}</div>
      {contextoManual && <InlineMensaje tipo="info">{contextoManual}</InlineMensaje>}
      <div className="item-meta calif-grade-card__stats">
        <span>{edicionManualAciertos ? 'Reactivos del examen' : 'Respuestas disponibles'}: {edicionManualAciertos ? reactivosOficiales.length : respuestasSeguras.length}</span>
        <span>
          Aciertos: {edicionManualAciertos && !aciertosManualesValidos ? 'pendiente' : edicionManualAciertos ? aciertosParaCalificar : aciertosMostrados}/{totalMostrado}
        </span>
        <span>Calificación final: {edicionManualAciertos && !aciertosManualesValidos ? 'pendiente' : edicionManualAciertos ? notaFinalSobre5.toFixed(2) : notaFinalMostrada.toFixed(2)} / 5.00</span>
        {esExtraordinario && totalMostrado > 0 && !(edicionManualAciertos && !aciertosManualesValidos) ? (
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
      {edicionManualAciertos && (
        <div className="calif-manual-aciertos">
          <label className="campo" htmlFor="calificacion-aciertos-manuales">
            <span>Aciertos obtenidos</span>
            <input
              id="calificacion-aciertos-manuales"
              type="number"
              inputMode="numeric"
              min={0}
              max={reactivosOficiales.length}
              step={1}
              value={aciertosManualesTexto}
              aria-invalid={errorAciertosManuales || undefined}
              aria-describedby={[
                'calificacion-aciertos-manuales-ayuda',
                errorAciertosManuales ? 'calificacion-aciertos-manuales-error' : null
              ].filter(Boolean).join(' ')}
              onChange={(event) => setAciertosManualesTexto(event.target.value)}
            />
          </label>
          <p id="calificacion-aciertos-manuales-ayuda" className="nota">
            Cuenta los reactivos correctos en la revisión física. La nota se calcula con aciertos ÷ {reactivosOficiales.length} × 5.
          </p>
          {errorAciertosManuales && (
            <p id="calificacion-aciertos-manuales-error" className="mensaje error" role="alert">
              Captura un número entero entre 0 y {reactivosOficiales.length}.
            </p>
          )}
        </div>
      )}
      {(calificacionSinRespuestas || calificacionCeroManual) && (
        <div id="calificacion-sin-respuestas-ayuda">
          <InlineMensaje tipo="warning">
            {calificacionCeroManual
              ? `Registraste 0 aciertos. Se guardará ${notaFinalSobre5.toFixed(2)} / 5.00. Confirma que revisaste el examen.`
              : `No hay respuestas cargadas. Se guardará ${notaFinalSobre5.toFixed(2)} / 5.00. Confirma que ese es el resultado esperado.`}
          </InlineMensaje>
          <label className="campo calif-grade-card__checkbox-field calif-grade-card__checkbox-field--confirm">
            <input
              type="checkbox"
              checked={confirmacionSinRespuestasVigente}
              onChange={(event) => setConfirmacionSinRespuestas(event.target.checked)}
            />
            {calificacionCeroManual ? 'Confirmo guardar 0 aciertos' : 'Confirmo guardar la calificación calculada sin respuestas'}
          </label>
        </div>
      )}
      <InlineMensaje tipo="info">
        {resultadoOmr
          ? 'La calificación se calcula automáticamente a partir de resultados OMR confirmados.'
          : edicionManualAciertos
            ? 'La nota usa los aciertos que registres sobre el total de reactivos.'
            : 'La calificación se calcula según las respuestas cargadas y la clave del examen.'}
      </InlineMensaje>
      {bloqueoPorSoloLectura ? (
        <InlineMensaje tipo="info">Examen calificado cargado en modo solo lectura.</InlineMensaje>
      ) : null}
      {requiereRevisionConfirmacion && (
        <InlineMensaje tipo="warning">Debes confirmar la revisión OMR para habilitar el cálculo y guardado de la calificación.</InlineMensaje>
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
      <div className="calif-grade-grid">
        <label className="campo calif-grade-card__checkbox-field">
          <span>{previewBono?.evidencia.estado === 'detectado' ? 'Marca de guía detectada: aplicar +0.25' : 'Confirmar marca de guía (+0.25)'}</span>
          <input
            type="checkbox"
            checked={bonusActivo}
            onChange={(event) => {
              setBonusActivo(event.target.checked);
            }}
            disabled={bloqueoCalificar || bloqueoPorSoloLectura || bonusBloqueadoPorMaximo || !previewBono?.evidencia.region}
          />
        </label>
      </div>
      {previewBono ? (
        <InlineMensaje tipo={previewBono.evidencia.estado === 'detectado' ? 'ok' : 'warning'}>
          {previewBono.evidencia.motivo} {previewBono.evidencia.confianza !== null ? `Confianza OCR: ${previewBono.evidencia.confianza.toFixed(0)}%.` : ''}
        </InlineMensaje>
      ) : null}
      {previewBono?.evidencia.imagenRegionBase64 ? (
        <figure className="calif-bono-guia-evidencia">
          <img src={previewBono.evidencia.imagenRegionBase64} alt="Recorte OCR de la zona de guía de estudio" />
          <figcaption>Verifica la marca manuscrita antes de confirmar un bono dudoso.</figcaption>
        </figure>
      ) : null}
      {bonusBloqueadoPorMaximo ? (
        <InlineMensaje tipo="info">Bonus deshabilitado: la calificación del examen ya es 5.00.</InlineMensaje>
      ) : null}
      {!puedeCalificar ? (
        <div id="calificar-permiso-ayuda" className="calif-grade-card__permission-help">
          <InlineMensaje tipo="warning">Tu perfil no tiene permiso para guardar esta calificación.</InlineMensaje>
        </div>
      ) : null}
      <Boton
        type="button"
        icono={<Icono nombre="calificar" />}
        cargando={guardando}
        disabled={!puedeCalificarLocal || bloqueoCalificar || bloqueoPorSoloLectura}
        aria-describedby={descripcionBotonGuardar}
        onClick={calificar}
      >
        {guardando ? 'Procesando…' : bloqueoPorSoloLectura ? 'Calificación registrada (solo lectura)' : previewListo ? 'Guardar calificación' : 'Analizar marca y previsualizar'}
      </Boton>
      {mensaje && (
        <InlineMensaje tipo={esMensajeError(mensaje) ? 'error' : 'ok'}>{mensaje}</InlineMensaje>
      )}
      <details className="colapsable">
        <summary>Ayuda para calificar</summary>
        <ul className="lista nota">
          <li>La calificación final se recalcula automáticamente sobre 5.00 e incluye bonus si está activo.</li>
          {edicionManualAciertos ? <li>En la revisión manual registra el total de aciertos, no las opciones de cada reactivo.</li> : null}
          {resultadoOmr ? (
            <li>Si se requiere revisión OMR, confirma las respuestas detectadas antes de guardar.</li>
          ) : null}
        </ul>
      </details>
    </div>
  );
}
