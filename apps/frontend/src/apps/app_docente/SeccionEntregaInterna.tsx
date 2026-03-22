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
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { TemaBoton } from '../../tema/TemaBoton';
import { AyudaFormulario } from './AyudaFormulario';
import { clienteApi } from './clienteApiDocente';
import { SeccionAutenticacion } from './SeccionAutenticacion';
import { SeccionAlumnos } from './SeccionAlumnos';
import { SeccionBanco } from './SeccionBanco';
import { SeccionCuenta } from './SeccionCuenta';
import { QrAccesoMovil, SeccionEscaneo } from './SeccionEscaneo';
import { SeccionPlantillas } from './SeccionPlantillas';
import { SeccionPeriodos, SeccionPeriodosArchivados } from './SeccionPeriodos';
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
      <div className="panel entregas-panel">
        <h2>
          <Icono nombre="recepcion" /> Entrega de examenes
        </h2>
        <AyudaFormulario titulo="Resumen de entrega">
          <p>
            <b>Proposito:</b> registrar entregas y ver el estado de cada examen generado.
            Los entregados muestran fecha de entrega; los pendientes indican folios sin registro.
          </p>
          <ul className="lista">
            <li>
              <b>Entregados:</b> estado entregado o calificado.
            </li>
            <li>
              <b>Pendientes:</b> estado generado (aun sin entrega).
            </li>
          </ul>
        </AyudaFormulario>
        <div className="entregas-resumen" aria-live="polite">
          <div className="entregas-resumen__item">
            <span>Total</span>
            <b>{resumenEntrega.total}</b>
          </div>
          <div className="entregas-resumen__item">
            <span>Entregados</span>
            <b>{resumenEntrega.entregadosCount}</b>
          </div>
          <div className="entregas-resumen__item">
            <span>Pendientes</span>
            <b>{resumenEntrega.pendientesCount}</b>
          </div>
          <div className="entregas-resumen__item">
            <span>Avance</span>
            <b>{resumenEntrega.avance}%</b>
          </div>
        </div>
      </div>

      <SeccionRegistroEntrega
        alumnos={alumnos}
        onVincular={vincularYRefrescar}
        puedeGestionar={puedeGestionar}
        avisarSinPermiso={avisarSinPermiso}
        examenesPorFolio={examenesPorFolio}
      />

      <div className="panel entregas-panel">
        <div className="item-row">
          <div>
            <h3>Estado de entregas</h3>
            <div className="nota">Total: {examenesFiltrados.length} · Entregados: {entregados.length} · Pendientes: {pendientes.length}</div>
          </div>
          <div className="item-actions">
            <Boton type="button" variante="secundario" onClick={() => void cargarExamenes()}>
              Refrescar
            </Boton>
          </div>
        </div>

        <div className="entregas-filtros">
          <label className="campo">
            Materia
            <select value={periodoId} onChange={(event) => setPeriodoId(event.target.value)}>
              <option value="">Selecciona</option>
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

        <div className="resultado entregas-listado">
          <h3>Entregados</h3>
          {entregados.length === 0 && !cargando && <p className="nota">Aun no hay entregas registradas.</p>}
          <ul className="lista lista-items">
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
                  <div className="item-glass entregas-listado__item entregas-listado__item--ok">
                    <div className="item-row">
                      <div>
                        <div className="item-title">Folio {examen.folio}</div>
                        <div className="item-meta">
                          <span>Alumno: {alumnoTexto}</span>
                          <span>Parcial: {parcialTexto}</span>
                          {tieneAcordeon && <span className="chip chip-static">Acordeón: +{bonoAcordeon.toFixed(2)}</span>}
                          <span>Entrega: {formatearFechaHora(examen.entregadoEn)}</span>
                          <span>Estado: {String(examen.estado ?? 'entregado')}</span>
                        </div>
                      </div>
                      <div className="item-actions">
                        <Boton
                          type="button"
                          variante="secundario"
                          disabled={bloqueando || !puedeGestionar}
                          onClick={() => void deshacerEntrega(examen.folio)}
                        >
                          {bloqueando ? (
                            <>
                              <Spinner /> Deshaciendo…
                            </>
                          ) : (
                            'Deshacer entrega'
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

        <div className="resultado entregas-listado">
          <h3>Pendientes</h3>
          {pendientes.length === 0 && !cargando && <p className="nota">No hay pendientes.</p>}
          <ul className="lista lista-items">
            {pendientes.map((examen) => {
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
              return (
                <li key={examen._id}>
                  <div className="item-glass entregas-listado__item entregas-listado__item--pending">
                    <div className="item-row">
                      <div>
                        <div className="item-title">Folio {examen.folio}</div>
                        <div className="item-meta">
                          <span>Alumno: {alumnoTexto}</span>
                          <span>Parcial: {parcialTexto}</span>
                          {tieneAcordeon && <span className="chip chip-static">Acordeón: +{bonoAcordeon.toFixed(2)}</span>}
                          <span>Generado: {formatearFechaHora(examen.generadoEn)}</span>
                          <span>Estado: {String(examen.estado ?? 'generado')}</span>
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
    </>
  );
}
