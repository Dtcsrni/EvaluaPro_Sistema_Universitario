/**
 * SeccionPeriodos
 *
 * Responsabilidad: Seccion funcional del shell docente para gestion de materias con Bento Glassmorphic, iconografia rica y animaciones.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
import { useMemo, useState } from 'react';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { GuiaMateriaVisual } from './GuiaMateriaVisual';
import { registrarAccionDocente } from './telemetriaDocente';
import type { EnviarConPermiso, Periodo, PermisosUI } from './tipos';
import { clienteApi } from './clienteApiDocente';
import { obtenerTokenDocente } from '../../servicios_api/clienteApi';
import { esMensajeError, etiquetaMateria, idCortoMateria, mensajeDeError, patronNombreMateria } from './utilidades';

export function SeccionPeriodos({
  periodos,
  onRefrescar,
  onVerArchivadas,
  permisos,
  puedeEliminarMateriaDev,
  enviarConPermiso,
  avisarSinPermiso
}: {
  periodos: Periodo[];
  onRefrescar: () => void;
  onVerArchivadas: () => void;
  permisos: PermisosUI;
  puedeEliminarMateriaDev: boolean;
  enviarConPermiso: EnviarConPermiso;
  avisarSinPermiso: (mensaje: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [grupos, setGrupos] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [creando, setCreando] = useState(false);
  const [archivandoId, setArchivandoId] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardandoEdicionId, setGuardandoEdicionId] = useState<string | null>(null);
  const [edicionNombre, setEdicionNombre] = useState('');
  const [edicionFechaInicio, setEdicionFechaInicio] = useState('');
  const [edicionFechaFin, setEdicionFechaFin] = useState('');
  const [edicionGrupos, setEdicionGrupos] = useState('');
  const confirm = useConfirmDialog();
  const puedeGestionar = permisos.periodos.gestionar;
  const puedeArchivar = permisos.periodos.archivar;
  const bloqueoEdicion = !puedeGestionar;

  function formatearFecha(valor?: string) {
    if (!valor) return '-';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return String(valor);
    return d.toLocaleDateString();
  }

  function formatearFechaInput(valor?: string) {
    if (!valor) return '';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function normalizarNombreMateria(valor: string): string {
    return String(valor || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function normalizarTextoCorto(valor: string): string {
    return String(valor || '')
      .trim()
      .replace(/\s+/g, ' ');
  }



  function calcularProgresoPeriodo(fechaInicio?: string, fechaFin?: string): {
    porcentaje: number;
    estado: 'por_iniciar' | 'en_curso' | 'por_finalizar' | 'concluido';
    etiquetaEstado: string;
    diasRestantes: number | null;
  } {
    if (!fechaInicio || !fechaFin) {
      return { porcentaje: 0, estado: 'en_curso', etiquetaEstado: 'En curso', diasRestantes: null };
    }
    const inicio = new Date(fechaInicio).getTime();
    const fin = new Date(fechaFin).getTime();
    const hoy = Date.now();
    if (Number.isNaN(inicio) || Number.isNaN(fin) || fin <= inicio) {
      return { porcentaje: 0, estado: 'en_curso', etiquetaEstado: 'En curso', diasRestantes: null };
    }
    if (hoy < inicio) {
      const diasParaInicio = Math.ceil((inicio - hoy) / (1000 * 60 * 60 * 24));
      return { porcentaje: 0, estado: 'por_iniciar', etiquetaEstado: `Inicia en ${diasParaInicio} d`, diasRestantes: diasParaInicio };
    }
    if (hoy > fin) {
      return { porcentaje: 100, estado: 'concluido', etiquetaEstado: 'Concluido', diasRestantes: 0 };
    }
    const diasRestantes = Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24));
    const porcentaje = Math.min(100, Math.max(0, Math.round(((hoy - inicio) / (fin - inicio)) * 100)));
    const estado = diasRestantes <= 14 ? 'por_finalizar' : 'en_curso';
    const etiquetaEstado = estado === 'por_finalizar' ? `Cierra en ${diasRestantes} d` : `En curso (${porcentaje}%)`;
    return { porcentaje, estado, etiquetaEstado, diasRestantes };
  }

  const nombreValido = useMemo(() => {
    const limpio = normalizarTextoCorto(nombre);
    if (!limpio) return false;
    if (limpio.length < 3 || limpio.length > 80) return false;
    return patronNombreMateria.test(limpio);
  }, [nombre]);

  const nombreNormalizado = useMemo(() => normalizarNombreMateria(nombre), [nombre]);
  const nombreDuplicado = useMemo(() => {
    if (!nombreNormalizado) return false;
    return periodos.some((p) => normalizarNombreMateria(p.nombre) === nombreNormalizado);
  }, [nombreNormalizado, periodos]);

  const gruposNormalizados = useMemo(
    () =>
      (grupos || '')
        .split(',')
        .map((item) => normalizarTextoCorto(item))
        .filter(Boolean),
    [grupos]
  );
  const gruposDuplicados = useMemo(() => {
    const vistos = new Set<string>();
    for (const grupo of gruposNormalizados) {
      const clave = grupo.toLowerCase();
      if (vistos.has(clave)) return true;
      vistos.add(clave);
    }
    return false;
  }, [gruposNormalizados]);
  const gruposValidos = useMemo(() => {
    if (gruposNormalizados.length > 50) return false;
    return gruposNormalizados.every((g) => g.length >= 1 && g.length <= 40);
  }, [gruposNormalizados]);

  const puedeCrear = Boolean(
    nombreValido &&
      fechaInicio &&
      fechaFin &&
      fechaFin >= fechaInicio &&
      !nombreDuplicado &&
      gruposValidos &&
      !gruposDuplicados
  );

  const nombreEdicionValido = useMemo(() => {
    const limpio = normalizarTextoCorto(edicionNombre);
    if (!limpio) return false;
    if (limpio.length < 3 || limpio.length > 80) return false;
    return patronNombreMateria.test(limpio);
  }, [edicionNombre]);

  const nombreEdicionNormalizado = useMemo(() => normalizarNombreMateria(edicionNombre), [edicionNombre]);
  const nombreEdicionDuplicado = useMemo(() => {
    if (!editandoId || !nombreEdicionNormalizado) return false;
    return periodos.some((p) => p._id !== editandoId && normalizarNombreMateria(p.nombre) === nombreEdicionNormalizado);
  }, [editandoId, nombreEdicionNormalizado, periodos]);

  const gruposEdicionNormalizados = useMemo(
    () =>
      (edicionGrupos || '')
        .split(',')
        .map((item) => normalizarTextoCorto(item))
        .filter(Boolean),
    [edicionGrupos]
  );
  const gruposEdicionDuplicados = useMemo(() => {
    const vistos = new Set<string>();
    for (const grupo of gruposEdicionNormalizados) {
      const clave = grupo.toLowerCase();
      if (vistos.has(clave)) return true;
      vistos.add(clave);
    }
    return false;
  }, [gruposEdicionNormalizados]);
  const gruposEdicionValidos = useMemo(() => {
    if (gruposEdicionNormalizados.length > 50) return false;
    return gruposEdicionNormalizados.every((g) => g.length >= 1 && g.length <= 40);
  }, [gruposEdicionNormalizados]);

  const puedeGuardarEdicion = Boolean(
    editandoId &&
      nombreEdicionValido &&
      edicionFechaInicio &&
      edicionFechaFin &&
      edicionFechaFin >= edicionFechaInicio &&
      !nombreEdicionDuplicado &&
      gruposEdicionValidos &&
      !gruposEdicionDuplicados
  );

  const resumenMaterias = useMemo(() => {
    let proximasAFinalizar = 0;
    let totalGrupos = 0;
    for (const periodo of periodos) {
      const progreso = calcularProgresoPeriodo(periodo.fechaInicio, periodo.fechaFin);
      if (progreso.estado === 'por_finalizar') {
        proximasAFinalizar += 1;
      }
      if (Array.isArray(periodo.grupos)) {
        totalGrupos += periodo.grupos.length;
      }
    }
    return {
      totalMaterias: periodos.length,
      totalGrupos,
      proximasAFinalizar
    };
  }, [periodos]);

  async function crearPeriodo() {
    try {
      const inicio = Date.now();
      if (!puedeGestionar) {
        avisarSinPermiso('No tienes permiso para registrar materias.');
        return;
      }
      if (!puedeCrear) return;
      setCreando(true);
      setMensaje('');
      await enviarConPermiso(
        'periodos:gestionar',
        '/periodos',
        {
          nombre: normalizarTextoCorto(nombre),
          fechaInicio,
          fechaFin,
          grupos: gruposNormalizados
        },
        'No tienes permiso para registrar materias.'
      );
      setMensaje('Materia creada');
      emitToast({ level: 'ok', title: 'Materias', message: 'Materia creada', durationMs: 2200 });
      registrarAccionDocente('crear_periodo', true, Date.now() - inicio);
      setNombre('');
      setFechaInicio('');
      setFechaFin('');
      setGrupos('');
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo registrar la materia');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo registrar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('crear_periodo', false);
    } finally {
      setCreando(false);
    }
  }

  function iniciarEdicion(periodo: Periodo) {
    setEditandoId(periodo._id);
    setEdicionNombre(periodo.nombre || '');
    setEdicionFechaInicio(formatearFechaInput(periodo.fechaInicio));
    setEdicionFechaFin(formatearFechaInput(periodo.fechaFin));
    setEdicionGrupos(Array.isArray(periodo.grupos) ? periodo.grupos.join(', ') : '');
    setMensaje('');
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setEdicionNombre('');
    setEdicionFechaInicio('');
    setEdicionFechaFin('');
    setEdicionGrupos('');
  }

  async function guardarEdicion(periodo: Periodo) {
    if (!editandoId || editandoId !== periodo._id) return;
    try {
      const inicio = Date.now();
      if (!puedeGestionar) {
        avisarSinPermiso('No tienes permiso para editar materias.');
        return;
      }
      if (!puedeGuardarEdicion) return;
      setGuardandoEdicionId(periodo._id);
      setMensaje('');
      await enviarConPermiso(
        'periodos:gestionar',
        `/periodos/${periodo._id}`,
        {
          nombre: normalizarTextoCorto(edicionNombre),
          fechaInicio: edicionFechaInicio,
          fechaFin: edicionFechaFin,
          grupos: gruposEdicionNormalizados
        },
        'No tienes permiso para editar materias.'
      );
      setMensaje('Materia actualizada');
      emitToast({ level: 'ok', title: 'Materias', message: 'Materia actualizada', durationMs: 2200 });
      registrarAccionDocente('actualizar_periodo', true, Date.now() - inicio);
      cancelarEdicion();
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo actualizar la materia');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo actualizar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('actualizar_periodo', false);
    } finally {
      setGuardandoEdicionId(null);
    }
  }

  async function archivarMateria(periodo: Periodo) {
    if (!puedeArchivar) {
      avisarSinPermiso('No tienes permiso para archivar materias.');
      return;
    }
    const confirmado = await confirm({
      title: 'Archivar materia',
      message: `La materia "${etiquetaMateria(periodo)}" dejará de mostrarse en la lista activa.`,
      details: ['Los datos se conservarán.', 'Seguirá disponible en “Materias archivadas”.'],
      confirmLabel: 'Sí, archivar',
      tone: 'warning'
    });
    if (!confirmado) return;

    try {
      const inicio = Date.now();
      setArchivandoId(periodo._id);
      setMensaje('');
      await enviarConPermiso(
        'periodos:archivar',
        `/periodos/${periodo._id}/archivar`,
        {},
        'No tienes permiso para archivar materias.'
      );
      setMensaje('Materia archivada');
      emitToast({ level: 'ok', title: 'Materias', message: 'Materia archivada', durationMs: 2200 });
      registrarAccionDocente('archivar_periodo', true, Date.now() - inicio);
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo archivar la materia');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo archivar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('archivar_periodo', false);
    } finally {
      setArchivandoId(null);
    }
  }

  async function eliminarMateriaDev(periodo: Periodo) {
    if (!puedeEliminarMateriaDev) {
      avisarSinPermiso('No tienes permiso para eliminar materias en desarrollo.');
      return;
    }
    const confirmado = await confirm({
      title: 'Eliminar materia en desarrollo',
      message: `Se eliminará "${etiquetaMateria(periodo)}" con su información relacionada.`,
      details: ['Se borrarán alumnos, banco, plantillas y exámenes asociados.', 'No uses esta acción en operación normal.'],
      confirmLabel: 'Sí, eliminar materia',
      tone: 'danger'
    });
    if (!confirmado) return;

    try {
      const inicio = Date.now();
      setEliminandoId(periodo._id);
      setMensaje('');
      await enviarConPermiso(
        'periodos:eliminar_dev',
        `/periodos/${periodo._id}/eliminar`,
        {},
        'No tienes permiso para eliminar materias en desarrollo.'
      );
      setMensaje('Materia eliminada');
      emitToast({ level: 'ok', title: 'Materias', message: 'Materia eliminada', durationMs: 2200 });
      registrarAccionDocente('eliminar_periodo', true, Date.now() - inicio);
      await Promise.resolve().then(() => onRefrescar());
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo eliminar la materia');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo eliminar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('eliminar_periodo', false);
    } finally {
      setEliminandoId(null);
    }
  }

  async function descargarListaInstitucional(periodo: Periodo, formato: 'xlsx' | 'pdf') {
    emitToast({
      level: 'info',
      title: 'Generando Lista',
      message: `Descargando lista institucional en formato ${formato.toUpperCase()}...`
    });
    try {
      const token = obtenerTokenDocente();
      const params = new URLSearchParams({
        periodoId: periodo._id,
        templateId: 'asistencia_cuh_control',
        formato,
        ...(token ? { token } : {})
      });
      const url = `${clienteApi.baseApi}/listas-institucionales/generar?${params.toString()}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.mensaje || 'Error al generar la lista institucional');
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Lista_${(periodo.nombre || 'Materia').replace(/[^a-zA-Z0-9_-]/g, '_')}.${formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      emitToast({
        level: 'ok',
        title: 'Lista Descargada',
        message: `Lista institucional ${formato.toUpperCase()} descargada con éxito.`
      });
      registrarAccionDocente(`descargar_lista_cuh_${formato}`, true);
    } catch (err) {
      const msg = mensajeDeError(err, 'No se pudo descargar la lista institucional.');
      emitToast({ level: 'error', title: 'Error de Descarga', message: msg });
    }
  }

  return (
    <div className="panel materias-panel anim-fade-in">
      {/* Cabecera Principal con Mini-KPIs integrados */}
      <div className="materias-panel__head">
        <div className="materias-panel__lead">
          <div className="materias-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10" />
              <path d="M6 10h10" />
              <path d="M6 14h6" />
              <path d="M16 2v6l2-1.5 2 1.5V2" />
            </svg>
          </div>
          <div className="materias-panel__text-block">
            <div className="materias-panel__meta-row">
              <span className="materias-status-pill">
                <span className="materias-pulse-dot" aria-hidden="true" />
                <span>Ciclo Académico</span>
              </span>
              <span className="materias-counter-tag">
                {periodos.length} {periodos.length === 1 ? 'materia registrada' : 'materias registradas'}
              </span>
            </div>
            <h2 className="materias-panel__title">Materias</h2>
            <p className="nota">Administra tus asignaturas activas, fechas de curso y asignación de grupos.</p>
          </div>
        </div>

        <div className="materias-header-kpis" aria-live="polite">
          <div className="materia-mini-kpi materia-mini-kpi--active anim-kpi-hover" data-tooltip="Total de materias o cursos activos registrados">
            <span className="materia-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10M6 10h10" />
              </svg>
            </span>
            <span className="materia-mini-kpi__num">{resumenMaterias.totalMaterias}</span>
            <span className="materia-mini-kpi__lbl">Materias</span>
          </div>

          <div className="materia-mini-kpi materia-mini-kpi--groups anim-kpi-hover" data-tooltip="Total de grupos académicos asignados">
            <span className="materia-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="3" />
              </svg>
            </span>
            <span className="materia-mini-kpi__num">{resumenMaterias.totalGrupos}</span>
            <span className="materia-mini-kpi__lbl">Grupos</span>
          </div>

          <div className="materia-mini-kpi materia-mini-kpi--closing anim-kpi-hover" data-tooltip="Materias cuya fecha de término vence en los próximos 14 días">
            <span className="materia-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <span className="materia-mini-kpi__num">{resumenMaterias.proximasAFinalizar}</span>
            <span className="materia-mini-kpi__lbl">Por cerrar</span>
          </div>

          <Boton
            variante="secundario"
            type="button"
            onClick={onVerArchivadas}
            data-tooltip="Consultar materias y cursos finalizados o archivados"
            icono={
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 8v13H3V8" />
                <path d="M1 3h22v5H1z" />
                <path d="M10 12h4" />
              </svg>
            }
          >
            Archivadas
          </Boton>
        </div>
      </div>

      {/* Guía Rápida Bento Unificada (Sin acordeones redundantes) */}
      <GuiaMateriaVisual />

      {/* Formulario Estructurado en 2 Filas Claras Sin Solapamientos */}
      <section className="materias-form materias-form--glass materias-form--panoramico anim-form-card">
        <div className="materias-form__header">
          <h3 className="materias-form__title">✨ Registrar Nueva Materia</h3>
          <p className="materias-form__subtitle">Ingresa la asignatura, grupos y periodo lectivo para habilitar alumnos y evaluaciones.</p>
        </div>

        <div className="materias-form__fields">
          {/* Fila 1: Asignatura y Grupos */}
          <div className="materias-form__row materias-form__row--top">
            <label className="campo campo--materia">
              <span>Nombre de la materia</span>
              <div className="auth-input-box auth-input-box--book auth-input-box--animated">
                <input
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  disabled={bloqueoEdicion}
                  placeholder="Ej. Álgebra Lineal, Programación Web…"
                  data-tooltip="Escribe el nombre oficial de la asignatura o periodo académico"
                />
              </div>
            </label>

            <label className="campo campo--grupos">
              <span>Grupos asignados</span>
              <div className="auth-input-box auth-input-box--tags auth-input-box--animated">
                <input
                  value={grupos}
                  onChange={(event) => setGrupos(event.target.value)}
                  disabled={bloqueoEdicion}
                  placeholder="Ej. 1A, 1B, 2A"
                  data-tooltip="Lista de grupos separados por coma (ej. 1A, 1B, 2C)"
                />
              </div>
            </label>
          </div>

          {/* Fila 2: Fechas y Botón de Creación */}
          <div className="materias-form__row materias-form__row--bottom">
            <label className="campo campo--fecha">
              <span>Fecha inicio</span>
              <div className="auth-input-box auth-input-box--calendar auth-input-box--animated">
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(event) => setFechaInicio(event.target.value)}
                  disabled={bloqueoEdicion}
                  data-tooltip="Fecha oficial en que da inicio el curso lectivo"
                />
              </div>
            </label>

            <label className="campo campo--fecha">
              <span>Fecha fin</span>
              <div className="auth-input-box auth-input-box--calendar auth-input-box--animated">
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(event) => setFechaFin(event.target.value)}
                  disabled={bloqueoEdicion}
                  data-tooltip="Fecha límite programada para la conclusión del curso"
                />
              </div>
            </label>

            <div className="materias-form__cta-col">
              <Boton
                type="button"
                className="boton--crear-materia"
                icono={<Icono nombre="nuevo" />}
                cargando={creando}
                disabled={!puedeCrear || bloqueoEdicion}
                onClick={crearPeriodo}
                data-tooltip="Crear y habilitar esta materia para inscribir alumnos y diseñar exámenes"
              >
                {creando ? 'Creando…' : 'Crear materia'}
              </Boton>
            </div>
          </div>
        </div>

        {/* Feedback de validación */}
        <div className="materias-form__feedback-area">
          {nombre.trim() && !nombreValido && (
            <InlineMensaje tipo="warning">El nombre debe tener entre 3 y 80 caracteres para poder crear la materia.</InlineMensaje>
          )}
          {nombre.trim() && nombreDuplicado && (
            <InlineMensaje tipo="error">Ya existe una materia con ese nombre. Cambia el nombre para crearla.</InlineMensaje>
          )}
          {fechaInicio && fechaFin && fechaFin < fechaInicio && (
            <InlineMensaje tipo="error">La fecha fin debe ser igual o posterior a la fecha inicio.</InlineMensaje>
          )}
          {!gruposValidos && grupos.trim() && (
            <InlineMensaje tipo="warning">Revisa grupos: máximo 50 y hasta 40 caracteres por grupo para poder crear la materia.</InlineMensaje>
          )}
          {gruposDuplicados && <InlineMensaje tipo="warning">Hay grupos repetidos; corrígelo para poder crear la materia.</InlineMensaje>}
          {mensaje && (
            <p className={esMensajeError(mensaje) ? 'mensaje error anim-fade-in' : 'mensaje ok anim-fade-in'} role="status">
              {mensaje}
            </p>
          )}
        </div>
      </section>

      {/* Listado de Materias Activas a Ancho Completo */}
      <div className="materias-seccion-activas anim-fade-in">
        <div className="materias-seccion-activas__head">
          <h3 className="materias-section-title">Materias activas ({periodos.length})</h3>
        </div>
        {periodos.length === 0 ? (
          <div className="empty-state-card anim-fade-in">
            <div className="empty-state-card__icon anim-icon-pulse">
              <span aria-hidden="true">🎓</span>
            </div>
            <h4>Comienza configurando tu primera materia</h4>
            <p>Crea tu primer curso arriba para desbloquear la gestión de alumnos, el banco de preguntas y la calificación de exámenes.</p>
            <div className="empty-state-steps" aria-hidden="true">
              <div className="empty-step">
                <span className="empty-step__num">1</span>
                <span>Registra tu materia y fechas</span>
              </div>
              <div className="empty-step__arrow">➔</div>
              <div className="empty-step">
                <span className="empty-step__num">2</span>
                <span>Inscribe a tus alumnos</span>
              </div>
              <div className="empty-step__arrow">➔</div>
              <div className="empty-step">
                <span className="empty-step__num">3</span>
                <span>Califica exámenes con OMR</span>
              </div>
            </div>
          </div>
        ) : (
          <ul className="lista lista-items materias-lista">
            {periodos.map((periodo) => {
              const progreso = calcularProgresoPeriodo(periodo.fechaInicio, periodo.fechaFin);
              return (
                <li key={periodo._id} className="anim-slide-up">
                  <div className="item-glass materias-lista__item anim-card-hover">
                    <div className="item-row">
                      <div>
                        {editandoId === periodo._id ? (
                          <div className="lista materias-edicion anim-fade-in">
                            <label className="campo">
                              <span>Nombre de la materia</span>
                              <div className="auth-input-box auth-input-box--book auth-input-box--animated">
                                <input
                                  value={edicionNombre}
                                  onChange={(event) => setEdicionNombre(event.target.value)}
                                  disabled={!puedeGestionar || guardandoEdicionId === periodo._id}
                                />
                              </div>
                            </label>
                            {edicionNombre.trim() && !nombreEdicionValido && (
                              <InlineMensaje tipo="warning">El nombre debe tener entre 3 y 80 caracteres.</InlineMensaje>
                            )}
                            {nombreEdicionDuplicado && (
                              <InlineMensaje tipo="error">Ya existe una materia activa con ese nombre.</InlineMensaje>
                            )}
                            <div className="materias-fechas-grid">
                              <label className="campo">
                                <span>Fecha inicio</span>
                                <input
                                  type="date"
                                  value={edicionFechaInicio}
                                  onChange={(event) => setEdicionFechaInicio(event.target.value)}
                                  disabled={!puedeGestionar || guardandoEdicionId === periodo._id}
                                />
                              </label>
                              <label className="campo">
                                <span>Fecha fin</span>
                                <input
                                  type="date"
                                  value={edicionFechaFin}
                                  onChange={(event) => setEdicionFechaFin(event.target.value)}
                                  disabled={!puedeGestionar || guardandoEdicionId === periodo._id}
                                />
                              </label>
                            </div>
                            {edicionFechaInicio && edicionFechaFin && edicionFechaFin < edicionFechaInicio && (
                              <InlineMensaje tipo="error">La fecha fin debe ser igual o posterior a la fecha inicio.</InlineMensaje>
                            )}
                            <label className="campo">
                              <span>Grupos (separados por coma)</span>
                              <div className="auth-input-box auth-input-box--tags auth-input-box--animated">
                                <input
                                  value={edicionGrupos}
                                  onChange={(event) => setEdicionGrupos(event.target.value)}
                                  disabled={!puedeGestionar || guardandoEdicionId === periodo._id}
                                />
                              </div>
                            </label>
                            {!gruposEdicionValidos && edicionGrupos.trim() && (
                              <InlineMensaje tipo="warning">Revisa grupos: máximo 50 y hasta 40 caracteres por grupo.</InlineMensaje>
                            )}
                            {gruposEdicionDuplicados && <InlineMensaje tipo="warning">Hay grupos repetidos.</InlineMensaje>}
                          </div>
                        ) : (
                          <>
                            <div className="materia-card-header">
                              <div className="materia-title-group">
                                <div className="materia-avatar" aria-hidden="true">
                                  <Icono nombre="periodos" />
                                </div>
                                <div>
                                  <div className="item-title" title={periodo._id}>
                                    {etiquetaMateria(periodo)}
                                  </div>
                                  <span className={`chip chip--sm chip--${progreso.estado} anim-badge-in`}>
                                    {progreso.etiquetaEstado}
                                  </span>
                                </div>
                              </div>
                              <div className="materia-progress-ring" title={`Avance académico: ${progreso.porcentaje}% (${progreso.etiquetaEstado})`}>
                                <svg viewBox="0 0 36 36" className="circular-chart">
                                  <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                  <path
                                    className="circle-fill"
                                    strokeDasharray={`${progreso.porcentaje}, 100`}
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  />
                                  <text x="18" y="20.35" className="circle-text">
                                    {progreso.porcentaje}%
                                  </text>
                                </svg>
                              </div>
                            </div>
                            <div className="item-meta materia-card-meta">
                              
                              <span className="materia-meta-tag">
                                <span className="materia-meta-lbl">Inicio:</span> {formatearFecha(periodo.fechaInicio)}
                              </span>
                              <span className="materia-meta-tag">
                                <span className="materia-meta-lbl">Fin:</span> {formatearFecha(periodo.fechaFin)}
                              </span>
                              <span className="materia-meta-tag">
                                <span className="materia-meta-lbl">Grupos:</span>{' '}
                                <span className="materia-grupos-badge">
                                  {Array.isArray(periodo.grupos) && periodo.grupos.length > 0 ? periodo.grupos.join(', ') : '-'}
                                </span>
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="item-actions">
                        {editandoId === periodo._id ? (
                          <>
                            <Boton
                              type="button"
                              cargando={guardandoEdicionId === periodo._id}
                              onClick={() => void guardarEdicion(periodo)}
                              disabled={!puedeGuardarEdicion || !puedeGestionar}
                              icono={<Icono nombre="ok" />}
                            >
                              Guardar cambios
                            </Boton>
                            <Boton variante="secundario" type="button" onClick={cancelarEdicion} disabled={guardandoEdicionId === periodo._id}>
                              Cancelar
                            </Boton>
                          </>
                        ) : (
                          <>
                            <Boton
                              variante="secundario"
                              type="button"
                              onClick={() => iniciarEdicion(periodo)}
                              disabled={bloqueoEdicion}
                              icono={
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                </svg>
                              }
                            >
                              Editar
                            </Boton>
                            <Boton
                              variante="secundario"
                              type="button"
                              cargando={archivandoId === periodo._id}
                              onClick={() => archivarMateria(periodo)}
                              disabled={!puedeArchivar}
                              icono={
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 8v13H3V8" />
                                  <path d="M1 3h22v5H1z" />
                                  <path d="M10 12h4" />
                                </svg>
                              }
                            >
                              Archivar
                            </Boton>
                            <Boton
                              variante="secundario"
                              type="button"
                              onClick={() => descargarListaInstitucional(periodo, 'xlsx')}
                              icono={
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                  <line x1="8" y1="13" x2="16" y2="13" />
                                  <line x1="8" y1="17" x2="16" y2="17" />
                                </svg>
                              }
                            >
                              Lista CUH XLSX
                            </Boton>
                            <Boton
                              variante="secundario"
                              type="button"
                              onClick={() => descargarListaInstitucional(periodo, 'pdf')}
                              icono={
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                  <path d="M9 15h6M9 12h6" />
                                </svg>
                              }
                            >
                              Lista CUH PDF
                            </Boton>
                            {puedeEliminarMateriaDev && (
                              <Boton
                                variante="secundario"
                                type="button"
                                cargando={eliminandoId === periodo._id}
                                onClick={() => void eliminarMateriaDev(periodo)}
                                disabled={!puedeEliminarMateriaDev}
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
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function SeccionPeriodosArchivados({
  periodos,
  onVerActivas
}: {
  periodos: Periodo[];
  onVerActivas: () => void;
}) {
  function formatearFechaHora(valor?: string) {
    if (!valor) return '-';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return String(valor);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="panel materias-panel anim-fade-in">
      {/* Encabezado Integrado de Materias Archivadas */}
      <div className="materias-panel__head">
        <div className="materias-panel__lead">
          <div className="materias-panel__icon-orb materias-panel__icon-orb--amber anim-icon-pulse" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 8v13H3V8" />
              <path d="M1 3h22v5H1z" />
              <path d="M10 12h4" />
            </svg>
          </div>
          <div className="materias-panel__text-block">
            <div className="materias-panel__meta-row">
              <span className="materias-status-pill materias-status-pill--amber">
                <span className="materias-pulse-dot materias-pulse-dot--amber" aria-hidden="true" />
                <span>Archivo Histórico</span>
              </span>
              <span className="materias-counter-tag">
                {periodos.length} {periodos.length === 1 ? 'materia archivada' : 'materias archivadas'}
              </span>
            </div>
            <h2 className="materias-panel__title">Materias archivadas</h2>
            <p className="nota">Historial de asignaturas, calificaciones y registros de ciclos lectivos anteriores.</p>
          </div>
        </div>

        <div className="acciones">
          <Boton
            variante="secundario"
            type="button"
            onClick={onVerActivas}
            data-tooltip="Regresar a la gestión de materias activas"
            icono={
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            }
          >
            Volver a materias activas
          </Boton>
        </div>
      </div>

      {/* Tarjeta Informativa Glassmorphism */}
      <div className="archivadas-info-card anim-fade-in" role="region" aria-label="Información sobre archivo de materias">
        <div className="archivadas-info-card__icon" aria-hidden="true">🛡️</div>
        <div className="archivadas-info-card__text">
          <strong>¿Qué ocurre con las materias archivadas?</strong>
          <p>
            Al archivar un curso, este se resguarda de forma segura para no saturar tu espacio de trabajo diario.
            Todos los alumnos inscritos, reactivos, plantillas y calificaciones históricas permanecen intactos y disponibles para consulta o auditoría.
          </p>
        </div>
      </div>

      {/* Listado de Materias Archivadas */}
      <div className="materias-seccion-activas anim-fade-in">
        <div className="materias-seccion-activas__head">
          <h3 className="materias-section-title">Registro histórico ({periodos.length})</h3>
        </div>

        {periodos.length === 0 ? (
          <div className="empty-state-card anim-fade-in">
            <div className="empty-state-card__icon anim-icon-pulse">
              <span aria-hidden="true">📦</span>
            </div>
            <h4>No hay materias archivadas</h4>
            <p>Cuando concluyas un periodo lectivo y lo archives desde la sección de materias activas, aparecerá aquí resguardado con todos sus datos y exámenes.</p>
          </div>
        ) : (
          <ul className="lista lista-items materias-lista">
            {periodos.map((periodo) => (
              <li key={periodo._id} className="anim-slide-up">
                <div className="item-glass materias-lista__item anim-card-hover">
                  <div className="item-row">
                    <div>
                      <div className="materia-card-header">
                        <div>
                          <div className="item-title" title={periodo._id}>
                            {etiquetaMateria(periodo)}
                          </div>
                          <span className="chip chip--sm chip--archivado anim-badge-in">Archivada</span>
                        </div>
                      </div>
                      <div className="item-meta materia-card-meta">
                        <span className="materia-meta-tag">
                          <span className="materia-meta-lbl">ID:</span> {idCortoMateria(periodo._id)}
                        </span>
                        <span className="materia-meta-tag">
                          <span className="materia-meta-lbl">Creada:</span> {formatearFechaHora(periodo.createdAt)}
                        </span>
                        <span className="materia-meta-tag">
                          <span className="materia-meta-lbl">Archivada:</span> {formatearFechaHora(periodo.archivadoEn)}
                        </span>
                      </div>
                      {periodo.resumenArchivado && (
                        <div className="archivadas-chips-row">
                          <span className="archivada-chip">👥 {periodo.resumenArchivado.alumnos ?? 0} alumnos</span>
                          <span className="archivada-chip">📝 {periodo.resumenArchivado.bancoPreguntas ?? 0} reactivos</span>
                          <span className="archivada-chip">📄 {periodo.resumenArchivado.plantillas ?? 0} plantillas</span>
                          <span className="archivada-chip">🎖️ {periodo.resumenArchivado.calificaciones ?? 0} calificaciones</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
