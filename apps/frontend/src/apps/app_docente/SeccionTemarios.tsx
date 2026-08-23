/**
 * SeccionTemarios.tsx
 *
 * Módulo de carga y seguimiento de temarios del docente:
 * - Carga desde PDF (drag & drop) o texto manual
 * - Vista de árbol jerárquico (1, 1.1, 1.1.1…)
 * - Cambio de estado por nodo (pendiente → en progreso → cubierto)
 * - Barra de progreso por temario
 * - Vinculación con sesión de asistencia
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { clienteApi } from './clienteApiDocente';
import { emitToast } from '../../ui/toast/toastBus';
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

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <section className="temarios-container">
      <h2 className="eyebrow">📚 Temarios</h2>

      {/* Filtro periodo */}
      <div className="temarios-spacing-bottom">
        <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)} className="asistencias-select">
          <option value="">— Selecciona periodo —</option>
          {periodos.filter((p) => p.activo).map((p) => (
            <option key={p._id} value={p._id}>{p.nombre}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="temarios-tab-bar">
        {(['lista', 'cargar', ...(temarioActual ? ['arbol'] : [])] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as TabLocal)}
            className={`nav-docente-tab ${tab === t ? 'activo' : ''}`}
          >
            {t === 'lista' ? '📋 Mis temarios' : t === 'cargar' ? '➕ Cargar temario' : `🌳 ${temarioActual?.nombre ?? 'Árbol'}`}
          </button>
        ))}
      </div>

      {/* ── LISTA ── */}
      {tab === 'lista' && (
        <div>
          {temarios.length === 0 ? (
            <p className="nota">
              {periodoId ? 'Sin temarios. Carga uno desde la pestaña ➕.' : 'Selecciona un periodo.'}
            </p>
          ) : (
            <div className="temarios-list-stack">
              {temarios.map((t) => (
                <div
                  key={t._id}
                  className="temarios-card scale-hover"
                  role="button"
                  tabIndex={0}
                  onClick={() => void abrirTemario(t)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void abrirTemario(t); }}
                  title="Abrir temario"
                >
                  <div className="temarios-card-header">
                    <strong>{t.nombre}</strong>
                    <span className="nota">
                      {t.totalNodos} temas
                    </span>
                  </div>
                  {/* Barra de progreso */}
                  <div className="temarios-btn-margin-top">
                    <div className="temarios-progress-label-row">
                      <span>Avance</span>
                      <span className={t.porcentajeAvance === 100 ? 'temarios-progress-val-success' : undefined}>
                        {t.porcentajeAvance}%
                      </span>
                    </div>
                    <div className="temarios-progress-track">
                      <div className="temarios-progress-bar" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CARGAR ── */}
      {tab === 'cargar' && (
        <div className="temarios-list-stack">
          {/* Drag & drop PDF */}
          <div className="temarios-card">
            <h3>📄 Desde PDF</h3>
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
              className={`temarios-upload-box ${drag ? 'drag-active' : ''}`}
            >
              {archivoPdf ? (
                <p><strong>📄 {archivoNombre}</strong></p>
              ) : (
                <p className="nota">
                  Arrastra tu PDF aquí o haz click para seleccionar
                </p>
              )}
            </div>
            <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) manejarArchivo(f); }} />
            <div className="temarios-tab-bar temarios-btn-margin-top">
              <input
                type="text"
                placeholder="Nombre del temario"
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value)}
                className="asistencias-input temarios-input-flex"
              />
              <button
                onClick={() => void subirPdf()}
                disabled={!archivoPdf || cargando}
                className="asistencias-btn-primario"
              >
                {cargando ? 'Procesando…' : '⬆️ Cargar PDF'}
              </button>
            </div>
          </div>

          {/* Manual */}
          <div className="temarios-card">
            <h3>✍️ Carga manual</h3>
            <p className="nota">
              Formato: <code>1 Tema principal</code>, <code>1.1 Subtema</code>, <code>1.1.1 Sub-subtema</code>
            </p>
            <input
              type="text"
              placeholder="Nombre del temario"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              className="asistencias-input temarios-input-full"
            />
            <textarea
              placeholder={'1 Introducción\n1.1 Conceptos básicos\n1.1.1 Definiciones\n2 Desarrollo…'}
              value={textoManual}
              onChange={(e) => setTextoManual(e.target.value)}
              rows={10}
              className="asistencias-input font-code temarios-textarea"
            />
            <button onClick={() => void cargarManual()} disabled={cargando} className="asistencias-btn-primario temarios-btn-margin-top">
              {cargando ? 'Cargando…' : '✅ Crear temario'}
            </button>
          </div>
        </div>
      )}

      {/* ── ÁRBOL ── */}
      {tab === 'arbol' && temarioActual && (
        <div>
          {/* Cabecera con progreso */}
          <div className="temarios-tree-header">
            <h3>{temarioActual.nombre}</h3>
            <span className={temarioActual.porcentajeAvance === 100 ? 'temarios-progress-val-success' : 'temarios-progress-val-accent'}>
              {temarioActual.porcentajeAvance}% completado
            </span>
          </div>
          <div className="temarios-progress-track">
            <div className="temarios-progress-bar" />
          </div>

          {/* Leyenda */}
          <div className="temarios-tree-legend">
            {(['pendiente', 'en_progreso', 'cubierto'] as const).map((e) => (
              <span key={e}>
                <span>{ESTADO_ICON[e]}</span>{' '}
                {e === 'pendiente' ? 'Pendiente' : e === 'en_progreso' ? 'En progreso' : 'Cubierto'}
              </span>
            ))}
            <span className="nota">· Click para avanzar</span>
          </div>

          {cargando ? (
            <p>Cargando árbol…</p>
          ) : (
            <div className="temarios-tree-stack">
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
                  className={`temarios-node-item ${nodo.estado === 'cubierto' ? 'temarios-node-cubierto' : ''}`}
                >
                  <span className="temarios-node-icon">
                    {ESTADO_ICON[nodo.estado]}
                  </span>
                  <span className={`temarios-node-title ${nodo.nivel === 1 ? 'temarios-node-nivel-1' : nodo.nivel === 2 ? 'temarios-node-nivel-2' : 'temarios-node-nivel-3'}`}>
                    <span className="font-code nota">
                      {nodo.numero}{' '}
                    </span>
                    {nodo.titulo}
                  </span>
                  {nodo.cubiertaEn && (
                    <span className="temarios-node-date">
                      {new Date(nodo.cubiertaEn).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}


