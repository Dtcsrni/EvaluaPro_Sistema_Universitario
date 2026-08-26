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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clienteApi } from './clienteApiDocente';
import { emitToast } from '../../ui/toast/toastBus';
import { Boton } from '../../ui/ux/componentes/Boton';
import { GuiaAsistenciasVisual } from './GuiaAsistenciasVisual';
import type { Alumno, Periodo } from './tipos';

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

export function SeccionAsistencias({ periodos, alumnos }: Props) {
  const [tab, setTab] = useState<TabActivo>('resumen');
  const [periodoId, setPeriodoId] = useState('');
  const [grupo, setGrupo] = useState('');
  const [sesiones, setSesiones] = useState<SesionAsistencia[]>([]);
  const [sesionActual, setSesionActual] = useState<SesionAsistencia | null>(null);
  const [registros, setRegistros] = useState<Record<string, RegistroLocal>>({});
  const [resumen, setResumen] = useState<ResumenAlumno[]>([]);
  const [reglas, setReglas] = useState<ReglaAsistencia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Formulario nueva sesión
  const [nuevaSesionFecha, setNuevaSesionFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [nuevaSesionGrupo, setNuevasSesionGrupo] = useState('');
  const [nuevaSesionTema, setNuevaSesionTema] = useState('');

  // Formulario nueva regla
  const [nuevaReglaMax, setNuevaReglaMax] = useState(3);
  const [nuevaReglaAccion, setNuevaReglaAccion] = useState<'bloquear_examen' | 'advertir'>('bloquear_examen');
  const [nuevaReglaContarRetardos, setNuevaReglaContarRetardos] = useState(false);
  const [nuevaReglaRetardosEquivalen, setNuevaReglaRetardosEquivalen] = useState(3);

  // Periodo seleccionado
  const periodoSeleccionado = useMemo(() => {
    return periodos.find((per) => per._id === periodoId);
  }, [periodos, periodoId]);

  // Grupos del periodo seleccionado
  const gruposDisponibles = useMemo(() => {
    return periodoSeleccionado?.grupos ?? [];
  }, [periodoSeleccionado]);

  // Alumnos del grupo seleccionado
  const alumnosGrupo = useMemo(() => {
    if (!grupo) return alumnos.filter((a) => a.activo !== false);
    return alumnos.filter((a) => a.grupo === grupo && a.activo !== false);
  }, [alumnos, grupo]);

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

  const cargarSesiones = useCallback(async () => {
    if (!periodoId) return;
    try {
      const data = await clienteApi.obtener<{ sesiones: SesionAsistencia[] }>(
        `/asistencias/sesiones?periodoId=${periodoId}${grupo ? `&grupo=${encodeURIComponent(grupo)}` : ''}`
      );
      setSesiones(data.sesiones ?? []);
    } catch {
      /* silencioso */
    }
  }, [periodoId, grupo]);

  const cargarResumen = useCallback(async () => {
    if (!periodoId) return;
    setCargando(true);
    try {
      const data = await clienteApi.obtener<{ resumen: ResumenAlumno[] }>(
        `/asistencias/resumen?periodoId=${periodoId}${grupo ? `&grupo=${encodeURIComponent(grupo)}` : ''}`
      );
      setResumen(data.resumen ?? []);
    } catch {
      emitToast({ level: 'error', title: 'Error', message: 'No se pudo cargar el resumen.' });
    } finally {
      setCargando(false);
    }
  }, [periodoId, grupo]);

  const cargarReglas = useCallback(async () => {
    if (!periodoId) return;
    try {
      const data = await clienteApi.obtener<{ reglas: ReglaAsistencia[] }>(
        `/asistencias/reglas?periodoId=${periodoId}`
      );
      setReglas(data.reglas ?? []);
    } catch {
      /* silencioso */
    }
  }, [periodoId]);

  useEffect(() => {
    if (periodoId) {
      void cargarSesiones();
      void cargarResumen();
      void cargarReglas();
    }
  }, [periodoId, grupo, cargarSesiones, cargarResumen, cargarReglas]);

  // ─── Crear sesión ────────────────────────────────────────────────────────────
  async function crearSesion() {
    const g = nuevaSesionGrupo || grupo;
    if (!periodoId || !g) {
      emitToast({ level: 'warn', title: 'Datos incompletos', message: 'Selecciona periodo y grupo.' });
      return;
    }
    try {
      const data = await clienteApi.enviar<{ sesion: SesionAsistencia }>('/asistencias/sesiones', {
        periodoId,
        fecha: new Date(nuevaSesionFecha + 'T12:00:00').toISOString(),
        grupo: g,
        temaNombre: nuevaSesionTema || undefined
      });
      emitToast({ level: 'ok', title: 'Sesión creada', message: formatFecha(data.sesion.fecha) });
      setSesionActual(data.sesion);
      // Inicializar registros con todos presentes
      const init: Record<string, RegistroLocal> = {};
      alumnosGrupo.forEach((al) => {
        init[al._id] = { alumnoId: al._id, estado: 'P' };
      });
      setRegistros(init);
      setTab('pase_lista');
      void cargarSesiones();
    } catch {
      emitToast({ level: 'error', title: 'Error', message: 'No se pudo crear la sesión.' });
    }
  }

  // ─── Cambiar estado individual ───────────────────────────────────────────────
  function ciclarEstado(alumnoId: string) {
    const CICLO: Array<'P' | 'F' | 'R' | 'J'> = ['P', 'F', 'R', 'J'];
    setRegistros((prev) => {
      const actual = prev[alumnoId]?.estado ?? 'P';
      const siguiente = CICLO[(CICLO.indexOf(actual) + 1) % CICLO.length]!;
      return { ...prev, [alumnoId]: { alumnoId, estado: siguiente } };
    });
  }

  // ─── Guardar pase de lista ───────────────────────────────────────────────────
  async function guardarPaseLista() {
    if (!sesionActual) return;
    setGuardando(true);
    try {
      await clienteApi.enviar(`/asistencias/sesiones/${sesionActual._id}/registros`, {
        registros: Object.values(registros)
      });
      emitToast({ level: 'ok', title: 'Lista guardada', message: `${Object.keys(registros).length} registros guardados.` });
      void cargarResumen();
      setTab('resumen');
    } catch {
      emitToast({ level: 'error', title: 'Error', message: 'No se pudo guardar el pase de lista.' });
    } finally {
      setGuardando(false);
    }
  }

  // ─── Cargar registros de sesión existente ───────────────────────────────────
  async function abrirSesion(sesion: SesionAsistencia) {
    setSesionActual(sesion);
    try {
      const data = await clienteApi.obtener<{ registros: Array<{ alumnoId: string; estado: 'P' | 'F' | 'R' | 'J'; justificacion?: string }> }>(
        `/asistencias/sesiones/${sesion._id}/registros`
      );
      const init: Record<string, RegistroLocal> = {};
      alumnosGrupo.forEach((al) => { init[al._id] = { alumnoId: al._id, estado: 'P' }; });
      data.registros.forEach((r) => { init[r.alumnoId] = r; });
      setRegistros(init);
      setTab('pase_lista');
    } catch {
      emitToast({ level: 'error', title: 'Error', message: 'No se pudo cargar la sesión.' });
    }
  }

  // ─── Crear/actualizar regla ─────────────────────────────────────────────────
  async function guardarRegla() {
    if (!periodoId) return;
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
      emitToast({ level: 'ok', title: 'Regla guardada', message: `Máx. ${nuevaReglaMax} faltas → ${nuevaReglaAccion === 'bloquear_examen' ? 'bloquear examen' : 'advertencia'}.` });
      void cargarReglas();
    } catch {
      emitToast({ level: 'error', title: 'Error', message: 'No se pudo guardar la regla.' });
    }
  }

  // ─── Autorizar excepción ────────────────────────────────────────────────────
  async function autorizarExcepcion(alumnoId: string, nombreCompleto: string) {
    const motivo = window.prompt(`Motivo de excepción para ${nombreCompleto}:`);
    if (motivo === null) return;
    try {
      await clienteApi.enviar('/asistencias/excepciones', { alumnoId, periodoId, motivo });
      emitToast({ level: 'ok', title: 'Excepción autorizada', message: nombreCompleto });
      void cargarResumen();
    } catch {
      emitToast({ level: 'error', title: 'Error', message: 'No se pudo autorizar la excepción.' });
    }
  }

  return (
    <div className="panel asistencias-panel anim-fade-in">
      {/* ── 1. Cabecera Ejecutiva Bento con Mini-KPIs ─── */}
      <div className="asistencias-panel__head">
        <div className="asistencias-panel__lead">
          <div className="asistencias-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div className="asistencias-panel__text-block">
            <div className="asistencias-panel__meta-row">
              <span className="asistencias-status-pill">
                <span className="asistencias-pulse-dot" aria-hidden="true" />
                <span>Control de Asistencia Activo</span>
              </span>
              <span className="asistencias-counter-tag">
                {periodoSeleccionado ? periodoSeleccionado.nombre : 'Sin materia seleccionada'}
              </span>
            </div>
            <h2 className="asistencias-panel__title asistencias-titulo">📋 Asistencias</h2>
            <p className="nota">Pase de lista en 1 clic, semáforo de inasistencias y control automático de derecho a examen.</p>
          </div>
        </div>

        <div className="asistencias-header-kpis" aria-live="polite">
          <div className="asistencia-mini-kpi asistencia-mini-kpi--sesiones anim-kpi-hover" data-tooltip="Total de sesiones de clase registradas">
            <span className="asistencia-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            </span>
            <span className="asistencia-mini-kpi__num">{kpis.totalSesiones}</span>
            <span className="asistencia-mini-kpi__lbl">Sesiones</span>
          </div>

          <div className="asistencia-mini-kpi asistencia-mini-kpi--alumnos anim-kpi-hover" data-tooltip="Total de alumnos en el grupo">
            <span className="asistencia-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </span>
            <span className="asistencia-mini-kpi__num">{kpis.totalAlumnos}</span>
            <span className="asistencia-mini-kpi__lbl">Alumnos</span>
          </div>

          <div className="asistencia-mini-kpi asistencia-mini-kpi--promedio anim-kpi-hover" data-tooltip="Porcentaje promedio de asistencia global">
            <span className="asistencia-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </span>
            <span className="asistencia-mini-kpi__num">{kpis.promedioPct}%</span>
            <span className="asistencia-mini-kpi__lbl">% Promedio</span>
          </div>

          <div className="asistencia-mini-kpi asistencia-mini-kpi--sin-derecho anim-kpi-hover" data-tooltip="Alumnos con riesgo o bloqueo por inasistencias">
            <span className="asistencia-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            </span>
            <span className="asistencia-mini-kpi__num">{kpis.sinDerechoCount}</span>
            <span className="asistencia-mini-kpi__lbl">Sin Derecho</span>
          </div>
        </div>
      </div>

      {/* ── 2. Guía Visual Bento ─── */}
      <GuiaAsistenciasVisual />

      {/* ── 3. Barra Panorámica de Selección y Filtros ─── */}
      <div className="asistencias-filtros-bar anim-form-card">
        <div className="asistencias-filtros-bar__row">
          <div className="asistencias-filtros-col">
            <label className="asistencias-label-field">
              <span className="asistencias-field-lbl">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                  <path d="M6 6h10" />
                </svg>
                Materia o Periodo Académico
              </span>
              <div className="auth-input-box auth-input-box--book auth-input-box--animated">
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
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  </svg>
                  Filtrar por Grupo
                </span>
                <div className="auth-input-box auth-input-box--tags auth-input-box--animated">
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
              onClick={() => setGrupo('')}
            >
              Todos ({alumnos.filter(a => a.activo !== false).length})
            </button>
            {gruposDisponibles.map((g) => {
              const count = alumnos.filter(a => a.grupo === g && a.activo !== false).length;
              return (
                <button
                  key={g}
                  type="button"
                  className={`alumnos-group-chip ${grupo === g ? 'alumnos-group-chip--active' : ''}`}
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
      <div className="asistencias-tabs-bar">
        {(['resumen', 'pase_lista', 'reglas'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`asistencias-tab-btn ${tab === t ? 'activo' : ''}`}
          >
            {t === 'resumen' && (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                <span>Resumen General</span>
              </>
            )}
            {t === 'pase_lista' && (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span>Pase de Lista</span>
              </>
            )}
            {t === 'reglas' && (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span>Reglas y Tolerancias</span>
              </>
            )}
          </button>
        ))}
      </div>

      {/* ── 5. Estado Vacío Interactivo cuando No Hay Periodo Seleccionado ─── */}
      {!periodoId ? (
        <div className="empty-state-card anim-fade-in">
          <div className="empty-state-card__icon anim-icon-pulse">
            <span aria-hidden="true">📋</span>
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
                  <div className="asistencia-materia-pick-arrow">➔</div>
                </button>
              ))}
            </div>
          )}

          <div className="empty-state-steps" aria-hidden="true">
            <div className="empty-step">
              <span className="empty-step__num">1</span>
              <span>Selecciona tu materia</span>
            </div>
            <div className="empty-step__arrow">➔</div>
            <div className="empty-step">
              <span className="empty-step__num">2</span>
              <span>Pasa lista con 1 clic</span>
            </div>
            <div className="empty-step__arrow">➔</div>
            <div className="empty-step">
              <span className="empty-step__num">3</span>
              <span>Semáforo de examen</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ── TAB RESUMEN ─── */}
          {tab === 'resumen' && (
            <div className="anim-fade-in">
              {/* Nueva sesión rápida Panorámica */}
              <div className="panel asistencias-panel-card anim-card-hover">
                <div className="asistencias-card-head">
                  <h3 className="asistencias-sub-title">✨ Registrar Nueva Sesión de Clase</h3>
                  <p className="asistencias-sub-desc">Crea la fecha y tema para habilitar el pase de lista inmediato.</p>
                </div>
                <div className="asistencias-form-crear">
                  <div className="asistencias-form-crear__grid">
                    <label className="asistencias-field-col">
                      <span>Fecha de clase</span>
                      <div className="auth-input-box auth-input-box--calendar auth-input-box--animated">
                        <input
                          type="date"
                          value={nuevaSesionFecha}
                          onChange={(e) => setNuevaSesionFecha(e.target.value)}
                          className="asistencias-input"
                        />
                      </div>
                    </label>

                    {gruposDisponibles.length > 0 && (
                      <label className="asistencias-field-col">
                        <span>Grupo</span>
                        <div className="auth-input-box auth-input-box--tags auth-input-box--animated">
                          <select
                            value={nuevaSesionGrupo}
                            onChange={(e) => setNuevasSesionGrupo(e.target.value)}
                            className="asistencias-select"
                          >
                            <option value="">Grupo actual ({grupo || 'Todos'})</option>
                            {gruposDisponibles.map((g) => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                      </label>
                    )}

                    <label className="asistencias-field-col asistencias-field-col--expand">
                      <span>Tema o contenido cubierto</span>
                      <div className="auth-input-box auth-input-box--book auth-input-box--animated">
                        <input
                          type="text"
                          placeholder="Ej. Derivadas parciales, Matrices ortogonales…"
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
                        className="asistencias-btn-primario boton--crear-sesion"
                        icono={
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        }
                      >
                        Crear e iniciar
                      </Boton>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabla resumen de alumnos */}
              {cargando ? (
                <div className="asistencias-loading-box anim-fade-in">
                  <div className="asistencias-panel__icon-orb anim-icon-pulse" aria-hidden="true">⏳</div>
                  <p>Cargando resumen de asistencias…</p>
                </div>
              ) : resumen.length === 0 ? (
                <div className="empty-state-card anim-fade-in">
                  <div className="empty-state-card__icon anim-icon-pulse">
                    <span aria-hidden="true">🗓️</span>
                  </div>
                  <h4>Sin sesiones registradas aún</h4>
                  <p className="nota">
                    Crea tu primera sesión de clase arriba para comenzar a tomar asistencia y calcular el semáforo académico.
                  </p>
                </div>
              ) : (
                <div className="table-scroll-container anim-fade-in">
                  <table className="asistencias-tabla">
                    <thead>
                      <tr>
                        <th className="asistencias-th">Alumno</th>
                        <th className="asistencias-th">Matrícula</th>
                        <th className="asistencias-th">Grupo</th>
                        <th className="asistencias-th" title="Presentes">P</th>
                        <th className="asistencias-th" title="Faltas">F</th>
                        <th className="asistencias-th" title="Retardos">R</th>
                        <th className="asistencias-th" title="Justificadas">J</th>
                        <th className="asistencias-th">% Asist.</th>
                        <th className="asistencias-th">Derecho a Examen</th>
                        <th className="asistencias-th">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumen.map((al) => {
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
                              <span className="asistencia-matricula-badge">{al.matricula}</span>
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
                                  al.porcentajeAsistencia >= 85 ? 'green' : al.porcentajeAsistencia >= 70 ? 'orange' : 'red'
                                }`}
                              >
                                {al.porcentajeAsistencia}%
                              </span>
                            </td>
                            <td className="asistencias-td">
                              {al.bloqueadoExamen ? (
                                <span title="Sin derecho a examen" className="asistencias-badge-pill sin-derecho anim-badge-in">
                                  🚫 Sin Derecho
                                </span>
                              ) : al.tieneExcepcion ? (
                                <span title="Excepción autorizada" className="asistencias-badge-pill autorizado anim-badge-in">
                                  ⚠️ Autorizado
                                </span>
                              ) : (
                                <span title="Con derecho a examen" className="asistencias-badge-pill con-derecho anim-badge-in">
                                  ✅ Con Derecho
                                </span>
                              )}
                            </td>
                            <td className="asistencias-td">
                              {al.bloqueadoExamen && (
                                <button
                                  onClick={() => void autorizarExcepcion(al.alumnoId, al.nombreCompleto)}
                                  className="asistencias-btn-secundario anim-fade-in"
                                  title="Autorizar excepción al derecho a examen"
                                >
                                  Autorizar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sesiones anteriores */}
              {sesiones.length > 0 && (
                <div className="asistencias-panel-card anim-card-hover">
                  <div className="asistencias-card-head">
                    <h3 className="asistencias-sub-title">📅 Sesiones Registradas ({sesiones.length})</h3>
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
                            📅 {formatFecha(s.fecha)}
                          </span>
                          <span className="asistencia-grupo-pill">{s.grupo}</span>
                        </div>
                        {s.temaNombre && (
                          <p className="asistencias-sesion-card__topic">{s.temaNombre}</p>
                        )}
                        <div className="asistencias-sesion-card__footer">
                          <span>Editar lista ➔</span>
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
            <div className="anim-fade-in">
              {!sesionActual ? (
                <div className="empty-state-card anim-fade-in">
                  <div className="empty-state-card__icon anim-icon-pulse">
                    <span aria-hidden="true">✍️</span>
                  </div>
                  <h4>No hay sesión seleccionada</h4>
                  <p className="nota">
                    Crea una nueva sesión o selecciona una existente desde la pestaña <strong>Resumen</strong> para iniciar el pase de lista.
                  </p>
                  <Boton variante="secundario" type="button" onClick={() => setTab('resumen')}>
                    ⬅ Volver al Resumen
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
                        onClick={() => {
                          const all: Record<string, RegistroLocal> = {};
                          alumnosGrupo.forEach((a) => { all[a._id] = { alumnoId: a._id, estado: 'P' }; });
                          setRegistros(all);
                          emitToast({ level: 'info', title: 'Pase rápido', message: 'Todos marcados como Presentes' });
                        }}
                        icono={
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        }
                      >
                        Todos Presentes
                      </Boton>

                      <Boton
                        type="button"
                        onClick={() => void guardarPaseLista()}
                        cargando={guardando}
                        disabled={guardando}
                        className="asistencias-btn-primario boton--guardar-lista pulse-glow"
                        icono={
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                            <polyline points="17 21 17 13 7 13 7 21" />
                            <polyline points="7 3 7 8 15 8" />
                          </svg>
                        }
                      >
                        {guardando ? 'Guardando…' : 'Guardar lista'}
                      </Boton>
                    </div>
                  </div>

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
                    <span className="nota asistencias-legend-hint">💡 Haz clic en la fila de un estudiante para ciclar su estado (P ➔ F ➔ R ➔ J)</span>
                  </div>

                  {/* Lista interactiva Fast-Check */}
                  <div className="asistencias-fastcheck-grid">
                    {alumnosGrupo.map((al, idx) => {
                      const reg = registros[al._id] ?? { alumnoId: al._id, estado: 'P' as const };
                      const iniciales = obtenerIniciales(al.nombreCompleto);
                      return (
                        <div
                          key={al._id}
                          role="button"
                          tabIndex={0}
                          className={`asistencias-alumno-row anim-slide-up ${reg.estado === 'F' ? 'falta' : reg.estado === 'R' ? 'retardo' : reg.estado === 'J' ? 'justificada' : 'presente'}`}
                          onClick={() => ciclarEstado(al._id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              ciclarEstado(al._id);
                            }
                          }}
                        >
                          <span className="asistencias-alumno-num">{idx + 1}</span>

                          <div className="asistencia-avatar-sm" aria-hidden="true">
                            <span>{iniciales}</span>
                          </div>

                          <div className="asistencias-alumno-info">
                            <span className="font-bold asistencias-alumno-name">{al.nombreCompleto}</span>
                            <span className="font-code nota asistencias-alumno-matricula">{al.matricula}</span>
                          </div>

                          <span
                            className={`asistencias-alumno-badge asistencias-badge-dot-${reg.estado.toLowerCase()} state-badge-pulse`}
                            key={reg.estado}
                          >
                            {reg.estado} · {ESTADO_LABEL[reg.estado]}
                          </span>

                          {reg.estado === 'J' && (
                            <input
                              type="text"
                              placeholder="Motivo de justificación…"
                              value={reg.justificacion ?? ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                setRegistros((prev) => ({ ...prev, [al._id]: { ...reg, justificacion: e.target.value } }));
                              }}
                              onClick={(e) => e.stopPropagation()}
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
            <div className="anim-fade-in">
              <div className="panel asistencias-panel-card anim-card-hover">
                <div className="asistencias-card-head">
                  <h3 className="asistencias-sub-title">⚙️ Configurar Regla de Asistencia y Derecho a Examen</h3>
                  <p className="asistencias-sub-desc">Establece el número máximo de faltas permitidas antes de bloquear el derecho a examen.</p>
                </div>

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
                        className="asistencias-select"
                      >
                        <option value="bloquear_examen">🚫 Bloquear examen (requiere autorización docente)</option>
                        <option value="advertir">⚠️ Solo advertir al docente</option>
                      </select>
                    </div>
                  </label>

                  <div className="asistencias-form-col asistencias-form-col--btn">
                    <Boton
                      type="button"
                      onClick={() => void guardarRegla()}
                      className="asistencias-btn-primario boton--guardar-regla"
                      icono={
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                          <polyline points="17 21 17 13 7 13 7 21" />
                          <polyline points="7 3 7 8 15 8" />
                        </svg>
                      }
                    >
                      Guardar regla
                    </Boton>
                  </div>
                </div>

                {/* Sección retardos */}
                <div className="asistencias-config-retardo-box">
                  <label className="asistencias-checkbox-label">
                    <input
                      type="checkbox"
                      checked={nuevaReglaContarRetardos}
                      onChange={(e) => setNuevaReglaContarRetardos(e.target.checked)}
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
                          className="asistencias-input asistencias-input-num-xs"
                        />
                        <span className="nota">
                          ({nuevaReglaRetardosEquivalen} retardos = 1 falta acumulada)
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                <p className="nota asistencias-regla-footer-hint">
                  ℹ️ La regla aplica a la materia actual {grupo ? `y al grupo "${grupo}"` : '(todos los grupos)'}. Puedes autorizar excepciones individuales en cualquier momento desde la pestaña Resumen.
                </p>
              </div>

              {/* Reglas existentes */}
              {reglas.length > 0 && (
                <div className="asistencias-panel-card anim-card-hover">
                  <div className="asistencias-card-head">
                    <h3 className="asistencias-sub-title">Reglas Activas ({reglas.length})</h3>
                  </div>
                  <div className="asistencias-reglas-grid">
                    {reglas.map((r) => (
                      <div key={r._id} className="asistencias-regla-card anim-slide-up">
                        <div className="asistencias-regla-card__icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                        </div>
                        <div className="asistencias-regla-card__body">
                          <strong>Máximo {r.maxFaltas} faltas</strong>
                          <span className="nota">
                            → {r.accion === 'bloquear_examen' ? '🚫 Bloquear examen' : '⚠️ Advertencia'}
                            {r.grupo ? ` · Grupo: ${r.grupo}` : ' · Todos los grupos'}
                          </span>
                          {r.contarRetardos && (
                            <span className="asistencias-r-stat">
                              · ⏱ {r.retardosEquivalenFalta} retardos equivalen a 1 falta
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
    </div>
  );
}
