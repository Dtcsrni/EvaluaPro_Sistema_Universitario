/**
 * SeccionTemarios.tsx
 *
 * Responsabilidad: Módulo ejecutivo de estructura curricular y seguimiento de temarios:
 * - Cabecera Bento con Mini-KPIs y estado curricular
 * - Guía visual Bento Step Cards
 * - Selector panorámico de materia y estado vacío interactivo con tarjetas rápidas
 * - Carga inteligente desde PDF con drag & drop y extractor estructurado
 * - Carga manual jerárquica con numeración multinivel (1, 1.1, 1.1.1)
 * - Vista de árbol interactiva con semáforo de cobertura de temas (Pendiente / En progreso / Cubierto)
 * - Métricas de avance porcentual en tiempo real
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clienteApi } from './clienteApiDocente';
import { emitToast } from '../../ui/toast/toastBus';
import { Boton } from '../../ui/ux/componentes/Boton';
import { GuiaTemariosVisual } from './GuiaTemariosVisual';
import type { Periodo } from './tipos';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Temario = {
  _id: string;
  nombre: string;
  totalNodos: number;
  porcentajeAvance: number;
  createdAt: string;
};

type TemaNode = {
  _id: string;
  numero: string;
  nivel: number;
  titulo: string;
  estado: 'pendiente' | 'en_progreso' | 'cubierto';
  notas?: string;
  cubiertaEn?: string;
};

type TabLocal = 'lista' | 'cargar' | 'arbol';

// ─── Estado iconos ───────────────────────────────────────────────────────────
const ESTADO_ICON: Record<string, string> = { cubierto: '✅', en_progreso: '🔄', pendiente: '○' };
const ESTADO_CICLO: Array<TemaNode['estado']> = ['pendiente', 'en_progreso', 'cubierto'];

function obtenerIniciales(nombre?: string): string {
  const palabras = String(nombre || '').trim().split(/\s+/);
  if (palabras.length === 1) {
    return palabras[0].substring(0, 2).toUpperCase() || 'TM';
  }
  const primera = palabras[0].charAt(0);
  const segunda = palabras[1].charAt(0);
  return (primera + segunda).toUpperCase() || 'TM';
}

// ─── Componente ───────────────────────────────────────────────────────────────
type Props = { periodos: Periodo[] };

export function SeccionTemarios({ periodos }: Props) {
  const [tab, setTab] = useState<TabLocal>('lista');
  const [periodoId, setPeriodoId] = useState('');
  const [temarios, setTemarios] = useState<Temario[]>([]);
  const [temarioActual, setTemarioActual] = useState<Temario | null>(null);
  const [nodos, setNodos] = useState<TemaNode[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardandoNodo, setGuardandoNodo] = useState('');

  // Formulario carga manual
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [textoManual, setTextoManual] = useState('');

  // PDF drag & drop
  const [archivoNombre, setArchivoNombre] = useState('');
  const [archivoPdf, setArchivoPdf] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Periodo seleccionado
  const periodoSeleccionado = useMemo(() => {
    return periodos.find((p) => p._id === periodoId);
  }, [periodos, periodoId]);

  // Mini-KPIs Curriculares
  const kpis = useMemo(() => {
    const totalTemarios = temarios.length;
    const totalTemas = temarios.reduce((acc, t) => acc + (t.totalNodos || 0), 0);
    let promedioAvance = 0;
    if (temarios.length > 0) {
      const sumaAvance = temarios.reduce((acc, t) => acc + (t.porcentajeAvance || 0), 0);
      promedioAvance = Math.round(sumaAvance / temarios.length);
    }
    const temasCubiertos = nodos.filter(n => n.estado === 'cubierto').length;

    return {
      totalTemarios,
      totalTemas,
      promedioAvance,
      temasCubiertos
    };
  }, [temarios, nodos]);

  const cargarTemarios = useCallback(async () => {
    if (!periodoId) return;
    try {
      const data = await clienteApi.obtener<{ temarios: Temario[] }>(
        `/temarios?periodoId=${periodoId}`
      );
      setTemarios(data.temarios ?? []);
    } catch {
      /* silencioso */
    }
  }, [periodoId]);

  useEffect(() => { void cargarTemarios(); }, [cargarTemarios]);

  async function abrirTemario(t: Temario) {
    setTemarioActual(t);
    setCargando(true);
    try {
      const data = await clienteApi.obtener<{ nodos: TemaNode[] }>(
        `/temarios/${t._id}/nodos`
      );
      setNodos(data.nodos ?? []);
      setTab('arbol');
    } catch {
      emitToast({ level: 'error', title: 'Error', message: 'No se pudo cargar el temario.' });
    } finally {
      setCargando(false);
    }
  }

  // ─── Cargar PDF ─────────────────────────────────────────────────────────────
  function manejarArchivo(file: File) {
    if (file.type !== 'application/pdf') {
      emitToast({ level: 'warn', title: 'Archivo inválido', message: 'Selecciona un PDF válido.' });
      return;
    }
    setArchivoPdf(file);
    setArchivoNombre(file.name);
    if (!nombreNuevo) setNombreNuevo(file.name.replace(/\.pdf$/i, ''));
  }

  async function subirPdf() {
    if (!archivoPdf || !periodoId || !nombreNuevo) {
      emitToast({ level: 'warn', title: 'Datos incompletos', message: 'Selecciona periodo y PDF.' });
      return;
    }
    setCargando(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((res, rej) => {
        reader.onload = () => res((reader.result as string).split(',')[1] ?? '');
        reader.onerror = rej;
        reader.readAsDataURL(archivoPdf);
      });
      const data = await clienteApi.enviar<{ temario: Temario; totalNodos: number }>(
        '/temarios/pdf',
        { periodoId, nombre: nombreNuevo, archivoBase64: base64 }
      );
      emitToast({ level: 'ok', title: 'Temario procesado', message: `${data.totalNodos} temas extraídos.` });
      setArchivoPdf(null);
      setArchivoNombre('');
      setNombreNuevo('');
      void cargarTemarios();
      void abrirTemario(data.temario);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al procesar el PDF.';
      emitToast({ level: 'error', title: 'Error', message: msg });
    } finally {
      setCargando(false);
    }
  }

  // ─── Carga manual ────────────────────────────────────────────────────────────
  async function cargarManual() {
    if (!textoManual.trim() || !periodoId || !nombreNuevo) {
      emitToast({ level: 'warn', title: 'Datos incompletos', message: 'Completa nombre y texto.' });
      return;
    }
    setCargando(true);
    try {
      const data = await clienteApi.enviar<{ temario: Temario; totalNodos: number }>(
        '/temarios/manual',
        { periodoId, nombre: nombreNuevo, texto: textoManual }
      );
      emitToast({ level: 'ok', title: 'Temario cargado', message: `${data.totalNodos} temas.` });
      setTextoManual('');
      setNombreNuevo('');
      void cargarTemarios();
      void abrirTemario(data.temario);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cargar el temario.';
      emitToast({ level: 'error', title: 'Error', message: msg });
    } finally {
      setCargando(false);
    }
  }

  // ─── Cambiar estado de nodo ──────────────────────────────────────────────────
  async function ciclarEstadoNodo(nodo: TemaNode) {
    const siguiente = ESTADO_CICLO[(ESTADO_CICLO.indexOf(nodo.estado) + 1) % ESTADO_CICLO.length]!;
    setGuardandoNodo(nodo._id);
    try {
      const data = await clienteApi.enviar<{ nodo: TemaNode; porcentajeAvance: number }>(
        `/temarios/nodos/${nodo._id}/estado`,
        { estado: siguiente }
      );
      setNodos((prev) => prev.map((n) => (n._id === nodo._id ? data.nodo : n)));
      if (temarioActual) {
        setTemarioActual((t) => t ? { ...t, porcentajeAvance: data.porcentajeAvance } : t);
        setTemarios((ts) => ts.map((t) => t._id === temarioActual._id ? { ...t, porcentajeAvance: data.porcentajeAvance } : t));
      }
    } catch {
      emitToast({ level: 'error', title: 'Error', message: 'No se pudo actualizar.' });
    } finally {
      setGuardandoNodo('');
    }
  }

  return (
    <div className="panel temarios-panel anim-fade-in">
      {/* ── 1. Cabecera Ejecutiva Bento con Mini-KPIs ─── */}
      <div className="temarios-panel__head">
        <div className="temarios-panel__lead">
          <div className="temarios-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10M6 10h10" />
            </svg>
          </div>
          <div className="temarios-panel__text-block">
            <div className="temarios-panel__meta-row">
              <span className="temarios-status-pill">
                <span className="temarios-pulse-dot" aria-hidden="true" />
                <span>Estructura Curricular Activa</span>
              </span>
              <span className="temarios-counter-tag">
                {periodoSeleccionado ? periodoSeleccionado.nombre : 'Sin materia seleccionada'}
              </span>
            </div>
            <h2 className="temarios-panel__title eyebrow">📚 Temarios</h2>
            <p className="nota">Organización de unidades temáticas, seguimiento de avance lectivo y alineación curricular.</p>
          </div>
        </div>

        <div className="temarios-header-kpis" aria-live="polite">
          <div className="temario-mini-kpi temario-mini-kpi--temarios anim-kpi-hover" data-tooltip="Total de planes de estudio registrados">
            <span className="temario-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
              </svg>
            </span>
            <span className="temario-mini-kpi__num">{kpis.totalTemarios}</span>
            <span className="temario-mini-kpi__lbl">Temarios</span>
          </div>

          <div className="temario-mini-kpi temario-mini-kpi--temas anim-kpi-hover" data-tooltip="Total de temas y subtemas estructurados">
            <span className="temario-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </span>
            <span className="temario-mini-kpi__num">{kpis.totalTemas}</span>
            <span className="temario-mini-kpi__lbl">Temas</span>
          </div>

          <div className="temario-mini-kpi temario-mini-kpi--avance anim-kpi-hover" data-tooltip="Porcentaje promedio de cobertura del curso">
            <span className="temario-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <span className="temario-mini-kpi__num">
              {kpis.promedioAvance}<small className="temario-mini-kpi__pct">%</small>
            </span>
            <span className="temario-mini-kpi__lbl">Avance Global</span>
          </div>

          <div className="temario-mini-kpi temario-mini-kpi--cubiertos anim-kpi-hover" data-tooltip="Temas completados en clase">
            <span className="temario-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </span>
            <span className="temario-mini-kpi__num">{kpis.temasCubiertos}</span>
            <span className="temario-mini-kpi__lbl">Cubiertos</span>
          </div>
        </div>
      </div>

      {/* ── 2. Guía Visual Bento ─── */}
      <GuiaTemariosVisual />

      {/* ── 3. Barra Panorámica de Selección ─── */}
      <div className="temarios-filtros-bar anim-form-card temarios-spacing-bottom">
        <label className="asistencias-label-field">
          <span className="asistencias-field-lbl">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10" />
            </svg>
            Materia o Asignatura
          </span>
          <div className="auth-input-box auth-input-box--book auth-input-box--animated">
            <select
              value={periodoId}
              onChange={(e) => setPeriodoId(e.target.value)}
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

      {/* ── 4. Tabs Elevados ─── */}
      <div className="temarios-tabs-bar temarios-tab-bar">
        {(['lista', 'cargar', ...(temarioActual ? ['arbol'] : [])] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as TabLocal)}
            className={`temarios-tab-btn nav-docente-tab ${tab === t ? 'activo' : ''}`}
          >
            {t === 'lista' && (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>Mis temarios ({temarios.length})</span>
              </>
            )}
            {t === 'cargar' && (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Cargar temario</span>
              </>
            )}
            {t === 'arbol' && (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2" />
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <circle cx="12" cy="10" r="2" />
                </svg>
                <span>🌳 {temarioActual?.nombre ?? 'Árbol'} ({temarioActual?.porcentajeAvance ?? 0}%)</span>
              </>
            )}
          </button>
        ))}
      </div>

      {/* ── 5. Estado Vacío Interactivo cuando No Hay Periodo Seleccionado ─── */}
      {!periodoId ? (
        <div className="empty-state-card anim-fade-in">
          <div className="empty-state-card__icon anim-icon-pulse">
            <span aria-hidden="true">📚</span>
          </div>
          <h4>Comienza seleccionando una materia</h4>
          <p className="nota">
            Selecciona un curso activo para visualizar sus temarios cargados, registrar nuevas unidades temáticas o seguir el progreso del syllabus.
          </p>

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
              <span>Selecciona materia</span>
            </div>
            <div className="empty-step__arrow">➔</div>
            <div className="empty-step">
              <span className="empty-step__num">2</span>
              <span>Carga PDF o texto</span>
            </div>
            <div className="empty-step__arrow">➔</div>
            <div className="empty-step">
              <span className="empty-step__num">3</span>
              <span>Monitorea avance</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ── TAB LISTA ── */}
          {tab === 'lista' && (
            <div className="anim-fade-in">
              {temarios.length === 0 ? (
                <div className="empty-state-card anim-fade-in">
                  <div className="empty-state-card__icon anim-icon-pulse">
                    <span aria-hidden="true">📑</span>
                  </div>
                  <h4>Sin temarios registrados</h4>
                  <p className="nota">
                    No hay temarios para este periodo. Carga tu programa de estudios en PDF o en formato texto desde la pestaña <strong>Cargar temario</strong>.
                  </p>
                  <Boton
                    variante="primario"
                    type="button"
                    onClick={() => setTab('cargar')}
                    icono={
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    }
                  >
                    Importar temario ahora
                  </Boton>
                </div>
              ) : (
                <div className="temarios-grid anim-fade-in">
                  {temarios.map((t) => {
                    const iniciales = obtenerIniciales(t.nombre);
                    return (
                      <div
                        key={t._id}
                        className="temarios-card item-glass scale-hover anim-card-hover"
                        role="button"
                        tabIndex={0}
                        onClick={() => void abrirTemario(t)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void abrirTemario(t); }}
                        title="Abrir temario y ver árbol de contenidos"
                      >
                        <div className="temarios-card-header">
                          <div className="temario-card-title-group">
                            <div className="temario-avatar" aria-hidden="true">
                              <span>{iniciales}</span>
                            </div>
                            <div>
                              <strong className="temario-nombre-text">{t.nombre}</strong>
                              <span className="nota temario-nodos-chip">
                                {t.totalNodos} temas
                              </span>
                            </div>
                          </div>
                          <span className="temario-open-arrow" aria-hidden="true">➔</span>
                        </div>

                        {/* Barra de progreso interactiva */}
                        <div className="temarios-btn-margin-top">
                          <div className="temarios-progress-label-row">
                            <span className="temario-progress-lbl">Avance lectivo</span>
                            <span className={`temario-progress-val ${t.porcentajeAvance === 100 ? 'temarios-progress-val-success' : 'temarios-progress-val-accent'}`}>
                              {t.porcentajeAvance}%
                            </span>
                          </div>
                          <div className="temarios-progress-track">
                            <div
                              className="temarios-progress-bar"
                              ref={(el) => {
                                if (el) {
                                  el.style.width = `${Math.min(100, Math.max(0, t.porcentajeAvance))}%`;
                                }
                              }}
                            />
                          </div>
                        </div>

                        <div className="temarios-card-footer">
                          <span className="temarios-footer-cta">Ver árbol curricular ➔</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB CARGAR ── */}
          {tab === 'cargar' && (
            <div className="temarios-cargar-grid anim-fade-in">
              {/* Drag & drop PDF */}
              <div className="panel temarios-panel-card anim-card-hover">
                <div className="asistencias-card-head">
                  <h3 className="asistencias-sub-title">📄 Extracción Automática desde PDF</h3>
                  <p className="asistencias-sub-desc">Sube tu programa de estudios oficial y el sistema extraerá las unidades temáticas de forma estructurada.</p>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onDragEnter={() => setDrag(true)}
                  onDragLeave={() => setDrag(false)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) manejarArchivo(f); }}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      inputRef.current?.click();
                    }
                  }}
                  className={`temarios-upload-box ${drag ? 'drag-active' : ''} anim-card-hover`}
                >
                  <div className="temarios-upload-icon-orb" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  {archivoPdf ? (
                    <div className="temarios-file-pill anim-badge-in">
                      <span>📄 <strong>{archivoNombre}</strong></span>
                      <span className="nota">({(archivoPdf.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <div className="temarios-upload-prompt">
                      <p className="temarios-upload-title">Arrastra tu PDF aquí o haz click para seleccionar</p>
                      <p className="nota">Documento PDF oficial de la materia o syllabus académico</p>
                    </div>
                  )}
                </div>
                <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) manejarArchivo(f); }} />

                <div className="temarios-form-actions temarios-btn-margin-top">
                  <div className="auth-input-box auth-input-box--book auth-input-box--animated temarios-input-flex">
                    <input
                      type="text"
                      placeholder="Nombre del temario"
                      value={nombreNuevo}
                      onChange={(e) => setNombreNuevo(e.target.value)}
                      className="asistencias-input"
                    />
                  </div>
                  <Boton
                    type="button"
                    onClick={() => void subirPdf()}
                    disabled={!archivoPdf || cargando}
                    cargando={cargando}
                    className="asistencias-btn-primario pulse-glow"
                    icono={
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    }
                  >
                    {cargando ? 'Procesando…' : 'Cargar PDF'}
                  </Boton>
                </div>
              </div>

              {/* Manual */}
              <div className="panel temarios-panel-card anim-card-hover">
                <div className="asistencias-card-head">
                  <h3 className="asistencias-sub-title">✍️ Carga Manual Jerárquica</h3>
                  <p className="asistencias-sub-desc">
                    Escribe tu temario usando numeración estándar: <code>1 Tema principal</code>, <code>1.1 Subtema</code>, <code>1.1.1 Detalle</code>.
                  </p>
                </div>

                <div className="auth-input-box auth-input-box--book auth-input-box--animated temarios-input-full">
                  <input
                    type="text"
                    placeholder="Nombre del temario"
                    value={nombreNuevo}
                    onChange={(e) => setNombreNuevo(e.target.value)}
                    className="asistencias-input"
                  />
                </div>

                <textarea
                  placeholder={'1 Introducción\n1.1 Conceptos básicos\n1.1.1 Definiciones\n2 Desarrollo…'}
                  value={textoManual}
                  onChange={(e) => setTextoManual(e.target.value)}
                  rows={10}
                  className="asistencias-input font-code temarios-textarea"
                />

                <Boton
                  type="button"
                  onClick={() => void cargarManual()}
                  disabled={cargando}
                  cargando={cargando}
                  className="asistencias-btn-primario temarios-btn-margin-top pulse-glow"
                  icono={
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  }
                >
                  {cargando ? 'Cargando…' : 'Crear temario'}
                </Boton>
              </div>
            </div>
          )}

          {/* ── TAB ÁRBOL ── */}
          {tab === 'arbol' && temarioActual && (
            <div className="anim-fade-in">
              {/* Cabecera con progreso */}
              <div className="temarios-tree-hero-card anim-card-hover">
                <div className="temarios-tree-header">
                  <div className="temarios-tree-title-group">
                    <span className="temarios-status-pill">
                      <span className="temarios-pulse-dot" aria-hidden="true" />
                      <span>Árbol de Contenidos Activo</span>
                    </span>
                    <h3>{temarioActual.nombre}</h3>
                  </div>
                  <span className={`temario-tree-badge ${temarioActual.porcentajeAvance === 100 ? 'temarios-progress-val-success' : 'temarios-progress-val-accent'}`}>
                    {temarioActual.porcentajeAvance}% completado
                  </span>
                </div>

                <div className="temarios-progress-track">
                  <div
                    className="temarios-progress-bar"
                    ref={(el) => {
                      if (el) {
                        el.style.width = `${Math.min(100, Math.max(0, temarioActual.porcentajeAvance))}%`;
                      }
                    }}
                  />
                </div>

                {/* Leyenda interactiva */}
                <div className="temarios-tree-legend">
                  {(['pendiente', 'en_progreso', 'cubierto'] as const).map((e) => (
                    <span key={e} className="temarios-legend-node-chip">
                      <span>{ESTADO_ICON[e]}</span>
                      <strong>{e === 'pendiente' ? 'Pendiente' : e === 'en_progreso' ? 'En progreso' : 'Cubierto'}</strong>
                    </span>
                  ))}
                  <span className="nota temarios-legend-hint">💡 Haz clic en cualquier nodo para ciclar su estado (○ ➔ 🔄 ➔ ✅)</span>
                </div>
              </div>

              {cargando ? (
                <div className="asistencias-loading-box anim-fade-in">
                  <div className="asistencias-panel__icon-orb anim-icon-pulse" aria-hidden="true">⏳</div>
                  <p>Cargando árbol curricular…</p>
                </div>
              ) : (
                <div className="temarios-tree-stack anim-fade-in">
                  {nodos.map((nodo) => (
                    <div
                      key={nodo._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => { if (!guardandoNodo) void ciclarEstadoNodo(nodo); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (!guardandoNodo) void ciclarEstadoNodo(nodo);
                        }
                      }}
                      className={`temarios-node-item anim-slide-up ${
                        nodo.estado === 'cubierto' ? 'temarios-node-cubierto' : nodo.estado === 'en_progreso' ? 'temarios-node-en-progreso' : ''
                      } temarios-node-level-${nodo.nivel}`}
                    >
                      <span className="temarios-node-icon" aria-hidden="true">
                        {ESTADO_ICON[nodo.estado]}
                      </span>
                      <div className={`temarios-node-title ${nodo.nivel === 1 ? 'temarios-node-nivel-1' : nodo.nivel === 2 ? 'temarios-node-nivel-2' : 'temarios-node-nivel-3'}`}>
                        <span className="font-code temarios-node-num">
                          {nodo.numero}
                        </span>
                        <span className="temarios-node-text">{nodo.titulo}</span>
                      </div>
                      {nodo.cubiertaEn && (
                        <span className="temarios-node-date anim-badge-in">
                          🗓️ {new Date(nodo.cubiertaEn).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
