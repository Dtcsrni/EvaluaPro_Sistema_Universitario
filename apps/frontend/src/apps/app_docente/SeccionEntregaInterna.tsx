/**
 * SeccionEntregaInterna
 *
 * Responsabilidad: Seccion funcional del shell docente.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
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
import { Check, Clock3, FileText, PackageCheck, CircleCheck, IconoLucide } from '../../ui/iconosCatalogo';
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
  const [siguienteCursorExamenes, setSiguienteCursorExamenes] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const versionConsultaExamenesRef = useRef(0);
  const cargandoPaginaSiguienteRef = useRef(false);
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

  const textoAlumnoEntrega = (alumnoId?: string | null) => {
    const id = String(alumnoId ?? '').trim();
    if (!id) return 'Sin alumno asignado';
    const alumno = alumnosPorId.get(id);
    return alumno ? `${alumno.matricula} - ${alumno.nombreCompleto}` : 'Alumno no disponible';
  };

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

  const cambiarPeriodo = (nuevoPeriodoId: string) => {
    versionConsultaExamenesRef.current += 1;
    cargandoPaginaSiguienteRef.current = false;
    setPeriodoId(nuevoPeriodoId);
    setFiltro('');
    setExamenes([]);
    setSiguienteCursorExamenes(null);
    setMensaje('');
    setCargando(Boolean(nuevoPeriodoId));
  };

  const cargarExamenes = useCallback(async () => {
    const versionConsulta = ++versionConsultaExamenesRef.current;
    if (!periodoId) {
      setExamenes([]);
      setSiguienteCursorExamenes(null);
      setCargando(false);
      return;
    }
    if (!puedeLeer && !puedeGestionar) {
      setExamenes([]);
      setSiguienteCursorExamenes(null);
      setCargando(false);
      return;
    }
    try {
      setCargando(true);
      setMensaje('');
      const query = new URLSearchParams({ periodoId, limite: '100' });
      const payload = await clienteApi.obtener<{ examenes: ExamenGeneradoEntrega[]; nextCursor?: string | null }>(
        `/examenes/generados?${query}`
      );
      if (versionConsulta !== versionConsultaExamenesRef.current) return;
      setExamenes(Array.isArray(payload.examenes) ? payload.examenes : []);
      setSiguienteCursorExamenes(payload.nextCursor || null);
    } catch (error) {
      if (versionConsulta !== versionConsultaExamenesRef.current) return;
      const msg = mensajeDeError(error, 'No se pudo cargar el listado de examenes');
      setMensaje(msg);
    } finally {
      if (versionConsulta === versionConsultaExamenesRef.current) setCargando(false);
    }
  }, [periodoId, puedeLeer, puedeGestionar]);

  const cargarMasExamenes = useCallback(async () => {
    if (!periodoId || !siguienteCursorExamenes || cargandoPaginaSiguienteRef.current || cargando) return;
    cargandoPaginaSiguienteRef.current = true;
    const versionConsulta = versionConsultaExamenesRef.current;
    try {
      setCargando(true);
      setMensaje('');
      const query = new URLSearchParams({ periodoId, limite: '100', cursor: siguienteCursorExamenes });
      const payload = await clienteApi.obtener<{ examenes: ExamenGeneradoEntrega[]; nextCursor?: string | null }>(
        `/examenes/generados?${query}`
      );
      if (versionConsulta !== versionConsultaExamenesRef.current) return;
      setExamenes((actuales) => {
        const porId = new Map(actuales.map((examen) => [examen._id, examen]));
        for (const examen of Array.isArray(payload.examenes) ? payload.examenes : []) porId.set(examen._id, examen);
        return Array.from(porId.values());
      });
      setSiguienteCursorExamenes(payload.nextCursor || null);
    } catch (error) {
      if (versionConsulta === versionConsultaExamenesRef.current) {
        setMensaje(mensajeDeError(error, 'No se pudieron cargar más exámenes'));
      }
    } finally {
      cargandoPaginaSiguienteRef.current = false;
      if (versionConsulta === versionConsultaExamenesRef.current) setCargando(false);
    }
  }, [periodoId, siguienteCursorExamenes, cargando]);

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
          <div className="icono-seccion-orb banco-panel__icon-orb entrega-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <IconoLucide icon={PackageCheck} size={24} />
          </div>
          <div className="banco-panel__text-block">
            <div className="banco-panel__meta-row">
              <span className="banco-status-pill entrega-status-pill">
                <span className="banco-pulse-dot" aria-hidden="true" />
                <span>Recepción y Custodia de Folios</span>
              </span>
            </div>
            <h2 className="banco-panel__title eyebrow">Entrega de exámenes</h2>
            <p className="nota">Registra folios físicos recibidos y da seguimiento a la custodia antes del escaneo OMR.</p>
          </div>
        </div>

        {/* Mini-KPIs */}
        <div className="banco-header-kpis entrega-header-kpis" role="group" aria-label="Resumen de entregas">
          <div className="banco-mini-kpi banco-mini-kpi--preguntas anim-kpi-hover" data-tooltip="Exámenes cargados que coinciden con la búsqueda; puede haber más registros en esta materia. Usa Cargar más exámenes para consultarlos.">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={FileText} size={16} />
            </span>
            <span className="banco-mini-kpi__num">{resumenEntrega.total}</span>
            <span className="banco-mini-kpi__lbl">En lista</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temaactual anim-kpi-hover" data-tooltip="Exámenes con entrega física confirmada">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><IconoLucide icon={Check} size={16} /></span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--emerald">{resumenEntrega.entregadosCount}</span>
            <span className="banco-mini-kpi__lbl">Entregados</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--sintema anim-kpi-hover" data-tooltip="Folios pendientes de entrega física">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={Clock3} size={16} />
            </span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--amber">{resumenEntrega.pendientesCount}</span>
            <span className="banco-mini-kpi__lbl">Pendientes</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--paginas anim-kpi-hover" data-tooltip="Porcentaje de recepción completado">
            <span className="banco-mini-kpi__icon" aria-hidden="true"><IconoLucide icon={CircleCheck} size={16} /></span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--cyan">
              {resumenEntrega.total > 0 ? `${resumenEntrega.avance}%` : '—'}
            </span>
            <span className="banco-mini-kpi__lbl">Recepción</span>
          </div>
        </div>
      </div>

      <div className="entregas-contexto-periodo">
        <div className="campo">
          <label htmlFor="entregas-materia-activa">Materia activa</label>
          <select
            id="entregas-materia-activa"
            value={periodoId}
            onChange={(event) => cambiarPeriodo(event.target.value)}
            aria-describedby="entregas-materia-ayuda"
          >
            <option value="">Selecciona materia...</option>
            {periodos.map((periodo) => (
              <option key={periodo._id} value={periodo._id}>
                {periodo.nombre}
              </option>
            ))}
          </select>
          <span id="entregas-materia-ayuda" className="nota">
            Define los folios y alumnos que se consultan y vinculan en esta vista.
          </span>
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
            <p className="nota">Consulta los exámenes cargados de la materia y actualiza el estado con «Refrescar».</p>
          </div>
          <div className="item-actions">
            <Boton
              type="button"
              variante="secundario"
              cargando={cargando}
              icono={cargando ? undefined : <Icono nombre="recargar" />}
              onClick={() => void cargarExamenes()}
            >
              {cargando ? 'Consultando…' : 'Refrescar'}
            </Boton>
          </div>
        </div>

        <div className="entregas-filtros">
          <label className="campo">
            Buscar folio, matrícula o alumno
            <input type="search" value={filtro} onChange={(event) => setFiltro(event.target.value)} placeholder="Folio, matrícula o nombre" />
          </label>
        </div>

        {mensaje && (
          <InlineMensaje tipo="error">
            {mensaje}
            {examenes.length > 0 && (
              <span> Los datos visibles corresponden a la última consulta exitosa; vuelve a consultar antes de tomar decisiones sobre su estado actual.</span>
            )}
          </InlineMensaje>
        )}
        {cargando && (
          <p className="mensaje" role="status">
            <Spinner /> {examenes.length > 0 ? 'Actualizando la lista; los resultados cargados siguen visibles.' : 'Cargando entregas…'}
          </p>
        )}

        {periodoId && !puedeLeer && !puedeGestionar && !mensaje && (
          <p className="nota" role="status">No tienes permiso para consultar las entregas de esta materia.</p>
        )}
        {!periodoId && <p className="nota" role="status">Selecciona una materia para consultar sus entregas.</p>}
        {periodoId && (puedeLeer || puedeGestionar) && !cargando && !mensaje && examenesFiltrados.length === 0 && (
          filtroNormalizado ? (
            <p className="nota" role="status">
              No se encontraron exámenes para «{filtro.trim()}».{' '}
              <Boton type="button" variante="secundario" onClick={() => setFiltro('')}>Limpiar búsqueda</Boton>
            </p>
          ) : (
            <p className="nota" role="status">No hay exámenes generados para esta materia.</p>
          )
        )}
        {periodoId && (puedeLeer || puedeGestionar) && !cargando && !mensaje && examenes.length > 0 && (
          <p className="nota" role="status">
            Conteos calculados sobre {examenesFiltrados.length} {examenesFiltrados.length === 1 ? 'resultado visible' : 'resultados visibles'},
            {' '}de {examenes.length} {examenes.length === 1 ? 'examen cargado' : 'exámenes cargados'}
            {siguienteCursorExamenes ? '; la materia puede tener más registros.' : '.'}
          </p>
        )}

        {examenesFiltrados.length > 0 && <div className="entregas-tables-grid">
          {/* Columna 1: Entregados */}
          <div className="item-glass entregas-subpanel entregas-subpanel--entregados">
            <div className="entregas-subpanel__head">
              <span className="chip chip-static chip--emerald">
                Entregados ({entregados.length})
              </span>
            </div>
            {entregados.length === 0 && (
              <p className="nota">No hay entregas confirmadas entre los resultados actuales.</p>
            )}
            <ul className="lista lista-items entregas-lista-scroll">
              {entregados.map((examen) => {
                const alumnoTexto = textoAlumnoEntrega(examen.alumnoId);
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
                Pendientes ({pendientes.length})
              </span>
            </div>
            {pendientes.length === 0 && (
              <p className="nota">No hay folios pendientes entre los resultados actuales.</p>
            )}
            <ul className="lista lista-items entregas-lista-scroll">
              {pendientes.map((examen) => {
                const alumnoTexto = textoAlumnoEntrega(examen.alumnoId);
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
        </div>}
        {siguienteCursorExamenes && (
          <div className="entregas-listado__paginacion">
            <Boton type="button" variante="secundario" disabled={cargando} onClick={() => void cargarMasExamenes()}>
              {cargando ? <><Spinner /> Cargando…</> : 'Cargar más exámenes'}
            </Boton>
          </div>
        )}
      </div>
    </>
  );
}
