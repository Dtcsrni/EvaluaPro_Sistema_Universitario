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

// ─── Estado colores ───────────────────────────────────────────────────────────
const ESTADO_COLOR: Record<string, string> = {
  cubierto: 'var(--color-verde, #16a34a)',
  en_progreso: 'var(--color-naranja, #f59e0b)',
  pendiente: 'var(--color-texto-secundario, #9ca3af)'
};
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
      emitToast({ level: 'warn', title: 'Archivo inválido', message: 'Solo se aceptan PDFs.' });
      return;
    }
    setArchivoPdf(file);
    setArchivoNombre(file.name);
    if (!nombreNuevo) setNombreNuevo(file.name.replace(/\.pdf$/i, ''));
  }

  async function subirPdf() {
    if (!archivoPdf || !periodoId) {
      emitToast({ level: 'warn', title: 'Datos incompletos', message: 'Selecciona periodo y PDF.' });
      return;
    }
    setCargando(true);
    try {
      const form = new FormData();
      form.append('archivo', archivoPdf);
      form.append('periodoId', periodoId);
      form.append('nombre', nombreNuevo || archivoNombre);

      const data = await clienteApi.enviarFormData<{ temario: Temario; totalNodos: number }>(
        '/temarios/desde-pdf',
        form
      );
      emitToast({ level: 'ok', title: 'Temario cargado', message: `${data.totalNodos} temas detectados.` });
      setArchivoPdf(null);
      setArchivoNombre('');
      setNombreNuevo('');
      void cargarTemarios();
      void abrirTemario(data.temario);
    } catch {
      emitToast({ level: 'error', title: 'Error al parsear PDF', message: 'Verifique el formato del documento.' });
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
    <section style={ { padding: '1rem 1.5rem' }}>
      <h2 style={ { margin: '0 0 1rem', fontWeight: 700, fontSize: '1.25rem' }}>📚 Temarios</h2>

      {/* Filtro periodo */}
      <div style={ { marginBottom: '1rem' }}>
        <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)} style={estiloSelect}>
          <option value="">— Selecciona periodo —</option>
          {periodos.filter((p) => p.activo).map((p) => (
            <option key={p._id} value={p._id}>{p.nombre}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div style={ { display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['lista', 'cargar', ...(temarioActual ? ['arbol'] : [])] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as TabLocal)}
            style={ {
              ...estiloTab,
              background: tab === t ? 'var(--color-primario, #4f46e5)' : 'transparent',
              color: tab === t ? '#fff' : 'inherit'
            }}
          >
            {t === 'lista' ? '📋 Mis temarios' : t === 'cargar' ? '➕ Cargar temario' : `🌳 ${temarioActual?.nombre ?? 'Árbol'}`}
          </button>
        ))}
      </div>

      {/* ── LISTA ── */}
      {tab === 'lista' && (
        <div>
          {temarios.length === 0 ? (
            <p style={ { color: 'var(--color-texto-secundario, #888)' }}>
              {periodoId ? 'Sin temarios. Carga uno desde la pestaña ➕.' : 'Selecciona un periodo.'}
            </p>
          ) : (
            <div style={ { display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {temarios.map((t) => (
                <div
                  key={t._id}
                  style={estiloTarjeta}
                  role="button"
                  tabIndex={0}
                  onClick={() => void abrirTemario(t)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void abrirTemario(t); }}
                  title="Abrir temario"
                >
                  <div style={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={ { fontSize: '1rem' }}>{t.nombre}</strong>
                    <span style={ { fontSize: '0.85rem', color: 'var(--color-texto-secundario, #888)' }}>
                      {t.totalNodos} temas
                    </span>
                  </div>
                  {/* Barra de progreso */}
                  <div style={ { marginTop: '0.5rem' }}>
                    <div style={ { display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                      <span>Avance</span>
                      <span style={ { fontWeight: 600, color: t.porcentajeAvance === 100 ? 'var(--color-verde, #16a34a)' : 'inherit' }}>
                        {t.porcentajeAvance}%
                      </span>
                    </div>
                    <div style={ { height: '6px', borderRadius: '3px', background: 'var(--color-borde, #e5e7eb)', overflow: 'hidden' }}>
                      <div style={ {
                        height: '100%',
                        width: `${t.porcentajeAvance}%`,
                        background: t.porcentajeAvance === 100 ? 'var(--color-verde, #16a34a)' : 'var(--color-primario, #4f46e5)',
                        borderRadius: '3px',
                        transition: 'width 0.4s ease'
                      }} />
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
        <div style={ { display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Drag & drop PDF */}
          <div style={estiloTarjeta}>
            <h3 style={ { margin: '0 0 0.75rem', fontSize: '1rem' }}>📄 Desde PDF</h3>
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
              style={ {
                border: `2px dashed ${drag ? 'var(--color-primario, #4f46e5)' : 'var(--color-borde, #d1d5db)'}`,
                borderRadius: '0.5rem',
                padding: '2rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: drag ? 'rgba(79,70,229,0.04)' : 'transparent',
                transition: 'all 0.2s'
              }}
            >
              {archivoPdf ? (
                <p style={ { margin: 0, fontWeight: 600 }}>📄 {archivoNombre}</p>
              ) : (
                <p style={ { margin: 0, color: 'var(--color-texto-secundario, #888)' }}>
                  Arrastra tu PDF aquí o haz click para seleccionar
                </p>
              )}
            </div>
            <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) manejarArchivo(f); }} />
            <div style={ { display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input
                type="text"
                placeholder="Nombre del temario"
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value)}
                style={ { ...estiloInput, flexGrow: 1 }}
              />
              <button
                onClick={() => void subirPdf()}
                disabled={!archivoPdf || cargando}
                style={estiloBotonPrimario}
              >
                {cargando ? 'Procesando…' : '⬆️ Cargar PDF'}
              </button>
            </div>
          </div>

          {/* Manual */}
          <div style={estiloTarjeta}>
            <h3 style={ { margin: '0 0 0.5rem', fontSize: '1rem' }}>✍️ Carga manual</h3>
            <p style={ { fontSize: '0.82rem', color: 'var(--color-texto-secundario, #888)', margin: '0 0 0.5rem' }}>
              Formato: <code>1 Tema principal</code>, <code>1.1 Subtema</code>, <code>1.1.1 Sub-subtema</code>
            </p>
            <input
              type="text"
              placeholder="Nombre del temario"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              style={ { ...estiloInput, width: '100%', marginBottom: '0.5rem', boxSizing: 'border-box' }}
            />
            <textarea
              placeholder={'1 Introducción\n1.1 Conceptos básicos\n1.1.1 Definiciones\n2 Desarrollo…'}
              value={textoManual}
              onChange={(e) => setTextoManual(e.target.value)}
              rows={10}
              style={ { ...estiloInput, width: '100%', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '0.85rem' }}
            />
            <button onClick={() => void cargarManual()} disabled={cargando} style={ { ...estiloBotonPrimario, marginTop: '0.5rem' }}>
              {cargando ? 'Cargando…' : '✅ Crear temario'}
            </button>
          </div>
        </div>
      )}

      {/* ── ÁRBOL ── */}
      {tab === 'arbol' && temarioActual && (
        <div>
          {/* Cabecera con progreso */}
          <div style={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={ { margin: 0, fontSize: '1rem' }}>{temarioActual.nombre}</h3>
            <span style={ {
              fontWeight: 700,
              color: temarioActual.porcentajeAvance === 100 ? 'var(--color-verde, #16a34a)' : 'var(--color-primario, #4f46e5)'
            }}>
              {temarioActual.porcentajeAvance}% completado
            </span>
          </div>
          <div style={ { height: '8px', borderRadius: '4px', background: 'var(--color-borde, #e5e7eb)', marginBottom: '1rem', overflow: 'hidden' }}>
            <div style={ {
              height: '100%',
              width: `${temarioActual.porcentajeAvance}%`,
              background: 'var(--color-primario, #4f46e5)',
              borderRadius: '4px',
              transition: 'width 0.4s ease'
            }} />
          </div>

          {/* Leyenda */}
          <div style={ { display: 'flex', gap: '1rem', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
            {(['pendiente', 'en_progreso', 'cubierto'] as const).map((e) => (
              <span key={e}>
                <span style={ { marginRight: '0.25rem' }}>{ESTADO_ICON[e]}</span>
                {e === 'pendiente' ? 'Pendiente' : e === 'en_progreso' ? 'En progreso' : 'Cubierto'}
              </span>
            ))}
            <span style={ { color: 'var(--color-texto-secundario, #888)' }}>· Click para avanzar</span>
          </div>

          {cargando ? (
            <p>Cargando árbol…</p>
          ) : (
            <div style={ { display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
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
                  style={ {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    paddingLeft: `${(nodo.nivel - 1) * 1.5 + 0.5}rem`,
                    paddingRight: '0.75rem',
                    paddingTop: '0.4rem',
                    paddingBottom: '0.4rem',
                    borderRadius: '0.375rem',
                    cursor: guardandoNodo ? 'wait' : 'pointer',
                    opacity: guardandoNodo === nodo._id ? 0.5 : 1,
                    background: nodo.estado === 'cubierto' ? 'rgba(22,163,74,0.06)' : nodo.estado === 'en_progreso' ? 'rgba(245,158,11,0.06)' : 'transparent'
                  }}
                >
                  <span style={ { color: ESTADO_COLOR[nodo.estado], fontSize: nodo.nivel === 1 ? '1.1rem' : '0.9rem' }}>
                    {ESTADO_ICON[nodo.estado]}
                  </span>
                  <span style={ {
                    fontSize: nodo.nivel === 1 ? '0.95rem' : nodo.nivel === 2 ? '0.88rem' : '0.82rem',
                    fontWeight: nodo.nivel === 1 ? 700 : nodo.nivel === 2 ? 500 : 400,
                    color: nodo.estado === 'cubierto' ? 'var(--color-texto-secundario, #9ca3af)' : 'inherit',
                    textDecoration: nodo.estado === 'cubierto' ? 'line-through' : 'none',
                    flexGrow: 1
                  }}>
                    <span style={ { marginRight: '0.4rem', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-texto-secundario, #9ca3af)' }}>
                      {nodo.numero}
                    </span>
                    {nodo.titulo}
                  </span>
                  {nodo.cubiertaEn && (
                    <span style={ { fontSize: '0.72rem', color: 'var(--color-verde, #16a34a)' }}>
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

// ─── Estilos ──────────────────────────────────────────────────────────────────
const estiloSelect: React.CSSProperties = {
  padding: '0.4rem 0.6rem',
  borderRadius: '0.375rem',
  border: '1px solid var(--color-borde, #d1d5db)',
  background: 'var(--color-fondo-input, #fff)',
  fontSize: '0.9rem'
};
const estiloInput: React.CSSProperties = {
  padding: '0.4rem 0.6rem',
  borderRadius: '0.375rem',
  border: '1px solid var(--color-borde, #d1d5db)',
  background: 'var(--color-fondo-input, #fff)',
  fontSize: '0.9rem'
};
const estiloBotonPrimario: React.CSSProperties = {
  padding: '0.45rem 1rem',
  borderRadius: '0.375rem',
  background: 'var(--color-primario, #4f46e5)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.9rem'
};
const estiloTab: React.CSSProperties = {
  padding: '0.4rem 0.9rem',
  borderRadius: '0.375rem',
  border: '1px solid var(--color-borde, #d1d5db)',
  cursor: 'pointer',
  fontSize: '0.88rem',
  fontWeight: 500
};
const estiloTarjeta: React.CSSProperties = {
  background: 'var(--color-fondo-2, #f9fafb)',
  border: '1px solid var(--color-borde, #e5e7eb)',
  borderRadius: '0.5rem',
  padding: '1rem',
  cursor: 'pointer'
};

