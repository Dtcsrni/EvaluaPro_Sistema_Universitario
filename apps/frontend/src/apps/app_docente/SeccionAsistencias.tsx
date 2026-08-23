/**
 * SeccionAsistencias.tsx
 *
 * Módulo de pase de lista del docente:
 * - Lista de sesiones por periodo/grupo
 * - Pase de lista rápido (Fast-Check): un click = P/F/R
 * - Semáforo visual de asistencia por alumno
 * - Gestión de reglas de inasistencia
 * - Autorización de excepciones individuales
 * - Indicador de derecho a examen
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clienteApi } from './clienteApiDocente';
import { emitToast } from '../../ui/toast/toastBus';
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

// ─── Componente principal ─────────────────────────────────────────────────────
type Props = {
  periodos: Periodo[];
  alumnos: Alumno[];
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

  // Grupos del periodo seleccionado
  const gruposDisponibles = useMemo(() => {
    const p = periodos.find((per) => per._id === periodoId);
    return p?.grupos ?? [];
  }, [periodos, periodoId]);

  // Alumnos del grupo
  const alumnosGrupo = useMemo(() => {
    if (!grupo) return alumnos.filter((a) => a.activo !== false);
    return alumnos.filter((a) => a.grupo === grupo && a.activo !== false);
  }, [alumnos, grupo]);

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
      emitToast({ level: 'ok', title: 'Lista guardada', message: `${Object.keys(registros).length} registros.` });
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

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <section className="asistencias-seccion glass-card anim-slide-up">
      <h2 className="asistencias-titulo">📋 Asistencias</h2>

      {/* Filtros */}
      <div className="asistencias-filtros">
        <select
          value={periodoId}
          onChange={(e) => { setPeriodoId(e.target.value); setGrupo(''); }}
          className="asistencias-select"
        >
          <option value="">— Selecciona periodo —</option>
          {periodos.filter((p) => p.activo).map((p) => (
            <option key={p._id} value={p._id}>{p.nombre}</option>
          ))}
        </select>

        {gruposDisponibles.length > 0 && (
          <select value={grupo} onChange={(e) => setGrupo(e.target.value)} className="asistencias-select">
            <option value="">Todos los grupos</option>
            {gruposDisponibles.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="asistencias-tabs">
        {(['resumen', 'pase_lista', 'reglas'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`asistencias-tab-btn ${tab === t ? 'activo' : ''}`}
          >
            {t === 'resumen' ? '📊 Resumen' : t === 'pase_lista' ? '✍️ Pase de Lista' : '⚙️ Reglas'}
          </button>
        ))}
      </div>

      {/* ── TAB RESUMEN ─── */}
      {tab === 'resumen' && (
        <div className="anim-fade-in">
          {/* Nueva sesión rápida */}
          {periodoId && (
            <div className="panel asistencias-panel-card">
              <h3 className="eyebrow">➕ Nueva sesión</h3>
              <div className="asistencias-form-crear">
                <input
                  type="date"
                  value={nuevaSesionFecha}
                  onChange={(e) => setNuevaSesionFecha(e.target.value)}
                  className="asistencias-input"
                />
                {gruposDisponibles.length > 0 && (
                  <select
                    value={nuevaSesionGrupo}
                    onChange={(e) => setNuevasSesionGrupo(e.target.value)}
                    className="asistencias-select"
                  >
                    <option value="">Grupo actual</option>
                    {gruposDisponibles.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                )}
                <input
                  type="text"
                  placeholder="Tema cubierto (opcional)"
                  value={nuevaSesionTema}
                  onChange={(e) => setNuevaSesionTema(e.target.value)}
                  className="asistencias-input"
                />
                <button onClick={() => void crearSesion()} className="asistencias-btn-primario">
                  Crear e iniciar
                </button>
              </div>
            </div>
          )}

          {/* Tabla resumen */}
          {cargando ? (
            <p>Cargando…</p>
          ) : resumen.length === 0 ? (
            <p className="nota">
              {periodoId ? 'Sin sesiones registradas aún.' : 'Selecciona un periodo para ver el resumen.'}
            </p>
          ) : (
            <div className="table-scroll-container">
              <table className="asistencias-tabla">
                <thead>
                  <tr>
                    <th className="asistencias-th">Alumno</th>
                    <th className="asistencias-th">Matrícula</th>
                    <th className="asistencias-th">Grupo</th>
                    <th className="asistencias-th">P</th>
                    <th className="asistencias-th">F</th>
                    <th className="asistencias-th">R</th>
                    <th className="asistencias-th">J</th>
                    <th className="asistencias-th">% Asist.</th>
                    <th className="asistencias-th">Examen</th>
                    <th className="asistencias-th"></th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.map((al) => (
                    <tr key={al.alumnoId} className="asistencias-tr">
                      <td className="asistencias-td"><strong>{al.nombreCompleto}</strong></td>
                      <td className="asistencias-td font-code">{al.matricula}</td>
                      <td className="asistencias-td">{al.grupo}</td>
                      <td className="asistencias-td asistencias-p-stat">{al.presentes}</td>
                      <td className="asistencias-td asistencias-f-stat">{al.faltas}</td>
                      <td className="asistencias-td asistencias-r-stat">{al.retardos}</td>
                      <td className="asistencias-td asistencias-j-stat">{al.justificadas}</td>
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
                          <span title="Sin derecho a examen" className="asistencias-badge-pill sin-derecho">🚫 Sin Derecho</span>
                        ) : al.tieneExcepcion ? (
                          <span title="Excepción autorizada" className="asistencias-badge-pill autorizado">⚠️ Autorizado</span>
                        ) : (
                          <span title="Con derecho a examen" className="asistencias-badge-pill con-derecho">✅ Con Derecho</span>
                        )}
                      </td>
                      <td className="asistencias-td">
                        {al.bloqueadoExamen && (
                          <button
                            onClick={() => void autorizarExcepcion(al.alumnoId, al.nombreCompleto)}
                            className="asistencias-btn-secundario anim-fade-in"
                            title="Autorizar excepción"
                          >
                            Autorizar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Sesiones anteriores */}
          {sesiones.length > 0 && (
            <div className="asistencias-panel-card">
              <h3 className="eyebrow">📅 Sesiones registradas</h3>
              <div className="asistencias-chip-grid">
                {sesiones.map((s) => (
                  <button key={s._id} onClick={() => void abrirSesion(s)} className="asistencias-chip-sesion scale-hover">
                    {formatFecha(s.fecha)} {s.grupo} {s.temaNombre ? `· ${s.temaNombre.slice(0, 20)}` : ''}
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
            <p className="nota">
              Crea o selecciona una sesión desde la pestaña Resumen.
            </p>
          ) : (
            <>
              <div className="asistencias-subpanel-header">
                <h3>
                  Sesión: <strong>{formatFecha(sesionActual.fecha)}</strong> — Grupo: <strong>{sesionActual.grupo}</strong>
                  {sesionActual.temaNombre && <span className="nota"> ({sesionActual.temaNombre})</span>}
                </h3>
                <div className="asistencias-chip-grid">
                  <button onClick={() => { const all: Record<string, RegistroLocal> = {}; alumnosGrupo.forEach((a) => { all[a._id] = { alumnoId: a._id, estado: 'P' }; }); setRegistros(all); }} className="asistencias-btn-secundario">
                    Todos Presentes
                  </button>
                  <button
                    onClick={() => void guardarPaseLista()}
                    disabled={guardando}
                    className="asistencias-btn-primario"
                  >
                    {guardando ? 'Guardando…' : '💾 Guardar lista'}
                  </button>
                </div>
              </div>

              {/* Leyenda */}
              <div className="asistencias-legend-bar">
                {(['P', 'F', 'R', 'J'] as const).map((e) => (
                  <span key={e} className="asistencias-chip-grid">
                    <span className={`asistencias-legend-dot asistencias-badge-dot-${e.toLowerCase()}`} />
                    <strong>{ESTADO_LABEL[e]}</strong>
                  </span>
                ))}
                <span className="nota">· Click en un alumno para ciclar estado</span>
              </div>

              {/* Lista alumnos */}
              <div className="asistencias-chip-grid">
                {alumnosGrupo.map((al, idx) => {
                  const reg = registros[al._id] ?? { alumnoId: al._id, estado: 'P' as const };
                  return (
                    <div
                      key={al._id}
                      role="button"
                      tabIndex={0}
                      className={`asistencias-alumno-row anim-fade-in ${reg.estado === 'F' ? 'falta' : reg.estado === 'R' ? 'retardo' : ''}`}
                      onClick={() => ciclarEstado(al._id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          ciclarEstado(al._id);
                        }
                      }}
                    >
                      <span className="asistencias-alumno-num">
                        {idx + 1}
                      </span>
                      <span
                        className={`asistencias-alumno-badge asistencias-badge-dot-${reg.estado.toLowerCase()} state-badge-pulse`}
                        key={reg.estado}
                      >
                        {reg.estado}
                      </span>
                      <span className="font-code font-bold">{al.nombreCompleto}</span>
                      <span className="font-code nota">{al.matricula}</span>
                      {reg.estado === 'J' && (
                        <input
                          type="text"
                          placeholder="Justificación"
                          value={reg.justificacion ?? ''}
                          onChange={(e) => {
                            e.stopPropagation();
                            setRegistros((prev) => ({ ...prev, [al._id]: { ...reg, justificacion: e.target.value } }));
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="asistencias-input asistencias-alumno-input-justificacion"
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
          <div className="panel asistencias-panel-card">
            <h3 className="eyebrow">⚙️ Configurar regla de asistencia</h3>
            <div className="asistencias-config-grid">
              <label className="asistencias-form-col">
                Máximo de faltas permitidas
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={nuevaReglaMax}
                  onChange={(e) => setNuevaReglaMax(Number(e.target.value))}
                  className="asistencias-input asistencias-input-num-sm"
                />
              </label>
              <label className="asistencias-form-col">
                Acción al superar el límite
                <select
                  value={nuevaReglaAccion}
                  onChange={(e) => setNuevaReglaAccion(e.target.value as 'bloquear_examen' | 'advertir')}
                  className="asistencias-select"
                >
                  <option value="bloquear_examen">🚫 Bloquear examen (requiere autorización)</option>
                  <option value="advertir">⚠️ Solo advertir al docente</option>
                </select>
              </label>
              <button onClick={() => void guardarRegla()} className="asistencias-btn-primario">
                Guardar regla
              </button>
            </div>

            {/* ── Sección retardos (opcional, desactivada por default) ── */}
            <div className="asistencias-config-retardo-box">
              <label className="asistencias-chip-grid">
                <input
                  type="checkbox"
                  checked={nuevaReglaContarRetardos}
                  onChange={(e) => setNuevaReglaContarRetardos(e.target.checked)}
                />
                Contar retardos como faltas equivalentes
                <span className="nota">(desactivado por defecto)</span>
              </label>
              {nuevaReglaContarRetardos && (
                <div className="anim-slide-up">
                  <label className="asistencias-chip-grid">
                    Retardos equivalentes a 1 falta:
                    <input
                      type="number"
                      min={2}
                      max={10}
                      value={nuevaReglaRetardosEquivalen}
                      onChange={(e) => setNuevaReglaRetardosEquivalen(Number(e.target.value))}
                      className="asistencias-input asistencias-input-num-xs"
                    />
                    <span className="nota">
                      ({nuevaReglaRetardosEquivalen} retardos = 1 falta)
                    </span>
                  </label>
                </div>
              )}
            </div>

            <p className="nota">
              La regla aplica al periodo {grupo ? `y grupo "${grupo}"` : '(todos los grupos)'}. El docente puede autorizar excepciones individuales desde el Resumen.
            </p>
          </div>

          {/* Reglas existentes */}
          {reglas.length > 0 && (
            <div className="asistencias-panel-card">
              <h3 className="eyebrow">Reglas activas</h3>
              <div className="asistencias-chip-grid">
                {reglas.map((r) => (
                  <div key={r._id} className="panel anim-fade-in asistencias-regla-row">
                    <div>
                      <strong>Máx. {r.maxFaltas} faltas</strong>
                      <span className="nota">
                        → {r.accion === 'bloquear_examen' ? '🚫 Bloquear examen' : '⚠️ Advertir'}
                        {r.grupo ? ` · Grupo: ${r.grupo}` : ' · Todos los grupos'}
                      </span>
                      {r.contarRetardos && (
                        <span className="asistencias-r-stat">
                          · ⏱ {r.retardosEquivalenFalta} retardos = 1 falta
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
    </section>
  );
}


