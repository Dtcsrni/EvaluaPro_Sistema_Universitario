/** Shell principal docente: sesion, permisos, carga base y composicion de secciones. */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { guardarTokenDocente, limpiarTokenDocente, obtenerIdEquipoSincronizacion } from '../../servicios_api/clienteApi';
import { emitToast } from '../../ui/toast/toastBus';
import { Spinner } from '../../ui/iconos';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { clienteApi } from './clienteApiDocente';
import { ShellDocente } from './ShellDocente';
import { NavegacionDocente } from './NavegacionDocente';
import { RecordatorioPaseLista } from './RecordatorioPaseLista';
import { SeccionAutenticacion } from './SeccionAutenticacion';
import { SeccionAlumnos } from './SeccionAlumnos';
import { SeccionPeriodos, SeccionPeriodosArchivados } from './SeccionPeriodos';
import type { EstadoLeaseUI } from './SeccionLeaseSincronizacion';
import { usePermisosDocente } from './hooks/usePermisosDocente';
import { useSesionDocente } from './hooks/useSesionDocente';
import { useRecordatorioPaseLista } from './hooks/useRecordatorioPaseLista';
import { useOmrWorkflowState } from './hooks/useOmrWorkflowState';
import { useRecursosAcademicosDocente } from './hooks/useRecursosAcademicosDocente';
import { usePlantillasPreviewState } from './hooks/usePlantillasPreviewState';
import { registrarAccionDocente } from './telemetriaDocente';
import { registrarEventoTrazabilidadAutenticacion } from './trazaAutenticacion';
import { guardarTabPlantillas } from './features/plantillas/tabPlantillasState';
import type {
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
  normalizarRespuestasDetectadas,
  serializarRespuestasDetectadasOmr,
  mensajeDeError
} from './utilidades';

