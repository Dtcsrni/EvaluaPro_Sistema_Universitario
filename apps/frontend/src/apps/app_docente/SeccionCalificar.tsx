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
  respuestasDetectadas: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
  claveCorrectaPorNumero: Record<number, string>;
  ordenPreguntasClave: number[];
  contextoManual?: string | null;
  etiquetaTipoExamen?: string | null;
  soloLectura?: boolean;
  resumenPersistido?: {
    aciertos: number;
    totalReactivos: number;
    calificacionFinalSobre5: number;
  };
  onCalificar: (payload: {
    examenGeneradoId: string;
    alumnoId?: string | null;
    aciertos?: number;
    totalReactivos?: number;
    bonoSolicitado?: number;
    retroalimentacion?: string;
    respuestasDetectadas?: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
    omrAnalisis?: {
      estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
      calidadPagina: number;
      confianzaPromedioPagina: number;
      ratioAmbiguas: number;
      templateVersionDetectada: 1 | 3 | 4;
      motivosRevision: string[];
      revisionConfirmada: boolean;
      qrTexto?: string;
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
  const [bono, setBono] = useState(0);
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

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
          confianza: Number.isFinite(Number(item?.confianza)) ? Number(item?.confianza) : 0
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
  const bonusBloqueadoPorMaximo = resumenDinamico.notaExamenSobre5 >= 5;
  useEffect(() => {
    if (!bonusBloqueadoPorMaximo) return;
    if (bonusActivo) setBonusActivo(false);
    if (bono !== 0) setBono(0);
  }, [bonusActivo, bono, bonusBloqueadoPorMaximo]);
  const notaFinalSobre5 = useMemo(() => {
    const bonusAplicado = bonusActivo && !bonusBloqueadoPorMaximo ? Math.max(0, Math.min(0.5, Number(bono))) : 0;
    const final = Math.min(5, resumenDinamico.notaExamenSobre5 + bonusAplicado);
    return Number(final.toFixed(2));
  }, [bonusActivo, bono, bonusBloqueadoPorMaximo, resumenDinamico.notaExamenSobre5]);
  const aciertosMostrados = soloLectura && resumenPersistido ? Number(resumenPersistido.aciertos || 0) : resumenDinamico.aciertos;
  const totalMostrado = soloLectura && resumenPersistido ? Number(resumenPersistido.totalReactivos || 0) : resumenDinamico.total;
  const notaFinalMostrada = soloLectura && resumenPersistido
    ? Number(Number(resumenPersistido.calificacionFinalSobre5 || 0).toFixed(2))
    : notaFinalSobre5;

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
  const puedeCalificarLocal =
    !bloqueoPorSeleccionIncompleta &&
    !requiereRevisionConfirmacion &&
    !bloqueoPorSoloLectura &&
    !bloqueoPorClaveIncompleta;
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
        bonoSolicitado: bonusActivo ? bono : 0,
        respuestasDetectadas: respuestasTrabajo,
        omrAnalisis: resultadoOmr
          ? {
              estadoAnalisis: resultadoOmr.estadoAnalisis,
              calidadPagina: resultadoOmr.calidadPagina,
              confianzaPromedioPagina: resultadoOmr.confianzaPromedioPagina,
              ratioAmbiguas: resultadoOmr.ratioAmbiguas,
              templateVersionDetectada: resultadoOmr.templateVersionDetectada,
              motivosRevision: Array.isArray(resultadoOmr.motivosRevision) ? resultadoOmr.motivosRevision : [],
              revisionConfirmada: revisionOmrConfirmada,
              qrTexto: typeof resultadoOmr.qrTexto === 'string' ? resultadoOmr.qrTexto : undefined
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
      <h2>
        <Icono nombre="calificar" /> Calificar examen{etiquetaTipoExamen ? ` · ${etiquetaTipoExamen}` : ''}
      </h2>
      <div className="item-sub">Examen: {examenEtiqueta ?? examenId ?? 'Sin examen'}</div>
      <div className="item-sub">Alumno: {alumnoNombre ?? alumnoId ?? 'Sin alumno'}</div>
      {contextoManual && <InlineMensaje tipo="info">{contextoManual}</InlineMensaje>}
      <div className="item-meta">
        <span>Respuestas listas: {respuestasSeguras.length}</span>
        <span>
          Aciertos: {aciertosMostrados}/{totalMostrado}
        </span>
        <span>Calificación final: {notaFinalMostrada.toFixed(2)} / 5.00</span>
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
      <InlineMensaje tipo="info">La calificación se calcula automáticamente a partir de resultados OMR confirmados.</InlineMensaje>
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
        <label className="campo">
          <span>Bonus</span>
          <input
            type="checkbox"
            checked={bonusActivo}
            onChange={(event) => {
              const activo = event.target.checked;
              setBonusActivo(activo);
              if (!activo) setBono(0);
            }}
            disabled={bloqueoCalificar || bloqueoPorSoloLectura || bonusBloqueadoPorMaximo}
          />
        </label>
        <label className="campo">
          Bono (max 0.5)
          <input
            type="number"
            step="0.1"
            min={0}
            max={0.5}
            value={bono}
            onChange={(event) => setBono(Math.max(0, Math.min(0.5, Number(event.target.value))))}
            disabled={bloqueoCalificar || !bonusActivo || bloqueoPorSoloLectura || bonusBloqueadoPorMaximo}
          />
        </label>
      </div>
      {bonusBloqueadoPorMaximo ? (
        <InlineMensaje tipo="info">Bonus deshabilitado: la calificación del examen ya es 5.00.</InlineMensaje>
      ) : null}
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
        <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">
          {mensaje}
        </p>
      )}
      <details className="colapsable">
        <summary>Ayuda para calificar</summary>
        <ul className="lista nota">
          <li>La calificación final se recalcula automáticamente sobre 5.00 e incluye bonus si está activo.</li>
          <li>
            Si el estado es <code>requiere_revision</code>, confirma la revisión manual antes de guardar.
          </li>
        </ul>
      </details>
    </div>
  );
}
