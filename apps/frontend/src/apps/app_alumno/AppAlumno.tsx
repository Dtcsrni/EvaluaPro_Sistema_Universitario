/**
 * App alumno: consulta de resultados en la nube.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  crearClientePortal,
  guardarTokenAlumno,
  limpiarTokenAlumno,
  obtenerTokenAlumno
} from '../../servicios_api/clientePortal';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono, IlustracionSinResultados, Spinner } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { CampoTexto } from '../../ui/ux/componentes/CampoTexto';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { HelperPanel } from '../../ui/ux/componentes/HelperPanel';
import { obtenerSessionId } from '../../ui/ux/sesion';
import { TemaBoton } from '../../tema/TemaBoton';
import { abrirVentanaVersion, obtenerVersionApp } from '../../ui/version/versionInfo';
import {
  accionCerrarSesion,
  accionToastSesionParaError,
  mensajeUsuarioDeErrorConSugerencia,
  onSesionInvalidada
} from '../../servicios_api/clienteComun';

const clientePortal = crearClientePortal();
const basePortal = import.meta.env.VITE_PORTAL_BASE_URL || 'http://localhost:8080/api/portal';

type Resultado = {
  folio: string;
  tipoExamen: string;
  totalReactivos?: number;
  aciertos?: number;
  calificacionExamenFinalTexto: string;
  calificacionParcialTexto?: string;
  calificacionGlobalTexto?: string;
  versionPolitica?: number;
  bloqueContinuaDecimal?: number;
  bloqueExamenesDecimal?: number;
  finalDecimal?: number;
  finalRedondeada?: number;
  respuestasDetectadas?: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
  comparativaRespuestas?: Array<{
    numeroPregunta: number;
    correcta: string | null;
    detectada: string | null;
    coincide: boolean;
    confianza?: number;
  }>;
  omrCapturas?: Array<{
    numeroPagina: number;
    formato: 'jpg' | 'jpeg' | 'png' | 'webp';
    imagenBase64: string;
    calidad?: number;
    sugerencias?: string[];
  }>;
  omrAuditoria?: {
    estadoAnalisis?: 'ok' | 'rechazado_calidad' | 'requiere_revision';
    revisionConfirmada?: boolean;
    calidadPagina?: number;
    confianzaPromedioPagina?: number;
    ratioAmbiguas?: number;
    motivosRevision?: string[];
  };
};

function formatearCalificacion(valor: number, maximumFractionDigits = 4) {
  return new Intl.NumberFormat('es-MX', {
    maximumFractionDigits,
    useGrouping: false
  }).format(valor);
}

type PerfilAlumno = {
  matricula?: string;
  nombreCompleto?: string;
  grupo?: string;
};

type MateriaAlumno = {
  materiaId?: string;
  nombre?: string;
  estado?: string;
};

type AgendaAlumno = {
  agendaId?: string;
  titulo?: string;
  descripcion?: string;
  fecha?: string;
  tipo?: string;
};

type AvisoAlumno = {
  avisoId?: string;
  titulo?: string;
  mensaje?: string;
  severidad?: string;
  publicadoEn?: string;
};

type HistorialAlumno = {
  historialId?: string;
  folio?: string;
  tipoExamen?: string;
  calificacionTexto?: string;
  fecha?: string;
};

type SeccionContexto = 'perfil' | 'materias' | 'agenda' | 'avisos' | 'historial';
type ErroresContexto = Partial<Record<SeccionContexto, string>>;

function mensajeEstadoPdf(status: number): string {
  switch (status) {
    case 401:
      return 'Tu sesión venció. Vuelve a ingresar al portal y solicita el PDF otra vez.';
    case 403:
      return 'No tienes acceso a este PDF. Confirma con tu docente que esté disponible para tu folio.';
    case 404:
      return 'El PDF de este folio no está disponible. Consulta con tu docente.';
    case 429:
      return 'Hay demasiadas solicitudes. Espera un momento y vuelve a intentarlo.';
    default:
      return status >= 500
        ? 'El servicio no pudo entregar el PDF. Inténtalo de nuevo más tarde.'
        : 'No se pudo entregar el PDF. Inténtalo de nuevo o consulta con tu docente.';
  }
}

export function AppAlumno() {
  const version = obtenerVersionApp();
  const [token, setToken] = useState(() => obtenerTokenAlumno());
  const [codigo, setCodigo] = useState('');
  const [mostrarCodigo, setMostrarCodigo] = useState(false);
  const [matricula, setMatricula] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [intentoIngreso, setIntentoIngreso] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [detalleAbiertoFolio, setDetalleAbiertoFolio] = useState<string | null>(null);
  const [detallesPorFolio, setDetallesPorFolio] = useState<Record<string, Resultado>>({});
  const [cargandoDetallePorFolio, setCargandoDetallePorFolio] = useState<Record<string, boolean>>({});
  const [cargandoPdfPorFolio, setCargandoPdfPorFolio] = useState<Record<string, boolean>>({});
  const [pdfListoPorFolio, setPdfListoPorFolio] = useState<Record<string, boolean>>({});
  const [errorDetallePorFolio, setErrorDetallePorFolio] = useState<Record<string, string>>({});
  const [seleccionRevisionPorFolio, setSeleccionRevisionPorFolio] = useState<Record<string, Record<number, boolean>>>({});
  const [comentarioRevisionPorFolio, setComentarioRevisionPorFolio] = useState<Record<string, string>>({});
  const [conformidadPorFolio, setConformidadPorFolio] = useState<Record<string, boolean>>({});
  const [conformidadRegistradaPorFolio, setConformidadRegistradaPorFolio] = useState<Record<string, boolean>>({});
  const [enviandoConformidadPorFolio, setEnviandoConformidadPorFolio] = useState<Record<string, boolean>>({});
  const [intentoRevisionPorFolio, setIntentoRevisionPorFolio] = useState<Record<string, boolean>>({});
  const [enviandoRevisionPorFolio, setEnviandoRevisionPorFolio] = useState<Record<string, boolean>>({});
  const [resultadoRevisionPorFolio, setResultadoRevisionPorFolio] = useState<Record<string, { tipo: 'ok' | 'error'; mensaje: string } | undefined>>({});
  const solicitudesRevisionEnProceso = useRef(new Set<string>());
  const [cargando, setCargando] = useState(false);
  const [perfil, setPerfil] = useState<PerfilAlumno | null>(null);
  const [materias, setMaterias] = useState<MateriaAlumno[]>([]);
  const [agenda, setAgenda] = useState<AgendaAlumno[]>([]);
  const [avisos, setAvisos] = useState<AvisoAlumno[]>([]);
  const [historial, setHistorial] = useState<HistorialAlumno[]>([]);
  const [erroresContexto, setErroresContexto] = useState<ErroresContexto>({});
  const [cargandoContexto, setCargandoContexto] = useState(false);
  const intentosFallidosRef = useRef(0);
  const generacionSesionRef = useRef(0);
  const [cooldownHasta, setCooldownHasta] = useState(0);
  const [cooldownRestante, setCooldownRestante] = useState(0);
  const [cooldownFinalizado, setCooldownFinalizado] = useState(false);
  const cooldownActivoAnteriorRef = useRef(false);

  const obtenerSesionId = useCallback(() => obtenerSessionId('sesionAlumnoId'), []);

  const limpiarDatosAlumno = useCallback(() => {
    generacionSesionRef.current += 1;
    setCodigo('');
    setMostrarCodigo(false);
    setMatricula('');
    setMensaje('');
    setIntentoIngreso(false);
    setResultados([]);
    setDetalleAbiertoFolio(null);
    setDetallesPorFolio({});
    setCargandoDetallePorFolio({});
    setCargandoPdfPorFolio({});
    setPdfListoPorFolio({});
    setErrorDetallePorFolio({});
    setSeleccionRevisionPorFolio({});
    setComentarioRevisionPorFolio({});
    setConformidadPorFolio({});
    setConformidadRegistradaPorFolio({});
    setEnviandoConformidadPorFolio({});
    setIntentoRevisionPorFolio({});
    setEnviandoRevisionPorFolio({});
    setResultadoRevisionPorFolio({});
    solicitudesRevisionEnProceso.current.clear();
    setCargando(false);
    setPerfil(null);
    setMaterias([]);
    setAgenda([]);
    setAvisos([]);
    setHistorial([]);
    setErroresContexto({});
    setCargandoContexto(false);
  }, []);

  useEffect(() => {
    let intervalo: number | undefined;
    const actualizarRestante = () => {
      const restante = Math.max(0, Math.ceil((cooldownHasta - Date.now()) / 1000));
      setCooldownRestante(restante);
      if (restante > 0) {
        cooldownActivoAnteriorRef.current = true;
        setCooldownFinalizado(false);
        return;
      }
      if (cooldownHasta > 0 && cooldownActivoAnteriorRef.current) {
        cooldownActivoAnteriorRef.current = false;
        setCooldownFinalizado(true);
      }
      if (intervalo !== undefined) {
        window.clearInterval(intervalo);
        intervalo = undefined;
      }
    };
    actualizarRestante();
    if (cooldownHasta <= Date.now()) return;
    intervalo = window.setInterval(actualizarRestante, 1000);
    return () => {
      if (intervalo !== undefined) window.clearInterval(intervalo);
    };
  }, [cooldownHasta]);

  const cerrarSesion = useCallback((origen: 'manual' | 'invalidada' = 'manual') => {
    limpiarTokenAlumno();
    limpiarDatosAlumno();
    setToken(null);
    if (origen === 'manual') {
      emitToast({ level: 'info', title: 'Sesión', message: 'Sesión cerrada', durationMs: 2200 });
    } else {
      setMensaje('Tu sesión ya no está activa. Ingresa de nuevo para continuar.');
    }
    void clientePortal.registrarEventosUso({
      eventos: [{ sessionId: obtenerSesionId(), pantalla: 'alumno', accion: 'logout', exito: true }]
    });
  }, [limpiarDatosAlumno, obtenerSesionId]);

  useEffect(() => {
    return onSesionInvalidada((tipo) => {
      if (tipo !== 'alumno') return;
      cerrarSesion('invalidada');
    });
  }, [cerrarSesion]);

  function mensajeDeError(error: unknown, fallback: string) {
    return mensajeUsuarioDeErrorConSugerencia(error, fallback);
  }

  function emitirToastRecuperacionSesion(error: unknown) {
    const action = accionToastSesionParaError(error, 'alumno');
    if (!action) return;
    emitToast({
      level: 'warn',
      title: 'La sesión requiere atención',
      message: 'Cierra sesión y vuelve a ingresar para continuar.',
      action
    });
  }

  async function ingresar() {
    if (Date.now() < cooldownHasta) {
      const s = Math.max(1, Math.ceil((cooldownHasta - Date.now()) / 1000));
      const msg = `Espera ${s}s antes de intentar de nuevo.`;
      setMensaje(msg);
      return;
    }
    try {
      const inicio = Date.now();
      setCargando(true);
      setMensaje('');
      setCooldownFinalizado(false);
      const respuesta = await clientePortal.enviar<{ token: string }>('/ingresar', { codigo, matricula });
      limpiarDatosAlumno();
      guardarTokenAlumno(respuesta.token);
      setToken(respuesta.token);
      intentosFallidosRef.current = 0;
      setCooldownHasta(0);
      emitToast({ level: 'ok', title: 'Bienvenido', message: 'Sesión iniciada', durationMs: 2200 });
      void clientePortal.registrarEventosUso({
        eventos: [
          {
            sessionId: obtenerSesionId(),
            pantalla: 'alumno',
            accion: 'login',
            exito: true,
            duracionMs: Date.now() - inicio
          }
        ]
      });
      await cargarResultados();
    } catch (error) {
      const nuevo = intentosFallidosRef.current + 1;
      intentosFallidosRef.current = nuevo;
      if (nuevo >= 3) {
        const base = 15_000;
        const extra = Math.min(120_000, base * Math.pow(2, Math.min(4, nuevo - 3)));
        setCooldownHasta(Date.now() + extra);
      }
      const msg = mensajeDeError(error, 'No se pudo ingresar');
      setMensaje(msg);
      void clientePortal.registrarEventosUso({
        eventos: [{ sessionId: obtenerSesionId(), pantalla: 'alumno', accion: 'login', exito: false }]
      });
    } finally {
      setCargando(false);
    }
  }

  async function cargarResultados() {
    const generacion = generacionSesionRef.current;
    setMensaje('');
    try {
      const inicio = Date.now();
      setCargando(true);
      const respuesta = await clientePortal.obtener<{ resultados: Resultado[] }>('/resultados', { silenciarErrores: true });
      if (generacion !== generacionSesionRef.current) return;
      setResultados(respuesta.resultados);
      const detallesIniciales = (respuesta.resultados || []).reduce(
        (acumulado, resultado) => {
          const tieneDetalle = Array.isArray(resultado.comparativaRespuestas) || Boolean(resultado.omrAuditoria);
          if (tieneDetalle && resultado.folio) acumulado[resultado.folio] = resultado;
          return acumulado;
        },
        {} as Record<string, Resultado>
      );
      if (Object.keys(detallesIniciales).length > 0) {
        setDetallesPorFolio((prev) => ({ ...prev, ...detallesIniciales }));
      }
      await cargarContextoAcademico(generacion);
      if (generacion !== generacionSesionRef.current) return;
      void clientePortal.registrarEventosUso({
        eventos: [
          {
            sessionId: obtenerSesionId(),
            pantalla: 'alumno',
            accion: 'cargar_resultados',
            exito: true,
            duracionMs: Date.now() - inicio
          }
        ]
      });
    } catch (error) {
      if (generacion !== generacionSesionRef.current) return;
      const msg = mensajeDeError(error, 'No se pudieron cargar resultados');
      setMensaje(msg);
      emitirToastRecuperacionSesion(error);
      void clientePortal.registrarEventosUso({
        eventos: [{ sessionId: obtenerSesionId(), pantalla: 'alumno', accion: 'cargar_resultados', exito: false }]
      });
    } finally {
      if (generacion === generacionSesionRef.current) setCargando(false);
    }
  }

  async function cargarContextoAcademico(generacion = generacionSesionRef.current) {
    setCargandoContexto(true);
    setErroresContexto({});
    try {
      const [perfilResp, materiasResp, agendaResp, avisosResp, historialResp] = await Promise.allSettled([
        Promise.resolve().then(() => clientePortal.obtener<{ ok: boolean; data?: { perfil?: PerfilAlumno | null } }>('/perfil')),
        Promise.resolve().then(() => clientePortal.obtener<{ ok: boolean; data?: { materias?: MateriaAlumno[] } }>('/materias')),
        Promise.resolve().then(() => clientePortal.obtener<{ ok: boolean; data?: { agenda?: AgendaAlumno[] } }>('/agenda')),
        Promise.resolve().then(() => clientePortal.obtener<{ ok: boolean; data?: { avisos?: AvisoAlumno[] } }>('/avisos')),
        Promise.resolve().then(() => clientePortal.obtener<{ ok: boolean; data?: { historial?: HistorialAlumno[] } }>('/historial'))
      ]);
      if (generacion !== generacionSesionRef.current) return;
      const errores: ErroresContexto = {};
      const perfilData = perfilResp.status === 'fulfilled' && perfilResp.value?.ok === true
        ? perfilResp.value.data
        : undefined;
      const perfilValido = Boolean(perfilData && Object.prototype.hasOwnProperty.call(perfilData, 'perfil'));
      if (perfilValido) setPerfil(perfilData?.perfil ?? null);
      else {
        setPerfil(null);
        errores.perfil = 'No se pudo cargar el perfil.';
      }

      const materiasData = materiasResp.status === 'fulfilled' && materiasResp.value?.ok === true
        ? materiasResp.value.data?.materias
        : undefined;
      if (Array.isArray(materiasData)) setMaterias(materiasData);
      else {
        setMaterias([]);
        errores.materias = 'No se pudieron cargar las materias.';
      }

      const agendaData = agendaResp.status === 'fulfilled' && agendaResp.value?.ok === true
        ? agendaResp.value.data?.agenda
        : undefined;
      if (Array.isArray(agendaData)) setAgenda(agendaData.slice(0, 6));
      else {
        setAgenda([]);
        errores.agenda = 'No se pudo cargar la agenda.';
      }

      const avisosData = avisosResp.status === 'fulfilled' && avisosResp.value?.ok === true
        ? avisosResp.value.data?.avisos
        : undefined;
      if (Array.isArray(avisosData)) setAvisos(avisosData.slice(0, 6));
      else {
        setAvisos([]);
        errores.avisos = 'No se pudieron cargar los avisos.';
      }

      const historialData = historialResp.status === 'fulfilled' && historialResp.value?.ok === true
        ? historialResp.value.data?.historial
        : undefined;
      if (Array.isArray(historialData)) setHistorial(historialData.slice(0, 10));
      else {
        setHistorial([]);
        errores.historial = 'No se pudo cargar el historial.';
      }
      setErroresContexto(errores);
    } finally {
      if (generacion === generacionSesionRef.current) setCargandoContexto(false);
    }
  }

  const seccionesContextoFallidas = Object.values(erroresContexto).filter(Boolean);

  function estadoRevision(resultado: Resultado | undefined) {
    const estado = resultado?.omrAuditoria?.estadoAnalisis;
    const revisionConfirmada = Boolean(resultado?.omrAuditoria?.revisionConfirmada);
    if (!estado) return { clase: '', texto: 'Sin auditoría OMR' };
    if (estado === 'rechazado_calidad') return { clase: 'error', texto: 'OMR rechazado por calidad' };
    if (revisionConfirmada) return { clase: 'ok', texto: 'Revisión manual confirmada' };
    if (estado === 'requiere_revision') return { clase: 'warning', texto: 'Pendiente de revisión manual' };
    return { clase: 'ok', texto: 'OMR validado automáticamente' };
  }

  async function onToggleDetalle(folio: string, reintentar = false) {
    if (!folio) return;
    const generacion = generacionSesionRef.current;
    if (detalleAbiertoFolio === folio && !reintentar) {
      setDetalleAbiertoFolio(null);
      return;
    }
    setDetalleAbiertoFolio(folio);
    if (detallesPorFolio[folio] && !reintentar) return;

    try {
      setCargandoDetallePorFolio((prev) => ({ ...prev, [folio]: true }));
      setErrorDetallePorFolio((prev) => ({ ...prev, [folio]: '' }));
      const respuesta = await clientePortal.obtener<{ resultado: Resultado }>(`/resultados/${folio}`);
      if (generacion !== generacionSesionRef.current) return;
      if (respuesta?.resultado) {
        setDetallesPorFolio((prev) => ({ ...prev, [folio]: respuesta.resultado }));
      }
    } catch (error) {
      if (generacion !== generacionSesionRef.current) return;
      const msg = mensajeDeError(error, 'No se pudo cargar el detalle del examen');
      setErrorDetallePorFolio((prev) => ({ ...prev, [folio]: msg }));
      emitirToastRecuperacionSesion(error);
    } finally {
      if (generacion === generacionSesionRef.current) {
        setCargandoDetallePorFolio((prev) => ({ ...prev, [folio]: false }));
      }
    }
  }

  async function solicitarRevision(folio: string) {
    const generacion = generacionSesionRef.current;
    setIntentoRevisionPorFolio((prev) => ({ ...prev, [folio]: true }));
    const seleccion = seleccionRevisionPorFolio[folio] ?? {};
    const preguntas = Object.entries(seleccion)
      .filter(([, activa]) => Boolean(activa))
      .map(([numero]) => Number(numero))
      .filter((numero) => Number.isInteger(numero) && numero > 0);
    if (preguntas.length === 0) {
      return;
    }
    const comentario = (comentarioRevisionPorFolio[folio] ?? '').trim();
    if (comentario.length < 12) {
      return;
    }
    if (solicitudesRevisionEnProceso.current.has(folio)) return;
    solicitudesRevisionEnProceso.current.add(folio);
    setEnviandoRevisionPorFolio((prev) => ({ ...prev, [folio]: true }));
    setResultadoRevisionPorFolio((prev) => ({ ...prev, [folio]: undefined }));
    try {
      await clientePortal.enviar('/solicitudes-revision', {
        folio,
        solicitudes: preguntas.map((numeroPregunta) => ({ numeroPregunta, comentario }))
      }, { silenciarErrores: true });
      if (generacion !== generacionSesionRef.current) return;
      setIntentoRevisionPorFolio((prev) => ({ ...prev, [folio]: false }));
      setResultadoRevisionPorFolio((prev) => ({
        ...prev,
        [folio]: { tipo: 'ok', mensaje: 'Tu solicitud de revisión fue registrada.' }
      }));
    } catch (error) {
      if (generacion !== generacionSesionRef.current) return;
      setResultadoRevisionPorFolio((prev) => ({
        ...prev,
        [folio]: { tipo: 'error', mensaje: mensajeDeError(error, 'No se pudo registrar la solicitud de revisión') }
      }));
      emitirToastRecuperacionSesion(error);
    } finally {
      solicitudesRevisionEnProceso.current.delete(folio);
      if (generacion === generacionSesionRef.current) {
        setEnviandoRevisionPorFolio((prev) => ({ ...prev, [folio]: false }));
      }
    }
  }

  async function enviarConformidad(folio: string) {
    if (enviandoConformidadPorFolio[folio]) return;
    const generacion = generacionSesionRef.current;
    setEnviandoConformidadPorFolio((prev) => ({ ...prev, [folio]: true }));
    try {
      await clientePortal.enviar('/solicitudes-revision/conformidad', { folio, conformidad: true });
      if (generacion !== generacionSesionRef.current) return;
      setConformidadPorFolio((prev) => ({ ...prev, [folio]: true }));
      setConformidadRegistradaPorFolio((prev) => ({ ...prev, [folio]: true }));
    } catch (error) {
      if (generacion !== generacionSesionRef.current) return;
      emitToast({
        level: 'error',
        title: `No se pudo registrar la conformidad del folio ${folio}`,
        message: mensajeDeError(error, 'No se pudo registrar la conformidad'),
        action: accionToastSesionParaError(error, 'alumno')
      });
    } finally {
      if (generacion === generacionSesionRef.current) {
        setEnviandoConformidadPorFolio((prev) => ({ ...prev, [folio]: false }));
      }
    }
  }

  async function abrirPdf(folio: string) {
    if (!token || cargandoPdfPorFolio[folio]) return;
    const generacion = generacionSesionRef.current;
    setCargandoPdfPorFolio((prev) => ({ ...prev, [folio]: true }));
    setPdfListoPorFolio((prev) => ({ ...prev, [folio]: false }));
    const inicio = Date.now();
    try {
      const respuesta = await fetch(`${basePortal}/examen/${folio}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (generacion !== generacionSesionRef.current) return;
      if (!respuesta.ok) {
        emitToast({
          level: 'error',
          title: `PDF del folio ${folio} no disponible`,
          message: mensajeEstadoPdf(respuesta.status),
          durationMs: 5200,
          action: respuesta.status === 401 ? accionCerrarSesion('alumno') : undefined
        });
        void clientePortal.registrarEventosUso({
          eventos: [{
            sessionId: obtenerSesionId(), pantalla: 'alumno', accion: 'ver_pdf', exito: false,
            meta: { folio, status: respuesta.status }
          }]
        });
        return;
      }
      const blob = await respuesta.blob();
      if (generacion !== generacionSesionRef.current) return;
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setPdfListoPorFolio((prev) => ({ ...prev, [folio]: true }));
      void clientePortal.registrarEventosUso({
        eventos: [{
          sessionId: obtenerSesionId(), pantalla: 'alumno', accion: 'ver_pdf', exito: true,
          duracionMs: Date.now() - inicio, meta: { folio }
        }]
      });
    } catch (error) {
      if (generacion !== generacionSesionRef.current) return;
      emitToast({
        level: 'error',
        title: 'Error al abrir PDF',
        message: mensajeDeError(error, 'Error al abrir PDF'),
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'alumno')
      });
      void clientePortal.registrarEventosUso({
        eventos: [{ sessionId: obtenerSesionId(), pantalla: 'alumno', accion: 'ver_pdf', exito: false, meta: { folio } }]
      });
    } finally {
      if (generacion === generacionSesionRef.current) {
        setCargandoPdfPorFolio((prev) => ({ ...prev, [folio]: false }));
      }
    }
  }

  const puedeIngresar = Boolean(codigo.trim() && matricula.trim());
  // Valida sin bloquear el flujo (hay códigos reales con '-' / '_' y longitudes variables).
  const codigoValido = !codigo.trim() || /^[a-zA-Z0-9_-]{3,24}$/.test(codigo.trim());
  const matriculaValida = !matricula.trim() || /^[A-Za-z0-9._-]{3,32}$/.test(matricula.trim());
  const cooldownActivo = cooldownRestante > 0;
  const errorCodigo = !codigoValido
    ? 'Usa de 3 a 24 caracteres: letras, números, guion o guion bajo.'
    : intentoIngreso && !codigo.trim()
      ? 'Escribe el código de acceso que te compartió tu docente.'
      : undefined;
  const errorMatricula = !matriculaValida
    ? 'Usa de 3 a 32 caracteres: letras, números, punto, guion o guion bajo.'
    : intentoIngreso && !matricula.trim()
      ? 'Escribe tu matrícula.'
      : undefined;

  return (
    <section className={`card anim-entrada portal-alumno-shell ${token ? '' : 'portal-alumno-shell--acceso'} superficie-app superficie-app--alumno`}>
      <div className="cabecera">
        <div className="portal-alumno-shell__intro">
          <p className="eyebrow">
            <Icono nombre="alumno" /> Portal Alumno
          </p>
          <h1 className="portal-alumno-shell__title">Consulta tus resultados</h1>
          <p className="portal-alumno-shell__lead">
            Revisa calificaciones, el detalle de tus respuestas y los archivos disponibles.
          </p>
        </div>
        <div className="cabecera__acciones">
          <button
            type="button"
            className="chip chip-version"
            aria-label={`Versión v${version}. Abrir información de versión`}
            title="Abrir información de versión"
            onClick={() => abrirVentanaVersion('alumno')}
          >
            v{version}
          </button>
          <TemaBoton />
          {token && (
            <button className="boton secundario" type="button" onClick={() => cerrarSesion('manual')}>
              <Icono nombre="salir" /> Salir
            </button>
          )}
        </div>
      </div>
      {!token && (
        <div className="auth-grid auth-grid--alumno">
          <form
            className="auth-form"
            aria-labelledby="portal-alumno-acceso-titulo"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setIntentoIngreso(true);
              if (!codigoValido || !matriculaValida || !puedeIngresar || cooldownActivo || cargando) return;
              void ingresar();
            }}
          >
            <div className="portal-alumno-login-heading">
              <h2 id="portal-alumno-acceso-titulo"><Icono nombre="alumno" /> Ingresa al portal</h2>
              <p>Ingresa tu matrícula y el código de acceso que te compartió tu docente.</p>
            </div>
            {cooldownActivo && (
              <>
                <div aria-live="off">
                  <InlineMensaje tipo="info">
                    Por seguridad, podrás volver a intentar en {cooldownRestante} {cooldownRestante === 1 ? 'segundo' : 'segundos'}.
                  </InlineMensaje>
                </div>
              </>
            )}
            <p className="sr-only" role="status" aria-atomic="true">
              {cooldownActivo
                ? 'Por seguridad, el acceso está temporalmente bloqueado tras varios intentos fallidos. Espera a que termine el contador antes de volver a intentar.'
                : cooldownFinalizado ? 'El tiempo de espera terminó. Ya puedes volver a intentar ingresar.' : ''}
            </p>
            {mensaje && <InlineMensaje tipo="error">{mensaje}</InlineMensaje>}
            {cargando && (
              <p className="mensaje" role="status">
                <Spinner /> Cargando…
              </p>
            )}

            <CampoTexto
              etiqueta="Matrícula"
              ayuda="Escríbela sin espacios."
              value={matricula}
              onChange={(event) => {
                const limpio = event.target.value.replace(/\s+/g, '');
                if (!cooldownActivo) setMensaje('');
                setMatricula(limpio);
              }}
              autoComplete="username"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              error={errorMatricula}
            />
            <div className="campo auth-campo portal-alumno-codigo-field">
              <label htmlFor="portal-alumno-codigo">
                <span className="auth-field-label">Código de acceso</span>
              </label>
              <div className="auth-input-box auth-input-box--key">
                <Icono nombre="candado" size={16} className="auth-input-icon" ariaHidden />
                <input
                  id="portal-alumno-codigo"
                  type={mostrarCodigo ? 'text' : 'password'}
                  value={codigo}
                  onChange={(event) => {
                    const limpio = event.target.value.replace(/\s+/g, '').toUpperCase();
                    if (!cooldownActivo) setMensaje('');
                    setCodigo(limpio);
                  }}
                  autoComplete="current-password"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  aria-invalid={errorCodigo ? 'true' : undefined}
                  aria-describedby={errorCodigo ? 'portal-alumno-codigo-error' : 'portal-alumno-codigo-ayuda'}
                />
                <button
                  type="button"
                  className="auth-pwd-toggle portal-alumno-codigo-toggle"
                  onClick={() => setMostrarCodigo((visible) => !visible)}
                  aria-label={mostrarCodigo ? 'Ocultar código de acceso' : 'Mostrar código de acceso'}
                  aria-pressed={mostrarCodigo}
                >
                  <Icono nombre="ojo" size={18} ariaHidden />
                </button>
              </div>
              {errorCodigo ? (
                <small id="portal-alumno-codigo-error" className="ayuda error">{errorCodigo}</small>
              ) : (
                <small id="portal-alumno-codigo-ayuda" className="ayuda">Usa el código más reciente que te compartió tu docente. Si expiró, pídele uno nuevo.</small>
              )}
            </div>
            <Boton
              type="submit"
              icono={<Icono nombre="entrar" />}
              cargando={cargando}
              disabled={cargando || cooldownActivo}
            >
              Consultar
            </Boton>
          </form>

          <div className="auth-hero auth-hero--alumno">
            <p className="eyebrow">Después de ingresar</p>
            <p className="auth-subtitulo">Podrás consultar:</p>
            <ul className="auth-beneficios" aria-label="Qué puedes consultar">
              <li>
                <Icono nombre="ok" /> Resultados asociados a tu matrícula.
              </li>
              <li>
                <Icono nombre="pdf" /> Descarga el PDF cuando esté disponible.
              </li>
              <li>
                <Icono nombre="info" /> Consulta el detalle y estado de cada folio.
              </li>
            </ul>
          </div>
        </div>
      )}

      {token && mensaje && (
        <div className="mensaje error portal-alumno-resultados-error" role="alert">
          <p>{mensaje}</p>
          <Boton
            type="button"
            variante="secundario"
            disabled={cargando}
            cargando={cargando}
            onClick={() => void cargarResultados()}
          >
            {cargando ? 'Reintentando resultados…' : 'Reintentar carga de resultados'}
          </Boton>
        </div>
      )}

      {token && cargando && (
        <p className="mensaje" role="status">
          <Spinner /> Cargando…
        </p>
      )}

      {token && resultados.length === 0 && !cargando && !mensaje && (
        <div className="resultado">
          <h3>
            <Icono nombre="info" /> Sin resultados
          </h3>
          <IlustracionSinResultados />
          <p>Si acabas de ingresar, intenta recargar.</p>
          <button className="boton secundario" type="button" onClick={cargarResultados}>
            <Icono nombre="recargar" /> Recargar
          </button>
        </div>
      )}

      {token && resultados.length > 0 && (
        <div className="resultado portal-resultados-shell">
          <div className="portal-resultados-shell__hero">
            <div>
              <h3>
                <Icono nombre="ok" /> Resultados disponibles
              </h3>
              <p className="nota">Consulta tus calificaciones, el estado de revisión de tus respuestas y los archivos disponibles.</p>
            </div>
          </div>
          {cargandoContexto && (
            <p className="ayuda" role="status" aria-live="polite">
              <Spinner /> Cargando perfil y contexto académico…
            </p>
          )}
          {seccionesContextoFallidas.length > 0 && (
            <div className="mensaje error portal-alumno-resultados-error" role="alert">
              <p>Algunos datos académicos no se pudieron cargar. Tus calificaciones siguen disponibles; cada tarjeta indica el dato pendiente.</p>
              <Boton type="button" variante="secundario" disabled={cargandoContexto} cargando={cargandoContexto} onClick={() => void cargarContextoAcademico()}>
                {cargandoContexto ? 'Actualizando datos académicos…' : 'Reintentar datos académicos'}
              </Boton>
            </div>
          )}
          <section className="portal-alumno-shell__summary portal-alumno-shell__summary--folios" aria-label="Resumen de folios">
            <article className="portal-alumno-shell__summaryCard glass-card scale-hover">
              <span>Folios</span>
              <strong>{`${resultados.length} ${resultados.length === 1 ? 'folio' : 'folios'}`}</strong>
            </article>
          </section>
          <ul className="lista lista-items" aria-label="Resultados por folio">
            {resultados.map((resultado) => (
              <li key={resultado.folio} className="anim-slide-up">
                <div className="item-glass glass-card-interactive scale-hover portal-resultado-card">
                  <div className="item-row">
                    <div>
                      <div className="item-title portal-card-title">
                        <span className="portal-card-icon portal-card-icon--folio"><Icono nombre="calificar" /></span> Folio {resultado.folio}
                      </div>
                      <div className="item-meta portal-resultado-card__meta">
                        <span>Tipo: {resultado.tipoExamen}</span>
                        <span>Examen (sobre 5): {resultado.calificacionExamenFinalTexto} / 5</span>
                        {resultado.calificacionParcialTexto && <span>Calificación parcial (sobre 10): {resultado.calificacionParcialTexto} / 10</span>}
                        {resultado.calificacionGlobalTexto && <span>Calificación global (sobre 10): {resultado.calificacionGlobalTexto} / 10</span>}
                        {typeof resultado.finalDecimal === 'number' && <span>Calificación final decimal (sobre 10): {formatearCalificacion(resultado.finalDecimal)} / 10</span>}
                        {typeof resultado.finalRedondeada === 'number' && <span>Calificación final redondeada (sobre 10): {formatearCalificacion(resultado.finalRedondeada, 0)} / 10</span>}
                      </div>
                    </div>
                    <div className="item-actions">
                      <button
                        className="boton secundario portal-resultado-detail-toggle"
                        type="button"
                        aria-expanded={detalleAbiertoFolio === resultado.folio}
                        aria-controls={`detalle-folio-${encodeURIComponent(resultado.folio)}`}
                        onClick={() => void onToggleDetalle(resultado.folio)}
                      >
                        <Icono nombre={detalleAbiertoFolio === resultado.folio ? 'chevronArriba' : 'chevronAbajo'} className="portal-resultado-detail-toggle__icon" />{' '}
                        {detalleAbiertoFolio === resultado.folio ? 'Ocultar detalle' : 'Ver detalle'}{' '}
                        <span className="sr-only">del folio {resultado.folio}</span>
                      </button>
                      <button
                        className="boton secundario"
                        type="button"
                        disabled={cargandoPdfPorFolio[resultado.folio]}
                        aria-label={cargandoPdfPorFolio[resultado.folio] ? `Preparando PDF del folio ${resultado.folio}` : `Ver PDF del folio ${resultado.folio}`}
                        aria-busy={Boolean(cargandoPdfPorFolio[resultado.folio])}
                        onClick={() => void abrirPdf(resultado.folio)}
                      >
                        {cargandoPdfPorFolio[resultado.folio] ? <><Spinner /> Preparando PDF…</> : <><Icono nombre="pdf" /> Ver PDF</>}
                      </button>
                      {pdfListoPorFolio[resultado.folio] && (
                        <p className="nota" role="status">El PDF del folio {resultado.folio} está listo. Si no se abrió, revisa el bloqueo de ventanas emergentes.</p>
                      )}
                    </div>
                  </div>
                  <div id={`detalle-folio-${encodeURIComponent(resultado.folio)}`} hidden={detalleAbiertoFolio !== resultado.folio}>
                    {detalleAbiertoFolio === resultado.folio && (
                    <div className="alumno-detalle anim-slide-up">
                      {cargandoDetallePorFolio[resultado.folio] && (
                        <p className="mensaje" role="status">
                          <Spinner /> Cargando detalle del examen...
                        </p>
                      )}
                      {errorDetallePorFolio[resultado.folio] && (
                        <>
                          <InlineMensaje tipo="error">{errorDetallePorFolio[resultado.folio]}</InlineMensaje>
                          <button className="boton secundario" type="button" onClick={() => void onToggleDetalle(resultado.folio, true)}>
                            <Icono nombre="recargar" /> Reintentar detalle de {resultado.folio}
                          </button>
                        </>
                      )}
                      {!cargandoDetallePorFolio[resultado.folio] && !errorDetallePorFolio[resultado.folio] && (
                        <>
                          {(() => {
                            const detalle = detallesPorFolio[resultado.folio] ?? resultado;
                            const estado = estadoRevision(detalle);
                            const comparativa = Array.isArray(detalle.comparativaRespuestas) ? detalle.comparativaRespuestas : [];
                            const aciertos = comparativa.filter((item) => item.coincide).length;
                            const total = comparativa.length;
                            return (
                              <>
                                <div className="portal-detalle-summary">
                                  <div className="portal-detalle-summary__item">
                                    <span>Reactivos</span>
                                    <strong>{typeof (detalle.totalReactivos ?? total) === 'number' ? `${detalle.totalReactivos ?? total} reactivos` : detalle.totalReactivos ?? total ?? '-'}</strong>
                                  </div>
                                  <div className="portal-detalle-summary__item">
                                    <span>Aciertos detectados</span>
                                    <strong>{`${typeof detalle.aciertos === 'number' ? detalle.aciertos : aciertos} aciertos`}</strong>
                                  </div>
                                  {typeof detalle.finalDecimal === 'number' && (
                                    <div className="portal-detalle-summary__item">
                                      <span>Calificación final decimal (sobre 10)</span>
                                      <strong>{formatearCalificacion(detalle.finalDecimal)} / 10</strong>
                                    </div>
                                  )}
                                  {typeof detalle.finalRedondeada === 'number' && (
                                    <div className="portal-detalle-summary__item">
                                      <span>Calificación final redondeada (sobre 10)</span>
                                      <strong>{formatearCalificacion(detalle.finalRedondeada, 0)} / 10</strong>
                                    </div>
                                  )}
                                </div>
                                <div className="item-meta portal-detalle-meta">
                                  <span className={`badge ${estado.clase}`}>{estado.texto}</span>
                                </div>
                                {(typeof detalle.versionPolitica === 'number'
                                  || typeof detalle.bloqueContinuaDecimal === 'number'
                                  || typeof detalle.bloqueExamenesDecimal === 'number') && (
                                  <details className="portal-detalle-desglose">
                                    <summary>Ver desglose de la calificación</summary>
                                    <p className="nota">
                                      Los bloques se califican sobre 10 y la política del periodo aplica el peso correspondiente a cada uno.
                                    </p>
                                    <div className="item-meta portal-detalle-meta">
                                      {typeof detalle.versionPolitica === 'number' && <span>Versión de la política aplicada: {detalle.versionPolitica}</span>}
                                      {typeof detalle.bloqueContinuaDecimal === 'number' && (
                                        <span>Bloque de evaluación continua (sobre 10): {formatearCalificacion(detalle.bloqueContinuaDecimal)} / 10</span>
                                      )}
                                      {typeof detalle.bloqueExamenesDecimal === 'number' && (
                                        <span>Bloque de exámenes (sobre 10): {formatearCalificacion(detalle.bloqueExamenesDecimal)} / 10</span>
                                      )}
                                    </div>
                                  </details>
                                )}
                                {detalle.omrAuditoria?.motivosRevision && detalle.omrAuditoria.motivosRevision.length > 0 && (
                                  <InlineMensaje tipo="info">
                                    Motivos de revisión: {detalle.omrAuditoria.motivosRevision.join(' | ')}
                                  </InlineMensaje>
                                )}
                                {comparativa.length > 0 && (
              <p className="nota alumno-detalle-tabla-title">
                                    Comparación de respuestas · Folio {resultado.folio}
                                  </p>
                                )}
                                <div
                                  className="alumno-detalle-tabla-wrap"
                                  role={comparativa.length > 0 ? 'region' : undefined}
                                  aria-label={comparativa.length > 0 ? `Comparación de respuestas del folio ${resultado.folio}` : undefined}
                                  aria-describedby={comparativa.length > 0 ? `ayuda-desplazamiento-tabla-${encodeURIComponent(resultado.folio)}` : undefined}
                                  tabIndex={comparativa.length > 0 ? 0 : undefined}
                                >
                                  {comparativa.length === 0 ? (
                                    <InlineMensaje tipo="info">
                                      Aún no hay comparación de respuestas para este examen.
                                    </InlineMensaje>
                                  ) : (
                                    <>
                                      <p id={`ayuda-desplazamiento-tabla-${encodeURIComponent(resultado.folio)}`} className="nota alumno-detalle-tabla-hint">
                                        En móvil, cada pregunta se presenta como tarjeta para facilitar su lectura y selección.
                                      </p>
                                      <p id={`ayuda-seleccion-${encodeURIComponent(resultado.folio)}`} className="nota">
                                        Selecciona una o más preguntas de este folio para solicitar una revisión.
                                      </p>
                                      <table className="alumno-detalle-tabla">
                                        <caption className="sr-only">Comparación de respuestas del folio {resultado.folio}</caption>
                                        <thead>
                                          <tr>
                                            <th scope="col">Pregunta</th>
                                            <th scope="col">Clave correcta</th>
                                            <th scope="col">Tu respuesta</th>
                                            <th scope="col">Estado</th>
                                            <th scope="col">Solicitar revisión</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {comparativa.map((item) => (
                                            <tr key={`${resultado.folio}-q-${item.numeroPregunta}`}>
                                            <th scope="row">{item.numeroPregunta}</th>
                                            <td data-label="Clave correcta">{item.correcta ?? '-'}</td>
                                            <td data-label="Tu respuesta">{item.detectada ?? '-'}</td>
                                            <td data-label="Estado">
                                              <span className={`badge ${item.coincide ? 'ok' : 'error'}`}>
                                                {item.coincide ? 'Correcta' : 'Incorrecta'}
                                              </span>
                                            </td>
                                            <td data-label="Solicitar revisión">
                                              <label>
                                                <input
                                                  type="checkbox"
                                                  aria-label={`Solicitar revisión de la pregunta ${item.numeroPregunta} del folio ${resultado.folio}`}
                                                  aria-describedby={`ayuda-seleccion-${encodeURIComponent(resultado.folio)}${intentoRevisionPorFolio[resultado.folio] && !Object.values(seleccionRevisionPorFolio[resultado.folio] ?? {}).some(Boolean) ? ` error-seleccion-${encodeURIComponent(resultado.folio)}` : ''}`}
                                                  checked={Boolean(seleccionRevisionPorFolio[resultado.folio]?.[item.numeroPregunta])}
                                                  disabled={Boolean(enviandoRevisionPorFolio[resultado.folio])}
                                                  onChange={(event) => {
                                                    setSeleccionRevisionPorFolio((prev) => {
                                                      const folioActual = { ...(prev[resultado.folio] ?? {}) };
                                                      folioActual[item.numeroPregunta] = event.target.checked;
                                                      return { ...prev, [resultado.folio]: folioActual };
                                                    });
                                                    setResultadoRevisionPorFolio((prev) => ({ ...prev, [resultado.folio]: undefined }));
                                                  }}
                                                />{' '}
                                                Revisar
                                              </label>
                                            </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      {intentoRevisionPorFolio[resultado.folio] && !Object.values(seleccionRevisionPorFolio[resultado.folio] ?? {}).some(Boolean) && (
                                        <p id={`error-seleccion-${encodeURIComponent(resultado.folio)}`} className="ayuda error" role="alert">
                                          Marca al menos una pregunta de este folio.
                                        </p>
                                      )}
                                    </>
                                  )}
                                </div>
                                {comparativa.length > 0 && (
                                  <div className="item-actions alumno-revision-actions">
                                    <label htmlFor={`comentario-revision-${encodeURIComponent(resultado.folio)}`}>
                                      Comentario obligatorio (mínimo 12 caracteres)
                                    </label>
                                    <textarea
                                      id={`comentario-revision-${encodeURIComponent(resultado.folio)}`}
                                      className="alumno-revision-comentario"
                                      value={comentarioRevisionPorFolio[resultado.folio] ?? ''}
                                      disabled={Boolean(enviandoRevisionPorFolio[resultado.folio])}
                                      required
                                      aria-describedby={`ayuda-comentario-${encodeURIComponent(resultado.folio)}${intentoRevisionPorFolio[resultado.folio] && (comentarioRevisionPorFolio[resultado.folio] ?? '').trim().length < 12 ? ` error-comentario-${encodeURIComponent(resultado.folio)}` : ''}`}
                                      aria-invalid={Boolean(intentoRevisionPorFolio[resultado.folio] && (comentarioRevisionPorFolio[resultado.folio] ?? '').trim().length < 12)}
                                      onChange={(event) => {
                                        setComentarioRevisionPorFolio((prev) => ({ ...prev, [resultado.folio]: event.target.value }));
                                        setResultadoRevisionPorFolio((prev) => ({ ...prev, [resultado.folio]: undefined }));
                                      }}
                                      rows={2}
                                    />
                                    <small id={`ayuda-comentario-${encodeURIComponent(resultado.folio)}`}>
                                      Explica qué respuesta consideras que debe revisarse.
                                    </small>
                                    {intentoRevisionPorFolio[resultado.folio] && (comentarioRevisionPorFolio[resultado.folio] ?? '').trim().length < 12 && (
                                      <p id={`error-comentario-${encodeURIComponent(resultado.folio)}`} className="ayuda error" role="alert">
                                        Escribe al menos 12 caracteres para explicar la solicitud.
                                      </p>
                                    )}
                                    <button
                                      className="boton secundario"
                                      type="button"
                                      disabled={Boolean(enviandoRevisionPorFolio[resultado.folio])}
                                      aria-label={`${enviandoRevisionPorFolio[resultado.folio] ? 'Enviando solicitud de revisión' : 'Solicitar revisión de marcadas'} del folio ${resultado.folio}`}
                                      aria-busy={Boolean(enviandoRevisionPorFolio[resultado.folio])}
                                      onClick={() => void solicitarRevision(resultado.folio)}
                                    >
                                      {enviandoRevisionPorFolio[resultado.folio]
                                        ? <><Spinner /> Enviando solicitud…</>
                                        : <><Icono nombre="info" /> Solicitar revisión de marcadas</>}
                                    </button>
                                    {resultadoRevisionPorFolio[resultado.folio] && (
                                      <InlineMensaje tipo={resultadoRevisionPorFolio[resultado.folio]?.tipo === 'error' ? 'error' : 'ok'}>
                                        {resultadoRevisionPorFolio[resultado.folio]?.mensaje}
                                      </InlineMensaje>
                                    )}
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={Boolean(conformidadPorFolio[resultado.folio])}
                                        disabled={Boolean(enviandoConformidadPorFolio[resultado.folio] || conformidadRegistradaPorFolio[resultado.folio])}
                                        onChange={(event) =>
                                          setConformidadPorFolio((prev) => ({ ...prev, [resultado.folio]: event.target.checked }))
                                        }
                                      />{' '}
                                      {conformidadRegistradaPorFolio[resultado.folio]
                                        ? 'Conformidad registrada'
                                        : 'En conformidad con resultados'}
                                    </label>
                                    {conformidadRegistradaPorFolio[resultado.folio] ? (
                                      <InlineMensaje tipo="ok">
                                        Confirmaste tu conformidad con los resultados del folio {resultado.folio}.
                                      </InlineMensaje>
                                    ) : (
                                      <button
                                        className="boton secundario"
                                        type="button"
                                        disabled={!conformidadPorFolio[resultado.folio] || enviandoConformidadPorFolio[resultado.folio]}
                                        aria-label={`${enviandoConformidadPorFolio[resultado.folio] ? 'Enviando conformidad' : 'Enviar conformidad'} del folio ${resultado.folio}`}
                                        aria-busy={Boolean(enviandoConformidadPorFolio[resultado.folio])}
                                        onClick={() => void enviarConformidad(resultado.folio)}
                                      >
                                        {enviandoConformidadPorFolio[resultado.folio]
                                          ? <><Spinner /> Enviando conformidad…</>
                                          : <><Icono nombre="ok" /> Enviar conformidad</>}
                                      </button>
                                    )}
                                  </div>
                                )}
                                {Array.isArray(detalle.omrCapturas) && detalle.omrCapturas.length > 0 && (
                                  <div className="panel alumno-detalle anim-slide-up" aria-label="Capturas OMR por página">
                                    <h4>Capturas OMR por página</h4>
                                    <div className="guia-grid">
                                      {detalle.omrCapturas
                                        .slice()
                                        .sort((a, b) => Number(a.numeroPagina) - Number(b.numeroPagina))
                                        .map((captura) => (
                                          <div className="item-glass glass-card-interactive scale-hover" key={`${resultado.folio}-captura-${captura.numeroPagina}`}>
                                            <div className="item-meta">
                                              <span>Página {captura.numeroPagina}</span>
                                              {typeof captura.calidad === 'number' && <span>Calidad: {(captura.calidad * 100).toFixed(0)}%</span>}
                                            </div>
                                            <img
                                              className="preview"
                                              alt={`Captura OMR página ${captura.numeroPagina}`}
                                              src={`data:image/${captura.formato};base64,${captura.imagenBase64}`}
                                            />
                                            {Array.isArray(captura.sugerencias) && captura.sugerencias.length > 0 && (
                                              <InlineMensaje tipo="info">{captura.sugerencias.join(' | ')}</InlineMensaje>
                                            )}
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </>
                      )}
                    </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="guia-grid portal-alumno-context-grid">
            <div className="item-glass portal-alumno-card glass-card scale-hover">
              <div className="item-title portal-card-title">
                <span className="portal-card-icon portal-card-icon--perfil"><Icono nombre="alumno" /></span> Perfil
              </div>
              <div className="item-meta">
                <span>{erroresContexto.perfil ? 'No se pudo cargar el perfil.' : perfil?.nombreCompleto?.trim() || 'Nombre no disponible'}</span>
                <span>Matrícula: {erroresContexto.perfil ? 'No disponible' : perfil?.matricula?.trim() || 'No disponible'}</span>
                <span>Grupo: {erroresContexto.perfil ? 'No disponible' : perfil?.grupo?.trim() || 'Sin grupo asignado'}</span>
              </div>
            </div>
            <div className="item-glass portal-alumno-card glass-card scale-hover">
              <div className="item-title portal-card-title">
                <span className="portal-card-icon portal-card-icon--materias"><Icono nombre="periodos" /></span> Materias
              </div>
              <div className="item-meta">
                <span>{erroresContexto.materias
                  ? 'Materias: No disponibles'
                  : cargandoContexto
                    ? 'Cargando materias…'
                    : `${materias.length} ${materias.length === 1 ? 'materia' : 'materias'}`}</span>
                <span>{erroresContexto.materias
                  ? erroresContexto.materias
                  : materias.length === 0
                    ? 'Sin materias asignadas'
                    : `${materias.slice(0, 2).map((materia) => materia.nombre?.trim() || 'Materia sin nombre').join(' · ')}${materias.length > 2 ? ` · y ${materias.length - 2} más` : ''}`}</span>
              </div>
            </div>
            <div className="item-glass portal-alumno-card glass-card scale-hover">
              <div className="item-title portal-card-title">
                <span className="portal-card-icon portal-card-icon--agenda"><Icono nombre="agenda" /></span> Agenda
              </div>
              <div className="item-meta">
                <span>{erroresContexto.agenda ? 'Eventos próximos: No disponible' : `Eventos próximos mostrados: ${agenda.length}`}</span>
                <span>{erroresContexto.agenda ? erroresContexto.agenda : agenda[0]?.titulo?.trim() || 'Sin próximos eventos'}</span>
              </div>
            </div>
            <div className="item-glass portal-alumno-card glass-card scale-hover">
              <div className="item-title portal-card-title">
                <span className="portal-card-icon portal-card-icon--avisos"><Icono nombre="alerta" /></span> Avisos
              </div>
              <div className="item-meta">
                <span>{erroresContexto.avisos
                  ? 'Avisos recientes: No disponibles'
                  : cargandoContexto
                    ? 'Cargando avisos…'
                    : `${avisos.length} ${avisos.length === 1 ? 'aviso reciente' : 'avisos recientes'}`}</span>
                <span>{erroresContexto.avisos ? erroresContexto.avisos : avisos[0]?.titulo?.trim() || 'Sin avisos recientes'}</span>
              </div>
            </div>
            <div className="item-glass portal-alumno-card glass-card scale-hover">
              <div className="item-title portal-card-title">
                <span className="portal-card-icon portal-card-icon--historial"><Icono nombre="historial" /></span> Historial
              </div>
              <div className="item-meta">
                <span>{erroresContexto.historial ? 'Registros: No disponibles' : `Registros mostrados: ${historial.length}`}</span>
                <span>{erroresContexto.historial ? erroresContexto.historial : historial[0]?.folio?.trim() || 'Sin registros anteriores'}</span>
              </div>
            </div>
          </div>
          <HelperPanel
            titulo="Cómo revisar tus resultados"
            descripcion="Compara la respuesta detectada con la clave y solicita revisión si hace falta."
            pasos={[
              'Abre “Ver detalle” en el folio.',
              'Marca las preguntas y envía la solicitud de revisión.',
              'Al terminar, marca tu conformidad y envíala.'
            ]}
          />
        </div>
      )}
    </section>
  );
}
