/** Shell principal docente: sesion, permisos, carga base y composicion de secciones. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { guardarTokenDocente, limpiarTokenDocente } from '../../servicios_api/clienteApi';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono, Spinner } from '../../ui/iconos';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { clienteApi } from './clienteApiDocente';
import { ShellDocente } from './ShellDocente';
import { SeccionAutenticacion } from './SeccionAutenticacion';
import { SeccionAlumnos } from './SeccionAlumnos';
import { SeccionBanco } from './SeccionBanco';
import { SeccionCuenta } from './SeccionCuenta';
import { SeccionPlantillas } from './SeccionPlantillas';
import { SeccionPeriodos, SeccionPeriodosArchivados } from './SeccionPeriodos';
import { SeccionEntrega } from './SeccionEntregaInterna';
import { SeccionCalificaciones } from './SeccionCalificaciones';
import { SeccionRehidratacionLotes } from './SeccionRehidratacionLotes';
import { SeccionSincronizacion } from './SeccionSincronizacion';
import { SeccionEvaluaciones } from './SeccionEvaluaciones';
import { SeccionAsistencias } from './SeccionAsistencias';
import { SeccionTemarios } from './SeccionTemarios';
import { usePermisosDocente } from './hooks/usePermisosDocente';
import { useSesionDocente } from './hooks/useSesionDocente';
import { useRecordatorioPaseLista } from './hooks/useRecordatorioPaseLista';
import { useOmrWorkflowState } from './hooks/useOmrWorkflowState';
import { useRecursosAcademicosDocente } from './hooks/useRecursosAcademicosDocente';
import { usePlantillasPreviewState } from './hooks/usePlantillasPreviewState';
import { registrarAccionDocente } from './telemetriaDocente';
import type {
  Alumno,
  Docente,
  ExamenGeneradoClave,
  Plantilla,
  Pregunta,
  PreviewCalificacion,
  RespuestaSyncPull,
  RespuestaSyncPush,
  ResultadoAnalisisOmr,
  RevisionPaginaOmr,
  SolicitudRevisionAlumno
} from './tipos';
import {
  combinarRespuestasOmrPaginas,
  construirClaveCorrectaExamen,
  normalizarResultadoOmr,
  normalizarTemplateVersionOmrDetectada,
  obtenerVistaInicial,
  normalizarRespuestasDetectadas
} from './utilidades';
export function AppDocente() {
  const montadoRef = useRef(true);
  const [docente, setDocente] = useState<Docente | null>(null);
  const [capacidadesIntegraciones, setCapacidadesIntegraciones] = useState<{
    oauthGoogleBackend: boolean;
    classroomBackend: boolean;
    smtpBackend: boolean;
    requireGoogleOAuth: boolean;
    passwordLoginAllowed: boolean;
    primerUso?: boolean;
    requiereRegistroInicial?: boolean;
  } | null>(null);
  const [vista, setVista] = useState(obtenerVistaInicial());
  const {
    puede,
    permisosUI,
    itemsVista,
    esAdmin,
    esDev,
    puedeEliminarMateriaDev,
    puedeEliminarAlumnoDev
  } = usePermisosDocente(docente);
  const avisarSinPermiso = useCallback((mensaje: string) => {
    emitToast({ level: 'warn', title: 'Sin permisos', message: mensaje, durationMs: 4200 });
  }, []);
  const enviarConPermiso = useCallback(
    <T,>(
      permiso: string,
      ruta: string,
      payload: unknown,
      mensaje: string,
      opciones?: { timeoutMs?: number }
    ): Promise<T> => {
      if (!puede(permiso)) {
        avisarSinPermiso(mensaje);
        return Promise.reject(new Error('SIN_PERMISO'));
      }
      return clienteApi.enviar(ruta, payload, opciones);
    },
    [avisarSinPermiso, puede]
  );
  const {
    alumnos,
    setAlumnos,
    periodos,
    periodosArchivados,
    plantillas,
    setPlantillas,
    preguntas,
    setPreguntas,
    cargandoDatos,
    ultimaActualizacionDatos,
    refrescarMaterias,
    refrescarDatos
  } = useRecursosAcademicosDocente({
    docente,
    permisosUI,
    montadoRef
  });
  const {
    previewPorPlantillaId,
    setPreviewPorPlantillaId,
    cargandoPreviewPlantillaId,
    setCargandoPreviewPlantillaId,
    plantillaPreviewId,
    setPlantillaPreviewId,
    previewPdfUrlPorPlantillaId,
    setPreviewPdfUrlPorPlantillaId,
    cargandoPreviewPdfPlantillaId,
    setCargandoPreviewPdfPlantillaId,
    paginasEstimadasBackendPorTema
  } = usePlantillasPreviewState(plantillas);
  const {
    resultadoOmr,
    setResultadoOmr,
    respuestasEditadas,
    setRespuestasEditadas,
    borradoresRespuestasOmr,
    setBorradoresRespuestasOmr,
    revisionOmrConfirmada,
    setRevisionOmrConfirmada,
    examenIdOmr,
    setExamenIdOmr,
    examenAlumnoId,
    setExamenAlumnoId,
    paginaOmrActiva,
    setPaginaOmrActiva,
    revisionesOmr,
    setRevisionesOmr,
    solicitudesRevision,
    setSolicitudesRevision,
    marcaActualizacionCalificados,
    setMarcaActualizacionCalificados,
    claveCorrectaOmrActiva,
    ordenPreguntasClaveOmrActiva,
    respuestasCombinadasRevisionOmrActiva,
    respuestasParaCalificarOmrActiva,
    resultadoParaCalificarOmrActiva,
    ordenPreguntasCalificarOmrActiva,
    claveCorrectaCalificarOmrActiva,
    hayCambiosPendientesOmrActiva,
    llaveBorradorOmr,
    seleccionarRevisionOmr,
    cargarRevisionHistoricaCalificada,
    actualizarRespuestasOmrActivas,
    actualizarRespuestaPreguntaOmrActiva,
    confirmarRevisionOmrActiva
  } = useOmrWorkflowState();
  const { recordatorioPaseLista, cerrarRecordatorioPaseLista } = useRecordatorioPaseLista({
    docente,
    permisosUI,
    periodos
  });

  function cerrarSesion() {
    void clienteApi.enviar('/autenticacion/salir', {});
    limpiarTokenDocente();
    setDocente(null);
    emitToast({ level: 'info', title: 'Sesion', message: 'Sesion cerrada', durationMs: 2200 });
    registrarAccionDocente('logout', true);
  }
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    if (itemsVista.length === 0) return;
    const vistaBase = vista === 'periodos_archivados' ? 'periodos' : vista;
    if (!itemsVista.some((item) => item.id === vistaBase)) {
      setVista(itemsVista[0].id);
    }
  }, [itemsVista, vista]);
  useSesionDocente({ setDocente, onCerrarSesion: cerrarSesion, montadoRef });
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);
  useEffect(() => {
    void clienteApi
      .obtener<{
        capacidadesIntegraciones?: {
          oauthGoogleBackend?: boolean;
          classroomBackend?: boolean;
          smtpBackend?: boolean;
          requireGoogleOAuth?: boolean;
          passwordLoginAllowed?: boolean;
          primerUso?: boolean;
          requiereRegistroInicial?: boolean;
        };
      }>('/autenticacion/capacidades-integraciones')
      .then((respuesta) => {
        const caps = respuesta?.capacidadesIntegraciones;
        setCapacidadesIntegraciones({
          oauthGoogleBackend: Boolean(caps?.oauthGoogleBackend),
          classroomBackend: Boolean(caps?.classroomBackend),
          smtpBackend: Boolean(caps?.smtpBackend),
          requireGoogleOAuth: Boolean(caps?.requireGoogleOAuth),
          passwordLoginAllowed: caps?.passwordLoginAllowed !== false,
          primerUso: Boolean(caps?.primerUso),
          requiereRegistroInicial: Boolean(caps?.requiereRegistroInicial)
        });
      })
      .catch(() => {
        setCapacidadesIntegraciones({
          oauthGoogleBackend: false,
          classroomBackend: false,
          smtpBackend: false,
          requireGoogleOAuth: false,
          passwordLoginAllowed: true,
          primerUso: true,
          requiereRegistroInicial: true
        });
      });
  }, []);

  const oauthGoogleDisponible =
    Boolean(String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()) && Boolean(capacidadesIntegraciones?.oauthGoogleBackend);
  const classroomDisponible = Boolean(capacidadesIntegraciones?.classroomBackend);
  const smtpDisponible = Boolean(capacidadesIntegraciones?.smtpBackend);
  const requireGoogleOAuth = Boolean(capacidadesIntegraciones?.requireGoogleOAuth);
  const passwordLoginAllowed = capacidadesIntegraciones?.passwordLoginAllowed !== false;
  useEffect(() => {
    if (!docente || vista !== 'calificaciones' || !permisosUI.calificaciones.calificar) return;
    void clienteApi
      .obtener<{ solicitudes: SolicitudRevisionAlumno[] }>('/calificaciones/revision/solicitudes')
      .then((respuesta) => {
        setSolicitudesRevision(Array.isArray(respuesta.solicitudes) ? respuesta.solicitudes : []);
      })
      .catch(() => {
        setSolicitudesRevision([]);
      });
  }, [docente, permisosUI.calificaciones.calificar, setSolicitudesRevision, vista]);

  const limpiarColaEscaneosOmr = useCallback(() => {
    const habiaElementos = revisionesOmr.length > 0 || Boolean(resultadoOmr);
    setRevisionesOmr([]);
    setBorradoresRespuestasOmr({});
    setResultadoOmr(null);
    setRespuestasEditadas([]);
    setRevisionOmrConfirmada(false);
    setExamenIdOmr(null);
    setExamenAlumnoId(null);
    if (habiaElementos) {
      emitToast({ level: 'info', title: 'Escaneo OMR', message: 'Cola de escaneos limpiada', durationMs: 2600 });
    }
  }, [
    revisionesOmr.length,
    resultadoOmr,
    setBorradoresRespuestasOmr,
    setExamenAlumnoId,
    setExamenIdOmr,
    setRespuestasEditadas,
    setResultadoOmr,
    setRevisionOmrConfirmada,
    setRevisionesOmr
  ]);

  if (!docente) {
    return (
      <SeccionAutenticacion
        oauthGoogleDisponible={oauthGoogleDisponible}
        smtpDisponible={smtpDisponible}
        requireGoogleOAuth={requireGoogleOAuth}
        passwordLoginAllowed={passwordLoginAllowed}
        primerUso={capacidadesIntegraciones?.primerUso}
        onIngresar={(token) => {
          guardarTokenDocente(token);
          clienteApi
            .obtener<{ docente: Docente }>('/autenticacion/perfil')
            .then((payload) => setDocente(payload.docente));
        }}
      />
    );
  }

  const contenido = (
    <div className="panel">
      <nav
        className="tabs tabs--scroll tabs--sticky"
        aria-label="Secciones del portal docente"
      >
        {itemsVista.map((item, idx) => (
          (() => {
            const activa = vista === item.id || (vista === 'periodos_archivados' && item.id === 'periodos');
            return (
          <button
            key={item.id}
            ref={(el) => {
              tabsRef.current[idx] = el;
            }}
            type="button"
            className={activa ? 'tab activa' : 'tab'}
            aria-current={activa ? 'page' : undefined}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
                return;
              }
              event.preventDefault();
              const ultimo = itemsVista.length - 1;
              let idxNuevo = idx;
              if (event.key === 'ArrowLeft') idxNuevo = Math.max(0, idx - 1);
              if (event.key === 'ArrowRight') idxNuevo = Math.min(ultimo, idx + 1);
              if (event.key === 'Home') idxNuevo = 0;
              if (event.key === 'End') idxNuevo = ultimo;
              const nuevoId = itemsVista[idxNuevo]?.id;
              if (!nuevoId) return;
              setVista(nuevoId);
              requestAnimationFrame(() => tabsRef.current[idxNuevo]?.focus());
            }}
            onClick={() => setVista(item.id)}
          >
            <Icono nombre={item.icono} />
            {item.label}
          </button>
            );
          })()
        ))}
      </nav>
      {cargandoDatos && (
        <div className="panel" aria-live="polite">
          <InlineMensaje tipo="info" leading={<Spinner />}>
            Cargando datos…
          </InlineMensaje>
        </div>
      )}
      {/* ── Banner recordatorio pase de lista ── */}
      {recordatorioPaseLista && (
        <div
          role="alert"
          aria-live="polite"
          className="banner-recordatorio-asistencia anim-fade-in"
        >
          <span className="banner-recordatorio-asistencia__icon pulse-glow">🗓️</span>
          <span className="banner-recordatorio-asistencia__text">
            <strong>Recordatorio de Asistencia:</strong> Aún no has registrado el pase de lista de hoy.
          </span>
          <button
            onClick={() => { cerrarRecordatorioPaseLista(); setVista('asistencias'); }}
            className="asistencias-btn-primario pulse-glow"
          >
            Pasar lista
          </button>
          <button
            onClick={cerrarRecordatorioPaseLista}
            aria-label="Cerrar recordatorio"
            className="banner-recordatorio-asistencia__close scale-hover"
          >
            ×
          </button>
        </div>
      )}
      {vista === 'banco' && (
        <div className="anim-fade-in">
          <SeccionBanco
            preguntas={preguntas}
            periodos={periodos}
            permisos={permisosUI}
            enviarConPermiso={enviarConPermiso}
            avisarSinPermiso={avisarSinPermiso}
            paginasEstimadasBackendPorTema={paginasEstimadasBackendPorTema}
            onRefrescar={() => {
              if (!permisosUI.banco.leer) {
                avisarSinPermiso('No tienes permiso para ver el banco.');
                return Promise.reject(new Error('SIN_PERMISO'));
              }
              return clienteApi.obtener<{ preguntas: Pregunta[] }>('/banco-preguntas').then((p) => setPreguntas(p.preguntas));
            }}
            onRefrescarPlantillas={() => {
              if (!permisosUI.plantillas.leer) {
                avisarSinPermiso('No tienes permiso para ver plantillas.');
                return Promise.reject(new Error('SIN_PERMISO'));
              }
              return clienteApi.obtener<{ plantillas: Plantilla[] }>('/examenes/plantillas').then((p) => setPlantillas(p.plantillas));
            }}
          />
        </div>
      )}
      {vista === 'periodos' && (
        <div className="anim-fade-in">
          <SeccionPeriodos
            periodos={periodos}
            onRefrescar={refrescarMaterias}
            onVerArchivadas={() => setVista('periodos_archivados')}
            permisos={permisosUI}
            puedeEliminarMateriaDev={puedeEliminarMateriaDev}
            enviarConPermiso={enviarConPermiso}
            avisarSinPermiso={avisarSinPermiso}
          />
        </div>
      )}
      {vista === 'periodos_archivados' && (
        <div className="anim-fade-in">
          <SeccionPeriodosArchivados
            periodos={periodosArchivados}
            onVerActivas={() => setVista('periodos')}
          />
        </div>
      )}
      {vista === 'alumnos' && (
        <div className="anim-fade-in">
          <SeccionAlumnos
            alumnos={alumnos}
            periodosActivos={periodos}
            periodosTodos={[...periodos, ...periodosArchivados]}
            permisos={permisosUI}
            puedeEliminarAlumnoDev={puedeEliminarAlumnoDev}
            enviarConPermiso={enviarConPermiso}
            avisarSinPermiso={avisarSinPermiso}
            onRefrescar={() => {
              if (!permisosUI.alumnos.leer) {
                avisarSinPermiso('No tienes permiso para ver alumnos.');
                return Promise.reject(new Error('SIN_PERMISO'));
              }
              return clienteApi.obtener<{ alumnos: Alumno[] }>('/alumnos').then((p) => setAlumnos(p.alumnos));
            }}
          />
        </div>
      )}
      {vista === 'asistencias' && (
        <div className="anim-fade-in">
          <SeccionAsistencias
            periodos={periodos}
            alumnos={alumnos}
          />
        </div>
      )}
      {vista === 'temarios' && (
        <div className="anim-fade-in">
          <SeccionTemarios
            periodos={periodos}
          />
        </div>
      )}
      {vista === 'plantillas' && (
        <div className="anim-fade-in">
          <SeccionPlantillas
            plantillas={plantillas}
            periodos={periodos}
            preguntas={preguntas}
            permisos={permisosUI}
            enviarConPermiso={enviarConPermiso}
            avisarSinPermiso={avisarSinPermiso}
            alumnos={alumnos}
            previewPorPlantillaId={previewPorPlantillaId}
            setPreviewPorPlantillaId={setPreviewPorPlantillaId}
            cargandoPreviewPlantillaId={cargandoPreviewPlantillaId}
            setCargandoPreviewPlantillaId={setCargandoPreviewPlantillaId}
            plantillaPreviewId={plantillaPreviewId}
            setPlantillaPreviewId={setPlantillaPreviewId}
            previewPdfUrlPorPlantillaId={previewPdfUrlPorPlantillaId}
            setPreviewPdfUrlPorPlantillaId={setPreviewPdfUrlPorPlantillaId}
            cargandoPreviewPdfPlantillaId={cargandoPreviewPdfPlantillaId}
            setCargandoPreviewPdfPlantillaId={setCargandoPreviewPdfPlantillaId}
            onRefrescar={() => {
              if (!permisosUI.plantillas.leer) {
                avisarSinPermiso('No tienes permiso para ver plantillas.');
                return Promise.reject(new Error('SIN_PERMISO'));
              }
              return clienteApi.obtener<{ plantillas: Plantilla[] }>('/examenes/plantillas').then((p) => setPlantillas(p.plantillas));
            }}
          />
        </div>
      )}
      {vista === 'entrega' && (
        <div className="anim-fade-in">
          <SeccionEntrega
            alumnos={alumnos}
            plantillas={plantillas}
            periodos={periodos}
            permisos={permisosUI}
            avisarSinPermiso={avisarSinPermiso}
            enviarConPermiso={enviarConPermiso}
            onVincular={(folio, alumnoId, opciones) => {
              if (!permisosUI.entregas.gestionar) {
                avisarSinPermiso('No tienes permiso para vincular entregas.');
                return Promise.reject(new Error('SIN_PERMISO'));
              }
              return clienteApi.enviar('/entregas/vincular-folio', {
                folio,
                alumnoId,
                ...(opciones?.acordeonEntregado
                  ? { acordeonEntregado: true, bonoAcordeon: Number(opciones.bonoAcordeon ?? 0.25) }
                  : { acordeonEntregado: false, bonoAcordeon: 0 })
              });
            }}
          />
        </div>
      )}
      {vista === 'calificaciones' && (
        <div className="anim-fade-in">
          <SeccionCalificaciones
          periodos={periodos}
          alumnos={alumnos}
          permisos={permisosUI}
          avisarSinPermiso={avisarSinPermiso}
          onAnalizar={async (folio, numeroPagina, imagenBase64, contexto) => {
            if (!permisosUI.omr.analizar) {
              avisarSinPermiso('No tienes permiso para analizar OMR.');
              throw new Error('SIN_PERMISO');
            }
            const respuesta = await clienteApi.enviar<ResultadoAnalisisOmr>('/omr/analizar', {
              folio,
              numeroPagina,
              imagenBase64
            });
            const resultadoNormalizado = normalizarResultadoOmr(respuesta?.resultado);
            const respuestaNormalizada: ResultadoAnalisisOmr = {
              ...respuesta,
              resultado: resultadoNormalizado
            };
            let claveCorrectaPorNumero: Record<number, string> = {};
            let ordenPreguntas: number[] = [];
            try {
              const examenPayload = await clienteApi.obtener<{ examen?: ExamenGeneradoClave }>(
                `/examenes/generados/folio/${encodeURIComponent(respuesta.folio)}`
              );
              const examenDetalle = examenPayload?.examen;
              let clave = construirClaveCorrectaExamen(examenDetalle, preguntas);
              if (Object.keys(clave.claveCorrectaPorNumero).length === 0 && examenDetalle?.periodoId) {
                const bancoPeriodo = await clienteApi.obtener<{ preguntas: Pregunta[] }>(
                  `/banco-preguntas?periodoId=${encodeURIComponent(String(examenDetalle.periodoId))}`
                );
                clave = construirClaveCorrectaExamen(examenDetalle, Array.isArray(bancoPeriodo?.preguntas) ? bancoPeriodo.preguntas : []);
              }
              claveCorrectaPorNumero = clave.claveCorrectaPorNumero;
              ordenPreguntas = clave.ordenPreguntas;
            } catch {
              claveCorrectaPorNumero = {};
              ordenPreguntas = [];
            }
            const ahora = Date.now();
            let revisionExamenConfirmada = resultadoNormalizado.estadoAnalisis === 'ok';
            let paginaInicioActiva = Number(respuesta.numeroPagina);
            let resultadoPaginaInicio = resultadoNormalizado;
            let respuestasPaginaInicio = resultadoNormalizado.respuestasDetectadas;
            let alumnoIdActivo = respuesta.alumnoId ?? null;
            setRevisionesOmr((prev) => {
              const siguiente = [...prev];
              const indiceExamen = siguiente.findIndex((item) => item.examenId === respuesta.examenId);
              const nuevaPagina: RevisionPaginaOmr = {
                numeroPagina: Number(respuesta.numeroPagina),
                resultado: resultadoNormalizado,
                respuestas: resultadoNormalizado.respuestasDetectadas,
                imagenBase64,
                nombreArchivo: contexto?.nombreArchivo,
                actualizadoEn: ahora
              };
              if (indiceExamen >= 0) {
                const examen = siguiente[indiceExamen];
                const paginaRespuesta = Number(respuesta.numeroPagina);
                const indicePagina = examen.paginas.findIndex((item) => Number(item.numeroPagina) === paginaRespuesta);
                const paginas = [...examen.paginas];
                if (indicePagina >= 0) {
                  paginas[indicePagina] = nuevaPagina;
                } else {
                  paginas.push(nuevaPagina);
                }
                paginas.sort((a, b) => Number(a.numeroPagina) - Number(b.numeroPagina));
                const requiereRevisionPagina = resultadoNormalizado.estadoAnalisis !== 'ok';
                const revisionConfirmada = requiereRevisionPagina ? false : examen.revisionConfirmada;
                revisionExamenConfirmada = revisionConfirmada;
                const paginaActivaActual = Number(paginaOmrActiva);
                const conservarPaginaActiva =
                  examenIdOmr === examen.examenId &&
                  Number.isFinite(paginaActivaActual) &&
                  paginas.some((item) => Number(item.numeroPagina) === paginaActivaActual);
                const paginaInicio = conservarPaginaActiva
                  ? (paginas.find((item) => Number(item.numeroPagina) === paginaActivaActual) ?? nuevaPagina)
                  : (paginas.find((item) => Number(item.numeroPagina) === 1) ?? paginas[0] ?? nuevaPagina);
                paginaInicioActiva = Number(paginaInicio.numeroPagina);
                resultadoPaginaInicio = paginaInicio.resultado;
                respuestasPaginaInicio = paginaInicio.respuestas;
                alumnoIdActivo = respuesta.alumnoId ?? examen.alumnoId ?? null;
                siguiente[indiceExamen] = {
                  ...examen,
                  folio: respuesta.folio || examen.folio,
                  alumnoId: respuesta.alumnoId ?? examen.alumnoId ?? null,
                  paginas,
                  claveCorrectaPorNumero:
                    Object.keys(claveCorrectaPorNumero).length > 0 ? claveCorrectaPorNumero : examen.claveCorrectaPorNumero,
                  ordenPreguntas: ordenPreguntas.length > 0 ? ordenPreguntas : examen.ordenPreguntas,
                  revisionConfirmada,
                  actualizadoEn: ahora
                };
              } else {
                revisionExamenConfirmada = resultadoNormalizado.estadoAnalisis === 'ok';
                paginaInicioActiva = Number(nuevaPagina.numeroPagina);
                resultadoPaginaInicio = nuevaPagina.resultado;
                respuestasPaginaInicio = nuevaPagina.respuestas;
                alumnoIdActivo = respuesta.alumnoId ?? null;
                siguiente.push({
                  examenId: respuesta.examenId,
                  folio: respuesta.folio,
                  alumnoId: respuesta.alumnoId ?? null,
                  paginas: [nuevaPagina],
                  claveCorrectaPorNumero,
                  ordenPreguntas,
                  revisionConfirmada: revisionExamenConfirmada,
                  creadoEn: ahora,
                  actualizadoEn: ahora
                });
              }
              siguiente.sort((a, b) => b.actualizadoEn - a.actualizadoEn);
              return siguiente;
            });
            setResultadoOmr(resultadoPaginaInicio);
            setRespuestasEditadas(respuestasPaginaInicio);
            if (Number.isFinite(Number(paginaInicioActiva))) {
              const llave = llaveBorradorOmr(respuesta.examenId, Number(paginaInicioActiva));
              setBorradoresRespuestasOmr((prev) => {
                if (!(llave in prev)) return prev;
                const siguiente = { ...prev };
                delete siguiente[llave];
                return siguiente;
              });
            }
            setRevisionOmrConfirmada(revisionExamenConfirmada);
            setExamenIdOmr(respuesta.examenId);
            setExamenAlumnoId(alumnoIdActivo);
            setPaginaOmrActiva(paginaInicioActiva);
            return respuestaNormalizada;
          }}
          onPrevisualizar={async (payload) => {
            if (!permisosUI.calificaciones.calificar) {
              avisarSinPermiso('No tienes permiso para calificar.');
              throw new Error('SIN_PERMISO');
            }
            const examenGeneradoId = String(payload.examenGeneradoId ?? '').trim();
            const revisionExamen = revisionesOmr.find((item) => item.examenId === examenGeneradoId);
            const respuestasConsolidadas = revisionExamen
              ? combinarRespuestasOmrPaginas(
                  revisionExamen.paginas.map((pagina) => {
                    const numeroPagina = Number(pagina.numeroPagina);
                    const llave = `${revisionExamen.examenId}::${numeroPagina}`;
                    const borrador = borradoresRespuestasOmr[llave];
                    return {
                      ...pagina,
                      respuestas: Array.isArray(borrador) ? borrador : pagina.respuestas
                    };
                  })
                )
              : [];
            const respuestasDetectadas = normalizarRespuestasDetectadas(
              Array.isArray(respuestasConsolidadas) && respuestasConsolidadas.length > 0
                ? respuestasConsolidadas
                : payload.respuestasDetectadas
            );
            return clienteApi.enviar<{ preview: PreviewCalificacion }>('/calificaciones/calificar', {
              ...payload,
              ...(respuestasDetectadas.length > 0 ? { respuestasDetectadas } : {}),
              soloPreview: true
            });
          }}
          resultado={resultadoOmr}
          onActualizar={actualizarRespuestasOmrActivas}
          onActualizarPregunta={actualizarRespuestaPreguntaOmrActiva}
          respuestasPaginaEditable={respuestasEditadas}
          claveCorrectaPorNumero={claveCorrectaOmrActiva}
          ordenPreguntasClave={ordenPreguntasClaveOmrActiva}
          revisionOmrConfirmada={revisionOmrConfirmada}
          hayCambiosPendientesOmrActiva={hayCambiosPendientesOmrActiva}
          onConfirmarRevisionOmr={confirmarRevisionOmrActiva}
          revisionesOmr={revisionesOmr}
          examenIdActivo={examenIdOmr}
          paginaActiva={paginaOmrActiva}
          onSeleccionarRevision={seleccionarRevisionOmr}
          examenId={examenIdOmr}
          alumnoId={examenAlumnoId}
          marcaActualizacionCalificados={marcaActualizacionCalificados}
          resultadoParaCalificar={resultadoParaCalificarOmrActiva}
          respuestasParaCalificar={respuestasParaCalificarOmrActiva}
          respuestasCombinadasRevision={respuestasCombinadasRevisionOmrActiva}
          claveCorrectaParaCalificar={claveCorrectaCalificarOmrActiva}
          ordenPreguntasParaCalificar={ordenPreguntasCalificarOmrActiva}
          onCalificar={async (payload) => {
            if (!permisosUI.calificaciones.calificar) {
              avisarSinPermiso('No tienes permiso para calificar.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            const examenRevision = revisionesOmr.find((item) => item.examenId === payload.examenGeneradoId);
            const paginasOmr = (Array.isArray(examenRevision?.paginas) ? examenRevision.paginas : [])
              .map((pagina) => {
                const numeroPagina = Number(pagina.numeroPagina);
                const imagenBase64 = String(pagina.imagenBase64 ?? '').trim();
                if (!Number.isInteger(numeroPagina) || numeroPagina <= 0 || !imagenBase64) return null;
                return {
                  numeroPagina,
                  imagenBase64
                };
              })
              .filter(
                (
                  pagina
                ): pagina is {
                  numeroPagina: number;
                  imagenBase64: string;
                } => Boolean(pagina)
              );
            const payloadCalificacion: {
              examenGeneradoId: string;
              alumnoId?: string;
              aciertos?: number;
              totalReactivos?: number;
              bonoSolicitado?: number;
              evaluacionContinua?: number;
              proyecto?: number;
              retroalimentacion?: string;
              respuestasDetectadas?: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
              omrAnalisis?: {
                estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
                calidadPagina: number;
                confianzaPromedioPagina?: number;
                ratioAmbiguas?: number;
                templateVersionDetectada?: 1 | 3 | 4;
                motivosRevision?: string[];
                revisionConfirmada?: boolean;
                qrTexto?: string;
              };
              paginasOmr?: Array<{ numeroPagina: number; imagenBase64: string }>;
            } = {
              examenGeneradoId: String(payload.examenGeneradoId)
            };
            if (typeof payload.alumnoId === 'string' && payload.alumnoId.trim()) payloadCalificacion.alumnoId = payload.alumnoId.trim();
            if (Number.isFinite(Number(payload.aciertos))) payloadCalificacion.aciertos = Number(payload.aciertos);
            if (Number.isFinite(Number(payload.totalReactivos))) payloadCalificacion.totalReactivos = Number(payload.totalReactivos);
            if (Number.isFinite(Number(payload.bonoSolicitado))) payloadCalificacion.bonoSolicitado = Number(payload.bonoSolicitado);
            if (Number.isFinite(Number(payload.evaluacionContinua))) payloadCalificacion.evaluacionContinua = Number(payload.evaluacionContinua);
            if (Number.isFinite(Number(payload.proyecto))) payloadCalificacion.proyecto = Number(payload.proyecto);
            if (typeof payload.retroalimentacion === 'string') payloadCalificacion.retroalimentacion = payload.retroalimentacion;
            const respuestasDetectadasNormalizadas = normalizarRespuestasDetectadas(payload.respuestasDetectadas);
            if (respuestasDetectadasNormalizadas.length > 0) {
              payloadCalificacion.respuestasDetectadas = respuestasDetectadasNormalizadas;
            }
            if (payload.omrAnalisis) {
              const estado = payload.omrAnalisis.estadoAnalisis;
              if (estado === 'ok' || estado === 'rechazado_calidad' || estado === 'requiere_revision') {
                payloadCalificacion.omrAnalisis = {
                  estadoAnalisis: estado,
                  calidadPagina: Number(payload.omrAnalisis.calidadPagina ?? 0),
                  confianzaPromedioPagina: Number(payload.omrAnalisis.confianzaPromedioPagina ?? 0),
                  ratioAmbiguas: Number(payload.omrAnalisis.ratioAmbiguas ?? 0),
                  templateVersionDetectada: normalizarTemplateVersionOmrDetectada(
                    payload.omrAnalisis.templateVersionDetectada
                  ),
                  motivosRevision: Array.isArray(payload.omrAnalisis.motivosRevision)
                    ? payload.omrAnalisis.motivosRevision
                        .map((motivo) => String(motivo ?? '').trim())
                        .filter((motivo) => motivo.length > 0)
                        .slice(0, 50)
                    : [],
                  revisionConfirmada: Boolean(payload.omrAnalisis.revisionConfirmada),
                  qrTexto:
                    typeof payload.omrAnalisis.qrTexto === 'string' && payload.omrAnalisis.qrTexto.trim().length > 0
                      ? payload.omrAnalisis.qrTexto.trim()
                      : undefined
                };
              }
            }
            if (paginasOmr.length > 0) payloadCalificacion.paginasOmr = paginasOmr;
            const respuesta = await clienteApi.enviar('/calificaciones/calificar', payloadCalificacion);
            setMarcaActualizacionCalificados(Date.now());
            limpiarColaEscaneosOmr();
            return respuesta;
          }}
          solicitudesRevision={solicitudesRevision}
          onSincronizarSolicitudesRevision={async () => {
            if (!permisosUI.calificaciones.calificar) {
              avisarSinPermiso('No tienes permiso para revisar solicitudes.');
              throw new Error('SIN_PERMISO');
            }
            await clienteApi.enviar('/calificaciones/revision/solicitudes/sincronizar', {});
            const respuesta = await clienteApi.obtener<{ solicitudes: SolicitudRevisionAlumno[] }>('/calificaciones/revision/solicitudes');
            setSolicitudesRevision(Array.isArray(respuesta.solicitudes) ? respuesta.solicitudes : []);
            return respuesta;
          }}
          onResolverSolicitudRevision={async (id, estado, respuestaDocente) => {
            if (!permisosUI.calificaciones.calificar) {
              avisarSinPermiso('No tienes permiso para resolver solicitudes.');
              throw new Error('SIN_PERMISO');
            }
            await clienteApi.enviar(`/calificaciones/revision/solicitudes/${encodeURIComponent(id)}/resolver`, {
              estado,
              ...(respuestaDocente ? { respuestaDocente } : {})
            });
            const respuesta = await clienteApi.obtener<{ solicitudes: SolicitudRevisionAlumno[] }>('/calificaciones/revision/solicitudes');
            setSolicitudesRevision(Array.isArray(respuesta.solicitudes) ? respuesta.solicitudes : []);
            return respuesta;
          }}
          onLimpiarColaEscaneos={limpiarColaEscaneosOmr}
          onCargarRevisionHistoricaCalificada={cargarRevisionHistoricaCalificada}
        />
        </div>
      )}
      {vista === 'rehidratacion' && (
        <div className="anim-fade-in">
          <SeccionRehidratacionLotes
            docente={docente}
            esAdmin={esAdmin}
            puedeUsar={permisosUI.rehidratacion.usar}
          />
        </div>
      )}
      {vista === 'evaluaciones' && (
        <div className="anim-fade-in">
          <SeccionEvaluaciones
            periodos={periodos}
            alumnos={alumnos}
            puedeGestionar={permisosUI.evaluaciones.gestionar}
            puedeClassroomConectar={permisosUI.classroom.conectar}
            puedeClassroomPull={permisosUI.classroom.pull}
            classroomDisponible={classroomDisponible}
          />
        </div>
      )}
      {vista === 'publicar' && (
        <div className="anim-fade-in">
          <SeccionSincronizacion
          periodos={periodos}
          periodosArchivados={periodosArchivados}
          alumnos={alumnos}
          plantillas={plantillas}
          preguntas={preguntas}
          ultimaActualizacionDatos={ultimaActualizacionDatos}
          docenteCorreo={docente?.correo}
          onPublicar={(periodoId) => {
            if (!permisosUI.publicar.publicar) {
              avisarSinPermiso('No tienes permiso para publicar resultados.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar('/sincronizaciones/publicar', { periodoId });
          }}
          onCodigo={(periodoId) => {
            if (!permisosUI.publicar.publicar) {
              avisarSinPermiso('No tienes permiso para generar codigos.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar<{ codigo?: string; expiraEn?: string }>('/sincronizaciones/codigo-acceso', { periodoId });
          }}
          onExportarPaquete={(payload) => {
            if (!permisosUI.sincronizacion.exportar) {
              avisarSinPermiso('No tienes permiso para exportar.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar<{
              paqueteBase64: string;
              checksumSha256: string;
              checksumGzipSha256?: string;
              cifrado?: boolean;
              exportadoEn: string;
              conteos: Record<string, number>;
            }>('/sincronizaciones/paquete/exportar', payload);
          }}
          onImportarPaquete={(payload) =>
            (async () => {
              if (!permisosUI.sincronizacion.importar) {
                avisarSinPermiso('No tienes permiso para importar.');
                throw new Error('SIN_PERMISO');
              }
              const respuesta = await clienteApi.enviar<
                | { mensaje?: string; resultados?: unknown[]; pdfsGuardados?: number }
                | { mensaje?: string; checksumSha256?: string; conteos?: Record<string, number> }
              >('/sincronizaciones/paquete/importar', payload);
              if (!payload?.dryRun) {
                await refrescarDatos();
              }
              return respuesta;
            })()
          }
          onPushServidor={(payload) => {
            if (!permisosUI.sincronizacion.push) {
              avisarSinPermiso('No tienes permiso para enviar al servidor.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar<RespuestaSyncPush>('/sincronizaciones/push', payload);
          }}
          onPullServidor={(payload) => {
            if (!permisosUI.sincronizacion.pull) {
              avisarSinPermiso('No tienes permiso para traer del servidor.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar<RespuestaSyncPull>('/sincronizaciones/pull', payload);
          }}
        />
        </div>
      )}
      {vista === 'cuenta' && (
        <div className="anim-fade-in">
          <SeccionCuenta
            docente={docente}
            onDocenteActualizado={setDocente}
            esAdmin={esAdmin}
            esDev={esDev}
            oauthGoogleDisponible={oauthGoogleDisponible}
            classroomDisponible={classroomDisponible}
            smtpDisponible={smtpDisponible}
            requireGoogleOAuth={requireGoogleOAuth}
          />
        </div>
      )}
    </div>
  );

  return <ShellDocente docente={docente} onCerrarSesion={cerrarSesion}>{contenido}</ShellDocente>;
}
