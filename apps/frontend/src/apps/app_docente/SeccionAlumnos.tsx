/**
 * SeccionAlumnos
 *
 * Responsabilidad: Seccion funcional del shell docente con diseno Bento Glassmorphic, iconografia rica y animaciones fluidas.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { IconoCampo } from '../../ui/IconoLucide';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import {
  ArrowRight,
  CircleAlert,
  Check,
  IconoLucide,
  Pencil,
  Search,
  Tags,
  Trash2,
  UsersRound
} from '../../ui/iconosCatalogo';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { GuiaAlumnosVisual } from './GuiaAlumnosVisual';
import { registrarAccionDocente } from './telemetriaDocente';
import type { Alumno, EnviarConPermiso, Periodo, PermisosUI } from './tipos';
import { clienteApi } from './clienteApiDocente';
import {
  esMensajeError,
  etiquetaMateriaParaSelector,
  fechaMateriaVisible,
  mensajeDeError,
  nombreMateriaVisible,
  obtenerInicialesAvatarAlumno
} from './utilidades';

function normalizarBusquedaAlumno(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .toLocaleLowerCase('es-MX')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export function SeccionAlumnos({
  alumnos,
  cargandoAlumnos = false,
  errorCargaAlumnos = false,
  onReintentarCargaAlumnos,
  cargandoMaterias = false,
  errorMaterias = false,
  onReintentarMaterias,
  periodosActivos,
  periodosTodos,
  destinoInicial,
  onRefrescar,
  permisos,
  puedeEliminarAlumnoDev,
  enviarConPermiso,
  avisarSinPermiso
}: {
  alumnos: Alumno[];
  cargandoAlumnos?: boolean;
  errorCargaAlumnos?: boolean;
  onReintentarCargaAlumnos?: () => void;
  cargandoMaterias?: boolean;
  errorMaterias?: boolean;
  onReintentarMaterias?: () => void;
  periodosActivos: Periodo[];
  periodosTodos: Periodo[];
  destinoInicial?: { periodoId: string; grupo?: string } | null;
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
  const [estadoResumenAsistencias, setEstadoResumenAsistencias] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [reintentoResumenAsistencias, setReintentoResumenAsistencias] = useState(0);
  const [grupoArchivadoSeleccionado, setGrupoArchivadoSeleccionado] = useState('');
  const [reinscribiendoGrupo, setReinscribiendoGrupo] = useState(false);
  const [preferenciaFormularioAlta, setPreferenciaFormularioAlta] = useState<boolean | null>(null);
  const [viewportMovil, setViewportMovil] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 720);

  const formularioRef = useRef<HTMLFormElement>(null);
  const matriculaInputRef = useRef<HTMLInputElement>(null);
  const botonEditarInvocadorRef = useRef<HTMLButtonElement | null>(null);
  const encabezadoListaRef = useRef<HTMLHeadingElement>(null);
  const idEditandoAnteriorRef = useRef<string | null>(null);
  const focoEdicionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (focoEdicionTimerRef.current !== null) clearTimeout(focoEdicionTimerRef.current);
  }, []);

  useEffect(() => {
    const actualizarViewport = () => setViewportMovil(window.innerWidth <= 720);
    window.addEventListener('resize', actualizarViewport);
    return () => window.removeEventListener('resize', actualizarViewport);
  }, []);

  useEffect(() => {
    if (idEditandoAnteriorRef.current && !editandoId) {
      if (botonEditarInvocadorRef.current?.isConnected) botonEditarInvocadorRef.current.focus();
      else encabezadoListaRef.current?.focus();
      botonEditarInvocadorRef.current = null;
    }
    idEditandoAnteriorRef.current = editandoId;
  }, [editandoId]);

  useEffect(() => {
    if (!periodoIdLista) {
      setResumenAsistencias([]);
      setEstadoResumenAsistencias('idle');
      return;
    }

    let vigente = true;
    setResumenAsistencias([]);
    setEstadoResumenAsistencias('loading');
    clienteApi.obtener<{ resumen: any[] }>(`/asistencias/resumen?periodoId=${periodoIdLista}`)
      .then((res: any) => {
        if (!vigente) return;
        setResumenAsistencias(res?.resumen || []);
        setEstadoResumenAsistencias('ready');
      })
      .catch(() => {
        if (!vigente) return;
        setResumenAsistencias([]);
        setEstadoResumenAsistencias('error');
      });

    return () => {
      vigente = false;
    };
  }, [periodoIdLista, reintentoResumenAsistencias]);

  const confirm = useConfirmDialog();
  const puedeGestionar = permisos.alumnos.gestionar;
  const bloqueoEdicion = !puedeGestionar;
  const formularioAltaAbierto = Boolean(editandoId) || (preferenciaFormularioAlta ?? (alumnos.length === 0 || !viewportMovil));

  function normalizarMatricula(valor: string): string {
    return String(valor || '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  function cambiarMateriaDeLista(periodoId: string) {
    setPeriodoIdLista(periodoId);
    setFiltroAlumno('');
    setFiltroGrupo('');
  }

  const matriculaNormalizada = useMemo(() => normalizarMatricula(matricula), [matricula]);
  const matriculaValida = useMemo(() => {
    if (!matricula.trim()) return true;
    return /^CUH\d{9}$/i.test(matriculaNormalizada);
  }, [matricula, matriculaNormalizada]);
  const errorMatriculaVisible = Boolean(matricula.trim() && !matriculaValida);

  const dominioCorreoPredeterminado = 'cuh.mx';

  function claseBadgeGrupo(grupoAlumno: string): string {
    const clave = String(grupoAlumno || '').trim().toUpperCase();
    if (!clave) return 'badge-grupo--none';
    let hash = 0;
    for (let i = 0; i < clave.length; i += 1) {
      hash = (hash * 31 + clave.charCodeAt(i)) >>> 0;
    }
    return `badge-grupo--${hash % 8}`;
  }

  useEffect(() => {
    if (!Array.isArray(periodosActivos) || periodosActivos.length === 0) return;
    if (!periodoIdLista) setPeriodoIdLista(periodosActivos[0]._id);
  }, [periodosActivos, periodoIdLista]);

  useEffect(() => {
    if (!destinoInicial?.periodoId) return;
    setPeriodoIdLista(destinoInicial.periodoId);
    setFiltroAlumno('');
    setFiltroGrupo(destinoInicial.grupo || '');
  }, [destinoInicial]);

  useEffect(() => {
    const activos = Array.isArray(periodosActivos) ? periodosActivos : [];
    if (activos.length === 0) return;
    const idsActivos = new Set(activos.map((periodo) => periodo._id));
    const lista = (Array.isArray(alumnos) ? alumnos : []).filter((alumno) => idsActivos.has(String(alumno.periodoId || '')));
    const ultimo = [...lista].sort((a, b) => {
      const porFecha = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      if (porFecha !== 0) return porFecha;
      return String(b._id).localeCompare(String(a._id));
    })[0];
    const periodoIdReciente = String(ultimo?.periodoId || activos[0]._id).trim();
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

  const materiaNuevaSeleccionada = periodosActivos.find((periodo) => periodo._id === periodoIdNuevo) ?? null;

  const gruposArchivados = useMemo(() => {
    const periodosPorId = new Map((periodosTodos || []).filter((periodo) => periodo.activo === false).map((periodo) => [periodo._id, periodo]));
    const grupos = new Map<string, { periodoId: string; grupo: string; cantidad: number; materia: string; inicio?: string }>();
    for (const alumno of Array.isArray(alumnos) ? alumnos : []) {
      const periodoId = String(alumno.periodoId || '');
      const periodo = periodosPorId.get(periodoId);
      const nombreGrupo = String(alumno.grupo || '').trim().replace(/\s+/g, ' ');
      if (!periodo || alumno.activo !== false || !nombreGrupo) continue;
      const clave = JSON.stringify([periodoId, nombreGrupo.toLocaleLowerCase('es')]);
      const existente = grupos.get(clave);
      if (existente) existente.cantidad += 1;
      else grupos.set(clave, { periodoId, grupo: nombreGrupo, cantidad: 1, materia: nombreMateriaVisible(periodo), inicio: fechaMateriaVisible(periodo.fechaInicio) });
    }
    return Array.from(grupos, ([clave, valor]) => ({ clave, ...valor })).sort((a, b) =>
      a.materia.localeCompare(b.materia, 'es') || a.grupo.localeCompare(b.grupo, 'es')
    );
  }, [alumnos, periodosTodos]);

  async function reinscribirGrupo() {
    if (!puedeGestionar) {
      avisarSinPermiso('No tienes permiso para reinscribir alumnos.');
      return;
    }
    const origenSeleccionado = gruposArchivados.find((item) => item.clave === grupoArchivadoSeleccionado);
    if (!origenSeleccionado || !periodoIdNuevo || editandoId) return;
    const destino = periodosActivos.find((periodo) => periodo._id === periodoIdNuevo);
    const confirmado = await confirm({
      title: 'Reinscribir grupo en otra materia',
      message: `Se copiarán los alumnos del grupo ${origenSeleccionado.grupo} de ${origenSeleccionado.materia}${origenSeleccionado.inicio ? ` (inicio ${origenSeleccionado.inicio})` : ''} a ${destino ? etiquetaMateriaParaSelector(destino) : 'la materia seleccionada'}.`,
      details: ['La materia archivada y su historial se conservarán.', 'Los alumnos que ya estén inscritos en la materia destino no se duplicarán.'],
      confirmLabel: 'Reinscribir grupo',
      tone: 'warning'
    });
    if (!confirmado) return;

    try {
      setReinscribiendoGrupo(true);
      setMensaje('');
      const resultado = await enviarConPermiso<{ reinscritos?: number; yaInscritos?: number }>(
        'alumnos:gestionar',
        '/alumnos/reinscribir-grupo-archivado',
        { periodoOrigenId: origenSeleccionado.periodoId, periodoDestinoId: periodoIdNuevo, grupo: origenSeleccionado.grupo },
        'No tienes permiso para reinscribir alumnos.'
      );
      const nuevos = Number(resultado?.reinscritos || 0);
      const existentes = Number(resultado?.yaInscritos || 0);
      const texto = `Grupo reinscrito: ${nuevos} ${nuevos === 1 ? 'alumno nuevo' : 'alumnos nuevos'}; ${existentes} ya ${existentes === 1 ? 'estaba inscrito' : 'estaban inscritos'}.`;
      setMensaje(texto);
      registrarAccionDocente('reinscribir_grupo_archivado', true);
      cambiarMateriaDeLista(periodoIdNuevo);
      onRefrescar();
    } catch (error) {
      informarErrorDeOperacion(error, 'No se pudo reinscribir el grupo');
      registrarAccionDocente('reinscribir_grupo_archivado', false);
    } finally {
      setReinscribiendoGrupo(false);
    }
  }

  const puedeCrear = Boolean(
    matricula.trim() &&
      matriculaValida &&
      nombres.trim() &&
      apellidos.trim() &&
      periodoIdNuevo &&
      !editandoId
  );

  const puedeGuardarEdicion = Boolean(
    editandoId && matricula.trim() && matriculaValida && nombres.trim() && apellidos.trim() && periodoIdNuevo
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
    const grupos = new Map<string, string>();
    for (const a of alumnosDeMateria) {
      const g = String(a.grupo || '').trim();
      const clave = g.toLowerCase();
      if (clave && !grupos.has(clave)) grupos.set(clave, g);
    }
    return Array.from(grupos.values()).sort((a, b) => a.localeCompare(b, 'es'));
  }, [alumnosDeMateria]);
  const mostrarChipsGrupo = gruposDisponibles.length > 0 && gruposDisponibles.length <= 3;
  const mostrarSelectorGrupo = gruposDisponibles.length > 3;
  const busquedaSinResultados = filtroAlumno.trim();
  const grupoSinResultados = gruposDisponibles.find((grupoDisponible) =>
    grupoDisponible.toLocaleLowerCase('es') === filtroGrupo.trim().toLocaleLowerCase('es')
  ) ?? filtroGrupo.trim();
  const descripcionSinCoincidencias = busquedaSinResultados && grupoSinResultados
    ? `No hay alumnos para «${busquedaSinResultados}» en el grupo «${grupoSinResultados}».`
    : busquedaSinResultados
      ? `No hay alumnos para «${busquedaSinResultados}».`
      : grupoSinResultados
        ? `No hay alumnos en el grupo «${grupoSinResultados}».`
        : 'No hay alumnos para los filtros actuales.';

  const alumnosFiltrados = useMemo(() => {
    const txt = normalizarBusquedaAlumno(filtroAlumno);
    const grp = filtroGrupo.trim().toLowerCase();
    return alumnosDeMateria.filter((alumno) => {
      const nombre = normalizarBusquedaAlumno(alumno.nombreCompleto);
      const matriculaAlumno = normalizarBusquedaAlumno(alumno.matricula);
      const correoAlumno = normalizarBusquedaAlumno(alumno.correo);
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
  const padrónVacioNoConfirmado = alumnos.length === 0 && (cargandoAlumnos || errorCargaAlumnos);
  const listaMateriaVaciaNoConfirmada = !periodoIdLista
    || (alumnosDeMateria.length === 0 && (cargandoAlumnos || errorCargaAlumnos));

  const nombreMateriaSeleccionada = useMemo(() => {
    const p = (periodosTodos || []).find((item) => item._id === periodoIdLista);
    return p ? nombreMateriaVisible(p) : '';
  }, [periodosTodos, periodoIdLista]);

  function informarErrorDeOperacion(error: unknown, fallback: string) {
    setMensaje(mensajeDeError(error, fallback));
    const accionSesion = accionToastSesionParaError(error, 'docente');
    if (accionSesion) {
      emitToast({
        level: 'warn',
        title: 'Renueva tu sesión docente',
        message: 'El detalle está en la sección Alumnos. Cierra sesión y vuelve a entrar para renovar el acceso.',
        action: accionSesion
      });
    }
  }

  async function crearAlumno() {
    try {
      const inicio = Date.now();
      if (!puedeGestionar) {
        avisarSinPermiso('No tienes permiso para registrar alumnos.');
        return;
      }
      if (!puedeCrear) return;
      const nombreCompletoRegistrado = `${nombres.trim()} ${apellidos.trim()}`.trim();
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
      setMensaje(`Se registró a «${nombreCompletoRegistrado}».`);
      registrarAccionDocente('crear_alumno', true, Date.now() - inicio);
      setMatricula('');
      setNombres('');
      setApellidos('');
      setCorreo('');
      setCorreoAuto(true);
      cambiarMateriaDeLista(periodoIdNuevo);
      onRefrescar();
    } catch (error) {
      informarErrorDeOperacion(error, 'No se pudo registrar el alumno');
      registrarAccionDocente('crear_alumno', false);
    } finally {
      setCreando(false);
    }
  }

  function iniciarEdicion(alumno: Alumno, botonInvocador: HTMLButtonElement) {
    if (focoEdicionTimerRef.current !== null) clearTimeout(focoEdicionTimerRef.current);
    botonEditarInvocadorRef.current = botonInvocador;
    setEditandoId(alumno._id);
    setMatricula(alumno.matricula || '');
    setNombres(alumno.nombres || '');
    setApellidos(alumno.apellidos || '');
    setCorreo(alumno.correo || '');
    setCorreoAuto(false);
    setGrupo(alumno.grupo || '');
    setPeriodoIdNuevo(alumno.periodoId || '');
    setMensaje('');
    registrarAccionDocente('iniciar_edicion_alumno', true);
    focoEdicionTimerRef.current = setTimeout(() => {
      focoEdicionTimerRef.current = null;
      formularioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      matriculaInputRef.current?.focus();
    }, 60);
  }

  function cancelarEdicion() {
    if (focoEdicionTimerRef.current !== null) {
      clearTimeout(focoEdicionTimerRef.current);
      focoEdicionTimerRef.current = null;
    }
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
      const nombreCompletoActualizado = `${nombres.trim()} ${apellidos.trim()}`.trim();
      setGuardandoEdicion(true);
      setMensaje('');
      await enviarConPermiso(
        'alumnos:gestionar',
        `/alumnos/${editandoId}/actualizar`,
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
      registrarAccionDocente('actualizar_alumno', true, Date.now() - inicio);
      cancelarEdicion();
      setMensaje(`Cambios guardados para «${nombreCompletoActualizado}».`);
      onRefrescar();
    } catch (error) {
      informarErrorDeOperacion(error, 'No se pudo actualizar el alumno');
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
      registrarAccionDocente('eliminar_alumno', true, Date.now() - inicio);
      if (editandoId === alumno._id) cancelarEdicion();
      setMensaje('Alumno eliminado');
      onRefrescar();
    } catch (error) {
      informarErrorDeOperacion(error, 'No se pudo eliminar el alumno');
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
          <div className="icono-seccion-orb alumnos-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <IconoLucide icon={UsersRound} size={28} />
          </div>
          <div className="alumnos-panel__text-block">
            <div className="alumnos-panel__meta-row">
              <span className="alumnos-counter-tag">
                Padrón general: {padrónVacioNoConfirmado ? '—' : resumenAlumnos.totalGeneral}
              </span>
            </div>
            <h2 className="alumnos-panel__title">
              Alumnos
            </h2>
            <p className="nota">Administra expedientes de estudiantes, matrículas institucionales CUH y asignación por grupos.</p>
            <a
              className="boton secundario alumnos-panel__list-shortcut"
              href="#alumnos-lista-heading"
              onClick={(event) => {
                event.preventDefault();
                encabezadoListaRef.current?.focus();
              }}
            >
              Ver lista de alumnos
            </a>
          </div>
        </div>

        <div className="alumnos-header-kpis">
          <div className="materia-mini-kpi materia-mini-kpi--active anim-kpi-hover" data-tooltip="Total de alumnos matriculados en la materia seleccionada">
            <span className="materia-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={UsersRound} size={16} />
            </span>
            <span className="materia-mini-kpi__num">{listaMateriaVaciaNoConfirmada ? '—' : resumenAlumnos.total}</span>
            <span className="materia-mini-kpi__lbl">En Materia</span>
          </div>

          <div className="materia-mini-kpi materia-mini-kpi--groups anim-kpi-hover" data-tooltip="Grupos académicos detectados en la materia seleccionada">
            <span className="materia-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={Tags} size={16} />
            </span>
            <span className="materia-mini-kpi__num">{listaMateriaVaciaNoConfirmada ? '—' : resumenAlumnos.grupos}</span>
            <span className="materia-mini-kpi__lbl">{resumenAlumnos.grupos === 1 ? 'grupo' : 'grupos'}</span>
          </div>

          {estadoResumenAsistencias === 'ready' && resumenAlumnos.sinDerecho > 0 && (
            <div className="materia-mini-kpi materia-mini-kpi--closing anim-kpi-hover" data-tooltip="Alumnos con 4 o más inasistencias en el periodo">
              <span className="materia-mini-kpi__icon" aria-hidden="true">
                <IconoLucide icon={CircleAlert} size={16} />
              </span>
              <span className="materia-mini-kpi__num">{resumenAlumnos.sinDerecho}</span>
              <span className="materia-mini-kpi__lbl">4+ inasistencias</span>
            </div>
          )}
        </div>
      </div>

      {estadoResumenAsistencias === 'loading' && (
        <InlineMensaje tipo="info">Cargando resumen de inasistencias…</InlineMensaje>
      )}
      {estadoResumenAsistencias === 'error' && (
        <div className="alumnos-resumen-asistencias-error">
          <InlineMensaje tipo="error">
            No se pudo cargar el resumen de inasistencias. El indicador no está disponible.
          </InlineMensaje>
          <Boton
            type="button"
            variante="secundario"
            tamano="sm"
            onClick={() => setReintentoResumenAsistencias((intento) => intento + 1)}
          >
            Reintentar resumen
          </Boton>
        </div>
      )}

      {/* Guía Rápida Bento Interactiva */}
      <GuiaAlumnosVisual />

      {gruposArchivados.length > 0 && (
        <section className="alumnos-form alumnos-form--glass" aria-labelledby="alumnos-reinscripcion-titulo">
          <div className="alumnos-form__header">
            <h3 className="alumnos-form__title" id="alumnos-reinscripcion-titulo">Reinscribir grupo de una materia archivada</h3>
            <p className="alumnos-form__subtitle">Elige un grupo anterior y una materia activa. Se conserva el historial de origen.</p>
          </div>
          <div className="alumnos-filtros alumnos-filtros--glass">
            <label className="campo campo--materia-select">
              <span>Grupo archivado</span>
              <div className="auth-input-box auth-input-box--select auth-input-box--animated">
                <IconoCampo nombre="select" />
                <select value={grupoArchivadoSeleccionado} onChange={(event) => setGrupoArchivadoSeleccionado(event.target.value)} disabled={bloqueoEdicion || reinscribiendoGrupo}>
                  <option value="">Selecciona grupo y materia de origen</option>
                  {gruposArchivados.map((item) => (
                    <option key={item.clave} value={item.clave}>{item.grupo} · {item.materia}{item.inicio ? ` · inicio ${item.inicio}` : ''} · {item.cantidad} alumnos</option>
                  ))}
                </select>
              </div>
            </label>
            <label className="campo campo--materia-select">
              <span>Materia activa de destino</span>
              <div className="auth-input-box auth-input-box--select auth-input-box--animated">
                <IconoCampo nombre="select" />
                <select value={periodoIdNuevo} onChange={(event) => setPeriodoIdNuevo(event.target.value)} disabled={bloqueoEdicion || reinscribiendoGrupo || periodosActivos.length === 0}>
                  <option value="">Selecciona materia activa</option>
                  {periodosActivos.map((periodo) => <option key={periodo._id} value={periodo._id}>{etiquetaMateriaParaSelector(periodo)}</option>)}
                </select>
              </div>
            </label>
            <Boton type="button" variante="primario" icono={<Icono nombre="nuevo" />} cargando={reinscribiendoGrupo} disabled={bloqueoEdicion || reinscribiendoGrupo || !grupoArchivadoSeleccionado || !periodoIdNuevo || Boolean(editandoId)} onClick={reinscribirGrupo}>
              {reinscribiendoGrupo ? 'Reinscribiendo…' : 'Reinscribir grupo'}
            </Boton>
          </div>
        </section>
      )}

      {editandoId && (
        <InlineMensaje tipo="info">
          Editas este expediente. Actualiza los campos y selecciona «Guardar cambios».
        </InlineMensaje>
      )}

      {/* Formulario Estructurado Panoramico de 2 Filas Claras */}
      <form
        ref={formularioRef}
        className={`alumnos-form alumnos-form--glass alumnos-form--panoramico anim-form-card${editandoId ? ' alumnos-form--editando' : ''}${formularioAltaAbierto ? '' : ' alumnos-form--colapsado'}`}
        aria-labelledby="alumnos-form-title"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (bloqueoEdicion || creando || guardandoEdicion) return;
          if (editandoId) {
            if (puedeGuardarEdicion) void guardarEdicion();
            return;
          }
          if (puedeCrear) void crearAlumno();
        }}
      >
        <div className="alumnos-form__header">
          <div className="alumnos-form__header-copy">
            <h3 className="alumnos-form__title" id="alumnos-form-title">
              {editandoId ? 'Modificar alumno seleccionado' : 'Registrar alumno'}
            </h3>
            <p className="alumnos-form__subtitle">
              Obligatorios: matrícula, nombres, apellidos y materia. Correo y grupo son opcionales.
            </p>
          </div>
          {!editandoId && (
            <button
              className="boton boton--secundario alumnos-form__toggle"
              type="button"
              aria-expanded={formularioAltaAbierto}
              aria-controls="alumnos-form-body"
              onClick={() => setPreferenciaFormularioAlta(!formularioAltaAbierto)}
            >
              <Icono nombre="chevron" size={16} className="alumnos-form__toggle-icon" />
              {formularioAltaAbierto ? 'Ocultar formulario' : 'Mostrar formulario'}
            </button>
          )}
        </div>

        <div id="alumnos-form-body" hidden={!formularioAltaAbierto}>
        <div className="alumnos-form__fields">
          {/* Fila 1: Identidad del Alumno */}
          <div className="alumnos-form__row alumnos-form__row--top">
            <label className="campo campo--matricula">
              <span className="campo__label-row">
                <span>Matrícula</span>
                {matricula.trim() && (
                  <span className={`badge-matricula-live anim-badge-in ${matriculaValida ? 'badge-matricula-live--ok' : 'badge-matricula-live--err'}`}>
                    {matriculaValida ? <><IconoLucide icon={Check} size={14} /> Válida</> : 'Usa 9 dígitos después de CUH'}
                  </span>
                )}
              </span>
              <div className="auth-input-box auth-input-box--id auth-input-box--animated">
                <IconoCampo nombre="id" />
                <input
                  ref={matriculaInputRef}
                  required
                  value={matricula}
                  onChange={(event) => {
                    const valor = event.target.value;
                    setMatricula(valor);
                    if (correoAuto) {
                      const m = normalizarMatricula(valor);
                      setCorreo(m ? `${m}@${dominioCorreoPredeterminado}` : '');
                    }
                  }}
                  disabled={bloqueoEdicion}
                  placeholder="CUH + 9 cifras"
                  aria-invalid={errorMatriculaVisible}
                  aria-describedby={[
                    'alumnos-matricula-ayuda',
                    errorMatriculaVisible && 'alumnos-matricula-error'
                  ].filter(Boolean).join(' ')}
                  data-tooltip="Escribe CUH seguido de exactamente 9 dígitos"
                />
              </div>
              <span className="ayuda" id="alumnos-matricula-ayuda">Formato: CUH seguido de exactamente 9 dígitos (ej. CUH512410168).</span>
            </label>

            <label className="campo campo--nombres">
              <span>Nombres</span>
              <div className="auth-input-box auth-input-box--user auth-input-box--animated">
                <IconoCampo nombre="user" />
                <input
                  value={nombres}
                  onChange={(event) => setNombres(event.target.value)}
                  disabled={bloqueoEdicion}
                  required
                  autoComplete="given-name"
                  placeholder="Ej. Ana María"
                />
              </div>
            </label>

            <label className="campo campo--apellidos">
              <span>Apellidos</span>
              <div className="auth-input-box auth-input-box--user auth-input-box--animated">
                <IconoCampo nombre="user" />
                <input
                  value={apellidos}
                  onChange={(event) => setApellidos(event.target.value)}
                  disabled={bloqueoEdicion}
                  required
                  autoComplete="family-name"
                  placeholder="Ej. Gómez Ruiz"
                />
              </div>
            </label>
          </div>

          {/* Fila 2: Contacto y Asignación Académica */}
          <div className="alumnos-form__row alumnos-form__row--bottom">
            <label className="campo campo--correo">
              <span>Correo (opcional)</span>
              <div className="auth-input-box auth-input-box--mail auth-input-box--animated">
                <IconoCampo nombre="mail" />
                <input
                  type="email"
                  autoComplete="email"
                  value={correo}
                  onChange={(event) => {
                    setCorreoAuto(false);
                    setCorreo(event.target.value);
                  }}
                  disabled={bloqueoEdicion}
                  placeholder={`alumno@${dominioCorreoPredeterminado}`}
                  aria-describedby={correoAuto && matriculaNormalizada
                    ? 'alumnos-correo-sugerido'
                    : editandoId && correo.trim() ? 'alumnos-correo-completo' : undefined}
                />
              </div>
              {correoAuto && matriculaNormalizada && (
                <span className="ayuda" id="alumnos-correo-sugerido">Sugerido automáticamente: {matriculaNormalizada}@{dominioCorreoPredeterminado}</span>
              )}
              {editandoId && correo.trim() && (
                <span className="ayuda alumnos-form__correo-completo" id="alumnos-correo-completo">Correo completo: {correo}</span>
              )}
            </label>

            <label className="campo campo--grupo">
              <span>Grupo (opcional)</span>
              <div className="auth-input-box auth-input-box--group auth-input-box--animated">
                <IconoCampo nombre="group" />
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
              <span id="alumnos-form-materia-label">Materia del alumno</span>
              <div className="auth-input-box auth-input-box--select auth-input-box--animated">
                <IconoCampo nombre="select" />
                <select
                  value={periodoIdNuevo}
                  required
                  aria-labelledby="alumnos-form-materia-label"
                  aria-describedby="alumnos-form-materia-ayuda"
                  onChange={(event) => {
                    const nuevoPeriodoId = event.target.value;
                    setPeriodoIdNuevo(nuevoPeriodoId);
                    setUltimoPeriodoIdUsado(String(nuevoPeriodoId || '').trim());
                  }}
                  disabled={bloqueoEdicion}
                >
                  <option value="">Selecciona</option>
                  {periodosActivos.map((periodo) => (
                    <option key={periodo._id} value={periodo._id}>
                      {etiquetaMateriaParaSelector(periodo)}
                    </option>
                  ))}
                </select>
              </div>
              <span className="ayuda" id="alumnos-form-materia-ayuda">
                {editandoId ? 'Define la materia asignada.' : 'Asigna al alumno a esta materia.'} No cambia la lista inferior.
              </span>
              {materiaNuevaSeleccionada && (
                <span className="nota alumnos-form__materia-contexto">
                  Materia seleccionada: {etiquetaMateriaParaSelector(materiaNuevaSeleccionada)}
                </span>
              )}
            </label>
          </div>
        </div>

        {matricula.trim() && !matriculaValida && (
          <p className="mensaje error" role="status">
            <span className="mensaje__icono"><Icono nombre="alerta" /></span>
            <span className="mensaje__contenido">
              <span id="alumnos-matricula-error">La matrícula debe tener el formato CUH seguido de exactamente 9 dígitos (ej. CUH512410168).</span>
            </span>
          </p>
        )}

        <div className="alumnos-form__footer">
          <div className="acciones alumnos-form__actions">
            {!editandoId ? (
              <Boton
                type="submit"
                variante="primario"
                icono={<Icono nombre="nuevo" />}
                cargando={creando}
                disabled={!puedeCrear || bloqueoEdicion}
              >
                {creando ? 'Creando alumno…' : 'Crear alumno'}
              </Boton>
          ) : (
            <>
              <Boton
                type="submit"
                icono={<Icono nombre="ok" />}
                cargando={guardandoEdicion}
                disabled={!puedeGuardarEdicion || bloqueoEdicion}
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
            <Icono nombre="info" />
            <span>Los alumnos registrados estarán disponibles de inmediato para el pase de lista y evaluación OMR.</span>
          </div>
        </div>
        </div>
      </form>

      {mensaje && <InlineMensaje tipo={esMensajeError(mensaje) ? 'error' : 'ok'}>{mensaje}</InlineMensaje>}

      {cargandoAlumnos && (
        <InlineMensaje tipo="info">
          {alumnos.length > 0 ? 'Actualizando lista de alumnos… Se conserva la información cargada.' : 'Cargando lista de alumnos…'}
        </InlineMensaje>
      )}
      {errorCargaAlumnos && (
        <div className="alumnos-resumen-asistencias-error">
          <InlineMensaje tipo="error">
            {alumnos.length > 0
              ? 'No se pudo actualizar la lista de alumnos. Se conserva la información cargada; puede estar desactualizada.'
              : 'No se pudo cargar la lista de alumnos. Reintenta la consulta.'}
          </InlineMensaje>
          {onReintentarCargaAlumnos && (
            <Boton
              type="button"
              variante="secundario"
              tamano="sm"
              disabled={cargandoAlumnos}
              onClick={onReintentarCargaAlumnos}
            >
              Reintentar carga de alumnos
            </Boton>
          )}
        </div>
      )}
      {cargandoMaterias && (
        <InlineMensaje tipo="info">
          {periodosActivos.length > 0
            ? 'Actualizando el catálogo de materias. La lista anterior sigue disponible.'
            : 'Cargando materias disponibles…'}
        </InlineMensaje>
      )}
      {errorMaterias && !cargandoMaterias && (
        <div className="alumnos-resumen-asistencias-error alumnos-catalogo-error">
          <InlineMensaje tipo="error">
            {periodosActivos.length > 0
              ? 'No se pudo actualizar el catálogo. Se conserva la lista anterior; puede estar desactualizada.'
              : 'No se pudo cargar el catálogo de materias. Reintenta la consulta para elegir una materia.'}
          </InlineMensaje>
          {onReintentarMaterias && (
            <Boton
              type="button"
              variante="secundario"
              tamano="sm"
              onClick={onReintentarMaterias}
            >
              Reintentar carga de materias
            </Boton>
          )}
        </div>
      )}

      {/* Explorador de Alumnos por Materia */}
      <section className="alumnos-explorador anim-fade-in" aria-label="Explorador de Alumnos">
        <div className="alumnos-explorador__header">
          <div className="alumnos-explorador__title-box">
            <h3 id="alumnos-lista-heading" ref={encabezadoListaRef} tabIndex={-1}>Alumnos de la materia</h3>
            {Boolean(nombreMateriaSeleccionada) && (
              <span className="alumnos-materia-badge anim-badge-in">
                {nombreMateriaSeleccionada}
              </span>
            )}
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda Glass con Chips Rápidos */}
        <div className={`alumnos-filtros alumnos-filtros--glass ${mostrarSelectorGrupo ? '' : 'alumnos-filtros--busqueda-compacta'}`}>
          <label className="campo campo--materia-select">
            <span id="alumnos-lista-materia-label">Materia de la lista</span>
            <div className="auth-input-box auth-input-box--select auth-input-box--animated">
              <IconoCampo nombre="select" />
              <select
                value={periodoIdLista}
                aria-labelledby="alumnos-lista-materia-label"
                aria-describedby="alumnos-lista-materia-ayuda"
                onChange={(event) => cambiarMateriaDeLista(event.target.value)}
              >
                <option value="">Selecciona</option>
                {periodosTodos
                  .filter((p) => p.activo !== false)
                  .map((periodo) => (
                    <option key={periodo._id} value={periodo._id}>
                      {etiquetaMateriaParaSelector(periodo)}
                    </option>
                  ))}
              </select>
            </div>
            <span className="ayuda" id="alumnos-lista-materia-ayuda">
              {nombreMateriaSeleccionada
                ? `Lista actual: ${nombreMateriaSeleccionada}. Cambia solo la lista de abajo; no cambia el formulario.`
                : 'Selecciona una materia para ver su lista; esto no cambia la materia del formulario.'}
            </span>
          </label>

          <label className="campo campo--search">
            <span id="alumnos-busqueda-label">Buscar alumno</span>
            <div className="auth-input-box auth-input-box--search auth-input-box--animated">
              <IconoCampo nombre="search" />
              <input
                aria-labelledby="alumnos-busqueda-label"
                type="search"
                value={filtroAlumno}
                onChange={(event) => setFiltroAlumno(event.target.value)}
                aria-describedby="alumnos-busqueda-ayuda"
                placeholder="Nombre"
              />
            </div>
            <small className="ayuda" id="alumnos-busqueda-ayuda">Busca por nombre, matrícula o correo.</small>
          </label>

          {mostrarSelectorGrupo && (
            <label className="campo campo--grupo-select">
              <span>Grupo</span>
              <div className="auth-input-box auth-input-box--group auth-input-box--animated">
                <IconoCampo nombre="group" />
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
          )}
        </div>

        {/* Quick Group Filter Chips */}
        {mostrarChipsGrupo && (
          <div className="alumnos-group-chips-bar" role="group" aria-labelledby="alumnos-filtro-grupo-rapido-label">
            <span className="alumnos-group-chips-label" id="alumnos-filtro-grupo-rapido-label">Filtrar por grupo:</span>
            <button
              type="button"
              className={`alumnos-group-chip ${!filtroGrupo ? 'alumnos-group-chip--active' : ''}`}
              aria-pressed={!filtroGrupo}
              onClick={() => setFiltroGrupo('')}
            >
              Todos ({alumnosDeMateria.length})
            </button>
            {gruposDisponibles.map((grp) => {
              const grupoNormalizado = grp.toLowerCase();
              const conteo = alumnosDeMateria.filter((a) => String(a.grupo || '').trim().toLowerCase() === grupoNormalizado).length;
              const activo = filtroGrupo.toLowerCase() === grp.toLowerCase();
              return (
                <button
                  key={grp}
                  type="button"
                  className={`alumnos-group-chip ${activo ? 'alumnos-group-chip--active' : ''}`}
                  aria-pressed={activo}
                  onClick={() => setFiltroGrupo(activo ? '' : grp)}
                >
                  <span className={`badge badge-grupo ${claseBadgeGrupo(grp)}`}>{grp}</span>
                  <span className="alumnos-group-chip-count">({conteo})</span>
                </button>
              );
            })}
          </div>
        )}

        {periodoIdLista && alumnosDeMateria.length > 0 && (
          <p className="nota alumnos-resultados-count" role="status">
            Se muestran {alumnosFiltrados.length} de {alumnosDeMateria.length} alumnos.
          </p>
        )}

        {/* Lista / Grid de Alumnos */}
        <ul className="lista lista-items alumnos-lista">
          {!periodoIdLista && !cargandoMaterias && !errorMaterias && (
            <li className="empty-state-card alumnos-empty-hero anim-fade-in">
              <div className="empty-state-card__icon anim-icon-pulse">
                <Icono nombre="alumnos" />
              </div>
              <h4>Comienza seleccionando una materia</h4>
              <p>Elige una asignatura activa para consultar su lista. La conexión con Google Classroom se administra en la sección Classroom.</p>

              {periodosActivos.length > 0 ? (
                <div className="alumnos-quick-periodos-grid">
                  {periodosActivos.map((p) => (
                    <button
                      key={p._id}
                      type="button"
                      className="alumnos-materia-pick-card anim-card-hover"
                      onClick={() => cambiarMateriaDeLista(p._id)}
                    >
                      <div className="alumnos-materia-pick-avatar">
                        <Icono nombre="periodos" />
                      </div>
                      <div className="alumnos-materia-pick-info">
                        <strong>{nombreMateriaVisible(p)}</strong>
                        <span>Grupos: {Array.isArray(p.grupos) && p.grupos.length > 0 ? p.grupos.join(', ') : 'General'}</span>
                      </div>
                      <div className="alumnos-materia-pick-arrow" aria-hidden="true">
                        <IconoLucide icon={ArrowRight} size={16} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state-steps" aria-hidden="true">
                  <div className="empty-step">
                    <span className="empty-step__num">1</span>
                    <span>Configura tu materia</span>
                  </div>
                  <div className="empty-step__arrow">
                    <IconoLucide icon={ArrowRight} size={14} />
                  </div>
                  <div className="empty-step">
                    <span className="empty-step__num">2</span>
                    <span>Registra tus alumnos</span>
                  </div>
                  <div className="empty-step__arrow">
                    <IconoLucide icon={ArrowRight} size={14} />
                  </div>
                  <div className="empty-step">
                    <span className="empty-step__num">3</span>
                    <span>Pasa lista y califica</span>
                  </div>
                </div>
              )}
            </li>
          )}

          {periodoIdLista && !cargandoAlumnos && !errorCargaAlumnos && alumnosDeMateria.length === 0 && (
            <li className="empty-state-card anim-fade-in">
              <div className="empty-state-card__icon anim-icon-pulse">
                <Icono nombre="nuevo" />
              </div>
              <h4>No hay alumnos registrados en esta materia</h4>
              <p>Registra alumnos con el formulario superior. La conexión con Google Classroom se administra en la sección Classroom.</p>
            </li>
          )}

          {periodoIdLista && alumnosDeMateria.length > 0 && alumnosFiltrados.length === 0 && (
            <li className="empty-state-card anim-fade-in">
              <div className="empty-state-card__icon anim-icon-pulse">
                <IconoLucide icon={Search} size={24} />
              </div>
              <h4>Sin coincidencias</h4>
              <p>{descripcionSinCoincidencias}</p>
              <Boton
                type="button"
                variante="secundario"
                tamano="sm"
                onClick={() => {
                  setFiltroAlumno('');
                  setFiltroGrupo('');
                }}
              >
                Limpiar filtros
              </Boton>
            </li>
          )}

          {periodoIdLista &&
            alumnosFiltrados.map((alumno) => {
              const faltas = resumenAsistencias.find((r) => r.alumnoId === alumno._id)?.faltas ?? 0;
              const sinDerecho = faltas >= 4;
              const iniciales = obtenerInicialesAvatarAlumno(alumno.nombreCompleto);

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
                          <span className="alumno-nombre">{alumno.nombreCompleto}</span>
                          {sinDerecho && (
                            <span
                              className="badge badge-alerta badge-alerta-inasistencias"
                              aria-label="Alumno con cuatro o más inasistencias"
                              title="Cuatro o más inasistencias en el periodo"
                            >
                              4+ inasistencias
                            </span>
                          )}
                        </div>

                        <div className="item-meta alumnos-card__meta">
                          {alumno.matricula && !/^\d{15,}$/.test(alumno.matricula) && (
                            <span className="alumno-meta-tag alumno-meta-tag--matricula" data-tooltip="Matrícula del estudiante">
                              <span className="alumno-meta-lbl">Matrícula:</span>{' '}
                              <span className="alumno-meta-value">{alumno.matricula}</span>
                            </span>
                          )}
                          <span className="alumno-meta-tag alumno-meta-tag--grupo" data-tooltip="Grupo asignado en la materia">
                            <span className="alumno-meta-lbl">Grupo:</span>{' '}
                            <span className={`badge badge-grupo ${claseBadgeGrupo(alumno.grupo || '')}`}>
                              {alumno.grupo ? alumno.grupo : '-'}
                            </span>
                          </span>
                          <span className="alumno-meta-tag alumno-meta-tag--correo" data-tooltip="Correo institucional para recepción de folios y calificaciones">
                            <span className="alumno-meta-lbl">Correo:</span>{' '}
                            <span className="alumno-correo">
                              {alumno.correo
                                ? Array.from(alumno.correo).map((caracter, indice) => (
                                    <Fragment key={`${indice}-${caracter}`}>
                                      {caracter}
                                      {'.@_-'.includes(caracter) && <wbr />}
                                    </Fragment>
                                  ))
                                : '-'}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Acciones con Iconos */}
                      <div className="item-actions alumnos-card__actions">
                        <Boton
                          variante="secundario"
                          type="button"
                          aria-label={`Editar ${alumno.nombreCompleto || alumno.matricula || 'alumno'}`}
                          data-tooltip="Editar"
                          onClick={(event) => iniciarEdicion(alumno, event.currentTarget)}
                          disabled={bloqueoEdicion}
                          icono={
                            <IconoLucide icon={Pencil} size={14} />
                          }
                        >
                          Editar
                        </Boton>
                        {puedeEliminarAlumnoDev && (
                          <Boton
                            variante="secundario"
                            type="button"
                            aria-label={`Eliminar ${alumno.nombreCompleto || alumno.matricula || 'alumno'} (DEV)`}
                            cargando={eliminandoAlumnoId === alumno._id}
                            onClick={() => void eliminarAlumnoDev(alumno)}
                            disabled={!puedeEliminarAlumnoDev}
                            icono={
                              <IconoLucide icon={Trash2} size={14} />
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
