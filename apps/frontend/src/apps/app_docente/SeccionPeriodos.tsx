/**
 * SeccionPeriodos
 *
 * Responsabilidad: Seccion funcional del shell docente para gestion de materias con Bento Glassmorphic, iconografia rica y animaciones.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconoCampo } from '../../ui/IconoLucide';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import {
  Archive,
  ArrowLeft,
  Award,
  BookOpenText,
  Clock3,
  FileSpreadsheet,
  FileText,
  IconoLucide,
  LibraryBig,
  ListChecks,
  Pencil,
  ShieldCheck,
  Tags,
  Trash2,
  Users
} from '../../ui/iconosCatalogo';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { GuiaMateriaVisual } from './GuiaMateriaVisual';
import { GestionPortadaMateria, ImagenPortadaMateria, useVistaPrevia } from './PortadaMateria';
import { registrarAccionDocente } from './telemetriaDocente';
import { fechaCalendarioEnMilisegundos, formatearFechaCalendario, normalizarFechaCalendarioISO } from './fechaCalendario';
import { fechaLocalISO } from './fechaLocal';
import type { Alumno, EnviarConPermiso, Periodo, PermisosUI } from './tipos';
import { clienteApi } from './clienteApiDocente';
import { obtenerTokenDocente } from '../../servicios_api/clienteApi';
import { mensajeDeError, nombreMateriaVisible, patronNombreMateria } from './utilidades';

export function SeccionPeriodos({
  periodos,
  alumnos = [],
  cargandoMaterias = false,
  errorMaterias = false,
  onRefrescar,
  onVerArchivadas,
  onAbrirGrupo,
  permisos,
  puedeEliminarMateriaDev,
  enviarConPermiso,
  avisarSinPermiso
}: {
  periodos: Periodo[];
  alumnos?: Alumno[];
  cargandoMaterias?: boolean;
  errorMaterias?: boolean;
  onRefrescar: () => void | Promise<void>;
  onVerArchivadas: () => void;
  onAbrirGrupo?: (periodoId: string, grupo?: string) => void;
  permisos: PermisosUI;
  puedeEliminarMateriaDev: boolean;
  enviarConPermiso: EnviarConPermiso;
  avisarSinPermiso: (mensaje: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [grupos, setGrupos] = useState('');
  const [archivoPortada, setArchivoPortada] = useState<File | null>(null);
  const [errorPortadaAlta, setErrorPortadaAlta] = useState('');
  const [portadaPendienteId, setPortadaPendienteId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [mensajeEsError, setMensajeEsError] = useState(false);
  const [creando, setCreando] = useState(false);
  const [archivandoId, setArchivandoId] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [accionesAbiertasId, setAccionesAbiertasId] = useState<string | null>(null);
  const [registroMateriaAbierto, setRegistroMateriaAbierto] = useState(false);
  const [guardandoEdicionId, setGuardandoEdicionId] = useState<string | null>(null);
  const vistaPreviaPortada = useVistaPrevia(archivoPortada);
  const reintentarCargaMaterias = () => void Promise.resolve(onRefrescar()).catch(() => undefined);

  const alumnosPorPeriodo = useMemo(() => {
    const mapa = new Map<string, Alumno[]>();
    for (const alumno of Array.isArray(alumnos) ? alumnos : []) {
      const periodoId = String(alumno.periodoId || '').trim();
      if (!periodoId) continue;
      const lista = mapa.get(periodoId) ?? [];
      lista.push(alumno);
      mapa.set(periodoId, lista);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => String(a.nombreCompleto || '').localeCompare(String(b.nombreCompleto || ''), 'es'));
    }
    return mapa;
  }, [alumnos]);
  const [edicionNombre, setEdicionNombre] = useState('');
  const [edicionFechaInicio, setEdicionFechaInicio] = useState('');
  const [edicionFechaFin, setEdicionFechaFin] = useState('');
  const [edicionGrupos, setEdicionGrupos] = useState('');
  const focoAccionEdicionIdRef = useRef<string | null>(null);
  const enfocarFormularioEdicionRef = useRef(false);
  const teclaAperturaEdicionRef = useRef<string | null>(null);
  const ignorarClickActivacionTecladoRef = useRef(false);
  const confirm = useConfirmDialog();
  const puedeGestionar = permisos.periodos.gestionar;
  const puedeArchivar = permisos.periodos.archivar;
  const bloqueoEdicion = !puedeGestionar;

  useEffect(() => {
    const periodoId = focoAccionEdicionIdRef.current ?? editandoId;
    if (!periodoId) return;

    if (editandoId === periodoId) {
      const idObjetivo = enfocarFormularioEdicionRef.current
        ? `edicion-materia-instrucciones-${periodoId}`
        : `nombre-materia-edicion-${encodeURIComponent(periodoId)}`;
      document.getElementById(idObjetivo)?.focus();
      enfocarFormularioEdicionRef.current = false;
      return;
    }

    document.getElementById(`acciones-toggle-materia-${encodeURIComponent(periodoId)}`)?.focus();
    focoAccionEdicionIdRef.current = null;
  }, [editandoId]);

  function formatearFecha(valor?: string) {
    if (!valor) return '-';
    return formatearFechaCalendario(valor) ?? String(valor);
  }

  function formatearFechaInput(valor?: string) {
    return normalizarFechaCalendarioISO(valor) ?? '';
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
    const inicio = fechaCalendarioEnMilisegundos(fechaInicio);
    const fin = fechaCalendarioEnMilisegundos(fechaFin);
    const hoy = fechaCalendarioEnMilisegundos(fechaLocalISO());
    if (inicio === null || fin === null || hoy === null || fin <= inicio) {
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
    const etiquetaEstado = estado === 'por_finalizar'
      ? diasRestantes === 0 ? 'Cierra hoy' : `Cierra en ${diasRestantes} d`
      : `En curso (${porcentaje}%)`;
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
  const mostrarAyudaCrear = !puedeCrear && !bloqueoEdicion && !creando;

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

  const errorNombreAltaFormato = Boolean(nombre.trim() && !nombreValido);
  const errorNombreAltaDuplicado = Boolean(nombre.trim() && nombreDuplicado);
  const errorFechasAltaRango = Boolean(fechaInicio && fechaFin && fechaFin < fechaInicio);
  const errorGruposAltaFormato = Boolean(grupos.trim() && !gruposValidos);
  const errorGruposAltaDuplicados = gruposDuplicados;
  const errorNombreEdicionFormato = Boolean(edicionNombre.trim() && !nombreEdicionValido);
  const errorFechasEdicionRango = Boolean(edicionFechaInicio && edicionFechaFin && edicionFechaFin < edicionFechaInicio);
  const errorGruposEdicionFormato = Boolean(edicionGrupos.trim() && !gruposEdicionValidos);

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
  const resumenMateriasDisponible = periodos.length > 0 || (!cargandoMaterias && !errorMaterias);

  function informarErrorDeOperacion(error: unknown, fallback: string) {
    setMensaje(mensajeDeError(error, fallback));
    setMensajeEsError(true);
    const accionSesion = accionToastSesionParaError(error, 'docente');
    if (accionSesion) {
      emitToast({
        level: 'warn',
        title: 'Renueva tu sesión docente',
        message: 'El detalle está en Materias. Cierra sesión y vuelve a entrar para renovar el acceso.',
        action: accionSesion
      });
    }
  }

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
      setMensajeEsError(false);
      const respuesta = await enviarConPermiso<{ periodo?: { _id?: string; id?: string } }>(
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
      const periodoId = String(respuesta.periodo?._id || respuesta.periodo?.id || '').trim();
      let falloPortada = false;
      if (archivoPortada && periodoId) {
        try {
          const formData = new FormData();
          formData.append('archivo', archivoPortada);
          await clienteApi.actualizarFormData(`/periodos/${encodeURIComponent(periodoId)}/portada`, formData);
          setArchivoPortada(null);
          setPortadaPendienteId(null);
        } catch {
          falloPortada = true;
          setPortadaPendienteId(periodoId);
        }
      } else {
        setArchivoPortada(null);
        setPortadaPendienteId(null);
      }
      const textoResultado = falloPortada
        ? 'Materia creada; no se pudo guardar la portada. Puedes reintentar sin crear otra materia.'
        : 'Materia creada';
      setMensaje(textoResultado);
      setMensajeEsError(falloPortada);
      registrarAccionDocente('crear_periodo', true, Date.now() - inicio);
      setNombre('');
      setFechaInicio('');
      setFechaFin('');
      setGrupos('');
      setErrorPortadaAlta('');
      onRefrescar();
    } catch (error) {
      informarErrorDeOperacion(error, 'No se pudo registrar la materia');
      registrarAccionDocente('crear_periodo', false);
    } finally {
      setCreando(false);
    }
  }

  async function reintentarPortada() {
    if (!portadaPendienteId || !archivoPortada || !puedeGestionar) return;
    try {
      const formData = new FormData();
      formData.append('archivo', archivoPortada);
      await clienteApi.actualizarFormData(`/periodos/${encodeURIComponent(portadaPendienteId)}/portada`, formData);
      setArchivoPortada(null);
      setPortadaPendienteId(null);
      setMensaje('Portada guardada');
      setMensajeEsError(false);
      onRefrescar();
    } catch (error) {
      const texto = mensajeDeError(error, 'No se pudo guardar la portada');
      setMensaje(`Materia creada. ${texto} Puedes reintentar sin crear otra materia.`);
      setMensajeEsError(true);
    }
  }

  function iniciarEdicion(periodo: Periodo, activadaConTeclado = false) {
    focoAccionEdicionIdRef.current = periodo._id;
    enfocarFormularioEdicionRef.current = activadaConTeclado;
    setEditandoId(periodo._id);
    setAccionesAbiertasId(periodo._id);
    setEdicionNombre(periodo.nombre || '');
    setEdicionFechaInicio(formatearFechaInput(periodo.fechaInicio));
    setEdicionFechaFin(formatearFechaInput(periodo.fechaFin));
    setEdicionGrupos(Array.isArray(periodo.grupos) ? periodo.grupos.join(', ') : '');
    setMensaje('');
    setMensajeEsError(false);
    registrarAccionDocente('iniciar_edicion_periodo', true);
  }

  function cancelarEdicion(notificarCancelacion = false) {
    focoAccionEdicionIdRef.current = editandoId;
    setEditandoId(null);
    setAccionesAbiertasId(null);
    setEdicionNombre('');
    setEdicionFechaInicio('');
    setEdicionFechaFin('');
    setEdicionGrupos('');
    if (notificarCancelacion) {
      emitToast({
        id: 'materias:edicion',
        level: 'info',
        title: 'Edición cancelada',
        message: 'No se guardaron cambios.',
        durationMs: 3000
      });
    }
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
      const nombreMateriaEditada = normalizarTextoCorto(edicionNombre);
      setGuardandoEdicionId(periodo._id);
      setMensaje('');
      setMensajeEsError(false);
      await enviarConPermiso(
        'periodos:gestionar',
        `/periodos/${periodo._id}`,
        {
          nombre: nombreMateriaEditada,
          fechaInicio: edicionFechaInicio,
          fechaFin: edicionFechaFin,
          grupos: gruposEdicionNormalizados
        },
        'No tienes permiso para editar materias.'
      );
      setMensaje(`Cambios guardados en «${nombreMateriaEditada}».`);
      setMensajeEsError(false);
      registrarAccionDocente('actualizar_periodo', true, Date.now() - inicio);
      cancelarEdicion();
      onRefrescar();
    } catch (error) {
      informarErrorDeOperacion(error, 'No se pudo actualizar la materia');
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
    setMensaje('');
    setMensajeEsError(false);
    const confirmado = await confirm({
      title: 'Archivar materia',
      message: `La materia "${nombreMateriaVisible(periodo)}" dejará de mostrarse en la lista activa.`,
      details: ['Los datos se conservarán.', 'Seguirá disponible en “Materias archivadas”.'],
      confirmLabel: 'Sí, archivar',
      tone: 'warning'
    });
    if (!confirmado) return;

    try {
      const inicio = Date.now();
      setArchivandoId(periodo._id);
      setMensaje('');
      setMensajeEsError(false);
      await enviarConPermiso(
        'periodos:archivar',
        `/periodos/${periodo._id}/archivar`,
        {},
        'No tienes permiso para archivar materias.'
      );
      setMensaje('Materia archivada');
      setMensajeEsError(false);
      registrarAccionDocente('archivar_periodo', true, Date.now() - inicio);
      onRefrescar();
    } catch (error) {
      informarErrorDeOperacion(error, 'No se pudo archivar la materia');
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
      message: `Se eliminará "${nombreMateriaVisible(periodo)}" con su información relacionada.`,
      details: ['Se borrarán alumnos, banco, plantillas y exámenes asociados.', 'No uses esta acción en operación normal.'],
      confirmLabel: 'Sí, eliminar materia',
      tone: 'danger'
    });
    if (!confirmado) return;

    try {
      const inicio = Date.now();
      setEliminandoId(periodo._id);
      setMensaje('');
      setMensajeEsError(false);
      await enviarConPermiso(
        'periodos:eliminar_dev',
        `/periodos/${periodo._id}/eliminar`,
        {},
        'No tienes permiso para eliminar materias en desarrollo.'
      );
      setMensaje('Materia eliminada');
      setMensajeEsError(false);
      registrarAccionDocente('eliminar_periodo', true, Date.now() - inicio);
      await Promise.resolve().then(() => onRefrescar());
    } catch (error) {
      informarErrorDeOperacion(error, 'No se pudo eliminar la materia');
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

  function abrirRegistroMateria() {
    setRegistroMateriaAbierto(true);
  }

  return (
    <div className="panel materias-panel anim-fade-in">
      {/* Cabecera Principal con Mini-KPIs integrados */}
      <div className="materias-panel__head">
        <div className="materias-panel__lead">
          <div className="icono-seccion-orb materias-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <IconoLucide icon={LibraryBig} size={28} />
          </div>
          <div className="materias-panel__text-block">
            <div className="materias-panel__meta-row">
              <span className="materias-status-pill">
                <span>Ciclo Académico</span>
              </span>
              <span className="materias-counter-tag">
                {resumenMateriasDisponible
                  ? `${periodos.length} ${periodos.length === 1 ? 'materia registrada' : 'materias registradas'}`
                  : cargandoMaterias ? 'Cargando catálogo…' : 'Catálogo no disponible'}
              </span>
            </div>
            <h2 className="materias-panel__title">Materias</h2>
            <p className="nota">Administra tus asignaturas activas, fechas de curso y asignación de grupos.</p>
          </div>
        </div>

        <div className="materias-header-actions">
          <Boton
            type="button"
            className="materias-header-primary"
            icono={<Icono nombre="nuevo" />}
            onClick={abrirRegistroMateria}
            data-tooltip="Abrir el formulario para registrar una materia"
          >
            Registrar materia
          </Boton>

          <div className="materias-header-kpis" role="group" aria-label="Resumen de materias">
          <div className="materia-mini-kpi materia-mini-kpi--active anim-kpi-hover" data-tooltip="Total de materias o cursos activos registrados">
            <span className="materia-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={BookOpenText} size={16} />
            </span>
            <span className="materia-mini-kpi__num">{resumenMateriasDisponible ? resumenMaterias.totalMaterias : '—'}</span>
            <span className="materia-mini-kpi__lbl">
              {resumenMateriasDisponible && resumenMaterias.totalMaterias === 1 ? 'Materia' : 'Materias'}
            </span>
          </div>

          <div className="materia-mini-kpi materia-mini-kpi--groups anim-kpi-hover" data-tooltip="Total de grupos académicos asignados">
            <span className="materia-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={Tags} size={16} />
            </span>
            <span className="materia-mini-kpi__num">{resumenMateriasDisponible ? resumenMaterias.totalGrupos : '—'}</span>
            <span className="materia-mini-kpi__lbl">
              {resumenMateriasDisponible && resumenMaterias.totalGrupos === 1 ? 'Grupo' : 'Grupos'}
            </span>
          </div>

          <div className="materia-mini-kpi materia-mini-kpi--closing anim-kpi-hover" data-tooltip="Materias cuya fecha de término vence en los próximos 14 días">
            <span className="materia-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={Clock3} size={16} />
            </span>
            <span className="materia-mini-kpi__num">{resumenMateriasDisponible ? resumenMaterias.proximasAFinalizar : '—'}</span>
            <span className="materia-mini-kpi__lbl">Por cerrar</span>
          </div>

          <Boton
            variante="secundario"
            type="button"
            onClick={onVerArchivadas}
            data-tooltip="Consultar materias y cursos finalizados o archivados"
            icono={
              <IconoLucide icon={Archive} size={15} />
            }
          >
            Archivadas
          </Boton>
          </div>
        </div>
      </div>

      {/* Guía Rápida Bento Unificada (Sin acordeones redundantes) */}
      <GuiaMateriaVisual />

      {/* Formulario Estructurado en 2 Filas Claras Sin Solapamientos */}
      <section className={`ui-card ui-card--form materias-form materias-form--glass materias-form--panoramico anim-form-card${registroMateriaAbierto ? ' materias-form--open' : ' materias-form--collapsed'}`}>
        <div className="materias-form__header">
          <div className="materias-form__header-copy">
            <h3 id="nueva-materia-titulo" className="materias-form__title">Nueva materia</h3>
            <p className="materias-form__subtitle" id="nueva-materia-instrucciones">
              El nombre y las fechas son obligatorios. Los grupos y la portada son opcionales. La fecha de término debe ser igual o posterior a la de inicio.
            </p>
          </div>
          <button
            type="button"
            className="materia-actions-toggle materias-form__toggle"
            aria-expanded={registroMateriaAbierto}
            aria-controls="registro-nueva-materia"
            onClick={() => setRegistroMateriaAbierto((abierto) => !abierto)}
          >
            <span className="materia-actions-toggle__label">
              <span className="materia-actions-toggle__eyebrow">ALTA DE MATERIA</span>
              <span>{registroMateriaAbierto ? 'Ocultar formulario' : 'Mostrar formulario'}</span>
            </span>
            <span className="materia-actions-toggle__icon" aria-hidden="true">
              <Icono nombre="chevron" />
            </span>
          </button>
        </div>

        <form
          id="registro-nueva-materia"
          className="materias-form__body"
          hidden={!registroMateriaAbierto}
          aria-labelledby="nueva-materia-titulo"
          aria-describedby="nueva-materia-instrucciones"
          onSubmit={(event) => {
            event.preventDefault();
            void crearPeriodo();
          }}
        >
        <div className="materias-form__fields">
          {/* Fila 1: Asignatura y Grupos */}
          <div className="materias-form__row materias-form__row--top">
            <label className="campo campo--materia">
              <span>Nombre de la materia</span>
              <div className="auth-input-box auth-input-box--book auth-input-box--animated">
                <IconoCampo nombre="book" />
                <input
                  type="text"
                  autoComplete="off"
                  required
                  aria-invalid={errorNombreAltaFormato || errorNombreAltaDuplicado || undefined}
                  aria-describedby={[
                    'nueva-materia-instrucciones',
                    errorNombreAltaFormato && 'error-nombre-alta-formato',
                    errorNombreAltaDuplicado && 'error-nombre-alta-duplicado'
                  ].filter(Boolean).join(' ')}
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  disabled={bloqueoEdicion}
                  placeholder="Ej. Álgebra"
                  data-tooltip="Escribe el nombre oficial de la asignatura o periodo académico"
                />
              </div>
            </label>

            <label className="campo campo--grupos">
              <span id="grupos-materia-label">Grupos asignados (opcional)</span>
              <div className="auth-input-box auth-input-box--tags auth-input-box--animated">
                <IconoCampo nombre="tags" />
                <input
                  type="text"
                  autoComplete="off"
                  value={grupos}
                  onChange={(event) => setGrupos(event.target.value)}
                  disabled={bloqueoEdicion}
                  placeholder="Ej. 1A, 1B, 2A"
                  aria-labelledby="grupos-materia-label"
                  aria-invalid={errorGruposAltaFormato || errorGruposAltaDuplicados || undefined}
                  aria-describedby={[
                    'grupos-materia-ayuda',
                    errorGruposAltaFormato && 'error-grupos-alta-formato',
                    errorGruposAltaDuplicados && 'error-grupos-alta-duplicados'
                  ].filter(Boolean).join(' ')}
                />
              </div>
              <span className="ayuda" id="grupos-materia-ayuda">Separa varios grupos con comas.</span>
            </label>
          </div>

          <div className="materia-portada-editor materia-portada-editor--nueva">
            <label className="campo">
              <span id="portada-nueva-materia-label">Portada (opcional)</span>
              <span className="materia-portada-editor__selector">
                <span className="materia-portada-editor__selector-accion" aria-hidden="true">Elegir imagen</span>
                <span className="materia-portada-editor__selector-estado" id="portada-nueva-materia-estado" role="status" aria-live="polite" aria-atomic="true">
                  {archivoPortada?.name || 'Ningún archivo seleccionado'}
                </span>
                <input
                  id="portada-nueva-materia"
                  className="materia-portada-editor__selector-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  aria-labelledby="portada-nueva-materia-label"
                  aria-invalid={errorPortadaAlta ? true : undefined}
                  aria-describedby={errorPortadaAlta
                    ? `portada-nueva-materia-ayuda error-portada-nueva-materia`
                    : 'portada-nueva-materia-ayuda'}
                  onChange={(event) => {
                    const input = event.currentTarget;
                    const file = input.files?.[0] ?? null;
                    setPortadaPendienteId(null);
                    setErrorPortadaAlta('');
                    if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) {
                      input.value = '';
                      setArchivoPortada(null);
                      setErrorPortadaAlta('Selecciona una imagen JPG/JPEG, PNG o WebP.');
                      setMensaje('');
                      setMensajeEsError(false);
                    } else if (file && file.size > 20 * 1024 * 1024) {
                      input.value = '';
                      setArchivoPortada(null);
                      setErrorPortadaAlta('La imagen no debe superar 20 MiB.');
                      setMensaje('');
                      setMensajeEsError(false);
                    } else {
                      setArchivoPortada(file);
                      setMensaje('');
                      setMensajeEsError(false);
                    }
                  }}
                  disabled={bloqueoEdicion || creando}
                />
              </span>
            </label>
            {vistaPreviaPortada && <img className="materia-portada-editor__preview" src={vistaPreviaPortada} alt="Vista previa de la portada seleccionada" />}
            <p className="materia-portada-editor__ayuda" id="portada-nueva-materia-ayuda">JPG/JPEG, PNG o WebP; máximo 20 MiB. Si no seleccionas imagen, se usará la portada genérica.</p>
            {errorPortadaAlta && <p className="ayuda error" id="error-portada-nueva-materia" role="alert">{errorPortadaAlta}</p>}
          </div>

          {/* Fila 2: Fechas y Botón de Creación */}
          <div className="materias-form__row materias-form__row--bottom">
            <label className="campo campo--fecha">
              <span>Fecha de inicio</span>
              <input
                type="date"
                required
                aria-invalid={errorFechasAltaRango || undefined}
                aria-describedby={[
                  'nueva-materia-instrucciones',
                  errorFechasAltaRango && 'error-fechas-alta-rango'
                ].filter(Boolean).join(' ')}
                value={fechaInicio}
                onChange={(event) => setFechaInicio(event.target.value)}
                disabled={bloqueoEdicion}
                data-tooltip="Fecha oficial en que da inicio el curso lectivo"
              />
            </label>

            <label className="campo campo--fecha">
              <span>Fecha de término</span>
              <input
                type="date"
                required
                aria-invalid={errorFechasAltaRango || undefined}
                aria-describedby={[
                  'nueva-materia-instrucciones',
                  errorFechasAltaRango && 'error-fechas-alta-rango'
                ].filter(Boolean).join(' ')}
                min={fechaInicio || undefined}
                value={fechaFin}
                onChange={(event) => setFechaFin(event.target.value)}
                disabled={bloqueoEdicion}
                data-tooltip="Fecha límite programada para la conclusión del curso"
              />
            </label>

            <div className="materias-form__cta-col">
              {mostrarAyudaCrear && (
                <span className="ayuda materias-form__cta-help" id="materias-crear-ayuda">
                  Completa los campos obligatorios y corrige los errores indicados para habilitar la creación.
                </span>
              )}
              <Boton
                type="submit"
                className="boton--crear-materia"
                icono={<Icono nombre="nuevo" />}
                cargando={creando}
                disabled={!puedeCrear || bloqueoEdicion}
                aria-describedby={mostrarAyudaCrear ? 'materias-crear-ayuda' : undefined}
                data-tooltip="Crear y habilitar esta materia para inscribir alumnos y diseñar exámenes"
              >
                {creando ? 'Creando…' : 'Crear materia'}
              </Boton>
            </div>
          </div>
        </div>

        {/* Feedback de validación */}
        <div className="materias-form__feedback-area">
          {errorNombreAltaFormato && (
            <InlineMensaje tipo="warning"><span id="error-nombre-alta-formato">El nombre debe tener entre 3 y 80 caracteres para poder crear la materia.</span></InlineMensaje>
          )}
          {errorNombreAltaDuplicado && (
            <InlineMensaje tipo="error"><span id="error-nombre-alta-duplicado">Ya existe una materia con ese nombre. Cambia el nombre para crearla.</span></InlineMensaje>
          )}
          {errorFechasAltaRango && (
            <InlineMensaje tipo="error"><span id="error-fechas-alta-rango">La fecha de término debe ser igual o posterior a la fecha de inicio.</span></InlineMensaje>
          )}
          {errorGruposAltaFormato && (
            <InlineMensaje tipo="warning"><span id="error-grupos-alta-formato">Revisa grupos: máximo 50 y hasta 40 caracteres por grupo para poder crear la materia.</span></InlineMensaje>
          )}
          {errorGruposAltaDuplicados && <InlineMensaje tipo="warning"><span id="error-grupos-alta-duplicados">Hay grupos repetidos; corrígelo para poder crear la materia.</span></InlineMensaje>}
          {portadaPendienteId && archivoPortada && (
            <Boton type="button" variante="secundario" onClick={reintentarPortada} disabled={!puedeGestionar}>
              Reintentar portada
            </Boton>
          )}
        </div>
        </form>
      </section>
        {mensaje && (
          <p
            className={mensajeEsError ? 'mensaje error anim-fade-in' : 'mensaje ok anim-fade-in'}
            role={mensajeEsError ? 'alert' : 'status'}
            aria-live={mensajeEsError ? 'assertive' : 'polite'}
          >
            {mensaje}
          </p>
        )}

      {/* Listado de Materias Activas a Ancho Completo */}
      <div className="materias-seccion-activas anim-fade-in">
        <div className="materias-seccion-activas__head">
          <h3 className="materias-section-title">
            Materias activas{resumenMateriasDisponible ? ` (${periodos.length})` : ''}
          </h3>
        </div>
        {errorMaterias && (
          <div className="mensaje error mt-10" role="alert">
            <p>No se pudo actualizar el catálogo de materias. Revisa la conexión e inténtalo de nuevo.</p>
            <Boton type="button" variante="secundario" tamano="sm" disabled={cargandoMaterias} cargando={cargandoMaterias} onClick={reintentarCargaMaterias}>
              Reintentar carga de materias
            </Boton>
          </div>
        )}
        {cargandoMaterias && (
          <div className="ayuda" role="status">
            {periodos.length === 0 ? 'Cargando materias…' : 'Actualizando materias…'}
          </div>
        )}
        {periodos.length === 0 && !cargandoMaterias && !errorMaterias ? (
          <div className="ui-card ui-card--empty empty-state-card anim-fade-in">
            <div className="empty-state-card__icon anim-icon-pulse" aria-hidden="true">
              <Icono nombre="periodos" size={28} />
            </div>
            <h4>Aún no hay materias</h4>
            <p>Selecciona «Registrar materia» para abrir el formulario y empezar a organizar sus grupos, alumnos y calificaciones.</p>
            <div className="empty-state-steps" aria-hidden="true">
              <div className="empty-step">
                <span className="empty-step__num">1</span>
                <span>Registra tu materia y fechas</span>
              </div>
              <div className="empty-step__arrow"><Icono nombre="chevron" size={14} /></div>
              <div className="empty-step">
                <span className="empty-step__num">2</span>
                <span>Inscribe a tus alumnos</span>
              </div>
              <div className="empty-step__arrow"><Icono nombre="chevron" size={14} /></div>
              <div className="empty-step">
                <span className="empty-step__num">3</span>
                <span>Califica exámenes con OMR</span>
              </div>
            </div>
          </div>
        ) : periodos.length > 0 ? (
          <ul className="lista lista-items materias-lista">
            {periodos.map((periodo) => {
              const progreso = calcularProgresoPeriodo(periodo.fechaInicio, periodo.fechaFin);
              const alumnosMateria = alumnosPorPeriodo.get(periodo._id) ?? [];
              const alumnosVistaPrevia = alumnosMateria.slice(0, 3);
              const totalAlumnosRestantes = alumnosMateria.length - alumnosVistaPrevia.length;
              const idEdicion = encodeURIComponent(periodo._id);
              const idErrorNombreFormato = `error-nombre-edicion-${idEdicion}-formato`;
              const idErrorNombreDuplicado = `error-nombre-edicion-${idEdicion}-duplicado`;
              const idErrorFechasRango = `error-fechas-edicion-${idEdicion}-rango`;
              const idErrorGruposFormato = `error-grupos-edicion-${idEdicion}-formato`;
              const idErrorGruposDuplicados = `error-grupos-edicion-${idEdicion}-duplicados`;
              const formEdicionId = `editar-materia-${idEdicion}`;
              return (
                <li key={periodo._id} className="anim-slide-up">
                  <article
                    className="ui-card ui-card--interactive item-glass materias-lista__item materias-lista__item--navigable anim-card-hover"
                    data-tooltip="Abrir Alumnos con esta materia y grupo seleccionado"
                  >
                    <div className="item-row">
                      <div>
                        {editandoId === periodo._id ? (
                          <form
                            id={formEdicionId}
                            className="lista materias-edicion anim-fade-in"
                            tabIndex={-1}
                            aria-label={`Editar materia ${nombreMateriaVisible(periodo)}`}
                            onSubmit={(event) => {
                              event.preventDefault();
                              void guardarEdicion(periodo);
                            }}
                          >
                            <p className="nota" id={`edicion-materia-instrucciones-${periodo._id}`} tabIndex={-1}>
                              El nombre y las fechas son obligatorios. Los grupos son opcionales. La fecha de término debe ser igual o posterior a la de inicio.
                            </p>
                            <label className="campo">
                              <span>Nombre de la materia</span>
                              <div className="auth-input-box auth-input-box--book auth-input-box--animated">
                                <IconoCampo nombre="book" />
                                <input
                                  id={`nombre-materia-edicion-${idEdicion}`}
                                  type="text"
                                  autoComplete="off"
                                  required
                                  aria-invalid={errorNombreEdicionFormato || nombreEdicionDuplicado || undefined}
                                  aria-describedby={[
                                    `edicion-materia-instrucciones-${periodo._id}`,
                                    errorNombreEdicionFormato && idErrorNombreFormato,
                                    nombreEdicionDuplicado && idErrorNombreDuplicado
                                  ].filter(Boolean).join(' ')}
                                  value={edicionNombre}
                                  onChange={(event) => setEdicionNombre(event.target.value)}
                                  disabled={!puedeGestionar || guardandoEdicionId === periodo._id}
                                />
                              </div>
                            </label>
                            {errorNombreEdicionFormato && (
                              <InlineMensaje tipo="warning"><span id={idErrorNombreFormato}>El nombre debe tener entre 3 y 80 caracteres.</span></InlineMensaje>
                            )}
                            {nombreEdicionDuplicado && (
                              <InlineMensaje tipo="error"><span id={idErrorNombreDuplicado}>Ya existe una materia activa con ese nombre.</span></InlineMensaje>
                            )}
                            <div className="materias-fechas-grid">
                              <label className="campo">
                                <span>Fecha de inicio</span>
                                <input
                                  type="date"
                                  required
                                  aria-invalid={errorFechasEdicionRango || undefined}
                                  aria-describedby={[
                                    `edicion-materia-instrucciones-${periodo._id}`,
                                    errorFechasEdicionRango && idErrorFechasRango
                                  ].filter(Boolean).join(' ')}
                                  value={edicionFechaInicio}
                                  onChange={(event) => setEdicionFechaInicio(event.target.value)}
                                  disabled={!puedeGestionar || guardandoEdicionId === periodo._id}
                                />
                              </label>
                              <label className="campo">
                                <span>Fecha de término</span>
                                <input
                                  type="date"
                                  required
                                  aria-invalid={errorFechasEdicionRango || undefined}
                                  aria-describedby={[
                                    `edicion-materia-instrucciones-${periodo._id}`,
                                    errorFechasEdicionRango && idErrorFechasRango
                                  ].filter(Boolean).join(' ')}
                                  min={edicionFechaInicio || undefined}
                                  value={edicionFechaFin}
                                  onChange={(event) => setEdicionFechaFin(event.target.value)}
                                  disabled={!puedeGestionar || guardandoEdicionId === periodo._id}
                                />
                              </label>
                            </div>
                            {errorFechasEdicionRango && (
                              <InlineMensaje tipo="error"><span id={idErrorFechasRango}>La fecha de término debe ser igual o posterior a la fecha de inicio.</span></InlineMensaje>
                            )}
                            <div className="campo">
                              <label htmlFor={`grupos-materia-edicion-${periodo._id}`}>Grupos asignados (opcional)</label>
                              <div className="auth-input-box auth-input-box--tags auth-input-box--animated">
                                <IconoCampo nombre="tags" />
                                <input
                                  id={`grupos-materia-edicion-${periodo._id}`}
                                  type="text"
                                  autoComplete="off"
                                  value={edicionGrupos}
                                  aria-invalid={errorGruposEdicionFormato || gruposEdicionDuplicados || undefined}
                                  aria-describedby={[
                                    `grupos-edicion-ayuda-${periodo._id}`,
                                    errorGruposEdicionFormato && idErrorGruposFormato,
                                    gruposEdicionDuplicados && idErrorGruposDuplicados
                                  ].filter(Boolean).join(' ') || undefined}
                                  onChange={(event) => setEdicionGrupos(event.target.value)}
                                  disabled={!puedeGestionar || guardandoEdicionId === periodo._id}
                                />
                              </div>
                              <span className="ayuda" id={`grupos-edicion-ayuda-${periodo._id}`}>Separa varios grupos con comas; puedes dejarlo vacío.</span>
                            </div>
                            {errorGruposEdicionFormato && (
                              <InlineMensaje tipo="warning"><span id={idErrorGruposFormato}>Revisa grupos: máximo 50 y hasta 40 caracteres por grupo.</span></InlineMensaje>
                            )}
                            {gruposEdicionDuplicados && <InlineMensaje tipo="warning"><span id={idErrorGruposDuplicados}>Hay grupos repetidos.</span></InlineMensaje>}
                          </form>
                        ) : (
                          <button
                            type="button"
                            className="materia-card-surface"
                            onClick={() => onAbrirGrupo?.(periodo._id, periodo.grupos?.[0])}
                            aria-label={`Abrir grupo ${periodo.grupos?.[0] || 'general'} de ${nombreMateriaVisible(periodo)}; ${alumnosMateria.length} ${alumnosMateria.length === 1 ? 'alumno' : 'alumnos'}`}
                            aria-describedby={`materia-card-alumnos-${idEdicion}`}
                          >
                            <div className="materia-card-header">
                              <div className="materia-title-group">
                                <ImagenPortadaMateria periodoId={periodo._id} tienePortada={periodo.tienePortada} />
                                <div>
                                  <div className="item-title">
                                    {nombreMateriaVisible(periodo)}
                                  </div>
                                  <span className={`chip chip--sm chip--${progreso.estado} anim-badge-in`}>
                                    {progreso.etiquetaEstado}
                                  </span>
                                  <progress
                                    className="materia-progress-bar"
                                    max={100}
                                    value={progreso.porcentaje}
                                    aria-label={`Tiempo transcurrido del periodo de ${nombreMateriaVisible(periodo)}`}
                                    aria-valuetext={`${progreso.porcentaje}% del periodo transcurrido`}
                                  />
                                  <span className="materia-progress-caption">Tiempo del periodo</span>
                                </div>
                              </div>
                              <div className="materia-progress-ring" aria-hidden="true">
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
                              
                              <span className="materia-meta-tag materia-meta-tag--inicio">
                                <span className="materia-meta-lbl">Inicio:</span>{' '}
                                <span className="materia-meta-value">{formatearFecha(periodo.fechaInicio)}</span>
                              </span>
                              <span className="materia-meta-tag materia-meta-tag--fin">
                                <span className="materia-meta-lbl">Fin:</span>{' '}
                                <span className="materia-meta-value">{formatearFecha(periodo.fechaFin)}</span>
                              </span>
                              <span className="materia-meta-tag materia-meta-tag--grupos">
                                <span className="materia-meta-lbl">Grupos:</span>{' '}
                                <span className="materia-meta-value materia-grupos-badge">
                                  {Array.isArray(periodo.grupos) && periodo.grupos.length > 0 ? periodo.grupos.join(', ') : '-'}
                                </span>
                              </span>
                            </div>
                            <div id={`materia-card-alumnos-${idEdicion}`} className="materia-card-alumnos">
                              <div className="materia-card-alumnos__header">
                                <span className="materia-meta-lbl">Alumnos</span>
                                <strong>{alumnosMateria.length}</strong>
                              </div>
                              {alumnosMateria.length > 0 ? (
                                <div className="materia-card-alumnos__list">
                                  {alumnosVistaPrevia.map((alumno) => (
                                    <span
                                      key={alumno._id}
                                      className="materia-alumno-chip"
                                      title={`${alumno.nombreCompleto}${alumno.grupo ? ` · Grupo ${alumno.grupo}` : ''}`}
                                    >
                                      <span className="materia-alumno-chip__name">{alumno.nombreCompleto}</span>
                                      {alumno.grupo && <span className="materia-alumno-chip__group">{alumno.grupo}</span>}
                                    </span>
                                  ))}
                                  {totalAlumnosRestantes > 0 && (
                                    <span className="materia-alumno-chip materia-alumno-chip--resumen">
                                      +{totalAlumnosRestantes} {totalAlumnosRestantes === 1 ? 'alumno' : 'alumnos'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="materia-card-alumnos__empty">Sin alumnos registrados</span>
                              )}
                            </div>
                            <span className="materia-card-primary-action" aria-hidden="true">
                              <span className="materia-card-primary-action__copy">
                                <span className="materia-card-primary-action__eyebrow">Acceso principal</span>
                                <span>Abrir grupo</span>
                              </span>
                              <span className="materia-card-primary-action__icon" aria-hidden="true">
                                <Icono nombre="chevron" />
                              </span>
                            </span>
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        id={`acciones-toggle-materia-${idEdicion}`}
                        className="materia-actions-toggle"
                        aria-label={`${accionesAbiertasId === periodo._id ? 'Ocultar' : 'Mostrar'} acciones de materia ${nombreMateriaVisible(periodo)}`}
                        aria-expanded={accionesAbiertasId === periodo._id}
                        aria-controls={`acciones-materia-${periodo._id}`}
                        onClick={() => setAccionesAbiertasId((actual) => (actual === periodo._id ? null : periodo._id))}
                      >
                        <span className="materia-actions-toggle__label">
                          <span className="materia-actions-toggle__eyebrow">GESTIÓN DE MATERIA</span>
                          <span>{accionesAbiertasId === periodo._id ? 'Ocultar acciones' : 'Mostrar acciones'}</span>
                        </span>
                        <span className="materia-actions-toggle__icon" aria-hidden="true">
                          <Icono nombre="chevron" />
                        </span>
                      </button>
                      <div
                        id={`acciones-materia-${periodo._id}`}
                        className={`item-actions${accionesAbiertasId === periodo._id ? ' item-actions--open' : ''}`}
                        hidden={accionesAbiertasId !== periodo._id}
                      >
                        <GestionPortadaMateria
                          periodoId={periodo._id}
                          nombreMateria={nombreMateriaVisible(periodo)}
                          tienePortada={periodo.tienePortada}
                          onCambio={onRefrescar}
                          disabled={!puedeGestionar}
                        />
                        {editandoId === periodo._id ? (
                          <>
                            <Boton
                              type="submit"
                              form={formEdicionId}
                              aria-label={`Guardar cambios en materia ${nombreMateriaVisible(periodo)}`}
                              cargando={guardandoEdicionId === periodo._id}
                              disabled={!puedeGuardarEdicion || !puedeGestionar}
                              icono={<Icono nombre="ok" />}
                            >
                              Guardar cambios
                            </Boton>
                            <Boton
                              variante="secundario"
                              type="button"
                              aria-label={`Cancelar edición de materia ${nombreMateriaVisible(periodo)}`}
                              onClick={() => cancelarEdicion(true)}
                              disabled={guardandoEdicionId === periodo._id}
                            >
                              Cancelar
                            </Boton>
                          </>
                        ) : (
                          <>
                            <Boton
                              variante="secundario"
                              type="button"
                              aria-label={`Editar materia ${nombreMateriaVisible(periodo)}`}
                              onKeyDown={(event) => {
                                if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
                                event.preventDefault();
                                teclaAperturaEdicionRef.current = event.key;
                                ignorarClickActivacionTecladoRef.current = true;
                              }}
                              onKeyUp={(event) => {
                                if (teclaAperturaEdicionRef.current !== event.key) return;
                                event.preventDefault();
                                teclaAperturaEdicionRef.current = null;
                                iniciarEdicion(periodo, true);
                                window.setTimeout(() => { ignorarClickActivacionTecladoRef.current = false; }, 0);
                              }}
                              onBlur={() => { teclaAperturaEdicionRef.current = null; }}
                              onClick={(event) => {
                                if (event.detail === 0) {
                                  event.preventDefault();
                                  if (ignorarClickActivacionTecladoRef.current) return;
                                  iniciarEdicion(periodo);
                                  return;
                                }
                                iniciarEdicion(periodo);
                              }}
                              disabled={bloqueoEdicion}
                              icono={
                                <IconoLucide icon={Pencil} size={14} />
                              }
                            >
                              Editar
                            </Boton>
                            <Boton
                              variante="secundario"
                              type="button"
                              aria-label={`Archivar materia ${nombreMateriaVisible(periodo)}`}
                              cargando={archivandoId === periodo._id}
                              onClick={() => archivarMateria(periodo)}
                              disabled={!puedeArchivar}
                              icono={
                                <IconoLucide icon={Archive} size={14} />
                              }
                            >
                              Archivar
                            </Boton>
                            <Boton
                              variante="secundario"
                              type="button"
                              aria-label={`Descargar lista institucional XLSX de ${nombreMateriaVisible(periodo)}`}
                              onClick={() => descargarListaInstitucional(periodo, 'xlsx')}
                              icono={
                                <IconoLucide icon={FileSpreadsheet} size={14} />
                              }
                            >
                              Lista CUH XLSX
                            </Boton>
                            <Boton
                              variante="secundario"
                              type="button"
                              aria-label={`Descargar lista institucional PDF de ${nombreMateriaVisible(periodo)}`}
                              onClick={() => descargarListaInstitucional(periodo, 'pdf')}
                              icono={
                                <IconoLucide icon={FileText} size={14} />
                              }
                            >
                              Lista CUH PDF
                            </Boton>
                            {puedeEliminarMateriaDev && (
                              <Boton
                                variante="secundario"
                                type="button"
                                aria-label={`Eliminar materia ${nombreMateriaVisible(periodo)} (DEV)`}
                                cargando={eliminandoId === periodo._id}
                                onClick={() => void eliminarMateriaDev(periodo)}
                                disabled={!puedeEliminarMateriaDev}
                                icono={
                                  <IconoLucide icon={Trash2} size={14} />
                                }
                              >
                                Eliminar (DEV)
                              </Boton>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export function SeccionPeriodosArchivados({
  periodos,
  cargando = false,
  errorCarga = false,
  onReintentar,
  onVerActivas
}: {
  periodos: Periodo[];
  cargando?: boolean;
  errorCarga?: boolean;
  onReintentar?: () => void | Promise<void>;
  onVerActivas: () => void;
}) {
  const resumenArchivadasDisponible = periodos.length > 0 || (!cargando && !errorCarga);

  function formatearFechaHora(valor?: string) {
    if (!valor) return '-';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return String(valor);
    const fecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
    const hora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(d);
    return `${fecha}, ${hora}`;
  }

  return (
    <div className="panel materias-panel anim-fade-in">
      {/* Encabezado Integrado de Materias Archivadas */}
      <div className="materias-panel__head">
        <div className="materias-panel__lead">
          <div className="icono-seccion-orb materias-panel__icon-orb materias-panel__icon-orb--amber anim-icon-pulse" aria-hidden="true">
            <IconoLucide icon={Archive} size={28} />
          </div>
          <div className="materias-panel__text-block">
            <div className="materias-panel__meta-row">
              <span className="materias-status-pill materias-status-pill--amber">
                <span className="materias-pulse-dot materias-pulse-dot--amber" aria-hidden="true" />
                <span>Archivo Histórico</span>
              </span>
              <span className="materias-counter-tag">
                {resumenArchivadasDisponible
                  ? `${periodos.length} ${periodos.length === 1 ? 'materia archivada' : 'materias archivadas'}`
                  : cargando ? 'Cargando historial…' : 'Historial no disponible'}
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
              <IconoLucide icon={ArrowLeft} size={14} />
            }
          >
            Volver a materias activas
          </Boton>
        </div>
      </div>

      {/* Tarjeta Informativa Glassmorphism */}
      <div className="archivadas-info-card anim-fade-in" role="region" aria-label="Información sobre archivo de materias">
        <div className="archivadas-info-card__icon" aria-hidden="true">
          <IconoLucide icon={ShieldCheck} size={28} />
        </div>
        <div className="archivadas-info-card__text">
          <strong>¿Qué conserva el archivo?</strong>
          <p>
            Deja de aparecer en la lista de materias activas. Sus alumnos, reactivos, plantillas y calificaciones siguen disponibles para consulta o auditoría.
          </p>
        </div>
      </div>

      {/* Listado de Materias Archivadas */}
      <div className="materias-seccion-activas anim-fade-in">
        <div className="materias-seccion-activas__head">
          <h3 className="materias-section-title">
            Registro histórico{resumenArchivadasDisponible ? ` (${periodos.length})` : ''}
          </h3>
        </div>

        {errorCarga && (
          <div className="mensaje error mt-10" role="alert">
            <p>No se pudo actualizar el historial de materias. Revisa la conexión e inténtalo de nuevo.</p>
            {onReintentar && (
              <Boton
                type="button"
                variante="secundario"
                tamano="sm"
                disabled={cargando}
                cargando={cargando}
                onClick={() => void Promise.resolve(onReintentar()).catch(() => undefined)}
              >
                Reintentar carga del historial
              </Boton>
            )}
          </div>
        )}
        {cargando && (
          <div className="ayuda" role="status">
            {periodos.length === 0 ? 'Cargando historial de materias…' : 'Actualizando historial de materias…'}
          </div>
        )}
        {periodos.length === 0 && !cargando && !errorCarga ? (
          <div className="ui-card ui-card--empty empty-state-card anim-fade-in">
            <div className="empty-state-card__icon anim-icon-pulse">
              <IconoLucide icon={Archive} size={28} />
            </div>
            <h4>No hay materias archivadas</h4>
            <p>Cuando concluyas un periodo lectivo y lo archives desde la sección de materias activas, aparecerá aquí resguardado con todos sus datos y exámenes.</p>
          </div>
        ) : periodos.length > 0 ? (
          <ul className="lista lista-items materias-lista">
            {periodos.map((periodo) => (
              <li key={periodo._id} className="anim-slide-up">
                <div className="ui-card ui-card--interactive item-glass materias-lista__item anim-card-hover">
                  <div className="item-row">
                    <div>
                      <div className="materia-card-header">
                        <div>
                          <div className="item-title">
                            {nombreMateriaVisible(periodo)}
                          </div>
                          <span className="chip chip--sm chip--archivado anim-badge-in">Archivada</span>
                        </div>
                      </div>
                      <div className="item-meta materia-card-meta">
                        <span className="materia-meta-tag materia-meta-tag--creada">
                          <span className="materia-meta-lbl">Creada:</span>{' '}
                          <span className="materia-meta-value">{formatearFechaHora(periodo.createdAt)}</span>
                        </span>
                        <span className="materia-meta-tag materia-meta-tag--archivada">
                          <span className="materia-meta-lbl">Archivada:</span>{' '}
                          <span className="materia-meta-value">{formatearFechaHora(periodo.archivadoEn)}</span>
                        </span>
                      </div>
                      {periodo.resumenArchivado && (
                        <div className="archivadas-chips-row">
                          <span className="archivada-chip"><IconoLucide icon={Users} size={14} /> {periodo.resumenArchivado.alumnos ?? 0} alumnos</span>
                          <span className="archivada-chip"><IconoLucide icon={ListChecks} size={14} /> {periodo.resumenArchivado.bancoPreguntas ?? 0} reactivos</span>
                          <span className="archivada-chip"><IconoLucide icon={FileText} size={14} /> {periodo.resumenArchivado.plantillas ?? 0} plantillas</span>
                          <span className="archivada-chip"><IconoLucide icon={Award} size={14} /> {periodo.resumenArchivado.calificaciones ?? 0} calificaciones</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
