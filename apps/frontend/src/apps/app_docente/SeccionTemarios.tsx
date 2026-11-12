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
import { IconoCampo } from '../../ui/IconoLucide';
import { clienteApi } from './clienteApiDocente';
import { emitToast } from '../../ui/toast/toastBus';
import { accionToastSesionParaError, ErrorRemoto, mensajeUsuarioDeErrorConSugerencia } from '../../servicios_api/clienteComun';
import { Icono } from '../../ui/iconos';
import {
  ArrowRight,
  BookOpenText,
  CalendarDays,
  Check,
  Circle,
  CircleCheck,
  Clock3,
  FileText,
  ListTree,
  LoaderCircle,
  Plus,
  TreeDeciduous,
  Upload,
  type LucideIcon,
  IconoLucide
} from '../../ui/iconosCatalogo';
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
  updatedAt: string;
  textoOriginal?: string | null;
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
const ESTADO_ICON: Record<TemaNode['estado'], LucideIcon> = {
  cubierto: CircleCheck,
  en_progreso: Clock3,
  pendiente: Circle
};
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

function formatearTamanoArchivo(bytes: number): string {
  const kilobytes = bytes / 1024;
  return kilobytes >= 1 ? `${kilobytes.toFixed(1)} KB` : 'menos de 1 KB';
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
  const [cargandoLista, setCargandoLista] = useState(false);
  const [errorLista, setErrorLista] = useState('');
  const [errorArbol, setErrorArbol] = useState('');
  const [errorPdf, setErrorPdf] = useState('');
  const [errorManual, setErrorManual] = useState('');
  const [errorNodo, setErrorNodo] = useState('');
  const [periodoListaId, setPeriodoListaId] = useState('');
  const [tabEnFoco, setTabEnFoco] = useState(0);
  const [guardandoNodo, setGuardandoNodo] = useState('');
  const secuenciaLista = useRef(0);
  const secuenciaArbol = useRef(0);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);

  // Formulario carga manual
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [textoManual, setTextoManual] = useState('');
  const [motivoCambio, setMotivoCambio] = useState('');
  const [editandoTemario, setEditandoTemario] = useState(false);

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

  const estadoPeriodo = !periodoId
    ? 'Elige una materia'
    : cargandoLista
      ? 'Cargando temarios'
      : errorLista
        ? 'No se pudo consultar'
        : periodoListaId === periodoId
          ? 'Periodo actualizado'
          : 'Cargando temarios';

  const cargarTemarios = useCallback(async () => {
    const secuencia = ++secuenciaLista.current;
    if (!periodoId) {
      setTemarios([]);
      setPeriodoListaId('');
      setErrorLista('');
      setCargandoLista(false);
      return;
    }
    setTemarios([]);
    setPeriodoListaId('');
    setErrorLista('');
    setCargandoLista(true);
    try {
      const data = await clienteApi.obtener<{ temarios: Temario[] }>(
        `/temarios?periodoId=${encodeURIComponent(periodoId)}`
      );
      if (secuencia !== secuenciaLista.current) return;
      setTemarios(data.temarios ?? []);
      setPeriodoListaId(periodoId);
    } catch {
      if (secuencia !== secuenciaLista.current) return;
      setTemarios([]);
      setErrorLista('No se pudieron cargar los temarios de este periodo. Reintenta la consulta.');
    } finally {
      if (secuencia === secuenciaLista.current) setCargandoLista(false);
    }
  }, [periodoId]);

  useEffect(() => { void cargarTemarios(); }, [cargarTemarios]);

  async function abrirTemario(t: Temario) {
    const secuencia = ++secuenciaArbol.current;
    setTemarioActual(t);
    setNodos([]);
    setErrorArbol('');
    setErrorNodo('');
    setCargando(true);
    try {
      const data = await clienteApi.obtener<{ temario?: Temario; nodos: TemaNode[] }>(
        `/temarios/${encodeURIComponent(t._id)}/nodos`
      );
      if (secuencia !== secuenciaArbol.current) return;
      if (data.temario) setTemarioActual({ ...t, ...data.temario });
      setNodos(data.nodos ?? []);
      setTab('arbol');
      setTabEnFoco(2);
    } catch {
      if (secuencia !== secuenciaArbol.current) return;
      setErrorArbol('No se pudo cargar este temario. Reintenta para consultar sus temas.');
    } finally {
      if (secuencia === secuenciaArbol.current) setCargando(false);
    }
  }

  // ─── Cargar PDF ─────────────────────────────────────────────────────────────
  function manejarArchivo(file: File) {
    const tipoPdf = file.type.trim().toLowerCase() === 'application/pdf';
    const extensionPdf = /\.pdf$/i.test(file.name);
    if (!tipoPdf && !extensionPdf) {
      setArchivoPdf(null);
      setArchivoNombre('');
      setErrorPdf('El archivo seleccionado no es un PDF. Elige un archivo .pdf.');
      return;
    }
    setErrorPdf('');
    setArchivoPdf(tipoPdf
      ? file
      : new File([file], file.name, { type: 'application/pdf', lastModified: file.lastModified }));
    setArchivoNombre(file.name);
    if (!nombreNuevo) setNombreNuevo(file.name.replace(/\.pdf$/i, ''));
  }

  async function subirPdf() {
    if (!archivoPdf || !periodoId || !nombreNuevo) {
      setErrorPdf('Selecciona un periodo, un archivo PDF y escribe el nombre del temario para continuar.');
      return;
    }
    setErrorPdf('');
    setCargando(true);
    try {
      const formData = new FormData();
      formData.set('periodoId', periodoId);
      formData.set('nombre', nombreNuevo);
      formData.set('archivo', archivoPdf, archivoPdf.name);
      const data = await clienteApi.enviarFormData<{ temario: Temario; totalNodos: number }>(
        '/temarios/desde-pdf',
        formData
      );
      setArchivoPdf(null);
      setArchivoNombre('');
      setNombreNuevo('');
      void cargarTemarios();
      void abrirTemario(data.temario);
    } catch (e: unknown) {
      const msg = mensajeUsuarioDeErrorConSugerencia(e, 'Revisa el archivo e intenta cargarlo de nuevo.');
      setErrorPdf(`No se pudo procesar el PDF: ${msg} Verifica el archivo e inténtalo de nuevo.`);
    } finally {
      setCargando(false);
    }
  }

  // ─── Carga manual ────────────────────────────────────────────────────────────
  async function cargarManual() {
    if (!textoManual.trim() || !nombreNuevo || (!editandoTemario && !periodoId)) {
      setErrorManual('Selecciona un periodo y completa el nombre y contenido del temario.');
      return;
    }
    setErrorManual('');
    setCargando(true);
    try {
      if (editandoTemario && temarioActual) {
        const data = await clienteApi.actualizar<{ temario: Temario; nodos: TemaNode[] }>(
          `/temarios/${encodeURIComponent(temarioActual._id)}`,
          {
            nombre: nombreNuevo,
            texto: textoManual,
            expectedUpdatedAt: temarioActual.updatedAt,
            motivoCambio
          }
        );
        setEditandoTemario(false);
        setMotivoCambio('');
        await cargarTemarios();
        await abrirTemario({ ...temarioActual, ...data.temario, _id: temarioActual._id });
        return;
      }
      const data = await clienteApi.enviar<{ temario: Temario; totalNodos: number }>(
        '/temarios/manual',
        { periodoId, nombre: nombreNuevo, texto: textoManual }
      );
      setTextoManual('');
      setNombreNuevo('');
      void cargarTemarios();
      void abrirTemario(data.temario);
    } catch (e: unknown) {
      const msg = mensajeUsuarioDeErrorConSugerencia(e, 'Revisa el nombre y el contenido e intenta guardar de nuevo.');
      setErrorManual(`No se pudo guardar el temario: ${msg} Revisa los datos e inténtalo de nuevo.`);
    } finally {
      setCargando(false);
    }
  }

  function prepararEdicionTemario() {
    if (!temarioActual) return;
    setEditandoTemario(true);
    setNombreNuevo(temarioActual.nombre);
    setTextoManual(String(temarioActual.textoOriginal ?? nodos.map((nodo) => `${nodo.numero} ${nodo.titulo}`).join('\n')));
    setMotivoCambio('');
    setErrorManual('');
    setTab('cargar');
    setTabEnFoco(1);
  }

  async function eliminarTemarioActual() {
    if (!temarioActual || !window.confirm('¿Eliminar este temario? Solo se permite si no tiene avance ni notas vinculadas.')) return;
    const motivo = window.prompt('Indica el motivo de eliminación:');
    if (!motivo?.trim()) {
      emitToast({ level: 'warn', title: 'Motivo requerido', message: 'No se eliminó el temario.' });
      return;
    }
    if (!temarioActual.updatedAt) {
      emitToast({ level: 'error', title: 'Versión no disponible', message: 'Vuelve a abrir el temario antes de eliminarlo.' });
      return;
    }
    setCargando(true);
    try {
      await clienteApi.enviar(`/temarios/${encodeURIComponent(temarioActual._id)}/eliminar`, {
        confirmarEliminacion: true,
        expectedUpdatedAt: temarioActual.updatedAt,
        motivoCambio: motivo.trim()
      });
      setTemarios((actuales) => actuales.filter((temario) => temario._id !== temarioActual._id));
      setTemarioActual(null);
      setNodos([]);
      setTab('lista');
      setTabEnFoco(0);
      emitToast({ level: 'ok', title: 'Temario eliminado', message: 'La acción quedó registrada en la auditoría.' });
    } catch (e: unknown) {
      const message = e instanceof ErrorRemoto
        ? e.detalle.status === 401
          ? 'Tu sesión venció. Cierra sesión y vuelve a ingresar.'
          : mensajeUsuarioDeErrorConSugerencia(e, 'Revisa el estado del temario e inténtalo de nuevo.')
        : 'No se pudo eliminar el temario. Revisa la conexión e inténtalo de nuevo.';
      const action = accionToastSesionParaError(e, 'docente');
      emitToast({ level: 'error', title: 'No se pudo eliminar', message, ...(action ? { action } : {}) });
    } finally {
      setCargando(false);
    }
  }

  // ─── Cambiar estado de nodo ──────────────────────────────────────────────────
  async function ciclarEstadoNodo(nodo: TemaNode) {
    const siguiente = ESTADO_CICLO[(ESTADO_CICLO.indexOf(nodo.estado) + 1) % ESTADO_CICLO.length]!;
    setGuardandoNodo(nodo._id);
    setErrorNodo('');
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
      setErrorNodo(`No se pudo actualizar el estado de «${nodo.titulo}». Reintenta la acción.`);
    } finally {
      setGuardandoNodo('');
    }
  }

  return (
    <div className="panel temarios-panel anim-fade-in">
      {/* ── 1. Cabecera Ejecutiva Bento con Mini-KPIs ─── */}
      <div className="temarios-panel__head">
        <div className="temarios-panel__lead">
          <div className="icono-seccion-orb temarios-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <IconoLucide icon={BookOpenText} size={24} />
          </div>
          <div className="temarios-panel__text-block">
            <div className="temarios-panel__meta-row">
              <span className="temarios-status-pill" role="status">
                <span className="temarios-pulse-dot" aria-hidden="true" />
                <span>{estadoPeriodo}</span>
              </span>
              <span className="temarios-counter-tag">
                {periodoSeleccionado ? periodoSeleccionado.nombre : 'Sin materia seleccionada'}
              </span>
            </div>
            <h2 className="temarios-panel__title eyebrow">Temarios</h2>
            <p className="nota">Organización de unidades temáticas, seguimiento de avance lectivo y alineación curricular.</p>
          </div>
        </div>

        <div className="temarios-filtros-bar anim-form-card">
          <label className="asistencias-label-field">
            <span className="asistencias-field-lbl">
              <IconoLucide icon={BookOpenText} size={14} />
              Periodo o materia
            </span>
            <div className="auth-input-box auth-input-box--book auth-input-box--animated">
              <IconoCampo nombre="book" />
              <select
                value={periodoId}
                onChange={(e) => {
                  const siguientePeriodo = e.target.value;
                  secuenciaArbol.current += 1;
                  setCargando(false);
                  setErrorArbol('');
                  setTemarioActual(null);
                  setNodos([]);
                  setTab('lista');
                  setTabEnFoco(0);
                  setPeriodoId(siguientePeriodo);
                }}
                className="asistencias-select-field asistencias-select"
              >
                <option value="">Elige materia</option>
                {periodos.filter((p) => p.activo !== false).map((p) => (
                  <option key={p._id} value={p._id}>{p.nombre}</option>
                ))}
              </select>
            </div>
          </label>
        </div>

        <div className="temarios-header-kpis">
          <div className="temario-mini-kpi temario-mini-kpi--temarios anim-kpi-hover" data-tooltip="Total de planes de estudio registrados">
            <span className="temario-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={BookOpenText} size={16} />
            </span>
            <span className="temario-mini-kpi__num">{periodoId && periodoListaId === periodoId && !cargandoLista ? kpis.totalTemarios : '—'}</span>
            <span className="temario-mini-kpi__lbl">Temarios</span>
          </div>

          <div className="temario-mini-kpi temario-mini-kpi--temas anim-kpi-hover" data-tooltip="Total de temas y subtemas estructurados">
            <span className="temario-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={ListTree} size={16} />
            </span>
            <span className="temario-mini-kpi__num">{periodoId && periodoListaId === periodoId && !cargandoLista ? kpis.totalTemas : '—'}</span>
            <span className="temario-mini-kpi__lbl">Temas</span>
          </div>

          <div className="temario-mini-kpi temario-mini-kpi--avance anim-kpi-hover" data-tooltip="Porcentaje promedio de cobertura del curso">
            <span className="temario-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={Clock3} size={16} />
            </span>
            <span className="temario-mini-kpi__num">
              {periodoId && periodoListaId === periodoId && !cargandoLista ? <>{kpis.promedioAvance}<small className="temario-mini-kpi__pct">%</small></> : '—'}
            </span>
            <span className="temario-mini-kpi__lbl">Avance promedio</span>
          </div>

          <div className="temario-mini-kpi temario-mini-kpi--cubiertos anim-kpi-hover" data-tooltip="Temas completados en clase">
            <span className="temario-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={CircleCheck} size={16} />
            </span>
            <span className="temario-mini-kpi__num">{temarioActual ? kpis.temasCubiertos : '—'}</span>
            <span className="temario-mini-kpi__lbl">Cubiertos en temario abierto</span>
          </div>
        </div>
      </div>

      {/* ── 3. Guía Visual Bento ─── */}
      <GuiaTemariosVisual />

      {/* ── 4. Tabs Elevados ─── */}
      <div className="temarios-tabs-bar temarios-tab-bar" role="tablist" tabIndex={-1} aria-label="Vistas de temarios" onKeyDown={(event) => {
        const visibles = tabsRef.current.filter((button): button is HTMLButtonElement => Boolean(button));
        let indice: number;
        if (event.key === 'ArrowRight') indice = (tabEnFoco + 1) % visibles.length;
        else if (event.key === 'ArrowLeft') indice = (tabEnFoco - 1 + visibles.length) % visibles.length;
        else if (event.key === 'Home') indice = 0;
        else if (event.key === 'End') indice = visibles.length - 1;
        else return;
        event.preventDefault();
        setTabEnFoco(indice);
        visibles[indice]?.focus();
        const siguiente = visibles[indice]?.dataset.tab as TabLocal | undefined;
        if (siguiente) setTab(siguiente);
      }}>
        {(['lista', 'cargar', ...(temarioActual ? ['arbol'] : [])] as const).map((t, indice) => (
          <button
            key={t}
            ref={(elemento) => { tabsRef.current[indice] = elemento; }}
            type="button"
            role="tab"
            id={`temarios-tab-${t}`}
            aria-controls={`temarios-panel-${t}`}
            aria-selected={tab === t}
            tabIndex={tabEnFoco === indice ? 0 : -1}
            data-tab={t}
            onFocus={() => setTabEnFoco(indice)}
            onClick={() => { setTab(t as TabLocal); setTabEnFoco(indice); }}
            className={`temarios-tab-btn nav-docente-tab ${tab === t ? 'activo' : ''}`}
          >
            {t === 'lista' && (
              <>
                <IconoLucide icon={FileText} size={16} />
                <span>Mis temarios ({temarios.length})</span>
              </>
            )}
            {t === 'cargar' && (
              <>
                <IconoLucide icon={Plus} size={16} />
                <span>Cargar temario</span>
              </>
            )}
            {t === 'arbol' && (
              <>
                <IconoLucide icon={TreeDeciduous} size={16} />
                <span>{temarioActual?.nombre ?? 'Árbol'} ({temarioActual?.porcentajeAvance ?? 0}%)</span>
              </>
            )}
          </button>
        ))}
      </div>

      {/* ── 5. Estado Vacío Interactivo cuando No Hay Periodo Seleccionado ─── */}
      <div role="tabpanel" id={`temarios-panel-${tab}`} aria-labelledby={`temarios-tab-${tab}`} tabIndex={0}>
      {!periodoId ? (
        <div className="empty-state-card anim-fade-in">
          <div className="empty-state-card__icon anim-icon-pulse">
            <Icono nombre="temarios" size={28} />
          </div>
          <h4>Comienza seleccionando una materia</h4>
          <p className="nota">
            Selecciona una materia activa para consultar sus temarios, registrar unidades temáticas o seguir el avance del programa.
          </p>

          {periodos.filter((p) => p.activo !== false).length > 0 && (
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
              <span>Selecciona materia</span>
            </div>
            <div className="empty-step__arrow"><IconoLucide icon={ArrowRight} size={16} /></div>
            <div className="empty-step">
              <span className="empty-step__num">2</span>
              <span>Carga PDF o texto</span>
            </div>
            <div className="empty-step__arrow"><IconoLucide icon={ArrowRight} size={16} /></div>
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
              {errorArbol && temarioActual && (
                <div role="alert">
                  <p>{errorArbol}</p>
                  <Boton type="button" variante="secundario" onClick={() => void abrirTemario(temarioActual)}>
                    Reintentar carga del temario
                  </Boton>
                </div>
              )}
              {cargandoLista ? <p role="status" aria-live="polite">Cargando temarios del periodo…</p> : errorLista ? (
                <div role="alert"><p>{errorLista}</p><Boton type="button" variante="secundario" onClick={() => void cargarTemarios()} disabled={cargandoLista}>Reintentar</Boton></div>
              ) : periodoListaId !== periodoId ? <p role="status">Espera a que se actualice la lista del periodo seleccionado.</p> : temarios.length === 0 ? (
                <div className="empty-state-card anim-fade-in">
                  <div className="empty-state-card__icon anim-icon-pulse">
                    <IconoLucide icon={FileText} size={26} />
                  </div>
                  <h4>Sin temarios registrados</h4>
                  <p className="nota">
                    No hay temarios para este periodo. Carga tu programa de estudios en PDF o en formato texto desde la pestaña <strong>Cargar temario</strong>.
                  </p>
                  <Boton
                    variante="primario"
                    type="button"
                    onClick={() => { setTab('cargar'); setTabEnFoco(1); }}
                    icono={
                      <IconoLucide icon={Plus} size={14} />
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
                      <button
                        key={t._id}
                        type="button"
                        className="temarios-card item-glass scale-hover anim-card-hover"
                        onClick={() => void abrirTemario(t)}
                        aria-label={`Abrir temario ${t.nombre}, ${t.totalNodos} temas, avance ${t.porcentajeAvance}%`}
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
                          <span className="temario-open-arrow" aria-hidden="true"><IconoLucide icon={ArrowRight} size={16} /></span>
                        </div>

                        {/* Barra de progreso interactiva */}
                        <div className="temarios-btn-margin-top">
                          <div className="temarios-progress-label-row">
                            <span className="temario-progress-lbl">Avance lectivo</span>
                            <span className={`temario-progress-val ${t.porcentajeAvance === 100 ? 'temarios-progress-val-success' : 'temarios-progress-val-accent'}`}>
                              {t.porcentajeAvance}%
                            </span>
                          </div>
                          <div className="temarios-progress-track" role="progressbar" aria-label={`Avance de ${t.nombre}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, t.porcentajeAvance))}>
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
                          <span className="temarios-footer-cta">Ver árbol curricular <IconoLucide icon={ArrowRight} size={14} /></span>
                        </div>
                      </button>
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
              {!editandoTemario && (
              <form
                className="panel temarios-panel-card anim-card-hover"
                aria-label="Carga de temario desde PDF"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  if (cargando) return;
                  void subirPdf();
                }}
              >
                <div className="asistencias-card-head">
                  <h3 className="asistencias-sub-title"><Icono nombre="pdf" /> Extracción Automática desde PDF</h3>
                  <p className="asistencias-sub-desc">Sube tu programa de estudios oficial y el sistema extraerá las unidades temáticas de forma estructurada.</p>
                </div>
                {errorPdf && <div role="alert"><p>{errorPdf}</p></div>}

                <div
                  onDragEnter={() => setDrag(true)}
                  onDragLeave={() => setDrag(false)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) manejarArchivo(f); }}
                  className={`temarios-upload-box ${drag ? 'drag-active' : ''}`}
                >
                  <div className="temarios-upload-icon-orb" aria-hidden="true">
                    <IconoLucide icon={Upload} size={32} />
                  </div>
                  {archivoPdf ? (
                    <div className="temarios-file-pill anim-badge-in">
                      <span><IconoLucide icon={FileText} size={16} /> <strong>{archivoNombre}</strong></span>
                      <span className="nota">({formatearTamanoArchivo(archivoPdf.size)})</span>
                    </div>
                  ) : (
                    <div className="temarios-upload-prompt">
                      <p className="temarios-upload-title">Arrastra tu PDF aquí o selecciónalo</p>
                      <p className="nota">Documento PDF oficial de la materia o syllabus académico</p>
                    </div>
                  )}
                </div>
                <div className="campo temarios-input-full temarios-file-field">
                  <span className="campo__label-text">Archivo PDF</span>
                  <div className="temarios-file-picker">
                    <input
                      id="temarios-archivo-pdf"
                      ref={inputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) manejarArchivo(f); }}
                      className="temarios-file-native-input"
                      aria-hidden="true"
                      tabIndex={-1}
                    />
                    <Boton
                      type="button"
                      variante="secundario"
                      className="temarios-file-trigger"
                      aria-label={archivoPdf ? 'Cambiar archivo PDF' : 'Seleccionar archivo PDF'}
                      aria-controls="temarios-archivo-pdf"
                      aria-describedby="temarios-archivo-pdf-hint temarios-archivo-pdf-status"
                      icono={<IconoLucide icon={Upload} size={16} />}
                      onClick={() => inputRef.current?.click()}
                    >
                      {archivoPdf ? 'Cambiar archivo PDF' : 'Elegir archivo PDF'}
                    </Boton>
                  </div>
                  <span className="ayuda" id="temarios-archivo-pdf-hint">Selecciona un PDF o arrástralo al área superior.</span>
                  <p
                    id="temarios-archivo-pdf-status"
                    role="status"
                    aria-label={archivoNombre ? `Archivo seleccionado: ${archivoNombre}` : 'Archivo PDF'}
                    className="temarios-file-status"
                  >
                    {archivoNombre
                      ? `Archivo seleccionado: ${archivoNombre} (${formatearTamanoArchivo(archivoPdf?.size ?? 0)}).`
                      : 'Ningún archivo seleccionado.'}
                  </p>
                </div>

                <div className="temarios-form-actions temarios-btn-margin-top">
                  <label className="asistencias-label-field temarios-input-flex temarios-input-full" htmlFor="temarios-nombre-pdf">
                    <span>Nombre del temario</span>
                    <input
                      type="text"
                      id="temarios-nombre-pdf"
                      value={nombreNuevo}
                      onChange={(e) => setNombreNuevo(e.target.value)}
                      className="asistencias-input"
                    />
                  </label>
                  <Boton
                    type="submit"
                    disabled={!archivoPdf || cargando}
                    cargando={cargando}
                    className="asistencias-btn-primario pulse-glow"
                    icono={<IconoLucide icon={Upload} size={14} />}
                  >
                    {cargando ? 'Procesando…' : 'Cargar PDF'}
                  </Boton>
                </div>
              </form>
              )}

              {/* Manual */}
              <form
                className="panel temarios-panel-card anim-card-hover"
                aria-label={editandoTemario ? 'Edición manual de temario' : 'Carga manual de temario'}
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  if (cargando) return;
                  void cargarManual();
                }}
              >
                <div className="asistencias-card-head">
                  <h3 className="asistencias-sub-title"><IconoLucide icon={ListTree} size={18} /> {editandoTemario ? 'Editar temario' : 'Carga manual por niveles'}</h3>
                  <p className="asistencias-sub-desc">
                    {editandoTemario ? 'Los nodos coincidentes conservan su estado y notas. No se pueden quitar nodos con avance, notas o asistencia vinculada.' : <>Escribe tu temario usando numeración estándar: <code>1 Tema principal</code>, <code>1.1 Subtema</code>, <code>1.1.1 Detalle</code>.</>}
                  </p>
                </div>

                {errorManual && <div role="alert"><p>{errorManual}</p></div>}
                <label className="asistencias-label-field temarios-input-full" htmlFor="temarios-nombre-manual">
                  <span>Nombre del temario</span>
                  <input
                    type="text"
                    id="temarios-nombre-manual"
                    value={nombreNuevo}
                    onChange={(e) => setNombreNuevo(e.target.value)}
                    className="asistencias-input"
                  />
                </label>

                <label className="asistencias-label-field temarios-input-full" htmlFor="temarios-contenido-manual">Contenido del temario</label>
                <textarea
                  id="temarios-contenido-manual"
                  aria-label="Contenido del temario"
                  aria-describedby="temarios-ayuda-contenido"
                  value={textoManual}
                  onChange={(e) => setTextoManual(e.target.value)}
                  rows={10}
                  className="asistencias-input font-code temarios-textarea"
                />
                <small id="temarios-ayuda-contenido">Escribe un tema por línea y usa numeración jerárquica, por ejemplo 1, 1.1 y 1.1.1.</small>

                {editandoTemario && (
                  <label className="asistencias-label-field temarios-input-full">
                    <span className="asistencias-field-lbl">Motivo del cambio</span>
                    <input
                      id="temarios-motivo-cambio"
                      type="text"
                      value={motivoCambio}
                      onChange={(e) => setMotivoCambio(e.target.value)}
                      maxLength={500}
                      required
                      className="asistencias-input"
                    />
                  </label>
                )}

                <Boton
                  type="submit"
                  disabled={cargando || (editandoTemario && !motivoCambio.trim())}
                  cargando={cargando}
                  className="asistencias-btn-primario temarios-btn-margin-top pulse-glow"
                  icono={<IconoLucide icon={Check} size={14} />}
                >
                  {cargando ? 'Guardando…' : editandoTemario ? 'Guardar cambios' : 'Crear temario'}
                </Boton>
              </form>
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
                  <Boton type="button" variante="secundario" onClick={prepararEdicionTemario}>
                    Editar temario
                  </Boton>
                  <Boton type="button" variante="secundario" onClick={() => void eliminarTemarioActual()} disabled={cargando}>
                    Eliminar temario
                  </Boton>
                  <span className={`temario-tree-badge ${temarioActual.porcentajeAvance === 100 ? 'temarios-progress-val-success' : 'temarios-progress-val-accent'}`}>
                    {temarioActual.porcentajeAvance}% completado
                  </span>
                </div>

                <div className="temarios-progress-track" role="progressbar" aria-label={`Avance de ${temarioActual.nombre}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, temarioActual.porcentajeAvance))}>
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
                      <IconoLucide icon={ESTADO_ICON[e]} size={15} />
                      <strong>{e === 'pendiente' ? 'Pendiente' : e === 'en_progreso' ? 'En progreso' : 'Cubierto'}</strong>
                    </span>
                  ))}
                  <span className="nota temarios-legend-hint">Activa un tema con Enter o Espacio para cambiar su estado: Pendiente → En progreso → Cubierto.</span>
                </div>
              </div>

              {errorArbol ? <div role="alert"><p>{errorArbol}</p><Boton type="button" variante="secundario" onClick={() => temarioActual && void abrirTemario(temarioActual)}>Reintentar</Boton></div> : cargando ? (
                <div className="asistencias-loading-box anim-fade-in">
                  <div className="asistencias-panel__icon-orb anim-icon-pulse" aria-hidden="true"><IconoLucide icon={LoaderCircle} size={24} /></div>
                  <p>Cargando árbol curricular…</p>
                </div>
              ) : (
                <div className="temarios-tree-stack anim-fade-in">
                  {errorNodo && <div role="alert"><p>{errorNodo}</p></div>}
                  {nodos.length === 0 ? <p>Este temario no tiene temas registrados.</p> : null}
                  {nodos.map((nodo) => (
                    <button
                      key={nodo._id}
                      type="button"
                      aria-label={`${nodo.numero} ${nodo.titulo}. Estado: ${nodo.estado === 'pendiente' ? 'Pendiente' : nodo.estado === 'en_progreso' ? 'En progreso' : 'Cubierto'}. Activar para cambiar al siguiente estado.`}
                      aria-busy={guardandoNodo === nodo._id}
                      onClick={() => { if (!guardandoNodo) void ciclarEstadoNodo(nodo); }}
                      className={`temarios-node-item anim-slide-up ${
                        nodo.estado === 'cubierto' ? 'temarios-node-cubierto' : nodo.estado === 'en_progreso' ? 'temarios-node-en-progreso' : ''
                      } temarios-node-level-${nodo.nivel}`}
                    >
                      <span className="temarios-node-icon" aria-hidden="true">
                        <IconoLucide icon={ESTADO_ICON[nodo.estado]} size={16} />
                      </span>
                      <div className={`temarios-node-title ${nodo.nivel === 1 ? 'temarios-node-nivel-1' : nodo.nivel === 2 ? 'temarios-node-nivel-2' : 'temarios-node-nivel-3'}`}>
                        <span className="font-code temarios-node-num">
                          {nodo.numero}
                        </span>
                        <span className="temarios-node-text">{nodo.titulo}</span>
                      </div>
                      <span className="temarios-node-state">{nodo.estado === 'pendiente' ? 'Pendiente' : nodo.estado === 'en_progreso' ? 'En progreso' : 'Cubierto'}</span>
                      {nodo.cubiertaEn && (
                        <span className="temarios-node-date anim-badge-in">
                          <IconoLucide icon={CalendarDays} size={14} /> {new Date(nodo.cubiertaEn).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
      </div>
      {(['lista', 'cargar', ...(temarioActual ? ['arbol'] : [])] as const)
        .filter((panelTab) => panelTab !== tab)
        .map((panelTab) => (
          <div
            key={panelTab}
            role="tabpanel"
            id={`temarios-panel-${panelTab}`}
            aria-labelledby={`temarios-tab-${panelTab}`}
            hidden
          />
        ))}
    </div>
  );
}