const SeccionBanco = lazy(() => import('./SeccionBanco').then(({ SeccionBanco: modulo }) => ({ default: modulo })));
const SeccionCuenta = lazy(() => import('./SeccionCuenta').then(({ SeccionCuenta: modulo }) => ({ default: modulo })));
const SeccionEntrega = lazy(() => import('./SeccionEntregaInterna').then(({ SeccionEntrega: modulo }) => ({ default: modulo })));
const SeccionCalificaciones = lazy(() => import('./SeccionCalificaciones').then(({ SeccionCalificaciones: modulo }) => ({ default: modulo })));
const SeccionRehidratacionLotes = lazy(() => import('./SeccionRehidratacionLotes').then(({ SeccionRehidratacionLotes: modulo }) => ({ default: modulo })));
const SeccionEvaluaciones = lazy(() => import('./SeccionEvaluaciones').then(({ SeccionEvaluaciones: modulo }) => ({ default: modulo })));
const SeccionClassroom = lazy(() => import('./SeccionClassroomSync').then(({ SeccionClassroom: modulo }) => ({ default: modulo })));
const SeccionAsistencias = lazy(() => import('./SeccionAsistencias').then(({ SeccionAsistencias: modulo }) => ({ default: modulo })));
const SeccionTemarios = lazy(() => import('./SeccionTemarios').then(({ SeccionTemarios: modulo }) => ({ default: modulo })));
const SeccionPlantillas = lazy(() => import('./SeccionPlantillas').then(({ SeccionPlantillas: modulo }) => ({ default: modulo })));
const SeccionSincronizacion = lazy(() => import('./SeccionSincronizacion').then(({ SeccionSincronizacion: modulo }) => ({ default: modulo })));
export function AppDocente({ googleClientId, onReintentarGoogle }: { googleClientId?: string; onReintentarGoogle?: () => Promise<boolean> } = {}) {
  const montadoRef = useRef(true);
  const recargarCapacidadesRef = useRef<(() => Promise<boolean>) | null>(null);
  const solicitudSolicitudesRef = useRef(0);
  const docenteSolicitudesRef = useRef('');
  const solicitudesCargadasRef = useRef(false);
  const [docente, setDocente] = useState<Docente | null>(null);
  const [estadoLease, setEstadoLease] = useState<EstadoLeaseUI | null>(null);
  const [errorConsultaLease, setErrorConsultaLease] = useState(false);
  const [capacidadesIntegraciones, setCapacidadesIntegraciones] = useState<{
    oauthGoogleBackend: boolean;
    oauthGoogleDesktopBackend: boolean;
    snapshotGoogleDisponible: boolean;
    classroomBackend: boolean;
    smtpBackend: boolean;
    requireGoogleOAuth: boolean;
    passwordLoginAllowed: boolean;
    primerUso?: boolean;
    requiereRegistroInicial?: boolean;
  } | null>(null);
  const [errorConsultaCapacidades, setErrorConsultaCapacidades] = useState(false);
  const [vista, setVista] = useState(obtenerVistaInicial());
  const [estadoCargaSolicitudes, setEstadoCargaSolicitudes] = useState<'inactivo' | 'cargando' | 'error' | 'listo'>('inactivo');
  const [solicitudesCargadas, setSolicitudesCargadas] = useState(false);
  const [errorCargaSolicitudes, setErrorCargaSolicitudes] = useState('');
  const [destinoAlumnos, setDestinoAlumnos] = useState<{ periodoId: string; grupo?: string } | null>(null);
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
    periodos,
    periodosArchivados,
    plantillas,
    setPlantillas,
    preguntas,
    cargandoBanco,
    errorCargaBanco,
    refrescarPreguntas,
    cargandoDatos,
    cargandoAlumnos,
    errorCargaAlumnos,
    cargandoMaterias,
    errorMaterias,
    errorMateriasArchivadas,
    ultimaActualizacionDatos,
    refrescarAlumnos,
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
  useEffect(() => {
    if (itemsVista.length === 0) return;
    const vistaBase = vista === 'periodos_archivados' ? 'periodos' : vista;
    if (!itemsVista.some((item) => item.id === vistaBase)) {
      setVista(itemsVista[0].id);
    }
  }, [itemsVista, vista]);
  const { sesionComprobada } = useSesionDocente({ setDocente, onCerrarSesion: cerrarSesion, montadoRef });
  const equipoIdSincronizacion = obtenerIdEquipoSincronizacion();
  const docenteIdSincronizacion = docente?.id;
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);
  useEffect(() => {
    let activo = true;
    const fallback = {
      oauthGoogleBackend: false,
      oauthGoogleDesktopBackend: false,
      snapshotGoogleDisponible: false,
      classroomBackend: false,
      smtpBackend: false,
      requireGoogleOAuth: false,
      passwordLoginAllowed: true,
      primerUso: true,
      requiereRegistroInicial: true
    };

    const cargarCapacidades = async (intento = 0): Promise<boolean> => {
      try {
        const respuesta = await clienteApi.obtener<{
          capacidadesIntegraciones?: {
            oauthGoogleBackend?: boolean;
            oauthGoogleDesktopBackend?: boolean;
            snapshotGoogleDisponible?: boolean;
            classroomBackend?: boolean;
            smtpBackend?: boolean;
            requireGoogleOAuth?: boolean;
            passwordLoginAllowed?: boolean;
            primerUso?: boolean;
            requiereRegistroInicial?: boolean;
          };
        }>('/autenticacion/capacidades-integraciones');
        if (!activo) return false;
        const caps = respuesta?.capacidadesIntegraciones;
        setErrorConsultaCapacidades(false);
        setCapacidadesIntegraciones({
          oauthGoogleBackend: Boolean(caps?.oauthGoogleBackend),
          oauthGoogleDesktopBackend: Boolean(caps?.oauthGoogleDesktopBackend),
          snapshotGoogleDisponible: Boolean(caps?.snapshotGoogleDisponible),
          classroomBackend: Boolean(caps?.classroomBackend),
          smtpBackend: Boolean(caps?.smtpBackend),
          requireGoogleOAuth: Boolean(caps?.requireGoogleOAuth),
          passwordLoginAllowed: caps?.passwordLoginAllowed !== false,
          primerUso: Boolean(caps?.primerUso),
          requiereRegistroInicial: Boolean(caps?.requiereRegistroInicial)
        });
        return Boolean(caps?.oauthGoogleBackend || caps?.oauthGoogleDesktopBackend);
      } catch {
        if (!activo) return false;
        if (intento < 5) {
          const esperaMs = Math.min(500 * (intento + 1), 2500);
          await new Promise((resolve) => window.setTimeout(resolve, esperaMs));
          return cargarCapacidades(intento + 1);
        }
        setErrorConsultaCapacidades(true);
        setCapacidadesIntegraciones(fallback);
        return false;
      }
    };

    recargarCapacidadesRef.current = () => cargarCapacidades();
    void cargarCapacidades();
    return () => {
      activo = false;
      recargarCapacidadesRef.current = null;
    };
  }, []);
  const reintentarGoogle = useCallback(async () => {
    const [clientId, capacidades] = await Promise.allSettled([
      onReintentarGoogle?.() ?? Promise.resolve(false),
      recargarCapacidadesRef.current?.() ?? Promise.resolve(false)
    ]);
    return (clientId.status === 'fulfilled' && clientId.value) ||
      (capacidades.status === 'fulfilled' && capacidades.value);
  }, [onReintentarGoogle]);
  useEffect(() => {
    if (!docenteIdSincronizacion || !sesionComprobada) {
      setEstadoLease(null);
      setErrorConsultaLease(false);
      return;
    }
    let activo = true;
    setEstadoLease(null);
    setErrorConsultaLease(false);
    const sincronizarEstado = async () => {
      try {
        const estado = await clienteApi.obtener<EstadoLeaseUI>('/sincronizaciones/local/lease');
        if (!activo) return;
        if (!estado.configurado) {
          setEstadoLease(estado);
          return;
        }
        try {
          const adquirido = await clienteApi.enviar<{ lease: EstadoLeaseUI['lease']; ttlMs: number }>('/sincronizaciones/local/lease/adquirir', { equipoId: equipoIdSincronizacion });
          if (activo) setEstadoLease({ ...estado, modo: 'escritura', ttlMs: adquirido.ttlMs, lease: adquirido.lease });
        } catch {
          const actualizado = await clienteApi.obtener<EstadoLeaseUI>('/sincronizaciones/local/lease');
          if (activo) setEstadoLease(actualizado);
        }
      } catch {
        if (activo) {
          setEstadoLease(null);
          setErrorConsultaLease(true);
        }
      }
    };
    void sincronizarEstado();
    return () => { activo = false; };
  }, [docenteIdSincronizacion, equipoIdSincronizacion, sesionComprobada]);

  async function reintentarConsultaLease(): Promise<boolean> {
    try {
      const estado = await clienteApi.obtener<EstadoLeaseUI>('/sincronizaciones/local/lease');
      setEstadoLease(estado);
      setErrorConsultaLease(false);
      return true;
    } catch {
      setErrorConsultaLease(true);
      return false;
    }
  }
  useEffect(() => {
    const leaseId = estadoLease?.lease?.leaseId;
    const leasePropio = estadoLease?.lease?.propio;
    if (!estadoLease?.configurado || estadoLease.modo !== 'escritura' || !leasePropio || !leaseId) return;
    const intervalo = window.setInterval(async () => {
      try {
        const respuesta = await clienteApi.enviar<{ lease: EstadoLeaseUI['lease']; ttlMs: number }>('/sincronizaciones/local/lease/renovar', { equipoId: equipoIdSincronizacion, leaseId });
        setEstadoLease((actual) => actual ? { ...actual, modo: 'escritura', ttlMs: respuesta.ttlMs, lease: respuesta.lease } : actual);
      } catch {
        try { setEstadoLease(await clienteApi.obtener<EstadoLeaseUI>('/sincronizaciones/local/lease')); } catch { /* el backend bloqueará escrituras si se pierde el lease */ }
      }
    }, Math.max(10_000, Math.floor(estadoLease.ttlMs / 3)));
    return () => window.clearInterval(intervalo);
  }, [estadoLease?.configurado, estadoLease?.modo, estadoLease?.lease?.propio, estadoLease?.lease?.leaseId, estadoLease?.ttlMs, equipoIdSincronizacion]);

  const googleFrontendConfigurado = Boolean(String(googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim());
  // Mientras se consulta el contrato de capacidades, conserva visible Google
  // si el build trae Client ID. Ocultarlo durante esa ventana provocaba que la
  // pantalla pareciera no soportarlo al arrancar la instalación local.
  // La visibilidad del proveedor no debe depender de una respuesta de backend:
  // si el runtime perdió GOOGLE_OAUTH_CLIENT_ID, el usuario debe ver Google y
  // recibir un diagnóstico accionable, no una regresión silenciosa del botón.
  const oauthGoogleDisponible = googleFrontendConfigurado;
  const oauthGoogleBackendDisponible = capacidadesIntegraciones === null
    ? undefined
    : Boolean(capacidadesIntegraciones.oauthGoogleBackend);
  const oauthGoogleDesktopDisponible = Boolean(capacidadesIntegraciones?.oauthGoogleDesktopBackend);
  // `undefined` means the backend capability contract has not resolved yet.
  // Keep actions gated, but let the Classroom section distinguish loading from
  // a confirmed unavailable integration.
  const classroomDisponible = capacidadesIntegraciones === null
    ? undefined
    : Boolean(capacidadesIntegraciones.classroomBackend);
  const smtpDisponible = Boolean(capacidadesIntegraciones?.smtpBackend);
  const snapshotGoogleDisponible = Boolean(capacidadesIntegraciones?.snapshotGoogleDisponible);
  const requireGoogleOAuth = Boolean(capacidadesIntegraciones?.requireGoogleOAuth);
  const passwordLoginAllowed = capacidadesIntegraciones?.passwordLoginAllowed !== false;
  const cargarSolicitudesRevision = useCallback(async (sincronizacionCompletada = false) => {
    if (!docente || !permisosUI.calificaciones.calificar) return;
    const solicitudId = ++solicitudSolicitudesRef.current;
    setEstadoCargaSolicitudes('cargando');
    setErrorCargaSolicitudes('');
    try {
      const respuesta = await clienteApi.obtener<{ solicitudes: SolicitudRevisionAlumno[] }>('/calificaciones/revision/solicitudes');
      if (solicitudId !== solicitudSolicitudesRef.current) return;
      setSolicitudesRevision(Array.isArray(respuesta.solicitudes) ? respuesta.solicitudes : []);
      solicitudesCargadasRef.current = true;
      setSolicitudesCargadas(true);
      setEstadoCargaSolicitudes('listo');
    } catch (error) {
      if (solicitudId !== solicitudSolicitudesRef.current) return;
      const mensaje = mensajeDeError(error, 'No se pudieron cargar las solicitudes de revisión.');
      setErrorCargaSolicitudes(solicitudesCargadasRef.current
        ? sincronizacionCompletada
          ? 'Solicitudes sincronizadas, pero no se pudo actualizar la lista. Se conserva la última lista cargada.'
          : 'No se pudieron actualizar las solicitudes. Se conserva la última lista cargada.'
        : sincronizacionCompletada
          ? 'Solicitudes sincronizadas, pero no se pudo cargar la lista. Reintenta la lectura.'
          : mensaje);
      setEstadoCargaSolicitudes(solicitudesCargadasRef.current ? 'listo' : 'error');
      throw error;
    }
  }, [docente, permisosUI.calificaciones.calificar, setSolicitudesRevision]);

  useEffect(() => {
    if (!docente || vista !== 'calificaciones' || !permisosUI.calificaciones.calificar) {
      solicitudSolicitudesRef.current += 1;
      if (!docente) {
        docenteSolicitudesRef.current = '';
        solicitudesCargadasRef.current = false;
        setSolicitudesRevision([]);
        setSolicitudesCargadas(false);
        setErrorCargaSolicitudes('');
      }
      setEstadoCargaSolicitudes('inactivo');
      return;
    }

    const docenteId = String(docente.id ?? '').trim();
    if (docenteSolicitudesRef.current !== docenteId) {
      docenteSolicitudesRef.current = docenteId;
      solicitudesCargadasRef.current = false;
      setSolicitudesRevision([]);
      setSolicitudesCargadas(false);
      setErrorCargaSolicitudes('');
    }
    void cargarSolicitudesRevision().catch(() => undefined);
    return () => { solicitudSolicitudesRef.current += 1; };
  }, [cargarSolicitudesRevision, docente, permisosUI.calificaciones.calificar, setSolicitudesRevision, vista]);

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

  async function adquirirLeaseDocente(estadoBase: EstadoLeaseUI | null = estadoLease): Promise<EstadoLeaseUI> {
    const respuesta = await clienteApi.enviar<{ lease: EstadoLeaseUI['lease']; ttlMs: number }>('/sincronizaciones/local/lease/adquirir', { equipoId: equipoIdSincronizacion });
    const siguiente: EstadoLeaseUI = { configurado: true, directorio: estadoBase?.directorio, origen: estadoBase?.origen, proveedor: 'carpeta-sincronizada', ttlMs: respuesta.ttlMs, modo: 'escritura', lease: respuesta.lease, snapshot: estadoBase?.snapshot };
    setEstadoLease(siguiente);
    return siguiente;
  }

  async function configurarCarpetaSincronizacionDocente(directorio: string): Promise<EstadoLeaseUI> {
    const respuesta = await clienteApi.enviar<EstadoLeaseUI>('/sincronizaciones/local/configuracion/carpeta', { directorio });
    setEstadoLease(respuesta);
    if (respuesta.configurado) {
      try {
        return await adquirirLeaseDocente(respuesta);
      } catch {
        try {
          const actualizado = await clienteApi.obtener<EstadoLeaseUI>('/sincronizaciones/local/lease');
          setEstadoLease(actualizado);
          return actualizado;
        } catch {
          // La carpeta ya quedó guardada; el estado se actualizará al recargar.
        }
      }
    }
    return respuesta;
  }

  function exigirLeaseDocente() {
    const lease = estadoLease?.lease;
    if (!lease || estadoLease?.modo !== 'escritura') throw new Error('SYNC_LEASE_REQUERIDO');
    return lease;
  }

  async function liberarLeaseDocente() {
    const lease = exigirLeaseDocente();
    const respuesta = await clienteApi.enviar('/sincronizaciones/local/lease/liberar', { equipoId: equipoIdSincronizacion, leaseId: lease.leaseId });
    setEstadoLease((actual) => actual ? { ...actual, modo: 'disponible', lease: undefined } : actual);
    return respuesta;
  }

  async function publicarNubeDocente(payload: { metodo: 'contrasena' | 'google'; credencial?: string }) {
    const lease = exigirLeaseDocente();
    const resultado = await clienteApi.enviar<{ checksumSha256?: string; conteos?: { baseDatosBytes: number; archivos: number; archivosBytes: number }; mensaje?: string; leaseLiberado?: boolean }>('/sincronizaciones/local/nube/publicar', { ...payload, equipoId: equipoIdSincronizacion, leaseId: lease.leaseId });
    if (resultado.leaseLiberado === false) {
      setEstadoLease(await clienteApi.obtener<EstadoLeaseUI>('/sincronizaciones/local/lease'));
    } else {
      setEstadoLease((actual) => actual ? { ...actual, modo: 'disponible', lease: undefined } : actual);
    }
    return resultado;
  }

  async function importarNubeDocente(payload: { metodo: 'contrasena' | 'google'; credencial?: string; dryRun: boolean }) {
    const lease = exigirLeaseDocente();
    const resultado = await clienteApi.enviar<{ checksumSha256?: string; conteos?: { baseDatosBytes: number; archivos: number; archivosBytes: number }; mensaje?: string; requiereReinicioSesion?: boolean }>('/sincronizaciones/local/nube/importar', { ...payload, equipoId: equipoIdSincronizacion, leaseId: lease.leaseId });
    if (!payload.dryRun) setEstadoLease((actual) => actual ? { ...actual, modo: 'disponible', lease: undefined } : actual);
    return resultado;
  }

  if (!sesionComprobada) {
    return (
      <div className="panel auth-session-check" role="status" aria-live="polite">
        <InlineMensaje tipo="info" leading={<Spinner />}>
          Verificando sesión guardada…
        </InlineMensaje>
      </div>
    );
  }

  if (!docente) {
    return (
      <SeccionAutenticacion
        oauthGoogleDisponible={oauthGoogleDisponible}
        oauthGoogleBackendDisponible={oauthGoogleBackendDisponible}
        oauthGoogleDesktopDisponible={oauthGoogleDesktopDisponible}
        oauthGoogleConsultando={capacidadesIntegraciones === null}
        oauthGoogleConsultaFallida={errorConsultaCapacidades}
        onReintentarGoogle={reintentarGoogle}
        smtpDisponible={smtpDisponible}
        requireGoogleOAuth={requireGoogleOAuth}
        passwordLoginAllowed={passwordLoginAllowed}
        primerUso={capacidadesIntegraciones?.primerUso}
        onIngresar={(token, persistente = true, flowId) => {
          const sesionGuardada = guardarTokenDocente(token, persistente);
          if (flowId) {
            registrarEventoTrazabilidadAutenticacion({
              flowId,
              canal: 'sesion',
              etapa: 'token_guardado',
              resultado: sesionGuardada ? 'exito' : 'error',
              ...(sesionGuardada ? {} : { codigo: 'TOKEN_STORAGE_FAILED' })
            });
          }
          if (!sesionGuardada) {
            emitToast({
              level: 'error',
              title: 'Sesion no guardada',
              message: 'No se pudo guardar la sesión en este equipo. Revisa el almacenamiento del navegador.',
              durationMs: 5200
            });
            return;
          }
          void clienteApi
            .obtener<{ docente: Docente }>('/autenticacion/perfil')
            .then((payload) => {
              if (flowId) registrarEventoTrazabilidadAutenticacion({ flowId, canal: 'sesion', etapa: 'perfil_validado', resultado: 'exito' });
              setDocente(payload.docente);
            })
            .catch(() => {
              if (flowId) registrarEventoTrazabilidadAutenticacion({ flowId, canal: 'sesion', etapa: 'perfil_rechazado', resultado: 'error', codigo: 'PROFILE_VALIDATION_FAILED' });
              emitToast({
                level: 'error',
                title: 'Sesion no validada',
                message: 'La sesión se guardó, pero no se pudo validar el perfil con la API.',
                durationMs: 5200
              });
            });
        }}
      />
    );
  }

  const contenido = (
    <Suspense fallback={<div className="panel app-loading" role="status" aria-live="polite">Cargando módulo…</div>}>
      <div className="panel">
      <NavegacionDocente items={itemsVista} vista={vista} onCambiarVista={setVista} />
      <div id="contenido-principal" className="shell-docente__main-col" tabIndex={-1}>
      {cargandoDatos && (
        <div className="panel" aria-live="polite">
          <InlineMensaje tipo="info" leading={<Spinner />}>
            Cargando datos…
          </InlineMensaje>
        </div>
      )}
      {estadoLease?.configurado && estadoLease.modo === 'solo_lectura' && (
        <div className="panel" role="status">
          <InlineMensaje tipo="warning">Otro equipo está trabajando con esta cuenta. Esta instalación permanece en solo lectura hasta que el control expire o sea liberado.</InlineMensaje>
        </div>
      )}
      <RecordatorioPaseLista
        mostrar={Boolean(recordatorioPaseLista)}
        enAsistencias={vista === 'asistencias'}
        onPasarLista={() => { cerrarRecordatorioPaseLista(); setVista('asistencias'); }}
        onCerrar={cerrarRecordatorioPaseLista}
      />
      {vista === 'banco' && (
        <div className="anim-fade-in">
          <SeccionBanco
            preguntas={preguntas}
            cargandoPreguntas={cargandoBanco}
            errorCargaPreguntas={errorCargaBanco}
            onReintentarCargaPreguntas={() => void refrescarPreguntas().catch(() => undefined)}
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
              return refrescarPreguntas();
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
            alumnos={alumnos}
            cargandoMaterias={cargandoMaterias}
            errorMaterias={errorMaterias}
            onRefrescar={refrescarMaterias}
            onVerArchivadas={() => setVista('periodos_archivados')}
            onAbrirGrupo={(periodoId, grupo) => {
              setDestinoAlumnos({ periodoId, grupo });
              setVista('alumnos');
            }}
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
            cargando={cargandoMaterias}
            errorCarga={errorMateriasArchivadas}
            onReintentar={refrescarMaterias}
            onVerActivas={() => setVista('periodos')}
          />
        </div>
      )}
      {vista === 'alumnos' && (
        <div className="anim-fade-in">
          <SeccionAlumnos
            alumnos={alumnos}
            cargandoAlumnos={cargandoAlumnos}
            errorCargaAlumnos={errorCargaAlumnos}
            onReintentarCargaAlumnos={() => { void refrescarAlumnos(); }}
            cargandoMaterias={cargandoMaterias}
            errorMaterias={errorMaterias}
            onReintentarMaterias={() => { void refrescarMaterias(); }}
            periodosActivos={periodos}
            periodosTodos={[...periodos, ...periodosArchivados]}
            destinoInicial={destinoAlumnos}
            permisos={permisosUI}
            puedeEliminarAlumnoDev={puedeEliminarAlumnoDev}
            enviarConPermiso={enviarConPermiso}
            avisarSinPermiso={avisarSinPermiso}
            onRefrescar={() => {
              if (!permisosUI.alumnos.leer) {
                avisarSinPermiso('No tienes permiso para ver alumnos.');
                return Promise.reject(new Error('SIN_PERMISO'));
              }
              return refrescarAlumnos();
            }}
          />
        </div>
      )}
      {vista === 'asistencias' && (
        <div className="anim-fade-in">
          <SeccionAsistencias
            periodos={periodos}
            alumnos={alumnos}
            puedeGestionar={permisosUI.asistencias.gestionar}
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
            periodosArchivados={periodosArchivados}
            preguntas={preguntas}
            permisos={permisosUI}
            preferenciasPdf={docente.preferenciasPdf}
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
          periodosArchivados={periodosArchivados}
          alumnos={alumnos}
          cargandoMaterias={cargandoMaterias}
          errorMaterias={errorMaterias}
          onReintentarMaterias={() => { void refrescarMaterias(); }}
          permisos={permisosUI}
          avisarSinPermiso={avisarSinPermiso}
          onAbrirLotesPdfOmr={() => {
            if (!permisosUI.plantillas.leer || !permisosUI.omr.analizar) {
              avisarSinPermiso('No tienes permiso para procesar lotes PDF OMR.');
              return;
            }
            guardarTabPlantillas('historial');
            setVista('plantillas');
          }}
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
              ...(respuestasDetectadas.length > 0
                ? { respuestasDetectadas: serializarRespuestasDetectadasOmr(respuestasDetectadas) }
                : {}),
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
              soloPreview?: boolean;
              omitirBonoAcordeon?: boolean;
              confirmarBonoAcordeonManual?: boolean;
              evaluacionContinua?: number;
              proyecto?: number;
              retroalimentacion?: string;
              respuestasDetectadas?: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
              omrAnalisis?: {
                estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
                calidadPagina: number;
                confianzaPromedioPagina?: number;
                ratioAmbiguas?: number;
                templateVersionDetectada?: 4;
                motivosRevision?: string[];
                revisionConfirmada?: boolean;
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
              paginasOmr?: Array<{ numeroPagina: number; imagenBase64: string }>;
            } = {
              examenGeneradoId: String(payload.examenGeneradoId)
            };
            if (typeof payload.alumnoId === 'string' && payload.alumnoId.trim()) payloadCalificacion.alumnoId = payload.alumnoId.trim();
            if (Number.isFinite(Number(payload.aciertos))) payloadCalificacion.aciertos = Number(payload.aciertos);
            if (Number.isFinite(Number(payload.totalReactivos))) payloadCalificacion.totalReactivos = Number(payload.totalReactivos);
            if (Number.isFinite(Number(payload.bonoSolicitado))) payloadCalificacion.bonoSolicitado = Number(payload.bonoSolicitado);
            if (payload.soloPreview) payloadCalificacion.soloPreview = true;
            if (typeof payload.omitirBonoAcordeon === 'boolean') payloadCalificacion.omitirBonoAcordeon = payload.omitirBonoAcordeon;
            if (typeof payload.confirmarBonoAcordeonManual === 'boolean') payloadCalificacion.confirmarBonoAcordeonManual = payload.confirmarBonoAcordeonManual;
            if (Number.isFinite(Number(payload.evaluacionContinua))) payloadCalificacion.evaluacionContinua = Number(payload.evaluacionContinua);
            if (Number.isFinite(Number(payload.proyecto))) payloadCalificacion.proyecto = Number(payload.proyecto);
            if (typeof payload.retroalimentacion === 'string') payloadCalificacion.retroalimentacion = payload.retroalimentacion;
            const respuestasDetectadasNormalizadas = normalizarRespuestasDetectadas(payload.respuestasDetectadas);
            if (respuestasDetectadasNormalizadas.length > 0) {
              payloadCalificacion.respuestasDetectadas = serializarRespuestasDetectadasOmr(respuestasDetectadasNormalizadas);
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
                      : undefined,
                  resumenRespuestas: payload.omrAnalisis.resumenRespuestas
                };
              }
            }
            if (paginasOmr.length > 0) payloadCalificacion.paginasOmr = paginasOmr;
            const respuesta = await clienteApi.enviar('/calificaciones/calificar', payloadCalificacion);
            if (!payload.soloPreview) {
              setMarcaActualizacionCalificados(Date.now());
              limpiarColaEscaneosOmr();
            }
            return respuesta;
          }}
          solicitudesRevision={solicitudesRevision}
          estadoCargaSolicitudesRevision={estadoCargaSolicitudes}
          solicitudesRevisionCargadas={solicitudesCargadas}
          errorCargaSolicitudesRevision={errorCargaSolicitudes}
          onReintentarCargaSolicitudesRevision={() => { void cargarSolicitudesRevision().catch(() => undefined); }}
          onSincronizarSolicitudesRevision={async () => {
            if (!permisosUI.calificaciones.calificar) {
              avisarSinPermiso('No tienes permiso para revisar solicitudes.');
              throw new Error('SIN_PERMISO');
            }
            await clienteApi.enviar('/calificaciones/revision/solicitudes/sincronizar', {});
            try {
              await cargarSolicitudesRevision(true);
              return 'actualizada' as const;
            } catch {
              return 'lista_no_actualizada' as const;
            }
          }}
          onResolverSolicitudRevision={async (id, estado, respuestaDocente) => {
            if (!permisosUI.calificaciones.calificar) {
              avisarSinPermiso('No tienes permiso para resolver solicitudes.');
              throw new Error('SIN_PERMISO');
            }
            const resultado = await clienteApi.enviar<{ solicitud?: SolicitudRevisionAlumno }>(`/calificaciones/revision/solicitudes/${encodeURIComponent(id)}/resolver`, {
              estado,
              ...(respuestaDocente ? { respuestaDocente } : {})
            });
            if (resultado.solicitud) {
              setSolicitudesRevision((actuales) => actuales.map((solicitud) =>
                solicitud._id === id ? { ...solicitud, ...resultado.solicitud } : solicitud
              ));
            }
            try {
              await cargarSolicitudesRevision();
            } catch {
              // La resolución ya fue confirmada; el estado y aviso de lectura se gestionan por separado.
            }
            return resultado;
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
            cargandoPeriodos={cargandoMaterias}
            errorPeriodos={errorMaterias}
            onReintentarPeriodos={() => void refrescarMaterias()}
          />
        </div>
      )}
      {vista === 'classroom' && (
        <div className="anim-fade-in">
          <SeccionClassroom
            puedeClassroomConectar={permisosUI.classroom.conectar}
            puedeClassroomPull={permisosUI.classroom.pull}
            puedeConsultarCalificaciones={itemsVista.some((item) => item.id === 'calificaciones')}
            classroomDisponible={classroomDisponible}
            onAbrirCalificaciones={() => setVista('calificaciones')}
          />
        </div>
      )}
      {vista === 'publicar' && (
        <div className="anim-fade-in">
          <SeccionSincronizacion
          periodos={periodos}
          cargandoMaterias={cargandoMaterias}
          errorMaterias={errorMaterias}
          puedeLeerMaterias={permisosUI.periodos.leer}
          onReintentarMaterias={refrescarMaterias}
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
            return clienteApi.enviar<{ codigoAccesoId: string; codigo: string; expiraEn: string }>('/sincronizaciones/codigo-acceso', { periodoId });
          }}
          onListarCodigos={(periodoId) => {
            const query = new URLSearchParams({ periodoId });
            return clienteApi.obtener<{ codigosAcceso: Array<{ id: string; periodoId: string; expiraEn: string; usado: boolean; estado: 'vigente' | 'expirado' | 'usado'; periodo?: { id: string; nombre: string } }> }>(`/sincronizaciones/codigo-acceso?${query}`);
          }}
          onExpirarCodigo={(codigoAccesoId) => {
            if (!permisosUI.publicar.publicar) {
              avisarSinPermiso('No tienes permiso para expirar códigos de acceso.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar<{ codigoAccesoId: string; expirado: boolean }>(`/sincronizaciones/codigo-acceso/${encodeURIComponent(codigoAccesoId)}/expirar`, {});
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
          onExportarLocal={async (payload) => {
            if (!permisosUI.sincronizacion.exportar) {
              avisarSinPermiso('No tienes permiso para exportar una instantánea local.');
              throw new Error('SIN_PERMISO');
            }
            const respuesta = await clienteApi.enviarBinario(
              '/sincronizaciones/local/exportar',
              new TextEncoder().encode(JSON.stringify(payload)),
              { contentType: 'application/json', timeoutMs: 180_000 }
            );
            const conteosRaw = respuesta.headers.get('X-EvaluaPro-Snapshot-Counts') || '{}';
            let conteos = { baseDatosBytes: 0, archivos: 0, archivosBytes: 0 };
            try { conteos = { ...conteos, ...(JSON.parse(conteosRaw) as Partial<typeof conteos>) }; } catch { /* el backend ya validó el archivo; solo se omite el resumen */ }
            const nombreHeader = respuesta.headers.get('Content-Disposition') || '';
            const nombre = /filename="([^"]+)"/i.exec(nombreHeader)?.[1] || `evaluapro_${new Date().toISOString().replace(/[:.]/g, '-')}.ep-snapshot`;
            return {
              archivo: await respuesta.blob(),
              nombreArchivo: nombre,
              checksumSha256: respuesta.headers.get('X-EvaluaPro-Snapshot-Checksum') || '',
              exportadoEn: respuesta.headers.get('X-EvaluaPro-Snapshot-Exported-At') || new Date().toISOString(),
              conteos
            };
          }}
          onImportarLocal={async ({ cuerpo }) => {
            if (!permisosUI.sincronizacion.importar) {
              avisarSinPermiso('No tienes permiso para importar una instantánea local.');
              throw new Error('SIN_PERMISO');
            }
            const respuesta = await clienteApi.enviarBinario('/sincronizaciones/local/importar', cuerpo, {
              contentType: 'application/vnd.evaluapro.snapshot',
              timeoutMs: 180_000
            });
            return respuesta.json();
          }}
          estadoLease={estadoLease}
          onAdquirirLease={adquirirLeaseDocente}
          onActualizarEstadoLease={reintentarConsultaLease}
          onLiberarLease={liberarLeaseDocente}
          onPublicarNube={publicarNubeDocente}
          onImportarNube={importarNubeDocente}
          // La política de acceso puede exigir Google, pero una cuenta que ya
          // tiene contraseña puede usarla como segunda credencial para el
          // cifrado local 1:1 después de autenticarse.
          puedeUsarContrasena={Boolean(docente?.tieneContrasena)}
          puedeUsarGoogle={snapshotGoogleDisponible}
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
            estadoLease={estadoLease}
            errorConsultaLease={errorConsultaLease}
            onReintentarConsultaLease={reintentarConsultaLease}
            onConfigurarCarpeta={configurarCarpetaSincronizacionDocente}
          />
        </div>
      )}
      </div>
      </div>
    </Suspense>
  );

  return <ShellDocente docente={docente} onCerrarSesion={cerrarSesion} onAbrirCuenta={() => setVista('cuenta')}>{contenido}</ShellDocente>;
}
