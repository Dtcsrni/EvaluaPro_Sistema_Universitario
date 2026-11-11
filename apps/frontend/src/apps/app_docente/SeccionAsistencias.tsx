/**
 * SeccionAsistencias.tsx
 *
 * Responsabilidad: Módulo ejecutivo de pase de lista y control de asistencias:
 * - Cabecera Bento con Mini-KPIs y estado del ciclo lectivo
 * - Guía visual Bento Step Cards
 * - Selector interactivo de periodo y chips de grupo rápidos
 * - Fast-Check 1-Click con semáforo visual (P/F/R/J)
 * - Semáforo de porcentaje de asistencia y derecho a examen
 * - Gestión de reglas y autorización de excepciones
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { IconoCampo } from '../../ui/IconoLucide';
import { clienteApi } from './clienteApiDocente';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Check,
  CheckCheck,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Info,
  LoaderCircle,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Tags,
  UsersRound,
  X,
  type LucideIcon,
  IconoLucide
} from '../../ui/iconosCatalogo';
import { Boton } from '../../ui/ux/componentes/Boton';
import { GuiaAsistenciasVisual } from './GuiaAsistenciasVisual';
import type { Alumno, Periodo } from './tipos';
import { fechaLocalISO } from './fechaLocal';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import {
  accionToastSesionParaError,
  ErrorRemoto,
  mensajeUsuarioDeErrorConSugerencia
} from '../../servicios_api/clienteComun';

// ─── Tipos locales ────────────────────────────────────────────────────────────
type SesionAsistencia = {
  _id: string;
  fecha: string;
  grupo: string;
  modo: 'manual' | 'qr_automatico';
  temaNombre?: string;
  observaciones?: string;
};

type RegistroLocal = {
  alumnoId: string;
  estado: 'P' | 'F' | 'R' | 'J';
  justificacion?: string;
};

function notificarErrorAsistencias(titulo: string, error: unknown, fallback: string) {
  const mensajeNormalizado = error instanceof ErrorRemoto
    ? mensajeUsuarioDeErrorConSugerencia(error, fallback)
    : fallback;
  const mensaje = /^(?:Error:|Network Error$)/i.test(mensajeNormalizado) ? fallback : mensajeNormalizado;
  const accionSesion = accionToastSesionParaError(error, 'docente');

  emitToast({
    level: 'error',
    title: titulo,
    message: mensaje,
    ...(accionSesion ? { action: accionSesion, persistent: true } : {})
  });
}

type ResumenAlumno = {
  alumnoId: string;
  matricula: string;
  nombreCompleto: string;
  grupo: string;
  presentes: number;
  faltas: number;
  retardos: number;
  justificadas: number;
  totalSesiones: number;
  porcentajeAsistencia: number;
  superaLimiteFaltas: boolean;
  tieneExcepcion: boolean;
  bloqueadoExamen: boolean;
};

type ReglaAsistencia = {
  _id: string;
  maxFaltas: number;
  accion: 'bloquear_examen' | 'advertir';
  excepcionPermitida: boolean;
  grupo?: string | null;
  contarRetardos: boolean;
  retardosEquivalenFalta: number;
};

type TabActivo = 'resumen' | 'pase_lista' | 'reglas';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ESTADO_LABEL: Record<string, string> = { P: 'Presente', F: 'Falta', R: 'Retardo', J: 'Justificada' };
const ESTADO_ICONO: Record<'P' | 'F' | 'R' | 'J', LucideIcon> = {
  P: CircleCheck,
  F: CircleX,
  R: Clock3,
  J: FileCheck2
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function obtenerIniciales(nombre?: string): string {
  const palabras = String(nombre || '').trim().split(/\s+/);
  if (palabras.length === 1) {
    return palabras[0].substring(0, 2).toUpperCase() || 'AL';
  }
  const primera = palabras[0].charAt(0);
  const segunda = palabras[1].charAt(0);
  return (primera + segunda).toUpperCase() || 'AL';
}

// ─── Componente principal ─────────────────────────────────────────────────────
type Props = {
  periodos: Periodo[];
  alumnos: Alumno[];
  puedeGestionar?: boolean;
};

export function SeccionAsistencias({ periodos, alumnos, puedeGestionar = false }: Props) {
  const ayudaAccionReglaId = useId();
  const [tab, setTab] = useState<TabActivo>('resumen');
  const [periodoId, setPeriodoId] = useState('');
  const [grupo, setGrupo] = useState('');
  const [sesiones, setSesiones] = useState<SesionAsistencia[]>([]);
  const [sesionActual, setSesionActual] = useState<SesionAsistencia | null>(null);
  const [registros, setRegistros] = useState<Record<string, RegistroLocal>>({});
  const [resumen, setResumen] = useState<ResumenAlumno[]>([]);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'con_derecho' | 'en_riesgo' | 'sin_derecho'>('todos');
  const [reglas, setReglas] = useState<ReglaAsistencia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [estadoResumen, setEstadoResumen] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [estadoSesiones, setEstadoSesiones] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [estadoReglas, setEstadoReglas] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [estadoRegistros, setEstadoRegistros] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [sesionParaReintento, setSesionParaReintento] = useState<SesionAsistencia | null>(null);
  const [avisoPresenciaInicial, setAvisoPresenciaInicial] = useState(false);
  const [avisoPaseRapido, setAvisoPaseRapido] = useState('');
  const solicitudRef = useRef({ resumen: 0, sesiones: 0, reglas: 0, registros: 0 });
  const contextoRef = useRef('');
  const [guardando, setGuardando] = useState(false);
  const guardandoReglaRef = useRef(false);
  const [guardandoRegla, setGuardandoRegla] = useState(false);

  // Formulario nueva sesión
  const [nuevaSesionFecha, setNuevaSesionFecha] = useState(() => fechaLocalISO());
  const [nuevaSesionGrupo, setNuevasSesionGrupo] = useState('');
  const [nuevaSesionTema, setNuevaSesionTema] = useState('');

  // Formulario nueva regla
  const [nuevaReglaMax, setNuevaReglaMax] = useState(3);
  const [nuevaReglaAccion, setNuevaReglaAccion] = useState<'bloquear_examen' | 'advertir'>('bloquear_examen');
  const [nuevaReglaContarRetardos, setNuevaReglaContarRetardos] = useState(false);
  const [nuevaReglaRetardosEquivalen, setNuevaReglaRetardosEquivalen] = useState(3);

  // Resumen filtrado para la tabla
  const resumenFiltrado = useMemo(() => {
    let lista = resumen;
    if (filtroTexto.trim()) {
      const q = filtroTexto.trim().toLowerCase();
      lista = lista.filter((r) =>
        r.nombreCompleto.toLowerCase().includes(q) ||
        r.matricula.toLowerCase().includes(q) ||
        r.grupo.toLowerCase().includes(q)
      );
    }
    if (filtroEstado === 'sin_derecho') {
      lista = lista.filter((r) => r.bloqueadoExamen);
    } else if (filtroEstado === 'en_riesgo') {
      lista = lista.filter((r) => !r.bloqueadoExamen && r.porcentajeAsistencia < 85 && r.totalSesiones > 0);
    } else if (filtroEstado === 'con_derecho') {
      lista = lista.filter((r) => !r.bloqueadoExamen);
    }
    return lista;
  }, [resumen, filtroTexto, filtroEstado]);

  // Periodo seleccionado
  const periodoSeleccionado = useMemo(() => {
    return periodos.find((per) => per._id === periodoId);
  }, [periodos, periodoId]);

  // Grupos del periodo seleccionado
  const gruposDisponibles = useMemo(() => {
    return periodoSeleccionado?.grupos ?? [];
  }, [periodoSeleccionado]);

  const etiquetaKpiAlumnos = !periodoId
    ? 'Alumnos'
    : grupo
      ? `Alumnos · grupo ${grupo}`
      : 'Alumnos · todos los grupos';
  const ayudaKpiAlumnos = !periodoId
    ? 'Selecciona un periodo para consultar el total de alumnos activos.'
    : grupo
      ? `Total de alumnos activos del grupo ${grupo} en el periodo seleccionado.`
      : 'Total de alumnos activos del periodo seleccionado en todos los grupos.';
  const ayudaKpiPromedio = !periodoId
    ? 'Selecciona un periodo para consultar el promedio de asistencia.'
    : grupo
      ? `Promedio de asistencia del grupo ${grupo} en el periodo seleccionado.`
      : 'Promedio de asistencia del periodo seleccionado en todos los grupos.';
  const ayudaKpiBloqueados = !periodoId
    ? 'Selecciona un periodo para consultar los alumnos con examen bloqueado.'
    : grupo
      ? `Alumnos con examen bloqueado del grupo ${grupo} en el periodo seleccionado.`
      : 'Alumnos con examen bloqueado en todos los grupos del periodo seleccionado.';

  // El periodo es parte de la identidad de la lista aunque dos materias compartan grupo.
  const alumnosPeriodo = useMemo(
    () => alumnos.filter((a) => a.periodoId === periodoId && a.activo !== false),
    [alumnos, periodoId]
  );
  const alumnosGrupo = useMemo(() => {
    if (!grupo) return alumnosPeriodo;
    return alumnosPeriodo.filter((a) => a.grupo === grupo);
  }, [alumnosPeriodo, grupo]);
  const contexto = `${periodoId}|${grupo}`;
  contextoRef.current = contexto;
  const alumnosSesion = useMemo(() => {
    if (!sesionActual) return [];
    return alumnosPeriodo.filter((a) => a.grupo === sesionActual.grupo);
  }, [alumnosPeriodo, sesionActual]);

  // KPIs de Asistencia
  const kpis = useMemo(() => {
    const totalSesiones = sesiones.length;
    const totalAlumnos = alumnosGrupo.length;
    let promedioPct = 0;
    let sinDerechoCount = 0;

    if (resumen.length > 0) {
      const sumaPct = resumen.reduce((acc, curr) => acc + curr.porcentajeAsistencia, 0);
      promedioPct = Math.round(sumaPct / resumen.length);
      sinDerechoCount = resumen.filter((r) => r.bloqueadoExamen).length;
    }

    return {
      totalSesiones,
      totalAlumnos,
      promedioPct,
      sinDerechoCount
    };
  }, [sesiones, alumnosGrupo, resumen]);

  const anuncioResumen = estadoResumen === 'loading' || estadoSesiones === 'loading'
    ? 'Actualizando el resumen de asistencia.'
    : estadoResumen === 'ready'
      ? `Resumen actualizado para ${periodoSeleccionado?.nombre ?? 'la materia seleccionada'}${grupo ? `, grupo ${grupo}` : ', todos los grupos'}${estadoSesiones === 'ready' ? `, ${kpis.totalSesiones} ${kpis.totalSesiones === 1 ? 'sesión' : 'sesiones'}` : ''} y ${kpis.totalAlumnos} ${kpis.totalAlumnos === 1 ? 'alumno' : 'alumnos'}.`
      : '';

  const cargarSesiones = useCallback(async () => {
    const solicitud = ++solicitudRef.current.sesiones;
    const contextoSolicitud = `${periodoId}|${grupo}`;
    if (!periodoId) { setSesiones([]); setEstadoSesiones('idle'); return; }
    setSesiones([]);
    setEstadoSesiones('loading');
    try {
      const data = await clienteApi.obtener<{ sesiones: SesionAsistencia[] }>(
        `/asistencias/sesiones?periodoId=${periodoId}${grupo ? `&grupo=${encodeURIComponent(grupo)}` : ''}`
      );
      if (solicitudRef.current.sesiones !== solicitud || contextoRef.current !== contextoSolicitud) return;
      setSesiones(data.sesiones ?? []);
      setEstadoSesiones('ready');
    } catch {
      if (solicitudRef.current.sesiones !== solicitud || contextoRef.current !== contextoSolicitud) return;
      setSesiones([]);
      setEstadoSesiones('error');
    }
  }, [periodoId, grupo]);

  const cargarResumen = useCallback(async () => {
    const solicitud = ++solicitudRef.current.resumen;
    const contextoSolicitud = `${periodoId}|${grupo}`;
    if (!periodoId) { setResumen([]); setEstadoResumen('idle'); return; }
    setResumen([]);
    setCargando(true);
    setEstadoResumen('loading');
    try {
      const data = await clienteApi.obtener<{ resumen: ResumenAlumno[] }>(
        `/asistencias/resumen?periodoId=${periodoId}${grupo ? `&grupo=${encodeURIComponent(grupo)}` : ''}`
      );
      if (solicitudRef.current.resumen !== solicitud || contextoRef.current !== contextoSolicitud) return;
      setResumen(data.resumen ?? []);
      setEstadoResumen('ready');
    } catch {
      if (solicitudRef.current.resumen !== solicitud || contextoRef.current !== contextoSolicitud) return;
      setResumen([]);
      setEstadoResumen('error');
    } finally {
      if (solicitudRef.current.resumen === solicitud) setCargando(false);
    }
  }, [periodoId, grupo]);

  const cargarReglas = useCallback(async () => {
    const solicitud = ++solicitudRef.current.reglas;
    const contextoSolicitud = periodoId;
    if (!periodoId) { setReglas([]); setEstadoReglas('idle'); return; }
    setReglas([]);
    setEstadoReglas('loading');
    try {
      const data = await clienteApi.obtener<{ reglas: ReglaAsistencia[] }>(
        `/asistencias/reglas?periodoId=${periodoId}`
      );
      if (solicitudRef.current.reglas !== solicitud || contextoRef.current.split('|')[0] !== contextoSolicitud) return;
      setReglas(data.reglas ?? []);
      setEstadoReglas('ready');
    } catch {
      if (solicitudRef.current.reglas !== solicitud || contextoRef.current.split('|')[0] !== contextoSolicitud) return;
      setReglas([]);
      setEstadoReglas('error');
    }
  }, [periodoId]);

  useEffect(() => {
    contextoRef.current = contexto;
    solicitudRef.current.registros += 1;
    setSesionActual(null);
    setRegistros({});
    setEstadoRegistros('idle');
    setSesionParaReintento(null);
    setAvisoPresenciaInicial(false);
    if (periodoId) {
      void cargarSesiones();
      void cargarResumen();
      void cargarReglas();
    } else {
      setSesiones([]); setResumen([]); setReglas([]);
      setEstadoSesiones('idle'); setEstadoResumen('idle'); setEstadoReglas('idle');
    }
  }, [periodoId, grupo, contexto, cargarSesiones, cargarResumen, cargarReglas]);

  // ─── Crear sesión ────────────────────────────────────────────────────────────
  async function crearSesion() {
    if (!puedeGestionar) return;
    const g = nuevaSesionGrupo || grupo;
    if (!periodoId || !g) {
      emitToast({ level: 'warn', title: 'Datos incompletos', message: 'Selecciona periodo y grupo.' });
      return;
    }
    const contextoCreacion = contexto;
    try {
      const data = await clienteApi.enviar<{ sesion: SesionAsistencia }>('/asistencias/sesiones', {
        periodoId,
        fecha: new Date(nuevaSesionFecha + 'T12:00:00').toISOString(),
        grupo: g,
        temaNombre: nuevaSesionTema || undefined
      });
      if (contextoRef.current !== contextoCreacion) return;
      emitToast({ level: 'ok', title: 'Sesión creada', message: formatFecha(data.sesion.fecha) });
      setSesionActual(data.sesion);
      // Inicializar registros con todos presentes
      const init: Record<string, RegistroLocal> = {};
      alumnosPeriodo.filter((al) => al.grupo === g).forEach((al) => {
        init[al._id] = { alumnoId: al._id, estado: 'P' };
      });
      setRegistros(init);
      setEstadoRegistros('ready');
      setSesionParaReintento(null);
      setAvisoPresenciaInicial(true);
      setTab('pase_lista');
      void cargarSesiones();
    } catch (error) {
      notificarErrorAsistencias(
        'No se pudo crear la sesión',
        error,
        'No se confirmó la creación. Revisa la lista de sesiones antes de volver a crearla.'
      );
    }
  }

  // Cada estado tiene una acción explícita; el motivo se conserva al corregir la selección.
  function establecerEstado(alumnoId: string, estado: RegistroLocal['estado']) {
    if (!puedeGestionar) return;
    setRegistros((prev) => ({
      ...prev,
      [alumnoId]: { ...prev[alumnoId], alumnoId, estado }
    }));
  }

  // ─── Guardar pase de lista ───────────────────────────────────────────────────
  async function guardarPaseLista() {
    if (!puedeGestionar || !sesionActual || estadoRegistros !== 'ready') return;
    setGuardando(true);
    try {
      await clienteApi.enviar(`/asistencias/sesiones/${sesionActual._id}/registros`, {
        registros: alumnosSesion.map((al) => registros[al._id] ?? { alumnoId: al._id, estado: 'P' })
      });
      emitToast({ level: 'ok', title: 'Lista guardada', message: `${alumnosSesion.length} registros guardados.` });
      void cargarResumen();
      setTab('resumen');
    } catch (error) {
      notificarErrorAsistencias(
        'No se pudo guardar el pase de lista',
        error,
        'No se confirmó el guardado. Revisa los registros de la sesión antes de volver a enviarlos.'
      );
    } finally {
      setGuardando(false);
    }
  }

  // ─── Cargar registros de sesión existente ───────────────────────────────────
  async function abrirSesion(sesion: SesionAsistencia) {
    const contextoApertura = contexto;
    const solicitud = ++solicitudRef.current.registros;
    setSesionActual(sesion);
    setSesionParaReintento(sesion);
    setRegistros({});
    setEstadoRegistros('loading');
    setAvisoPresenciaInicial(false);
    setAvisoPaseRapido('');
    setTab('pase_lista');
    try {
      const data = await clienteApi.obtener<{ registros: Array<{ alumnoId: string; estado: 'P' | 'F' | 'R' | 'J'; justificacion?: string }> }>(
        `/asistencias/sesiones/${sesion._id}/registros`
      );
      if (solicitudRef.current.registros !== solicitud || contextoRef.current !== contextoApertura) return;
      const roster = alumnos.filter((al) => al.periodoId === periodoId && al.grupo === sesion.grupo && al.activo !== false);
      const init: Record<string, RegistroLocal> = {};
      roster.forEach((al) => { init[al._id] = { alumnoId: al._id, estado: 'P' }; });
      data.registros.forEach((r) => { if (init[r.alumnoId]) init[r.alumnoId] = r; });
      setRegistros(init);
      setEstadoRegistros('ready');
      setSesionParaReintento(null);
      setAvisoPresenciaInicial(false);
    } catch {
      if (solicitudRef.current.registros !== solicitud || contextoRef.current !== contextoApertura) return;
      setRegistros({});
      setEstadoRegistros('error');
    }
  }

  // ─── Crear/actualizar regla ─────────────────────────────────────────────────
  async function guardarRegla() {
    if (!puedeGestionar || !periodoId || guardandoReglaRef.current) return;
    guardandoReglaRef.current = true;
    setGuardandoRegla(true);
    try {
      await clienteApi.enviar('/asistencias/reglas', {
        periodoId,
        grupo: grupo || null,
        maxFaltas: nuevaReglaMax,
        accion: nuevaReglaAccion,
        excepcionPermitida: true,
        contarRetardos: nuevaReglaContarRetardos,
        retardosEquivalenFalta: nuevaReglaRetardosEquivalen
      });
      emitToast({ level: 'ok', title: 'Regla guardada', message: `Máximo ${nuevaReglaMax} faltas. Acción: ${nuevaReglaAccion === 'bloquear_examen' ? 'bloquear examen' : 'advertir al docente'}.` });
      void cargarReglas();
    } catch (error) {
      notificarErrorAsistencias(
        'No se pudo guardar la regla',
        error,
        'No se confirmó el guardado. Revisa las reglas vigentes antes de volver a guardar.'
      );
    } finally {
      guardandoReglaRef.current = false;
      setGuardandoRegla(false);
    }
  }

  // ─── Autorizar excepción ────────────────────────────────────────────────────
  async function autorizarExcepcion(alumnoId: string, nombreCompleto: string) {
    if (!puedeGestionar) return;
    const motivo = window.prompt(`Motivo de excepción para ${nombreCompleto}:`);
    if (motivo === null) return;
    try {
      await clienteApi.enviar('/asistencias/excepciones', { alumnoId, periodoId, motivo });
      emitToast({ level: 'ok', title: 'Excepción autorizada', message: nombreCompleto });
      void cargarResumen();
    } catch (error) {
      notificarErrorAsistencias(
        'No se pudo autorizar la excepción',
        error,
        'No se confirmó la autorización. Revisa el resumen antes de volver a autorizarla.'
      );
    }
  }

  return (
    <div className="panel asistencias-panel anim-fade-in">
      {/* ── 1. Cabecera Ejecutiva Bento con Mini-KPIs ─── */}
      <div className="asistencias-panel__head">
        <div className="asistencias-panel__lead">
          <div className="icono-seccion-orb asistencias-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <IconoLucide icon={ClipboardCheck} size={26} />
          </div>
          <div className="asistencias-panel__text-block">
            <div className="asistencias-panel__meta-row">
              <span className="asistencias-status-pill">
                <span className="asistencias-pulse-dot" aria-hidden="true" />
                <span>Seguimiento de asistencia</span>
              </span>
              <span className="asistencias-counter-tag">
                {periodoSeleccionado ? periodoSeleccionado.nombre : 'Sin materia seleccionada'}
              </span>
            </div>
            <h2 className="asistencias-panel__title asistencias-titulo">Asistencias</h2>
            <p className="nota">Registra sesiones, revisa asistencias y consulta la elegibilidad para examen.</p>
          </div>
        </div>

        <div className="asistencias-header-kpis">
          <div className="asistencia-mini-kpi asistencia-mini-kpi--sesiones anim-kpi-hover" data-tooltip="Total de sesiones de clase registradas">
            <span className="asistencia-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={CalendarDays} size={16} />
            </span>
            <span className="asistencia-mini-kpi__num">{estadoSesiones === 'ready' ? kpis.totalSesiones : '—'}</span>
            <span className="asistencia-mini-kpi__lbl">Sesiones</span>
          </div>

          <div className="asistencia-mini-kpi asistencia-mini-kpi--alumnos anim-kpi-hover" data-tooltip={ayudaKpiAlumnos}>
            <span className="asistencia-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={UsersRound} size={16} />
            </span>
            <span className="asistencia-mini-kpi__num">{periodoId ? kpis.totalAlumnos : '—'}</span>
            <span className="asistencia-mini-kpi__lbl">{etiquetaKpiAlumnos}</span>
          </div>

          <div className="asistencia-mini-kpi asistencia-mini-kpi--promedio anim-kpi-hover" data-tooltip={ayudaKpiPromedio}>
            <span className="asistencia-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={Clock3} size={16} />
            </span>
            <span className="asistencia-mini-kpi__num">{estadoResumen === 'ready' && resumen.length ? `${kpis.promedioPct}%` : '—'}</span>
            <span className="asistencia-mini-kpi__lbl">Asistencia promedio</span>
          </div>

          <div className="asistencia-mini-kpi asistencia-mini-kpi--sin-derecho anim-kpi-hover" data-tooltip={ayudaKpiBloqueados}>
            <span className="asistencia-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={CircleX} size={16} />
            </span>
            <span className="asistencia-mini-kpi__num">{estadoResumen === 'ready' ? kpis.sinDerechoCount : '—'}</span>
            <span className="asistencia-mini-kpi__lbl">Examen bloqueado</span>
          </div>
        </div>
        <p className="sr-only" role="status" aria-label="Estado del resumen de asistencia">{anuncioResumen}</p>
      </div>

      {/* ── 2. Guía Visual Bento ─── */}
      <GuiaAsistenciasVisual />

      {/* ── 3. Barra Panorámica de Selección y Filtros ─── */}
      <div className="asistencias-filtros-bar anim-form-card">
        <div className="asistencias-filtros-bar__row">
          <div className="asistencias-filtros-col">
            <label className="asistencias-label-field">
              <span className="asistencias-field-lbl">
                <IconoLucide icon={BookOpenText} size={14} />
                <span className="asistencias-field-lbl__text">Materia o Periodo Académico</span>
              </span>
              <div className="auth-input-box auth-input-box--book auth-input-box--animated">
                <IconoCampo nombre="book" />
                <select
                  value={periodoId}
                  onChange={(e) => { setPeriodoId(e.target.value); setGrupo(''); }}
                  className="asistencias-select-field asistencias-select"
                >
                  <option value="">— Selecciona periodo —</option>
                  {periodos.filter((p) => p.activo !== false).map((p) => (
                    <option key={p._id} value={p._id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          {gruposDisponibles.length > 0 && (
            <div className="asistencias-filtros-col">
              <label className="asistencias-label-field">
                <span className="asistencias-field-lbl">
                  <IconoLucide icon={Tags} size={14} />
                  Filtrar por Grupo
                </span>
                <div className="auth-input-box auth-input-box--tags auth-input-box--animated">
                  <IconoCampo nombre="tags" />
                  <select
                    value={grupo}
                    onChange={(e) => setGrupo(e.target.value)}
                    className="asistencias-select-field asistencias-select"
                  >
                    <option value="">Todos los grupos</option>
                    {gruposDisponibles.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Chips de Selección Rápida de Grupo */}
        {gruposDisponibles.length > 0 && (
          <div className="asistencias-quick-group-chips">
            <span className="asistencias-quick-label">Grupo rápido:</span>
            <button
              type="button"
              className={`alumnos-group-chip ${grupo === '' ? 'alumnos-group-chip--active' : ''}`}
              aria-pressed={grupo === ''}
              onClick={() => setGrupo('')}
            >
              Todos ({alumnosPeriodo.length})
            </button>
            {gruposDisponibles.map((g) => {
              const count = alumnosPeriodo.filter((a) => a.grupo === g).length;
              return (
                <button
                  key={g}
                  type="button"
                  className={`alumnos-group-chip ${grupo === g ? 'alumnos-group-chip--active' : ''}`}
                  aria-pressed={grupo === g}
                  onClick={() => setGrupo(g)}
                >
                  {g} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 4. Navegación por Tabs Modernizada ─── */}
      <div className="asistencias-tabs-bar" role="tablist" aria-label="Secciones de asistencias">
        {(['resumen', 'pase_lista', 'reglas'] as const).map((t) => (
          <button
            key={t}
            id={`asistencias-tab-${t}`}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-controls={`asistencias-panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(event) => {
              const tabs: TabActivo[] = ['resumen', 'pase_lista', 'reglas'];
              const index = tabs.indexOf(t);
              const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
                : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
                  : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
              if (next >= 0) {
                event.preventDefault();
                setTab(tabs[next]);
                document.getElementById(`asistencias-tab-${tabs[next]}`)?.focus();
              }
            }}
            className={`asistencias-tab-btn ${tab === t ? 'activo' : ''}`}
          >
            {t === 'resumen' && (
              <>
                <IconoLucide icon={ChartNoAxesColumnIncreasing} size={16} />
                <span>Resumen General</span>
              </>
            )}
            {t === 'pase_lista' && (
              <>
                <IconoLucide icon={ClipboardCheck} size={16} />
                <span>Pase de Lista</span>
              </>
            )}
            {t === 'reglas' && (
              <>
                <IconoLucide icon={Settings2} size={16} />
                <span>Reglas y Tolerancias</span>
              </>
            )}
          </button>
        ))}
      </div>

      {/* ── 5. Estado Vacío Interactivo cuando No Hay Periodo Seleccionado ─── */}
      {!periodoId ? (
        <div id={`asistencias-panel-${tab}`} role="tabpanel" aria-labelledby={`asistencias-tab-${tab}`} tabIndex={0} className="empty-state-card anim-fade-in">
          <div className="empty-state-card__icon anim-icon-pulse">
            <Icono nombre="asistencias" size={28} />
          </div>
          <h4>Comienza seleccionando una materia</h4>
          <p>Selecciona una de tus asignaturas activas para cargar las listas de asistencia, iniciar el pase de lista y monitorear el derecho a examen.</p>

          {periodos.length > 0 && (
            <div className="asistencias-quick-periodos-grid">
              {periodos.filter(p => p.activo !== false).map((p) => (
                <button
                  key={p._id}
                  type="button"
                  className="asistencia-materia-pick-card anim-card-hover"
                  onClick={() => setPeriodoId(p._id)}
                >
                  <div className="asistencia-materia-pick-avatar">
                    {obtenerIniciales(p.nombre)}
                  </div>
                  <div className="asistencia-materia-pick-info">
                    <strong>{p.nombre}</strong>
                    <span>Grupos: {Array.isArray(p.grupos) && p.grupos.length > 0 ? p.grupos.join(', ') : 'General'}</span>
                  </div>
                  <div className="asistencia-materia-pick-arrow" aria-hidden="true"><IconoLucide icon={ArrowRight} size={18} /></div>
                </button>
              ))}
            </div>
          )}

          <div className="empty-state-steps" aria-hidden="true">
            <div className="empty-step">
              <span className="empty-step__num">1</span>
              <span>Selecciona tu materia</span>
            </div>
            <div className="empty-step__arrow"><IconoLucide icon={ArrowRight} size={14} /></div>
            <div className="empty-step">
              <span className="empty-step__num">2</span>
              <span>Marca y revisa la asistencia</span>
            </div>
            <div className="empty-step__arrow"><IconoLucide icon={ArrowRight} size={14} /></div>
            <div className="empty-step">
              <span className="empty-step__num">3</span>
              <span>Consulta elegibilidad de examen</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ── TAB RESUMEN ─── */}
          {tab === 'resumen' && (
            <div id="asistencias-panel-resumen" role="tabpanel" aria-labelledby="asistencias-tab-resumen" tabIndex={0} className="anim-fade-in">
              {/* Nueva sesión rápida Bento Hero Form */}
              <div className="panel asistencias-panel-card asistencias-hero-card anim-card-hover">
                <div className="asistencias-card-head">
                  <div className="asistencias-card-head__text">
                    <h3 className="asistencias-sub-title"><Icono nombre="nuevo" /> Registrar nueva sesión de clase</h3>
                    <p className="asistencias-sub-desc">Crea una sesión para pasar lista manualmente o mediante lectura de folios QR.</p>
                  </div>
                  <div className="asistencias-card-head__badge">
                    <span className="asistencias-pulse-dot" aria-hidden="true" />
                    <span>Sesión #{sesiones.length + 1}</span>
                  </div>
                </div>
                <div className="asistencias-form-crear">
                  <div className="asistencias-form-crear__grid">
                    <label className="asistencias-field-col asistencias-field-col--fecha">
                      <span>Fecha de clase</span>
                      <div className="auth-input-box auth-input-box--animated">
                        <input
                          type="date"
                          value={nuevaSesionFecha}
                          onChange={(e) => setNuevaSesionFecha(e.target.value)}
                          className="asistencias-input"
                        />
                      </div>
                    </label>

                    {gruposDisponibles.length > 0 && (
                      <label className="asistencias-field-col asistencias-field-col--grupo">
                        <span>Grupo académico</span>
                        <div className="auth-input-box asistencias-input-box auth-input-box--animated">
                          <IconoLucide icon={Tags} size={16} />
                          <select
                            value={nuevaSesionGrupo}
                            onChange={(e) => setNuevasSesionGrupo(e.target.value)}
                            className="asistencias-select"
                          >
                            <option value="">{grupo ? `Grupo ${grupo}` : 'Todos los grupos'}</option>
                            {gruposDisponibles.map((g) => <option key={g} value={g}>Grupo {g}</option>)}
                          </select>
                        </div>
                      </label>
                    )}

                    <label className="asistencias-field-col asistencias-field-col--tema">
                      <span>Tema o contenido temático cubierto</span>
                      <div className="auth-input-box asistencias-input-box auth-input-box--animated">
                        <IconoLucide icon={BookOpenText} size={16} />
                        <input
                          type="text"
                          placeholder="Ej. Unidad 2"
                          value={nuevaSesionTema}
                          onChange={(e) => setNuevaSesionTema(e.target.value)}
                          className="asistencias-input"
                        />
                      </div>
                    </label>

                    <div className="asistencias-field-col asistencias-field-col--cta">
                      <Boton
                        type="button"
                        onClick={() => void crearSesion()}
                        disabled={!puedeGestionar}
                        aria-describedby={!puedeGestionar ? 'asistencias-solo-lectura' : undefined}
                        className="asistencias-btn-primario boton--crear-sesion"
                        icono={<IconoLucide icon={Plus} size={16} />}
                      >
                        Crear e Iniciar Pase de Lista
                      </Boton>
                    </div>
                  </div>
                </div>
                {!puedeGestionar && <p id="asistencias-solo-lectura" className="nota" role="status">Tienes acceso de solo lectura a asistencias.</p>}
              </div>

              {/* Barra de Búsqueda y Filtros de Asistencia */}
              {resumen.length > 0 && (
                <div className="asistencias-table-toolbar anim-fade-in">
                  <div className="asistencias-search-box">
                    <span className="asistencias-search-icon" aria-hidden="true"><Icono nombre="buscar" size={18} /></span>
                    <input
                      type="text"
                      placeholder="Buscar alumno por nombre o matrícula…"
                      value={filtroTexto}
                      onChange={(e) => setFiltroTexto(e.target.value)}
                      className="asistencias-search-input"
                    />
                    {filtroTexto && (
                      <button
                        type="button"
                        onClick={() => setFiltroTexto('')}
                        className="asistencias-search-clear"
                        title="Limpiar búsqueda"
                      >
                        <IconoLucide icon={X} size={16} />
                      </button>
                    )}
                  </div>
                  <div className="asistencias-filter-chips">
                    <button
                      type="button"
                      className={`asistencias-chip ${filtroEstado === 'todos' ? 'asistencias-chip--active' : ''}`}
                      onClick={() => setFiltroEstado('todos')}
                    >
                      Todos ({resumen.length})
                    </button>
                    <button
                      type="button"
                      className={`asistencias-chip ${filtroEstado === 'con_derecho' ? 'asistencias-chip--active' : ''}`}
                      onClick={() => setFiltroEstado('con_derecho')}
                    >
                      <IconoLucide icon={CircleCheck} size={15} /> Sin bloqueo ({resumen.filter((r) => !r.bloqueadoExamen).length})
                    </button>
                    <button
                      type="button"
                      className={`asistencias-chip asistencias-chip--danger ${filtroEstado === 'sin_derecho' ? 'asistencias-chip--active' : ''}`}
                      onClick={() => setFiltroEstado('sin_derecho')}
                    >
                      <IconoLucide icon={CircleX} size={15} /> Examen bloqueado ({resumen.filter((r) => r.bloqueadoExamen).length})
                    </button>
                  </div>
                </div>
              )}

              {/* Tabla resumen de alumnos */}
              {cargando ? (
                <div className="asistencias-loading-box anim-fade-in">
                  <div className="asistencias-panel__icon-orb anim-icon-pulse" aria-hidden="true"><IconoLucide icon={LoaderCircle} size={24} /></div>
                  <p>Cargando resumen de asistencias…</p>
                </div>
              ) : estadoResumen === 'error' ? (
                <div>
                  <InlineMensaje tipo="error">No se pudo cargar el resumen. La información de elegibilidad no está disponible.</InlineMensaje>
                  <Boton type="button" variante="secundario" onClick={() => void cargarResumen()}>Reintentar resumen</Boton>
                </div>
              ) : estadoResumen === 'ready' && resumen.length === 0 ? (
                <div className="empty-state-card anim-fade-in">
                  <div className="empty-state-card__icon anim-icon-pulse">
                    <Icono nombre="asistencias" size={28} />
                  </div>
                  <h4>Sin sesiones registradas aún</h4>
                  <p className="nota">
                    Crea tu primera sesión de clase arriba para comenzar a tomar asistencia y calcular el semáforo académico.
                  </p>
                </div>
              ) : estadoResumen === 'ready' ? (
                <>
                  <p id="asistencias-tabla-ayuda" className="nota asistencias-table-scroll-hint">
                    Con el teclado, enfoca la tabla y pulsa las flechas para desplazar sus columnas; también puedes deslizarla. Abreviaturas: P, presentes; F, faltas; R, retardos; J, justificadas.
                  </p>
                  {/* Habilita el desplazamiento horizontal de la tabla con teclado. */}
                  {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- El foco permite desplazar esta región de tabla con teclado. */}
                  <div className="table-scroll-container anim-fade-in asistencias-table-scroll" role="region" aria-label="Resumen de asistencia por alumno" aria-describedby="asistencias-tabla-ayuda" tabIndex={0}>
                  <table className="asistencias-tabla">
                    <caption className="sr-only">Resumen de asistencia del periodo seleccionado por alumno</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="asistencias-th">Alumno</th>
                        <th scope="col" className="asistencias-th">Matrícula</th>
                        <th scope="col" className="asistencias-th">Grupo</th>
                        <th scope="col" className="asistencias-th" title="Presentes"><span aria-hidden="true">P</span><span className="sr-only">Presentes</span></th>
                        <th scope="col" className="asistencias-th" title="Faltas"><span aria-hidden="true">F</span><span className="sr-only">Faltas</span></th>
                        <th scope="col" className="asistencias-th" title="Retardos"><span aria-hidden="true">R</span><span className="sr-only">Retardos</span></th>
                        <th scope="col" className="asistencias-th" title="Justificadas"><span aria-hidden="true">J</span><span className="sr-only">Justificadas</span></th>
                        <th scope="col" className="asistencias-th"><span aria-hidden="true">% Asist.</span><span className="sr-only">Porcentaje de asistencia</span></th>
                        <th scope="col" className="asistencias-th">Derecho a Examen</th>
                        <th scope="col" className="asistencias-th">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumenFiltrado.map((al) => {
                        const matriculaLimpia = al.matricula && !/^\d{15,}$/.test(al.matricula) ? al.matricula : '';
                        const porcentajeMostrar = al.totalSesiones > 0 ? `${al.porcentajeAsistencia}%` : '100%';
                        const iniciales = obtenerIniciales(al.nombreCompleto);
                        return (
                          <tr key={al.alumnoId} className="asistencias-tr anim-slide-up">
                            <td className="asistencias-td">
                              <div className="asistencia-alumno-cell">
                                <div className="asistencia-avatar-sm" aria-hidden="true">
                                  <span>{iniciales}</span>
                                </div>
                                <strong>{al.nombreCompleto}</strong>
                              </div>
                            </td>
                            <td className="asistencias-td font-code">
                              <span className="asistencia-matricula-badge">{matriculaLimpia || '—'}</span>
                            </td>
                            <td className="asistencias-td">
                              <span className="asistencia-grupo-pill">{al.grupo}</span>
                            </td>
                            <td className="asistencias-td asistencias-p-stat font-bold">{al.presentes}</td>
                            <td className="asistencias-td asistencias-f-stat font-bold">{al.faltas}</td>
                            <td className="asistencias-td asistencias-r-stat font-bold">{al.retardos}</td>
                            <td className="asistencias-td asistencias-j-stat font-bold">{al.justificadas}</td>
                            <td className="asistencias-td">
                              <span
                                className={`asistencias-pct-badge ${
                                  al.totalSesiones === 0 || al.porcentajeAsistencia >= 85 ? 'green' : al.porcentajeAsistencia >= 70 ? 'orange' : 'red'
                                }`}
                                title={`${al.presentes} presentes de ${al.totalSesiones} sesiones`}
                              >
                                {porcentajeMostrar}
                              </span>
                            </td>
                            <td className="asistencias-td">
                              {al.bloqueadoExamen ? (
                                <span title="Examen bloqueado por inasistencias" className="asistencias-badge-pill sin-derecho anim-badge-in">
                                  <IconoLucide icon={CircleX} size={14} /> Examen bloqueado
                                </span>
                              ) : al.tieneExcepcion ? (
                                <span title="Excepción autorizada" className="asistencias-badge-pill autorizado anim-badge-in">
                                  <IconoLucide icon={FileCheck2} size={14} /> Autorizado
                                </span>
                              ) : (
                                <span title="Sin bloqueo de examen" className="asistencias-badge-pill con-derecho anim-badge-in">
                                  <IconoLucide icon={CircleCheck} size={14} /> Sin bloqueo
                                </span>
                              )}
                            </td>
                            <td className="asistencias-td">
                              {al.bloqueadoExamen ? (
                                <Boton
                                  variante="secundario"
                                  type="button"
                                  onClick={() => void autorizarExcepcion(al.alumnoId, al.nombreCompleto)}
                                  disabled={!puedeGestionar}
                                  className="asistencias-btn-autorizar anim-fade-in"
                                  icono={<IconoLucide icon={ShieldCheck} size={16} />}
                                >
                                  Autorizar Excepción
                                </Boton>
                              ) : (
                                <Boton
                                  variante="secundario"
                                  type="button"
                                  onClick={() => setTab('pase_lista')}
                                  className="asistencias-btn-fila-pase"
                                  icono={<IconoLucide icon={ClipboardCheck} size={16} />}
                                >
                                  Pase de Lista
                                </Boton>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </>
              ) : null}

              {/* Sesiones anteriores */}
              {estadoSesiones === 'error' && <div><InlineMensaje tipo="error">No se pudieron cargar las sesiones registradas.</InlineMensaje><Boton type="button" variante="secundario" onClick={() => void cargarSesiones()}>Reintentar sesiones</Boton></div>}
              {estadoSesiones === 'ready' && sesiones.length > 0 && (
                <div className="asistencias-panel-card anim-card-hover">
                  <div className="asistencias-card-head">
                    <h3 className="asistencias-sub-title"><Icono nombre="periodos" /> Sesiones Registradas ({sesiones.length})</h3>
                    <p className="asistencias-sub-desc">Haz clic en cualquier sesión para ver o editar el pase de lista.</p>
                  </div>
                  <div className="asistencias-sesiones-grid">
                    {sesiones.map((s) => (
                      <button
                        key={s._id}
                        onClick={() => void abrirSesion(s)}
                        className="asistencias-sesion-card anim-card-hover"
                      >
                        <div className="asistencias-sesion-card__header">
                          <span className="asistencias-sesion-card__date">
                            <Icono nombre="periodos" size={15} /> {formatFecha(s.fecha)}
                          </span>
                          <span className="asistencia-grupo-pill">{s.grupo}</span>
                        </div>
                        {s.temaNombre && (
                          <p className="asistencias-sesion-card__topic">{s.temaNombre}</p>
                        )}
                        <div className="asistencias-sesion-card__footer">
                          <span>Editar lista <IconoLucide icon={ArrowRight} size={14} /></span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB PASE DE LISTA ─── */}
          {tab === 'pase_lista' && (
            <div id="asistencias-panel-pase_lista" role="tabpanel" aria-labelledby="asistencias-tab-pase_lista" tabIndex={0} className="anim-fade-in">
              {!sesionActual ? (
                <div className="empty-state-card anim-fade-in">
                  <div className="empty-state-card__icon anim-icon-pulse">
                    <IconoLucide icon={ClipboardCheck} size={28} />
                  </div>
                  <h4>No hay sesión seleccionada</h4>
                  <p className="nota">
                    Crea una nueva sesión o selecciona una existente desde la pestaña <strong>Resumen</strong> para iniciar el pase de lista.
                  </p>
                  <Boton variante="secundario" type="button" onClick={() => setTab('resumen')}>
                    <IconoLucide icon={ArrowLeft} size={16} /> Volver al resumen
                  </Boton>
                </div>
              ) : (
                <>
                  {/* Banner de Sesión Activa con Acciones Rápidas */}
                  <div className="asistencias-subpanel-header anim-form-card">
                    <div className="asistencias-sesion-hero-info">
                      <span className="asistencias-status-pill">
                        <span className="asistencias-pulse-dot" aria-hidden="true" />
                        <span>Sesión Activa</span>
                      </span>
                      <h3>
                        <strong>{formatFecha(sesionActual.fecha)}</strong> — Grupo <strong>{sesionActual.grupo}</strong>
                        {sesionActual.temaNombre && <span className="nota"> · {sesionActual.temaNombre}</span>}
                      </h3>
                    </div>

                    <div className="asistencias-action-buttons-bar">
                      <Boton
                        variante="secundario"
                        type="button"
                        disabled={estadoRegistros !== 'ready'}
                        onClick={() => {
                          const all: Record<string, RegistroLocal> = {};
                          alumnosSesion.forEach((a) => { all[a._id] = { alumnoId: a._id, estado: 'P' }; });
                          setRegistros(all);
                          setAvisoPaseRapido('Se marcó a todo el grupo como Presente. Revisa cada registro antes de guardar.');
                        }}
                        icono={<IconoLucide icon={CheckCheck} size={14} />}
                      >
                        Todos Presentes
                      </Boton>

                      <Boton
                        type="button"
                        onClick={() => void guardarPaseLista()}
                        cargando={guardando}
                        disabled={!puedeGestionar || guardando || estadoRegistros !== 'ready'}
                        className="asistencias-btn-primario boton--guardar-lista pulse-glow"
                        icono={<IconoLucide icon={Save} size={14} />}
                      >
                        {guardando ? 'Guardando…' : 'Guardar lista'}
                      </Boton>
                    </div>
                  </div>

                  {avisoPaseRapido && <InlineMensaje tipo="ok">{avisoPaseRapido}</InlineMensaje>}
                  {estadoRegistros === 'loading' && <InlineMensaje tipo="info">Cargando los registros guardados de la sesión…</InlineMensaje>}
                  {estadoRegistros === 'error' && <div><InlineMensaje tipo="error">No se pudieron cargar los registros. No edites ni guardes esta lista hasta reintentar.</InlineMensaje>{sesionParaReintento && <Boton type="button" variante="secundario" onClick={() => void abrirSesion(sesionParaReintento)}>Reintentar carga de lista</Boton>}</div>}

                  {/* Barra de Leyenda Interactiva */}
                  <div className="asistencias-legend-bar anim-fade-in">
                    <div className="asistencias-legend-items">
                      {(['P', 'F', 'R', 'J'] as const).map((e) => (
                        <span key={e} className="asistencias-legend-chip">
                          <span className={`asistencias-legend-dot asistencias-badge-dot-${e.toLowerCase()}`} />
                          <strong>{ESTADO_LABEL[e]} ({e})</strong>
                        </span>
                      ))}
                    </div>
                    <span className="nota asistencias-legend-hint">Selecciona cada estado por su nombre; la letra es solo una referencia breve.</span>
                  </div>
                  {avisoPresenciaInicial && <InlineMensaje tipo="info">La nueva sesión inicia con todos los alumnos como Presentes. Revisa y ajusta cada registro antes de guardar.</InlineMensaje>}

                  {/* Lista interactiva Fast-Check */}
                  <div className="asistencias-fastcheck-grid">
                    {alumnosSesion.map((al, idx) => {
                      const reg = registros[al._id] ?? { alumnoId: al._id, estado: 'P' as const };
                      const iniciales = obtenerIniciales(al.nombreCompleto);
                      return (
                        <div
                          key={al._id}
                          className={`asistencias-alumno-row anim-slide-up ${reg.estado === 'F' ? 'falta' : reg.estado === 'R' ? 'retardo' : reg.estado === 'J' ? 'justificada' : 'presente'}`}
                        >
                          <span className="asistencias-alumno-num">{idx + 1}</span>

                          <div className="asistencia-avatar-sm" aria-hidden="true">
                            <span>{iniciales}</span>
                          </div>

                          <div className="asistencias-alumno-info">
                            <span className="font-bold asistencias-alumno-name">{al.nombreCompleto}</span>
                            <span className="font-code nota asistencias-alumno-matricula">{al.matricula}</span>
                          </div>

                          <div className="asistencias-estado-controls" role="group" aria-label={`Estado de asistencia para ${al.nombreCompleto}`}>
                            {(['P', 'F', 'R', 'J'] as const).map((estado) => (
                              <button
                                key={estado}
                                type="button"
                                className="asistencias-estado-control"
                                aria-label={`Marcar a ${al.nombreCompleto} como ${ESTADO_LABEL[estado]}`}
                                aria-pressed={reg.estado === estado}
                                disabled={!puedeGestionar || estadoRegistros !== 'ready'}
                                onClick={() => establecerEstado(al._id, estado)}
                              >
                                <IconoLucide icon={ESTADO_ICONO[estado]} size={16} />
                                {reg.estado === estado && <IconoLucide icon={Check} size={13} />}
                                <span>{ESTADO_LABEL[estado]}</span>
                              </button>
                            ))}
                          </div>

                          {reg.estado === 'J' && (
                            <input
                              type="text"
                              aria-label={`Motivo de justificación para ${al.nombreCompleto}`}
                              placeholder="Motivo de justificación…"
                              maxLength={300}
                              value={reg.justificacion ?? ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                setRegistros((prev) => ({ ...prev, [al._id]: { ...reg, justificacion: e.target.value } }));
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                              className="asistencias-input asistencias-alumno-input-justificacion anim-fade-in"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── TAB REGLAS ─── */}
          {tab === 'reglas' && (
            <div id="asistencias-panel-reglas" role="tabpanel" aria-labelledby="asistencias-tab-reglas" tabIndex={0} className="anim-fade-in">
              <div className="panel asistencias-panel-card anim-card-hover">
                <div className="asistencias-card-head">
                  <h3 className="asistencias-sub-title"><IconoLucide icon={Settings2} size={18} /> Configurar regla de asistencia y derecho a examen</h3>
                  <p className="asistencias-sub-desc">Establece el número máximo de faltas permitidas antes de bloquear el derecho a examen.</p>
                </div>

                {!puedeGestionar && <p className="nota" role="status">La configuración está disponible en modo de solo lectura.</p>}
              {estadoReglas === 'loading' && <InlineMensaje tipo="info">Cargando reglas de asistencia…</InlineMensaje>}
              {estadoReglas === 'error' && <div><InlineMensaje tipo="error">No se pudieron cargar las reglas vigentes.</InlineMensaje><Boton type="button" variante="secundario" onClick={() => void cargarReglas()}>Reintentar reglas</Boton></div>}
              {estadoReglas === 'ready' && reglas.length === 0 && <InlineMensaje tipo="info">No hay reglas configuradas para este periodo todavía.</InlineMensaje>}
                <div className="asistencias-config-grid">
                  <label className="asistencias-form-col">
                    <span className="asistencias-field-lbl">Máximo de faltas permitidas</span>
                    <div className="auth-input-box auth-input-box--animated">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={nuevaReglaMax}
                        onChange={(e) => setNuevaReglaMax(Number(e.target.value))}
                        disabled={!puedeGestionar}
                        className="asistencias-input asistencias-input-num-sm"
                      />
                    </div>
                  </label>

                  <label className="asistencias-form-col">
                    <span className="asistencias-field-lbl">Acción al superar el límite</span>
                    <div className="auth-input-box auth-input-box--animated">
                      <select
                        value={nuevaReglaAccion}
                        onChange={(e) => setNuevaReglaAccion(e.target.value as 'bloquear_examen' | 'advertir')}
                        disabled={!puedeGestionar}
                        aria-describedby={ayudaAccionReglaId}
                        className="asistencias-select"
                      >
                        <option value="bloquear_examen">Bloquear examen</option>
                        <option value="advertir">Solo advertir</option>
                      </select>
                    </div>
                    <span id={ayudaAccionReglaId} className="nota">
                      {nuevaReglaAccion === 'bloquear_examen'
                        ? 'Al superar el máximo, bloquea el examen; las excepciones se autorizan desde Resumen.'
                        : 'Al superar el máximo, muestra una advertencia sin bloquear el examen.'}
                    </span>
                  </label>

                </div>

                {/* Sección retardos */}
                <div className="asistencias-config-retardo-box">
                  <label className="asistencias-checkbox-label">
                    <input
                      type="checkbox"
                      checked={nuevaReglaContarRetardos}
                      onChange={(e) => setNuevaReglaContarRetardos(e.target.checked)}
                      disabled={!puedeGestionar}
                    />
                    <span>Contar retardos como faltas equivalentes</span>
                    <span className="nota">(desactivado por defecto)</span>
                  </label>

                  {nuevaReglaContarRetardos && (
                    <div className="asistencias-retardos-details anim-slide-up">
                      <label className="asistencias-chip-grid">
                        <span>Retardos equivalentes a 1 falta:</span>
                        <input
                          type="number"
                          min={2}
                          max={10}
                          value={nuevaReglaRetardosEquivalen}
                          onChange={(e) => setNuevaReglaRetardosEquivalen(Number(e.target.value))}
                          disabled={!puedeGestionar}
                          className="asistencias-input asistencias-input-num-xs"
                        />
                        <span className="nota">
                          ({nuevaReglaRetardosEquivalen} retardos = 1 falta acumulada)
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                <div className="asistencias-form-col asistencias-form-col--btn">
                  <Boton
                    type="button"
                    onClick={() => void guardarRegla()}
                    disabled={!puedeGestionar || guardandoRegla}
                    cargando={guardandoRegla}
                    className="asistencias-btn-primario boton--guardar-regla"
                    icono={<IconoLucide icon={Save} size={14} />}
                  >
                    {guardandoRegla ? 'Guardando regla…' : 'Guardar regla'}
                  </Boton>
                </div>

                <p className="nota asistencias-regla-footer-hint">
                  <IconoLucide icon={Info} size={15} /> La regla aplica a la materia actual {grupo ? `y al grupo "${grupo}"` : '(todos los grupos)'}. Puedes autorizar excepciones individuales en cualquier momento desde la pestaña Resumen.
                </p>
              </div>

              {/* Reglas existentes */}
              {estadoReglas === 'ready' && reglas.length > 0 && (
                <div className="asistencias-panel-card anim-card-hover">
                  <div className="asistencias-card-head">
                    <h3 className="asistencias-sub-title">Reglas Activas ({reglas.length})</h3>
                  </div>
                  <div className="asistencias-reglas-grid">
                    {reglas.map((r) => (
                      <div key={r._id} className="asistencias-regla-card anim-slide-up">
                        <div className="asistencias-regla-card__icon" aria-hidden="true">
                          <IconoLucide icon={ShieldCheck} size={18} />
                        </div>
                        <div className="asistencias-regla-card__body">
                          <strong>Máximo {r.maxFaltas} faltas</strong>
                          <span className="nota">
                            Acción: {r.accion === 'bloquear_examen' ? 'Bloquear examen' : 'Advertir'}
                            {r.grupo ? ` · Grupo: ${r.grupo}` : ' · Todos los grupos'}
                          </span>
                          {r.contarRetardos && (
                            <span className="asistencias-r-stat">
                              · Equivalencia: {r.retardosEquivalenFalta} retardos por cada falta
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {(['resumen', 'pase_lista', 'reglas'] as const).filter((panel) => panel !== tab).map((panel) => (
        <div key={panel} id={`asistencias-panel-${panel}`} role="tabpanel" aria-labelledby={`asistencias-tab-${panel}`} hidden />
      ))}
    </div>
  );
}
