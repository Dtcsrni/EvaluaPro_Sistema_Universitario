/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * App docente: panel basico para banco, examenes, entrega y calificacion.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { guardarTokenDocente, limpiarTokenDocente, obtenerTokenDocente } from '../../servicios_api/clienteApi';
import { accionToastSesionParaError, mensajeUsuarioDeErrorConSugerencia, onSesionInvalidada } from '../../servicios_api/clienteComun';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono, Spinner } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { TemaBoton } from '../../tema/TemaBoton';
import { clienteApi } from './clienteApiDocente';
import { SeccionAutenticacion } from './SeccionAutenticacion';
import { SeccionAlumnos } from './SeccionAlumnos';
import { SeccionBanco } from './SeccionBanco';
import { SeccionCuenta } from './SeccionCuenta';
import { QrAccesoMovil, SeccionEscaneo } from './SeccionEscaneo';
import { SeccionPlantillas } from './SeccionPlantillas';
import { SeccionPeriodos, SeccionPeriodosArchivados } from './SeccionPeriodos';
import { GuiaEntregaVisual } from './GuiaEntregaVisual';
import { SeccionRegistroEntrega } from './SeccionRegistroEntrega';
import { registrarAccionDocente } from './telemetriaDocente';
import type {
  Alumno,
  Docente,
  EnviarConPermiso,
  ExamenGeneradoClave,
  Periodo,
  PermisosUI,
  Plantilla,
  Pregunta,
  PreviewCalificacion,
  PreviewPlantilla,
  RegistroSincronizacion,
  RespuestaSyncPull,
  RespuestaSyncPush,
  ResultadoAnalisisOmr,
  ResultadoOmr,
  RevisionExamenOmr,
  RevisionPaginaOmr
} from './tipos';
import {
  combinarRespuestasOmrPaginas,
  construirClaveCorrectaExamen,
  consolidarResultadoOmrExamen,
  esMensajeError,
  etiquetaMateria,
  mensajeDeError,
  normalizarResultadoOmr,
  obtenerSesionDocenteId,
  obtenerVistaInicial,
} from './utilidades';


