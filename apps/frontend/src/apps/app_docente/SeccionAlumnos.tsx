/**
 * SeccionAlumnos
 *
 * Responsabilidad: Seccion funcional del shell docente con diseno Bento Glassmorphic, iconografia rica y animaciones fluidas.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { GuiaAlumnosVisual } from './GuiaAlumnosVisual';
import { registrarAccionDocente } from './telemetriaDocente';
import type { Alumno, EnviarConPermiso, Periodo, PermisosUI } from './tipos';
import { clienteApi } from './clienteApiDocente';
import {
  esCorreoDeDominioPermitidoFrontend,
  esMensajeError,
  etiquetaMateria,
  mensajeDeError,
  obtenerDominiosCorreoPermitidosFrontend,
  textoDominiosPermitidos
} from './utilidades';

export function SeccionAlumnos({
  alumnos,
  periodosActivos,
  periodosTodos,
  onRefrescar,
  permisos,
  puedeEliminarAlumnoDev,
  enviarConPermiso,
  avisarSinPermiso
}: {
  alumnos: Alumno[];
  periodosActivos: Periodo[];
  periodosTodos: Periodo[];
  onRefrescar: () => void;
  permisos: PermisosUI;
  puedeEliminarAlumnoDev: boolean;
  enviarConPermiso: EnviarConPermiso;
  avisarSinPermiso: (mensaje: string) => void;
}) {
  const [matricula, setMatricula] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [correo, setCorreo] = useState('');
  const [correoAuto, setCorreoAuto] = useState(true);
  const [grupo, setGrupo] = useState('');
  const [periodoIdNuevo, setPeriodoIdNuevo] = useState('');
  const [periodoIdLista, setPeriodoIdLista] = useState('');
  const [ultimoGrupoUsado, setUltimoGrupoUsado] = useState('');
  const [ultimoPeriodoIdUsado, setUltimoPeriodoIdUsado] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [eliminandoAlumnoId, setEliminandoAlumnoId] = useState<string | null>(null);
  const [filtroAlumno, setFiltroAlumno] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [resumenAsistencias, setResumenAsistencias] = useState<any[]>([]);

  const formularioRef = useRef<HTMLElement>(null);
  const matriculaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!periodoIdLista) {
      setResumenAsistencias([]);
      return;
    }
    clienteApi.obtener<{ resumen: any[] }>(`/asistencias/resumen?periodoId=${periodoIdLista}`)
      .then((res: any) => {
        setResumenAsistencias(res?.resumen || []);
      })
      .catch(() => {
        setResumenAsistencias([]);
      });
  }, [periodoIdLista]);

  const confirm = useConfirmDialog();
  const puedeGestionar = permisos.alumnos.gestionar;
  const bloqueoEdicion = !puedeGestionar;

  function normalizarMatricula(valor: string): string {
    return String(valor || '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  const matriculaNormalizada = useMemo(() => normalizarMatricula(matricula), [matricula]);
  const matriculaValida = useMemo(() => {
    if (!matricula.trim()) return true;
    return /^CUH\d+$/i.test(matriculaNormalizada) || /^[\w\-.]{3,30}$/.test(matriculaNormalizada);
  }, [matricula, matriculaNormalizada]);

  const dominiosPermitidos = obtenerDominiosCorreoPermitidosFrontend();
  const politicaDominiosTexto = dominiosPermitidos.length > 0 ? textoDominiosPermitidos(dominiosPermitidos) : '';
  const correoValido = !correo.trim() || esCorreoDeDominioPermitidoFrontend(correo, dominiosPermitidos);

  function claseBadgeGrupo(grupoAlumno: string): string {
    const clave = String(grupoAlumno || '').trim().toUpperCase();
    if (!clave) return 'badge-grupo--none';
    let hash = 0;
    for (let i = 0; i < clave.length; i += 1) {
      hash = (hash * 31 + clave.charCodeAt(i)) >>> 0;
    }
    return `badge-grupo--${hash % 8}`;
  }

  function obtenerIniciales(nombre?: string, apellido?: string): string {
    const n = String(nombre || '').trim().charAt(0);
    const a = String(apellido || '').trim().charAt(0);
    return (n + a).toUpperCase() || 'AL';
  }

  useEffect(() => {
    if (!Array.isArray(periodosActivos) || periodosActivos.length === 0) return;
    if (!periodoIdLista) setPeriodoIdLista(periodosActivos[0]._id);
  }, [periodosActivos, periodoIdLista]);

  useEffect(() => {
    const lista = Array.isArray(alumnos) ? alumnos : [];
    if (lista.length === 0) {
      if (!periodoIdNuevo && Array.isArray(periodosActivos) && periodosActivos.length > 0) {
        setPeriodoIdNuevo(periodosActivos[0]._id);
      }
      return;
    }
    const ultimo = [...lista].sort((a, b) => {
      const porFecha = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      if (porFecha !== 0) return porFecha;
      return String(b._id).localeCompare(String(a._id));
    })[0];
    const periodoIdReciente = String(ultimo?.periodoId || '').trim();
    const grupoReciente = String(ultimo?.grupo || '').trim();
    if (!ultimoPeriodoIdUsado && periodoIdReciente) {
      setUltimoPeriodoIdUsado(periodoIdReciente);
      if (!periodoIdNuevo) setPeriodoIdNuevo(periodoIdReciente);
    }
    if (!ultimoGrupoUsado && grupoReciente) {
      setUltimoGrupoUsado(grupoReciente);
      if (!grupo) setGrupo(grupoReciente);
    }
  }, [alumnos, grupo, ultimoGrupoUsado, ultimoPeriodoIdUsado, periodoIdNuevo, periodosActivos]);

  const puedeCrear = Boolean(
    matricula.trim() &&
      matriculaValida &&
      nombres.trim() &&
      apellidos.trim() &&
      periodoIdNuevo &&
      correoValido &&
      !editandoId
  );

  const puedeGuardarEdicion = Boolean(
    editandoId && matricula.trim() && matriculaValida && nombres.trim() && apellidos.trim() && periodoIdNuevo && correoValido
  );

  const alumnosDeMateria = useMemo(() => {
    const lista = Array.isArray(alumnos) ? alumnos : [];
    if (!periodoIdLista) return [];
    return lista
      .filter((a) => a.periodoId === periodoIdLista)
      .sort((a, b) => {
        const porFecha = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        if (porFecha !== 0) return porFecha;
        return String(b._id).localeCompare(String(a._id));
      });
  }, [alumnos, periodoIdLista]);

  const gruposDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const a of alumnosDeMateria) {
      const g = String(a.grupo || '').trim();
      if (g) set.add(g);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [alumnosDeMateria]);

  const alumnosFiltrados = useMemo(() => {
    const txt = filtroAlumno.trim().toLowerCase();
    const grp = filtroGrupo.trim().toLowerCase();
    return alumnosDeMateria.filter((alumno) => {
      const nombre = String(alumno.nombreCompleto || '').toLowerCase();
      const matriculaAlumno = String(alumno.matricula || '').toLowerCase();
      const correoAlumno = String(alumno.correo || '').toLowerCase();
      const grupoAlumno = String(alumno.grupo || '').trim().toLowerCase();
      const byText = !txt || nombre.includes(txt) || matriculaAlumno.includes(txt) || correoAlumno.includes(txt);
      const byGroup = !grp || grupoAlumno === grp;
      return byText && byGroup;
    });
  }, [alumnosDeMateria, filtroAlumno, filtroGrupo]);

  const totalSinDerecho = useMemo(() => {
    return alumnosDeMateria.filter((alumno) => {
      const faltas = resumenAsistencias.find((r) => r.alumnoId === alumno._id)?.faltas ?? 0;
      return faltas >= 4;
    }).length;
  }, [alumnosDeMateria, resumenAsistencias]);

  const resumenAlumnos = useMemo(() => {
    const total = alumnosDeMateria.length;
    const grupos = gruposDisponibles.length;
    return {
      total,
      grupos,
      sinDerecho: totalSinDerecho,
      totalGeneral: (Array.isArray(alumnos) ? alumnos : []).length
    };
  }, [alumnosDeMateria, gruposDisponibles.length, totalSinDerecho, alumnos]);

  const nombreMateriaSeleccionada = useMemo(() => {
    const p = (periodosTodos || []).find((item) => item._id === periodoIdLista);
    return p ? etiquetaMateria(p) : '';
  }, [periodosTodos, periodoIdLista]);

  async function crearAlumno() {
    try {
      const inicio = Date.now();
      if (!puedeGestionar) {
        avisarSinPermiso('No tienes permiso para registrar alumnos.');
        return;
      }
      if (!puedeCrear) return;
      setCreando(true);
      setMensaje('');
      await enviarConPermiso(
        'alumnos:gestionar',
        '/alumnos',
        {
          periodoId: periodoIdNuevo,
          matricula: matriculaNormalizada,
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          correo: correo.trim() || undefined,
          grupo: grupo.trim() || undefined
        },
        'No tienes permiso para registrar alumnos.'
      );
      setMensaje('Alumno registrado');
      emitToast({ level: 'ok', title: 'Alumnos', message: 'Alumno registrado correctamente', durationMs: 2200 });
      registrarAccionDocente('crear_alumno', true, Date.now() - inicio);
      setMatricula('');
      setNombres('');
      setApellidos('');
      setCorreo('');
      setCorreoAuto(true);
      setPeriodoIdLista(periodoIdNuevo);
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo registrar el alumno');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo registrar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('crear_alumno', false);
    } finally {
      setCreando(false);
    }
  }

  function iniciarEdicion(alumno: Alumno) {
    setEditandoId(alumno._id);
    setMatricula(alumno.matricula || '');
    setNombres(alumno.nombres || '');
    setApellidos(alumno.apellidos || '');
    setCorreo(alumno.correo || '');
    setCorreoAuto(false);
    setGrupo(alumno.grupo || '');
    setPeriodoIdNuevo(alumno.periodoId || '');
    setMensaje('');
    emitToast({
      level: 'info',
      title: 'Modificando Alumno',
      message: `Editando datos de ${alumno.nombreCompleto || 'alumno'}. Modifica los campos en el formulario.`,
      durationMs: 3000
    });
    registrarAccionDocente('iniciar_edicion_alumno', true);
    setTimeout(() => {
      formularioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      matriculaInputRef.current?.focus();
    }, 60);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setMatricula('');
    setNombres('');
    setApellidos('');
    setCorreo('');
    setCorreoAuto(true);
    setMensaje('');
  }

  async function guardarEdicion() {
    if (!editandoId) return;
    try {
      const inicio = Date.now();
      if (!puedeGestionar) {
        avisarSinPermiso('No tienes permiso para editar alumnos.');
        return;
      }
      if (!puedeGuardarEdicion) return;
      setGuardandoEdicion(true);
      setMensaje('');
      await enviarConPermiso(
        'alumnos:gestionar',
        `/alumnos/${editandoId}`,
        {
          periodoId: periodoIdNuevo,
          matricula: matriculaNormalizada,
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          correo: correo.trim() || undefined,
          grupo: grupo.trim() || undefined
        },
        'No tienes permiso para editar alumnos.'
      );
      setMensaje('Alumno actualizado');
      emitToast({ level: 'ok', title: 'Alumnos', message: 'Alumno actualizado correctamente', durationMs: 2200 });
      registrarAccionDocente('actualizar_alumno', true, Date.now() - inicio);
      cancelarEdicion();
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo actualizar el alumno');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo actualizar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('actualizar_alumno', false);
    } finally {
      setGuardandoEdicion(false);
    }
  }

  async function eliminarAlumnoDev(alumno: Alumno) {
    if (!puedeEliminarAlumnoDev) {
      avisarSinPermiso('No tienes permiso para eliminar alumnos en desarrollo.');
      return;
    }
    const confirmado = await confirm({
      title: 'Eliminar alumno en desarrollo',
      message: `Se eliminará a "${alumno.nombreCompleto}" (${alumno.matricula}).`,
      details: ['Esta acción es exclusiva para pruebas locales.', 'Se desvincularán sus asistencias y calificaciones.'],
      confirmLabel: 'Sí, eliminar alumno',
      tone: 'danger'
    });
    if (!confirmado) return;

    try {
      const inicio = Date.now();
      setEliminandoAlumnoId(alumno._id);
      setMensaje('');
      await enviarConPermiso(
        'alumnos:eliminar_dev',
        `/alumnos/${alumno._id}/eliminar`,
        {},
        'No tienes permiso para eliminar alumnos en desarrollo.'
      );
      setMensaje('Alumno eliminado');
      emitToast({ level: 'ok', title: 'Alumnos', message: 'Alumno eliminado', durationMs: 2200 });
      registrarAccionDocente('eliminar_alumno', true, Date.now() - inicio);
      if (editandoId === alumno._id) cancelarEdicion();
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo eliminar el alumno');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo eliminar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('eliminar_alumno', false);
    } finally {
      setEliminandoAlumnoId(null);
    }
  }

  return (
    <div className="panel alumnos-panel anim-fade-in">
      {/* Cabecera Ejecutiva Principal con Mini-KPIs animados */}
      <div className="alumnos-panel__head">
        <div className="alumnos-panel__lead">
          <div className="alumnos-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="alumnos-panel__text-block">
            <div className="alumnos-panel__meta-row">
              <span className="alumnos-status-pill">
                <span className="alumnos-pulse-dot" aria-hidden="true" />
                <span>Control Escolar y Matrículas</span>
              </span>
              <span className="alumnos-counter-tag">
                {resumenAlumnos.totalGeneral} {resumenAlumnos.totalGeneral === 1 ? 'alumno registrado' : 'alumnos registrados'}
              </span>
            </div>
            <h2 className="alumnos-panel__title">
              <Icono nombre="alumnos" /> Alumnos
            </h2>
            <p className="nota">Administra expedientes de estudiantes, matrículas institucionales CUH y asignación por grupos.</p>
          </div>
        </div>

        <div className="alumnos-header-kpis" aria-live="polite">
          <div className="materia-mini-kpi materia-mini-kpi--active anim-kpi-hover" data-tooltip="Total de alumnos matriculados en la materia seleccionada">
            <span className="materia-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              </svg>
            </span>
            <span className="materia-mini-kpi__num">{resumenAlumnos.total}</span>
            <span className="materia-mini-kpi__lbl">En Materia</span>
          </div>

          <div className="materia-mini-kpi materia-mini-kpi--groups anim-kpi-hover" data-tooltip="Grupos académicos detectados en la materia seleccionada">
            <span className="materia-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="3" />
              </svg>
            </span>
            <span className="materia-mini-kpi__num">{resumenAlumnos.grupos}</span>
            <span className="materia-mini-kpi__lbl">Grupos</span>
          </div>

          {resumenAlumnos.sinDerecho > 0 && (
            <div className="materia-mini-kpi materia-mini-kpi--closing anim-kpi-hover" data-tooltip="Alumnos con 4 o más inasistencias en el periodo">
              <span className="materia-mini-kpi__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </span>
              <span className="materia-mini-kpi__num">{resumenAlumnos.sinDerecho}</span>
              <span className="materia-mini-kpi__lbl">Sin Derecho</span>
            </div>
          )}
        </div>
      </div>

      {/* Guía Rápida Bento Interactiva */}
      <GuiaAlumnosVisual />

      {editandoId && (
        <InlineMensaje tipo="info">
          ✏️ Editando alumno. Modifica los campos y pulsa &quot;Guardar cambios&quot;.
        </InlineMensaje>
      )}

      {/* Formulario Estructurado Panoramico de 2 Filas Claras */}
      <section ref={formularioRef} className="alumnos-form alumnos-form--glass alumnos-form--panoramico anim-form-card">
        <div className="alumnos-form__header">
          <h3 className="alumnos-form__title">
            {editandoId ? '✏️ Modificar Alumno Seleccionado' : '✨ Registrar Nuevo Alumno'}
          </h3>
          <p className="alumnos-form__subtitle">
            Captura la matrícula oficial CUH, nombres, grupo y materia correspondiente.
          </p>
        </div>

        <div className="alumnos-form__fields">
          {/* Fila 1: Identidad del Alumno */}
          <div className="alumnos-form__row alumnos-form__row--top">
            <label className="campo campo--matricula">
              <span className="campo__label-row">
                <span>Matricula</span>
                {matricula.trim() && (
                  <span className={`badge-matricula-live anim-badge-in ${matriculaValida ? 'badge-matricula-live--ok' : 'badge-matricula-live--err'}`}>
                    {matriculaValida ? '✓ Válida' : 'Formato CUH#########'}
                  </span>
                )}
              </span>
              <div className="auth-input-box auth-input-box--id auth-input-box--animated">
                <input
                  ref={matriculaInputRef}
                  value={matricula}
                  onChange={(event) => {
                    const valor = event.target.value;
                    setMatricula(valor);
                    if (correoAuto) {
                      const m = normalizarMatricula(valor);
                      setCorreo(m ? `${m}@cuh.mx` : '');
                    }
                  }}
                  disabled={bloqueoEdicion}
                  placeholder="Ej. CUH512410168"
                  data-tooltip="Formato oficial: CUH seguido de 9 dígitos"
                />
              </div>
              <span className="ayuda">Formato oficial: CUH######### (ej. CUH512410168).</span>
            </label>

            <label className="campo campo--nombres">
              <span>Nombres</span>
              <div className="auth-input-box auth-input-box--user auth-input-box--animated">
                <input
                  value={nombres}
                  onChange={(event) => setNombres(event.target.value)}
                  disabled={bloqueoEdicion}
                  placeholder="Ej. Ana María, Carlos Roberto…"
                />
              </div>
            </label>

            <label className="campo campo--apellidos">
              <span>Apellidos</span>
              <div className="auth-input-box auth-input-box--user auth-input-box--animated">
                <input
                  value={apellidos}
                  onChange={(event) => setApellidos(event.target.value)}
                  disabled={bloqueoEdicion}
                  placeholder="Ej. Gómez Ruiz, López Hernández…"
                />
              </div>
            </label>
          </div>

          {/* Fila 2: Contacto y Asignación Académica */}
          <div className="alumnos-form__row alumnos-form__row--bottom">
            <label className="campo campo--correo">
              <span>Correo institucional</span>
              <div className="auth-input-box auth-input-box--mail auth-input-box--animated">
                <input
                  value={correo}
                  onChange={(event) => {
                    setCorreoAuto(false);
                    setCorreo(event.target.value);
                  }}
                  disabled={bloqueoEdicion}
                  placeholder="alumno@cuh.mx"
                />
              </div>
              {correoAuto && matriculaNormalizada && (
                <span className="ayuda">Sugerido automáticamente: {matriculaNormalizada}@cuh.mx</span>
              )}
              {dominiosPermitidos.length > 0 && !correoAuto && (
                <span className="ayuda">Opcional. Dominio permitido: {politicaDominiosTexto}</span>
              )}
            </label>

            <label className="campo campo--grupo">
              <span>Grupo</span>
              <div className="auth-input-box auth-input-box--group auth-input-box--animated">
                <input
                  value={grupo}
                  onChange={(event) => {
                    const nuevoGrupo = event.target.value;
                    setGrupo(nuevoGrupo);
                    setUltimoGrupoUsado(String(nuevoGrupo || '').trim());
                  }}
                  disabled={bloqueoEdicion}
                  placeholder="Ej. 3A, 101, B…"
                />
              </div>
            </label>

            <label className="campo campo--materia">
              <span>Materia</span>
              <div className="auth-input-box auth-input-box--select auth-input-box--animated">
                <select
                  value={periodoIdNuevo}
                  onChange={(event) => {
                    const nuevoPeriodoId = event.target.value;
                    setPeriodoIdNuevo(nuevoPeriodoId);
                    setUltimoPeriodoIdUsado(String(nuevoPeriodoId || '').trim());
                  }}
                  disabled={bloqueoEdicion}
                >
                  <option value="">Selecciona</option>
                  {periodosActivos.map((periodo) => (
                    <option key={periodo._id} value={periodo._id} title={periodo._id}>
                      {etiquetaMateria(periodo)}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>
        </div>

        {matricula.trim() && !matriculaValida && (
          <InlineMensaje tipo="error">Matricula invalida. Usa el formato CUH#########.</InlineMensaje>
        )}
        {dominiosPermitidos.length > 0 && correo.trim() && !correoValido && (
          <InlineMensaje tipo="error">Correo no permitido por politicas. Usa un correo institucional.</InlineMensaje>
        )}

        <div className="alumnos-form__footer">
          <div className="acciones alumnos-form__actions">
            {!editandoId ? (
              <Boton
                type="button"
                variante="primario"
                icono={<Icono nombre="nuevo" />}
                cargando={creando}
                disabled={!puedeCrear || bloqueoEdicion}
                onClick={crearAlumno}
              >
                {creando ? 'Creando alumno…' : '✨ Crear Alumno'}
              </Boton>
          ) : (
            <>
              <Boton
                type="button"
                icono={<Icono nombre="ok" />}
                cargando={guardandoEdicion}
                disabled={!puedeGuardarEdicion || bloqueoEdicion}
                onClick={guardarEdicion}
              >
                {guardandoEdicion ? 'Guardando…' : 'Guardar cambios'}
              </Boton>
              <Boton variante="secundario" type="button" onClick={cancelarEdicion}>
                Cancelar
              </Boton>
            </>
          )}
          </div>
          <div className="alumnos-form__hint">
            <span>💡 Los alumnos registrados estarán disponibles de inmediato para el pase de lista y evaluación OMR.</span>
          </div>
        </div>
      </section>

      {mensaje && (
        <p className={esMensajeError(mensaje) ? 'mensaje error anim-fade-in' : 'mensaje ok anim-fade-in'} role="status">
          {mensaje}
        </p>
      )}

      {/* Explorador de Alumnos por Materia */}
      <section className="alumnos-explorador anim-fade-in" aria-label="Explorador de Alumnos">
        <div className="alumnos-explorador__header">
          <div className="alumnos-explorador__title-box">
            <h3>Alumnos de la materia</h3>
            {Boolean(nombreMateriaSeleccionada) && (
              <span className="alumnos-materia-badge anim-badge-in">
                <span className="alumnos-pulse-dot" aria-hidden="true" />
                {nombreMateriaSeleccionada}
              </span>
            )}
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda Glass con Chips Rápidos */}
        <div className="alumnos-filtros alumnos-filtros--glass">
          <label className="campo campo--materia-select">
            <span>Materia seleccionada</span>
            <div className="auth-input-box auth-input-box--select auth-input-box--animated">
              <select value={periodoIdLista} onChange={(event) => setPeriodoIdLista(event.target.value)}>
                <option value="">Selecciona</option>
                {periodosTodos
                  .filter((p) => p.activo !== false)
                  .map((periodo) => (
                    <option key={periodo._id} value={periodo._id} title={periodo._id}>
                      {etiquetaMateria(periodo)}
                    </option>
                  ))}
              </select>
            </div>
            {Boolean(nombreMateriaSeleccionada) && (
              <span className="ayuda">Mostrando alumnos de: {nombreMateriaSeleccionada}</span>
            )}
          </label>

          <label className="campo campo--search">
            <span>Buscar alumno</span>
            <div className="auth-input-box auth-input-box--search auth-input-box--animated">
              <input
                type="search"
                value={filtroAlumno}
                onChange={(event) => setFiltroAlumno(event.target.value)}
                placeholder="Nombre, matrícula o correo"
              />
            </div>
          </label>

          <label className="campo campo--grupo-select">
            <span>Grupo</span>
            <div className="auth-input-box auth-input-box--group auth-input-box--animated">
              <select value={filtroGrupo} onChange={(event) => setFiltroGrupo(event.target.value)}>
                <option value="">Todos</option>
                {gruposDisponibles.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>

        {/* Quick Group Filter Chips */}
        {gruposDisponibles.length > 0 && (
          <div className="alumnos-group-chips-bar" aria-label="Filtro rápido por grupo">
            <span className="alumnos-group-chips-label">Filtrar por grupo:</span>
            <button
              type="button"
              className={`alumnos-group-chip ${!filtroGrupo ? 'alumnos-group-chip--active' : ''}`}
              onClick={() => setFiltroGrupo('')}
            >
              Todos ({alumnosDeMateria.length})
            </button>
            {gruposDisponibles.map((grp) => {
              const conteo = alumnosDeMateria.filter((a) => String(a.grupo || '').trim() === grp).length;
              const activo = filtroGrupo.toLowerCase() === grp.toLowerCase();
              return (
                <button
                  key={grp}
                  type="button"
                  className={`alumnos-group-chip ${activo ? 'alumnos-group-chip--active' : ''}`}
                  onClick={() => setFiltroGrupo(activo ? '' : grp)}
                >
                  <span className={`badge badge-grupo ${claseBadgeGrupo(grp)}`}>{grp}</span>
                  <span className="alumnos-group-chip-count">({conteo})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Lista / Grid de Alumnos */}
        <ul className="lista lista-items alumnos-lista">
          {!periodoIdLista && (
            <li className="empty-state-card alumnos-empty-hero anim-fade-in">
              <div className="empty-state-card__icon anim-icon-pulse">
                <Icono nombre="alumnos" />
              </div>
              <h4>Comienza seleccionando una materia</h4>
              <p>Elige una de tus asignaturas activas para cargar la lista de alumnos, o sincroniza tu roster oficial desde Google Classroom.</p>

              {periodosActivos.length > 0 ? (
                <div className="alumnos-quick-periodos-grid">
                  {periodosActivos.map((p) => (
                    <button
                      key={p._id}
                      type="button"
                      className="alumnos-materia-pick-card anim-card-hover"
                      onClick={() => setPeriodoIdLista(p._id)}
                    >
                      <div className="alumnos-materia-pick-avatar">
                        <Icono nombre="periodos" />
                      </div>
                      <div className="alumnos-materia-pick-info">
                        <strong>{etiquetaMateria(p)}</strong>
                        <span>Grupos: {Array.isArray(p.grupos) && p.grupos.length > 0 ? p.grupos.join(', ') : 'General'}</span>
                      </div>
                      <div className="alumnos-materia-pick-arrow">➔</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state-steps" aria-hidden="true">
                  <div className="empty-step">
                    <span className="empty-step__num">1</span>
                    <span>Configura tu materia</span>
                  </div>
                  <div className="empty-step__arrow">➔</div>
                  <div className="empty-step">
                    <span className="empty-step__num">2</span>
                    <span>Registra tus alumnos</span>
                  </div>
                  <div className="empty-step__arrow">➔</div>
                  <div className="empty-step">
                    <span className="empty-step__num">3</span>
                    <span>Pasa lista y califica</span>
                  </div>
                </div>
              )}
            </li>
          )}

          {periodoIdLista && alumnosDeMateria.length === 0 && (
            <li className="empty-state-card anim-fade-in">
              <div className="empty-state-card__icon anim-icon-pulse">
                <Icono nombre="nuevo" />
              </div>
              <h4>No hay alumnos registrados en esta materia</h4>
              <p>Utiliza el formulario superior para registrar alumnos individualmente o importa tu lista oficial.</p>
            </li>
          )}

          {periodoIdLista && alumnosDeMateria.length > 0 && alumnosFiltrados.length === 0 && (
            <li className="empty-state-card anim-fade-in">
              <div className="empty-state-card__icon anim-icon-pulse">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <h4>No hay alumnos que coincidan con los filtros</h4>
              <p>Intenta ajustar el texto de búsqueda o el grupo seleccionado.</p>
            </li>
          )}

          {periodoIdLista &&
            alumnosFiltrados.map((alumno) => {
              const faltas = resumenAsistencias.find((r) => r.alumnoId === alumno._id)?.faltas ?? 0;
              const sinDerecho = faltas >= 4;
              const iniciales = obtenerIniciales(alumno.nombres, alumno.apellidos);

              return (
                <li
                  key={alumno._id}
                  className="anim-slide-up"
                >
                  <div className="item-glass alumnos-lista__item anim-card-hover">
                    <div className="alumnos-card__body">
                      {/* Avatar con Iniciales y anillo de grupo */}
                      <div className={`alumno-avatar alumno-avatar--${claseBadgeGrupo(alumno.grupo || '')}`} aria-hidden="true">
                        <span>{iniciales}</span>
                      </div>

                      {/* Información Principal */}
                      <div className="alumno-info">
                        <div className="item-title alumnos-lista-title-container">
                          <span className="alumno-nombre">
                            {alumno.matricula && !/^\d{15,}$/.test(alumno.matricula) ? `${alumno.matricula} - ` : ''}
                            {alumno.nombreCompleto}
                          </span>
                          {sinDerecho && (
                            <span className="badge badge-alerta badge-alerta-sin-derecho anim-pulse-fast">
                              ⚠️ SIN DERECHO (4 O MÁS FALTAS)
                            </span>
                          )}
                        </div>

                        <div className="item-meta alumnos-card__meta">
                          {alumno.matricula && !/^\d{15,}$/.test(alumno.matricula) && (
                            <span className="alumno-meta-tag" data-tooltip="Matrícula del estudiante">
                              <span className="alumno-meta-lbl">Matrícula:</span> {alumno.matricula}
                            </span>
                          )}
                          <span className="alumno-meta-tag" data-tooltip="Grupo asignado en la materia">
                            <span className="alumno-meta-lbl">Grupo:</span>{' '}
                            <span className={`badge badge-grupo ${claseBadgeGrupo(alumno.grupo || '')}`}>
                              {alumno.grupo ? alumno.grupo : '-'}
                            </span>
                          </span>
                          <span className="alumno-meta-tag" data-tooltip="Correo institucional para recepción de folios y calificaciones">
                            <span className="alumno-meta-lbl">Correo:</span>{' '}
                            <span className="alumno-correo">{alumno.correo ? alumno.correo : '-'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Acciones con Iconos */}
                      <div className="item-actions alumnos-card__actions">
                        <Boton
                          variante="secundario"
                          type="button"
                          onClick={() => iniciarEdicion(alumno)}
                          disabled={bloqueoEdicion}
                          icono={
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                          }
                        >
                          Editar
                        </Boton>
                        {puedeEliminarAlumnoDev && (
                          <Boton
                            variante="secundario"
                            type="button"
                            cargando={eliminandoAlumnoId === alumno._id}
                            onClick={() => void eliminarAlumnoDev(alumno)}
                            disabled={!puedeEliminarAlumnoDev}
                            icono={
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            }
                          >
                            Eliminar (DEV)
                          </Boton>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
        </ul>
      </section>
    </div>
  );
}