export function SeccionEntrega({
  alumnos,
  plantillas,
  periodos,
  onVincular,
  permisos,
  avisarSinPermiso,
  enviarConPermiso
}: {
  alumnos: Alumno[];
  plantillas: Plantilla[];
  periodos: Periodo[];
  onVincular: (
    folio: string,
    alumnoId: string,
    opciones?: { acordeonEntregado?: boolean; bonoAcordeon?: number }
  ) => Promise<unknown>;
  permisos: PermisosUI;
  avisarSinPermiso: (mensaje: string) => void;
  enviarConPermiso: EnviarConPermiso;
}) {
  const confirm = useConfirmDialog();
  type ExamenGeneradoEntrega = {
    _id: string;
    folio: string;
    alumnoId?: string | null;
    acordeonEntregado?: boolean;
    bonoAcordeon?: number;
    estado?: string;
    periodoId?: string;
    plantillaId?: string;
    generadoEn?: string;
    entregadoEn?: string;
  };

  const [periodoId, setPeriodoId] = useState('');
  const [filtro, setFiltro] = useState('');
  const [examenes, setExamenes] = useState<ExamenGeneradoEntrega[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [deshaciendoFolio, setDeshaciendoFolio] = useState<string | null>(null);
  const puedeGestionar = permisos.entregas.gestionar;
  const puedeLeer = permisos.examenes.leer;

  useEffect(() => {
    if (periodoId || periodos.length === 0) return;
    const primero = periodos[0]?._id ?? '';
    if (primero) setPeriodoId(primero);
  }, [periodoId, periodos]);

  const alumnosPorId = useMemo(() => {
    const mapa = new Map<string, Alumno>();
    for (const a of Array.isArray(alumnos) ? alumnos : []) {
      mapa.set(a._id, a);
    }
    return mapa;
  }, [alumnos]);

  const plantillasPorId = useMemo(() => {
    const mapa = new Map<string, Plantilla>();
    for (const plantilla of Array.isArray(plantillas) ? plantillas : []) {
      mapa.set(plantilla._id, plantilla);
    }
    return mapa;
  }, [plantillas]);

  const examenesPorFolio = useMemo(() => {
    const mapa = new Map<string, ExamenGeneradoEntrega>();
    for (const examen of Array.isArray(examenes) ? examenes : []) {
      const folio = String(examen.folio ?? '').trim().toUpperCase();
      if (folio) {
        mapa.set(folio, examen);
      }
    }
    return mapa;
  }, [examenes]);

  const formatearFechaHora = useCallback((valor?: string) => {
    const v = String(valor || '').trim();
    if (!v) return '-';
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return v;
    return d.toLocaleString();
  }, []);

  const cargarExamenes = useCallback(async () => {
    if (!periodoId) {
      setExamenes([]);
      return;
    }
    if (!puedeLeer && !puedeGestionar) {
      setExamenes([]);
      return;
    }
    try {
      setCargando(true);
      setMensaje('');
      const payload = await clienteApi.obtener<{ examenes: ExamenGeneradoEntrega[] }>(
        `/examenes/generados?periodoId=${encodeURIComponent(periodoId)}`
      );
      setExamenes(Array.isArray(payload.examenes) ? payload.examenes : []);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo cargar el listado de examenes');
      setMensaje(msg);
    } finally {
      setCargando(false);
    }
  }, [periodoId, puedeLeer, puedeGestionar]);

  useEffect(() => {
    void cargarExamenes();
  }, [cargarExamenes]);

  const vincularYRefrescar = useCallback(
    async (folio: string, alumnoId: string, opciones?: { acordeonEntregado?: boolean; bonoAcordeon?: number }) => {
      await onVincular(folio, alumnoId, opciones);
      await cargarExamenes();
    },
    [onVincular, cargarExamenes]
  );

  const deshacerEntrega = useCallback(
    async (folio: string) => {
      if (!puedeGestionar) {
        avisarSinPermiso('No tienes permiso para deshacer entregas.');
        return;
      }
      const confirmar = await confirm({
        title: 'Deshacer entrega',
        message: `El folio ${folio} se desvinculará del alumno y volverá al estado "generado".`,
        confirmLabel: 'Sí, deshacer entrega',
        tone: 'warning'
      });
      if (!confirmar) return;
      const motivo = window.prompt('Motivo para deshacer la entrega:', '');
      try {
        setDeshaciendoFolio(folio);
        const payload: Record<string, string> = { folio };
        if (motivo && motivo.trim()) payload.motivo = motivo.trim();
        await enviarConPermiso('entregas:gestionar', '/entregas/deshacer-folio', payload, 'No tienes permiso para deshacer entregas.');
        emitToast({ level: 'ok', title: 'Entrega', message: 'Entrega revertida', durationMs: 2200 });
        await cargarExamenes();
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo deshacer la entrega');
        emitToast({
          level: 'error',
          title: 'No se pudo deshacer',
          message: msg,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
      } finally {
        setDeshaciendoFolio((actual) => (actual === folio ? null : actual));
      }
    },
    [avisarSinPermiso, cargarExamenes, confirm, enviarConPermiso, puedeGestionar]
  );

  const filtroNormalizado = filtro.trim().toLowerCase();
  const examenesFiltrados = useMemo(() => {
    if (!filtroNormalizado) return examenes;
    return examenes.filter((examen) => {
      const alumno = examen.alumnoId ? alumnosPorId.get(examen.alumnoId) : null;
      const texto = [
        examen.folio,
        alumno?.matricula ?? '',
        alumno?.nombreCompleto ?? ''
      ]
        .join(' ')
        .toLowerCase();
      return texto.includes(filtroNormalizado);
    });
  }, [examenes, filtroNormalizado, alumnosPorId]);

  const entregados = useMemo(() => {
    return examenesFiltrados.filter((examen) => {
      const estado = String(examen.estado ?? '').toLowerCase();
      return estado === 'entregado' || estado === 'calificado';
    }).sort((a, b) => {
      const aTime = a.entregadoEn ? new Date(a.entregadoEn).getTime() : 0;
      const bTime = b.entregadoEn ? new Date(b.entregadoEn).getTime() : 0;
      return bTime - aTime;
    });
  }, [examenesFiltrados]);

  const pendientes = useMemo(() => {
    return examenesFiltrados.filter((examen) => {
      const estado = String(examen.estado ?? '').toLowerCase();
      return estado !== 'entregado' && estado !== 'calificado';
    });
  }, [examenesFiltrados]);

  const resumenEntrega = useMemo(() => {
    const total = examenesFiltrados.length;
    const entregadosCount = entregados.length;
    const pendientesCount = pendientes.length;
    const avance = total > 0 ? Math.round((entregadosCount / total) * 100) : 0;
    return { total, entregadosCount, pendientesCount, avance };
  }, [entregados.length, examenesFiltrados.length, pendientes.length]);

  return (
    <>
      {/* 1. Bento Hero Header */}
      <div className="banco-panel__head entrega-panel__head anim-fade-in">
        <div className="banco-panel__lead">
          <div className="banco-panel__icon-orb entrega-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <div className="banco-panel__text-block">
            <div className="banco-panel__meta-row">
              <span className="banco-status-pill entrega-status-pill">
                <span className="banco-pulse-dot" aria-hidden="true" />
                <span>Recepción y Custodia de Folios</span>
              </span>
              <span className="banco-counter-tag">{resumenEntrega.total} exámenes</span>
            </div>
            <h2 className="banco-panel__title eyebrow"><Icono nombre="recepcion" /> Entrega de examenes</h2>
            <p className="nota">Registra folios físicos recibidos y da seguimiento a la custodia antes del escaneo OMR.</p>
          </div>
        </div>

        {/* Mini-KPIs */}
        <div className="banco-header-kpis" aria-live="polite">
          <div className="banco-mini-kpi banco-mini-kpi--preguntas anim-kpi-hover" data-tooltip="Total de exámenes generados en el lote">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              </svg>
            </span>
            <span className="banco-mini-kpi__num">{resumenEntrega.total}</span>
            <span className="banco-mini-kpi__lbl">Generados</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temaactual anim-kpi-hover" data-tooltip="Exámenes con entrega física confirmada">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="20 6 9 17 4 12" /></svg></span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--emerald">{resumenEntrega.entregadosCount}</span>
            <span className="banco-mini-kpi__lbl">Entregados</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--sintema anim-kpi-hover" data-tooltip="Folios pendientes de entrega física">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
              </svg>
            </span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--amber">{resumenEntrega.pendientesCount}</span>
            <span className="banco-mini-kpi__lbl">Pendientes</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--paginas anim-kpi-hover" data-tooltip="Porcentaje de recepción completado">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /></svg></span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--cyan">{resumenEntrega.avance}%</span>
            <span className="banco-mini-kpi__lbl">Recepción</span>
          </div>
        </div>
      </div>

      {/* 2. Bento Visual Guide */}
      <GuiaEntregaVisual />

      <SeccionRegistroEntrega
        alumnos={alumnos}
        onVincular={vincularYRefrescar}
        puedeGestionar={puedeGestionar}
        avisarSinPermiso={avisarSinPermiso}
        examenesPorFolio={examenesPorFolio}
      />

      <div className="panel entregas-panel anim-fade-in">
        <div className="banco-section-title">
          <div className="banco-section-title__wrap">
            <span className="banco-section-pill">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Bitácora de Recepción</span>
            </span>
            <h3>Estado de entregas</h3>
            <p className="nota">Historial en tiempo real de exámenes impresos entregados y folios pendientes por materia.</p>
          </div>
          <div className="item-actions">
            <span className="banco-counter-tag">Total: {examenesFiltrados.length}</span>
            <span className="banco-counter-tag banco-counter-tag--emerald">Entregados: {entregados.length}</span>
            <span className="banco-counter-tag banco-counter-tag--amber">Pendientes: {pendientes.length}</span>
            <Boton type="button" variante="secundario" onClick={() => void cargarExamenes()}>
              <Icono nombre="recargar" /> Refrescar
            </Boton>
          </div>
        </div>

        <div className="entregas-filtros">
          <label className="campo">
            Materia activa
            <select value={periodoId} onChange={(event) => setPeriodoId(event.target.value)}>
              <option value="">Selecciona materia...</option>
              {periodos.map((periodo) => (
                <option key={periodo._id} value={periodo._id}>
                  {periodo.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            Buscar (folio o alumno)
            <input value={filtro} onChange={(event) => setFiltro(event.target.value)} placeholder="FOLIO-000123 o 2024-001" />
          </label>
        </div>

        {mensaje && <InlineMensaje tipo="error">{mensaje}</InlineMensaje>}
        {cargando && (
          <p className="mensaje" role="status">
            <Spinner /> Cargando entregas…
          </p>
        )}

        <div className="entregas-tables-grid">
          {/* Columna 1: Entregados */}
          <div className="item-glass entregas-subpanel entregas-subpanel--entregados">
            <div className="entregas-subpanel__head">
              <span className="chip chip-static chip--emerald">
                ✓ Entregados ({entregados.length})
              </span>
            </div>
            {entregados.length === 0 && !cargando && (
              <p className="nota">Aún no hay entregas confirmadas para esta materia.</p>
            )}
            <ul className="lista lista-items entregas-lista-scroll">
              {entregados.map((examen) => {
                const alumno = examen.alumnoId ? alumnosPorId.get(examen.alumnoId) : null;
                const alumnoTexto = alumno ? `${alumno.matricula} - ${alumno.nombreCompleto}` : 'Sin alumno';
                const plantilla = examen.plantillaId ? plantillasPorId.get(examen.plantillaId) : null;
                const parcialTexto = plantilla
                  ? (plantilla.tipo === 'parcial'
                    ? (plantilla.titulo || 'Parcial')
                    : (plantilla.titulo ? `Global: ${plantilla.titulo}` : 'Global'))
                  : '-';
                const tieneAcordeon = Boolean(examen.acordeonEntregado);
                const bonoAcordeon = Number(examen.bonoAcordeon ?? 0);
                const bloqueando = deshaciendoFolio === examen.folio;
                return (
                  <li key={examen._id}>
                    <div className="item-glass entregas-listado__item entregas-listado__item--ok anim-card-hover">
                      <div className="item-row">
                        <div>
                          <div className="item-title">Folio {examen.folio}</div>
                          <div className="item-meta">
                            <span className="chip chip-static">{alumnoTexto}</span>
                            <span>{parcialTexto}</span>
                            {tieneAcordeon && <span className="chip chip-static chip--emerald">Acordeón: +{bonoAcordeon.toFixed(2)}</span>}
                            <span>Entrega: {formatearFechaHora(examen.entregadoEn)}</span>
                          </div>
                        </div>
                        <div className="item-actions">
                          <Boton
                            type="button"
                            variante="secundario"
                            className="boton--peligro"
                            disabled={bloqueando || !puedeGestionar}
                            onClick={() => void deshacerEntrega(examen.folio)}
                          >
                            {bloqueando ? (
                              <>
                                <Spinner /> Deshaciendo…
                              </>
                            ) : (
                              'Deshacer'
                            )}
                          </Boton>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Columna 2: Pendientes */}
          <div className="item-glass entregas-subpanel entregas-subpanel--pendientes">
            <div className="entregas-subpanel__head">
              <span className="chip chip-static chip--amber">
                ⏳ Pendientes ({pendientes.length})
              </span>
            </div>
            {pendientes.length === 0 && !cargando && (
              <p className="nota">Todos los exámenes del lote han sido entregados con éxito.</p>
            )}
            <ul className="lista lista-items entregas-lista-scroll">
              {pendientes.map((examen) => {
                const alumno = examen.alumnoId ? alumnosPorId.get(examen.alumnoId) : null;
                const alumnoTexto = alumno ? `${alumno.matricula} - ${alumno.nombreCompleto}` : 'Sin alumno asignado';
                const plantilla = examen.plantillaId ? plantillasPorId.get(examen.plantillaId) : null;
                const parcialTexto = plantilla
                  ? (plantilla.tipo === 'parcial'
                    ? (plantilla.titulo || 'Parcial')
                    : (plantilla.titulo ? `Global: ${plantilla.titulo}` : 'Global'))
                  : '-';
                const tieneAcordeon = Boolean(examen.acordeonEntregado);
                const bonoAcordeon = Number(examen.bonoAcordeon ?? 0);
                return (
                  <li key={examen._id}>
                    <div className="item-glass entregas-listado__item entregas-listado__item--pending anim-card-hover">
                      <div className="item-row">
                        <div>
                          <div className="item-title">Folio {examen.folio}</div>
                          <div className="item-meta">
                            <span className="chip chip-static">{alumnoTexto}</span>
                            <span>{parcialTexto}</span>
                            {tieneAcordeon && <span className="chip chip-static">Acordeón: +{bonoAcordeon.toFixed(2)}</span>}
                            <span>Generado: {formatearFechaHora(examen.generadoEn)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
