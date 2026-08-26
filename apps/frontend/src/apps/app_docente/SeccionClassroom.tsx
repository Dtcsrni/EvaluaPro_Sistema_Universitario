/**
 * SeccionClassroom
 *
 * Responsabilidad: Vista principal para integración, vinculación y sincronización
 * directa con Google Classroom (OAuth2, mapeo de roster y actividades por corte).
 *
 * Sin estilos inline: Todos los estilos provienen de screens.css y components.css.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { clienteApi } from './clienteApiDocente';
import type { Periodo } from './tipos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { Icono } from '../../ui/iconos';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { emitToast } from '../../ui/toast/toastBus';
import { mensajeDeError } from './utilidades';
import { GuiaClassroomVisual } from './GuiaClassroomVisual';

type ClassroomEstado = {
  conectado: boolean;
  correoGoogle?: string | null;
  googleUserId?: string | null;
  ultimaSincronizacionEn?: string | null;
  ultimoError?: string | null;
};

type ClassroomCurso = {
  id: string;
  name: string;
  section?: string;
  courseState?: string;
};

type ClassroomActividad = {
  id: string;
  title: string;
  description?: string;
  maxPoints?: number;
  state?: string;
  updateTime?: string;
  alternateLink?: string;
  mapeo?: {
    tituloEvidencia?: string;
    descripcionEvidencia?: string;
    ponderacion?: number;
    corte?: number;
    activo?: boolean;
  } | null;
};

type ClassroomAlumnoLocal = {
  _id: string;
  matricula?: string;
  nombreCompleto: string;
  correo?: string;
};

type ClassroomAlumnoCurso = {
  classroomUserId: string;
  fullName?: string;
  emailAddress?: string;
  alumnoIdConfirmado?: string | null;
  alumnoIdSugerido?: string | null;
  matchStrategy?: string;
  confidence?: number;
};

type ActividadEditable = {
  courseId: string;
  courseWorkId: string;
  tituloEvidencia: string;
  descripcionEvidencia: string;
  ponderacion: string;
  corte: string;
  activo: boolean;
};

type ClassroomPreviewResultado = {
  dryRun: boolean;
  totalActividades: number;
  submissionsProcesadas: number;
  importadas: number;
  actualizadas: number;
  omitidas: number;
  errores: Array<{
    courseWorkId?: string;
    userId?: string;
    mensaje: string;
  }>;
};

function normalizarBusqueda(valor: unknown): string {
  return String(valor ?? '').trim().toLowerCase();
}

export function SeccionClassroom({
  periodos,
  puedeClassroomConectar,
  puedeClassroomPull,
  classroomDisponible,
  onRecargarMaterias
}: {
  periodos: Periodo[];
  puedeClassroomConectar: boolean;
  puedeClassroomPull: boolean;
  classroomDisponible: boolean;
  onRecargarMaterias?: () => Promise<void>;
}) {
  const [periodoId, setPeriodoId] = useState(periodos[0]?._id ?? '');
  const [estado, setEstado] = useState<ClassroomEstado | null>(null);
  const [cursos, setCursos] = useState<ClassroomCurso[]>([]);
  const [courseIdSeleccionado, setCourseIdSeleccionado] = useState('');
  const [actividades, setActividades] = useState<ClassroomActividad[]>([]);
  const [actividadIdsSeleccionados, setActividadIdsSeleccionados] = useState<string[]>([]);
  const [edicionActividades, setEdicionActividades] = useState<Record<string, ActividadEditable>>({});
  const [alumnosLocales, setAlumnosLocales] = useState<ClassroomAlumnoLocal[]>([]);
  const [alumnosClassroom, setAlumnosClassroom] = useState<ClassroomAlumnoCurso[]>([]);
  const [mapeoEditable, setMapeoEditable] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ClassroomPreviewResultado | null>(null);
  const [busquedaAlumnos, setBusquedaAlumnos] = useState('');
  const [cargandoEstado, setCargandoEstado] = useState(false);
  const [cargandoCursos, setCargandoCursos] = useState(false);
  const [cargandoActividades, setCargandoActividades] = useState(false);
  const [cargandoRoster, setCargandoRoster] = useState(false);
  const [guardandoMapeo, setGuardandoMapeo] = useState(false);
  const [creandoMateria, setCreandoMateria] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  // Auto-seleccionar primer periodo si cambia la lista
  useEffect(() => {
    if (periodos.length > 0 && !periodos.some((p) => p._id === periodoId)) {
      setPeriodoId(periodos[0]._id);
    }
  }, [periodos, periodoId]);

  // Auto-seleccionar primer curso cuando se carguen
  useEffect(() => {
    if (cursos.length > 0 && !courseIdSeleccionado) {
      setCourseIdSeleccionado(cursos[0].id);
    }
  }, [cursos, courseIdSeleccionado]);

  // Auto-emparejar periodoId si el nombre coincide con el curso seleccionado
  useEffect(() => {
    if (!courseIdSeleccionado || periodos.length === 0) return;
    const curso = cursos.find((c: ClassroomCurso) => c.id === courseIdSeleccionado);
    if (!curso) return;
    const nombreNorm = normalizarBusqueda(curso.name);
    const coincidencia = periodos.find(
      (p: Periodo) => normalizarBusqueda(p.nombre) === nombreNorm || nombreNorm.includes(normalizarBusqueda(p.nombre))
    );
    if (coincidencia && periodoId !== coincidencia._id) {
      setPeriodoId(coincidencia._id);
    }
  }, [courseIdSeleccionado, cursos, periodos, periodoId]);

  const actividadesSeleccionadas = useMemo(
    () => actividades.filter((actividad) => actividadIdsSeleccionados.includes(actividad.id)),
    [actividadIdsSeleccionados, actividades]
  );

  const alumnosLocalesPorId = useMemo(
    () => new Map(alumnosLocales.map((alumno) => [alumno._id, alumno])),
    [alumnosLocales]
  );

  const alumnosClassroomFiltrados = useMemo(() => {
    const busqueda = normalizarBusqueda(busquedaAlumnos);
    if (!busqueda) return alumnosClassroom;
    return alumnosClassroom.filter((fila: ClassroomAlumnoCurso) => {
      const alumnoLocalId = mapeoEditable[fila.classroomUserId];
      const alumnoLocal = alumnoLocalId ? alumnosLocalesPorId.get(alumnoLocalId) : undefined;
      return [
        fila.fullName,
        fila.emailAddress,
        fila.classroomUserId,
        alumnoLocal?.nombreCompleto,
        alumnoLocal?.matricula,
        alumnoLocal?.correo
      ]
        .map(normalizarBusqueda)
        .some((valor) => valor.includes(busqueda));
    });
  }, [alumnosClassroom, alumnosLocalesPorId, busquedaAlumnos, mapeoEditable]);

  const cargarCursos = useCallback(async (silencioso = false) => {
    if (!puedeClassroomPull || !classroomDisponible) return;
    setCargandoCursos(true);
    try {
      setMensaje('');
      if (!silencioso) {
        emitToast({ level: 'info', title: 'Classroom', message: 'Consultando cursos activos...' });
      }
      const respuesta = await clienteApi.obtener<{ cursos: ClassroomCurso[] }>('/evaluaciones/v2/classroom/cursos');
      const lista = Array.isArray(respuesta.cursos)
        ? respuesta.cursos.filter((c) => !c.courseState || c.courseState.toUpperCase() === 'ACTIVE')
        : [];
      setCursos(lista);
      if (!silencioso) {
        emitToast({
          level: 'ok',
          title: 'Classroom',
          message: `Se cargaron ${lista.length} cursos activos exitosamente.`
        });
      }
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron cargar los cursos de Classroom.');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'Error de carga', message: msg });
    } finally {
      setCargandoCursos(false);
    }
  }, [classroomDisponible, puedeClassroomPull]);

  const cargarEstado = useCallback(async (silencioso = false) => {
    if (!puedeClassroomPull) return;
    setCargandoEstado(true);
    try {
      if (!silencioso) {
        emitToast({ level: 'info', title: 'Classroom', message: 'Verificando estado de la cuenta...' });
      }
      const respuesta = await clienteApi.obtener<{ estado: ClassroomEstado }>('/evaluaciones/v2/classroom/estado');
      setEstado(respuesta.estado);
      if (!silencioso) {
        emitToast({
          level: respuesta.estado.conectado ? 'ok' : 'info',
          title: 'Classroom',
          message: respuesta.estado.conectado
            ? `Cuenta conectada: ${respuesta.estado.correoGoogle || 'Google Workspace'}`
            : 'Cuenta de Google no conectada aún.'
        });
      }
      if (respuesta.estado?.conectado) {
        void cargarCursos(true);
      }
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo cargar el estado de Classroom.');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'Error', message: msg });
    } finally {
      setCargandoEstado(false);
    }
  }, [cargarCursos, puedeClassroomPull]);

  const cargarActividades = useCallback(async (courseId: string, currentPeriodoId?: string) => {
    if (!courseId) return;
    setCargandoActividades(true);
    try {
      const queryPeriodo = currentPeriodoId ? `?periodoId=${encodeURIComponent(currentPeriodoId)}` : '';
      const respuesta = await clienteApi.obtener<{ actividades: ClassroomActividad[] }>(
        `/evaluaciones/v2/classroom/cursos/${encodeURIComponent(courseId)}/actividades${queryPeriodo}`
      );
      const lista = Array.isArray(respuesta.actividades) ? respuesta.actividades : [];
      setActividades(lista);
      setEdicionActividades(
        Object.fromEntries(
          lista.map((actividad: ClassroomActividad) => [
            actividad.id,
            {
              courseId,
              courseWorkId: actividad.id,
              tituloEvidencia: actividad.mapeo?.tituloEvidencia ?? actividad.title ?? '',
              descripcionEvidencia: actividad.mapeo?.descripcionEvidencia ?? actividad.description ?? '',
              ponderacion: String(actividad.mapeo?.ponderacion ?? 1),
              corte: actividad.mapeo?.corte ? String(actividad.mapeo.corte) : '1',
              activo: actividad.mapeo?.activo !== false
            }
          ])
        )
      );
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron cargar las actividades de Classroom.');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'Error', message: msg });
    } finally {
      setCargandoActividades(false);
    }
  }, []);

  const cargarRoster = useCallback(async (courseId: string, currentPeriodoId?: string) => {
    if (!courseId) return;
    setCargandoRoster(true);
    try {
      const queryPeriodo = currentPeriodoId ? `?periodoId=${encodeURIComponent(currentPeriodoId)}` : '';
      const respuesta = await clienteApi.obtener<{
        alumnosLocales: ClassroomAlumnoLocal[];
        alumnosClassroom: ClassroomAlumnoCurso[];
      }>(`/evaluaciones/v2/classroom/cursos/${encodeURIComponent(courseId)}/alumnos${queryPeriodo}`);
      const locales = Array.isArray(respuesta.alumnosLocales) ? respuesta.alumnosLocales : [];
      const classroom = Array.isArray(respuesta.alumnosClassroom) ? respuesta.alumnosClassroom : [];
      setAlumnosLocales(locales);
      setAlumnosClassroom(classroom);
      setMapeoEditable(
        Object.fromEntries(
          classroom.map((fila: ClassroomAlumnoCurso) => [
            fila.classroomUserId,
            String(fila.alumnoIdConfirmado ?? fila.alumnoIdSugerido ?? '')
          ])
        )
      );
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo cargar el mapeo de alumnos Classroom.');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'Error', message: msg });
    } finally {
      setCargandoRoster(false);
    }
  }, []);

  // Carga inicial de estado al montar
  useEffect(() => {
    if (!classroomDisponible || !puedeClassroomPull) return;
    void cargarEstado(true);
  }, [cargarEstado, classroomDisponible, puedeClassroomPull]);

  // Carga inicial de cursos cuando esté conectado
  useEffect(() => {
    if (!classroomDisponible || !estado?.conectado) {
      setCursos([]);
      return;
    }
    void cargarCursos(true);
  }, [cargarCursos, classroomDisponible, estado?.conectado]);

  // Cargar roster y actividades al cambiar curso o periodo
  useEffect(() => {
    setPreview(null);
    setActividadIdsSeleccionados([]);
    setActividades([]);
    setAlumnosLocales([]);
    setAlumnosClassroom([]);
    setBusquedaAlumnos('');
    if (!courseIdSeleccionado || !estado?.conectado) return;
    void cargarActividades(courseIdSeleccionado, periodoId);
    void cargarRoster(courseIdSeleccionado, periodoId);
  }, [cargarActividades, cargarRoster, courseIdSeleccionado, periodoId, estado?.conectado]);

  // Escuchar eventos OAuth (BroadcastChannel, postMessage, storage)
  useEffect(() => {
    function onSyncEvent(data: { source?: unknown; status?: unknown; message?: unknown }) {
      if (String(data.source || '') !== 'classroom-oauth') return;
      if (String(data.status || '') === 'ok') {
        emitToast({ level: 'ok', title: 'Classroom', message: String(data.message || 'Cuenta conectada con éxito') });
        void cargarEstado(true);
        void cargarCursos(true);
      } else {
        emitToast({ level: 'error', title: 'Classroom', message: String(data.message || 'No se pudo conectar') });
      }
    }

    const messageListener = (event: MessageEvent) => {
      const data = (event.data || {}) as { source?: unknown; status?: unknown; message?: unknown };
      if (data && String(data.source || '') === 'classroom-oauth') {
        onSyncEvent(data);
      }
    };
    window.addEventListener('message', messageListener);

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('ep_classroom_sync');
        channel.onmessage = (event) => {
          onSyncEvent(event.data || {});
        };
      }
    } catch {
      // ignore
    }

    const storageListener = (event: StorageEvent) => {
      if (event.key === 'ep.classroom.event' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue) as { status?: string; message?: string };
          onSyncEvent({ source: 'classroom-oauth', status: parsed.status, message: parsed.message });
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', storageListener);

    return () => {
      window.removeEventListener('message', messageListener);
      window.removeEventListener('storage', storageListener);
      channel?.close();
    };
  }, [cargarEstado, cargarCursos]);

  function toggleActividad(actividadId: string) {
    setActividadIdsSeleccionados((prev) =>
      prev.includes(actividadId) ? prev.filter((id) => id !== actividadId) : [...prev, actividadId]
    );
  }

  function payloadActividadesSeleccionadas() {
    return actividadesSeleccionadas.map((actividad) => {
      const editable = edicionActividades[actividad.id];
      return {
        courseId: courseIdSeleccionado,
        courseWorkId: actividad.id,
        tituloEvidencia: editable?.tituloEvidencia || actividad.title,
        descripcionEvidencia: editable?.descripcionEvidencia || actividad.description || undefined,
        ponderacion: Number(editable?.ponderacion || 1),
        corte: Number(editable?.corte || 1),
        activo: editable?.activo !== false
      };
    });
  }

  async function crearMateriaDesdeCurso() {
    const curso = cursos.find((c) => c.id === courseIdSeleccionado);
    if (!curso) return;
    setCreandoMateria(true);
    emitToast({ level: 'info', title: 'Materia', message: `Creando materia "${curso.name}" en EvaluaPro...` });
    try {
      const ahora = new Date();
      const fin = new Date();
      fin.setMonth(fin.getMonth() + 4);
      const respuesta = await clienteApi.enviar<{ periodo: Periodo }>('/periodos', {
        nombre: curso.name,
        fechaInicio: ahora.toISOString().split('T')[0],
        fechaFin: fin.toISOString().split('T')[0]
      });
      emitToast({ level: 'ok', title: 'Materia creada', message: `Materia "${curso.name}" creada exitosamente.` });
      if (onRecargarMaterias) {
        await onRecargarMaterias();
      }
      if (respuesta.periodo?._id) {
        setPeriodoId(respuesta.periodo._id);
      }
    } catch (err) {
      const msg = mensajeDeError(err, 'No se pudo crear la materia.');
      emitToast({ level: 'error', title: 'Error al crear materia', message: msg });
    } finally {
      setCreandoMateria(false);
    }
  }

  async function conectarClassroom() {
    if (!puedeClassroomConectar) return;
    emitToast({ level: 'info', title: 'Google Classroom', message: 'Iniciando autorización de Google...' });
    try {
      const respuesta = await clienteApi.obtener<{ url: string }>('/evaluaciones/v2/classroom/oauth/iniciar');
      const url = String(respuesta.url || '').trim();
      if (!url) {
        throw new Error('No se recibió URL de autorización de Google.');
      }
      const popup = window.open(url, 'oauth_classroom', 'width=980,height=760');
      if (popup) {
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            void cargarEstado(true);
            void cargarCursos(true);
          }
        }, 600);
      }
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo conectar Google Classroom.');
      emitToast({ level: 'error', title: 'Classroom', message: msg });
    }
  }

  async function desconectarClassroom() {
    if (!puedeClassroomConectar) return;
    setDesconectando(true);
    emitToast({ level: 'info', title: 'Classroom', message: 'Desconectando cuenta...' });
    try {
      await clienteApi.enviar('/evaluaciones/v2/classroom/oauth/desconectar', {});
      emitToast({ level: 'ok', title: 'Classroom', message: 'Cuenta Classroom desconectada' });
      setEstado({ conectado: false });
      setCursos([]);
      setActividades([]);
      setAlumnosLocales([]);
      setAlumnosClassroom([]);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo desconectar Classroom.');
      emitToast({ level: 'error', title: 'Error', message: msg });
    } finally {
      setDesconectando(false);
    }
  }

  async function guardarMapeoCurso() {
    if (!courseIdSeleccionado || !periodoId) {
      emitToast({ level: 'warn', title: 'Mapeo de Alumnos', message: 'Selecciona una materia en EvaluaPro para guardar el mapeo.' });
      return;
    }
    setGuardandoMapeo(true);
    emitToast({ level: 'info', title: 'Mapeo de Alumnos', message: 'Guardando asignaciones...' });
    try {
      const asignaciones = Object.entries(mapeoEditable).map(([classroomUserId, alumnoId]) => ({
        classroomUserId,
        alumnoId: alumnoId || null
      }));
      const respuesta = await clienteApi.actualizar<{
        alumnosLocales: ClassroomAlumnoLocal[];
        alumnosClassroom: ClassroomAlumnoCurso[];
      }>(`/evaluaciones/v2/classroom/cursos/${encodeURIComponent(courseIdSeleccionado)}/mapeo-alumnos`, {
        periodoId,
        asignaciones
      });
      setAlumnosLocales(Array.isArray(respuesta.alumnosLocales) ? respuesta.alumnosLocales : []);
      setAlumnosClassroom(Array.isArray(respuesta.alumnosClassroom) ? respuesta.alumnosClassroom : []);
      emitToast({ level: 'ok', title: 'Mapeo de Alumnos', message: 'Asignaciones de alumnos guardadas con éxito.' });
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo guardar el mapeo de alumnos.');
      emitToast({ level: 'error', title: 'Error', message: msg });
    } finally {
      setGuardandoMapeo(false);
    }
  }

  async function previsualizarImportacion() {
    if (!periodoId || !courseIdSeleccionado) {
      emitToast({ level: 'warn', title: 'Importación', message: 'Selecciona la materia en EvaluaPro antes de previsualizar.' });
      return;
    }
    if (actividadIdsSeleccionados.length === 0) {
      emitToast({ level: 'warn', title: 'Importación', message: 'Selecciona al menos una tarea de Classroom para importar.' });
      return;
    }
    setEjecutando(true);
    emitToast({ level: 'info', title: 'Previsualización', message: 'Calculando notas y evidencias...' });
    try {
      const resultado = await clienteApi.enviar<ClassroomPreviewResultado>(
        '/evaluaciones/v2/classroom/importaciones/preview',
        {
          periodoId,
          actividades: payloadActividadesSeleccionadas()
        }
      );
      setPreview(resultado);
      emitToast({
        level: 'ok',
        title: 'Previsualización lista',
        message: `${resultado.totalActividades} tareas analizadas (${resultado.submissionsProcesadas} entregas detectadas).`
      });
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo generar la previsualización.');
      emitToast({ level: 'error', title: 'Error', message: msg });
    } finally {
      setEjecutando(false);
    }
  }

  async function ejecutarImportacion() {
    if (!periodoId || !courseIdSeleccionado) {
      emitToast({ level: 'warn', title: 'Importación', message: 'Selecciona la materia en EvaluaPro antes de sincronizar.' });
      return;
    }
    if (actividadIdsSeleccionados.length === 0) {
      emitToast({ level: 'warn', title: 'Importación', message: 'Selecciona al menos una tarea de Classroom para importar.' });
      return;
    }
    setEjecutando(true);
    emitToast({ level: 'info', title: 'Sincronización', message: 'Sincronizando tareas y calificaciones...' });
    try {
      const resultado = await clienteApi.enviar<ClassroomPreviewResultado>(
        '/evaluaciones/v2/classroom/importaciones/ejecutar',
        {
          periodoId,
          actividades: payloadActividadesSeleccionadas()
        }
      );
      setPreview(resultado);
      emitToast({
        level: 'ok',
        title: 'Sincronización Exitosa',
        message: `Se importaron ${resultado.importadas} evidencias y ${resultado.submissionsProcesadas} calificaciones a EvaluaPro.`
      });
      void cargarActividades(courseIdSeleccionado, periodoId);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo completar la sincronización.');
      emitToast({ level: 'error', title: 'Error', message: msg });
    } finally {
      setEjecutando(false);
    }
  }

  return (
    <div className="cuenta-container">
      {/* ── 1. Hero Header Bento ── */}
      <div className="cuenta-hero-bento">
        <div className="cuenta-hero-left">
          <div className="cuenta-hero-orb-wrap">
            <div className="cuenta-hero-orb" aria-hidden="true">
              <Icono nombre="classroom" />
            </div>
            <div className="cuenta-hero-badge">
              <span className="cuenta-hero-badge-dot" aria-hidden="true" />
              <span>Integración Directa · Google Workspace</span>
            </div>
          </div>
          <h2 className="cuenta-hero-title">Google Classroom</h2>
          <p className="cuenta-hero-subtitle">
            Vincula tus cursos institucionales para importar alumnos, sincronizar cuestionarios y consolidar calificaciones
            en la evaluación continua de forma automática.
          </p>
        </div>
        <div className="cuenta-hero-right">
          <div className="cuenta-hero-stat-card">
            <span className="cuenta-hero-stat-num">{cursos.length}</span>
            <span className="cuenta-hero-stat-label">Cursos Activos</span>
          </div>
          <div className="cuenta-hero-stat-card">
            <span className="cuenta-hero-stat-num">{alumnosClassroom.length}</span>
            <span className="cuenta-hero-stat-label">Alumnos Roster</span>
          </div>
          <div className="cuenta-hero-stat-card">
            <span className="cuenta-hero-stat-num">{actividades.length}</span>
            <span className="cuenta-hero-stat-label">Tareas Publicadas</span>
          </div>
        </div>
      </div>

      {/* ── 2. Guía Visual Bento ── */}
      <GuiaClassroomVisual />

      {/* ── Alerta inteligente de Google API ── */}
      {mensaje && (() => {
        const esApiDeshabilitada =
          mensaje.toLowerCase().includes('google classroom api') ||
          mensaje.toLowerCase().includes('has not been used') ||
          mensaje.toLowerCase().includes('disabled');
        const matchUrl = mensaje.match(/(https:\/\/[^\s]+)/);
        const urlHabilitar = matchUrl ? matchUrl[1] : 'https://console.cloud.google.com/apis/library/classroom.googleapis.com';

        if (esApiDeshabilitada) {
          return (
            <div className="cuenta-toggle-card anim-fade-in" role="alert">
              <div className="cuenta-toggle-info">
                <div className="cuenta-toggle-title">
                  ⚠️ Google Classroom API pendiente de habilitación en Google Cloud
                </div>
                <div className="cuenta-toggle-desc">
                  Tu proyecto de Google Cloud necesita tener activada la biblioteca <b>Google Classroom API</b> para consultar tus materias y estudiantes.
                </div>
                <div className="acciones acciones--mt">
                  <a href={urlHabilitar} target="_blank" rel="noreferrer noopener" className="boton">
                    🔗 Habilitar Google Classroom API en Google Cloud
                  </a>
                  <Boton type="button" variante="secundario" onClick={() => void cargarCursos(false)}>
                    🔄 Ya la habilité, reintentar
                  </Boton>
                </div>
              </div>
            </div>
          );
        }
        return <InlineMensaje tipo="info">{mensaje}</InlineMensaje>;
      })()}

      {/* ── 3. Conexión de Cuenta ── */}
      <div className="cuenta-panel anim-fade-in">
        <div className="banco-section-title">
          <div className="banco-section-title__wrap">
            <span className="banco-section-pill banco-section-pill--amber">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Cuenta Google & Sesión</span>
            </span>
            <h3 className="entregas-title-heading">
              <Icono nombre="cuenta" /> Vinculación de Cuenta Google
            </h3>
            <p className="nota">
              {estado?.conectado
                ? `Cuenta vinculada: ${estado.correoGoogle || 'Google Workspace'}. Lista para consultar cursos y tareas.`
                : 'Conecta tu cuenta institucional para autorizar la lectura de cursos, listas de alumnos y tareas.'}
            </p>
          </div>
          {estado?.conectado && (
            <div className="banco-section-side-meta">
              <span className="badge badge--success">● Vinculado</span>
            </div>
          )}
        </div>

        <div className="acciones acciones--mt">
          <Boton
            type="button"
            icono={<Icono nombre="entrar" />}
            disabled={!puedeClassroomConectar}
            onClick={() => void conectarClassroom()}
          >
            {estado?.conectado ? 'Reconectar Google' : 'Conectar Google'}
          </Boton>
          {estado?.conectado && (
            <Boton
              type="button"
              variante="secundario"
              disabled={!puedeClassroomConectar || desconectando}
              onClick={() => void desconectarClassroom()}
            >
              {desconectando ? 'Desconectando...' : 'Desconectar'}
            </Boton>
          )}
          <Boton
            type="button"
            variante="secundario"
            icono={<Icono nombre="recargar" />}
            disabled={cargandoEstado}
            onClick={() => void cargarEstado(false)}
          >
            {cargandoEstado ? 'Actualizando...' : 'Actualizar estado'}
          </Boton>
        </div>
      </div>

      {/* ── 4. Selección de Asignatura y Curso ── */}
      {estado?.conectado && (
        <div className="cuenta-subpanel anim-fade-in">
          <div className="banco-section-title">
            <div className="banco-section-title__wrap">
              <span className="banco-section-pill banco-section-pill--cyan">
                <span className="banco-section-pill__dot" aria-hidden="true" />
                <span>Asignación de Materia & Curso</span>
              </span>
              <h3 className="entregas-title-heading">
                <Icono nombre="periodos" /> Materia en EvaluaPro vs. Curso en Classroom
              </h3>
            </div>
          </div>

          <div className="grid grid--2">
            <label className="campo">
              <span>Materia en EvaluaPro</span>
              <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)}>
                {periodos.length === 0 ? (
                  <option value="">-- Sin materias registradas en EvaluaPro --</option>
                ) : (
                  <>
                    <option value="">-- Selecciona una materia local --</option>
                    {periodos.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.nombre}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </label>

            <label className="campo">
              <span>Curso en Google Classroom</span>
              <select
                value={courseIdSeleccionado}
                onChange={(e) => setCourseIdSeleccionado(e.target.value)}
                disabled={cargandoCursos}
              >
                <option value="">
                  {cargandoCursos
                    ? 'Cargando cursos activos...'
                    : cursos.length === 0
                      ? 'No hay cursos activos disponibles'
                      : `-- Selecciona un curso activo (${cursos.length} disponibles) --`}
                </option>
                {cursos.map((curso) => (
                  <option key={curso.id} value={curso.id}>
                    {curso.name} {curso.section ? `(${curso.section})` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="acciones acciones--mt">
            <Boton
              type="button"
              variante="secundario"
              icono={<Icono nombre="recargar" />}
              disabled={cargandoCursos}
              onClick={() => void cargarCursos(false)}
            >
              {cargandoCursos ? 'Cargando cursos...' : 'Recargar cursos de Classroom'}
            </Boton>
            {courseIdSeleccionado && !periodoId && (
              <Boton
                type="button"
                variante="primario"
                icono={<Icono nombre="periodos" />}
                disabled={creandoMateria}
                onClick={() => void crearMateriaDesdeCurso()}
              >
                {creandoMateria ? 'Creando materia...' : '✨ Crear materia en EvaluaPro desde este curso'}
              </Boton>
            )}
          </div>
        </div>
      )}

      {/* ── 5. Mapeo de Alumnos (Roster) ── */}
      {estado?.conectado && courseIdSeleccionado && (
        <div className="cuenta-subpanel anim-fade-in">
          <div className="banco-section-title">
            <div className="banco-section-title__wrap">
              <span className="banco-section-pill banco-section-pill--emerald">
                <span className="banco-section-pill__dot" aria-hidden="true" />
                <span>Emparejamiento de Matrícula</span>
              </span>
              <h3 className="entregas-title-heading">
                <Icono nombre="alumnos" /> Mapeo de Alumnos ({alumnosClassroom.length})
              </h3>
              <p className="nota">
                Asocia a los estudiantes de Google Classroom con los alumnos registrados en EvaluaPro.
              </p>
            </div>
            <div className="banco-section-side-meta">
              <input
                className="banco-search-input"
                placeholder="Buscar alumno en Classroom..."
                value={busquedaAlumnos}
                onChange={(e) => setBusquedaAlumnos(e.target.value)}
              />
            </div>
          </div>

          {cargandoRoster && <InlineMensaje tipo="info">Cargando lista de estudiantes desde Classroom...</InlineMensaje>}

          {!cargandoRoster && alumnosClassroom.length === 0 && (
            <div className="item-row item-glass">
              <p className="nota">No se encontraron estudiantes matriculados en este curso de Classroom.</p>
            </div>
          )}

          <div className="lista lista--compacta" data-testid="classroom-mapeo-alumnos">
            {alumnosClassroomFiltrados.map((fila) => (
              <div key={fila.classroomUserId} className="item-row item-glass">
                <div className="classroom-user-col">
                  <b>{fila.fullName || fila.classroomUserId}</b>
                  <div className="nota">{fila.emailAddress || 'Sin correo público'}</div>
                </div>
                <div className="classroom-select-col">
                  <select
                    value={mapeoEditable[fila.classroomUserId] || ''}
                    onChange={(event) =>
                      setMapeoEditable((prev) => ({
                        ...prev,
                        [fila.classroomUserId]: event.target.value
                      }))
                    }
                  >
                    <option value="">-- Sin vincular --</option>
                    {alumnosLocales.map((alumno) => (
                      <option key={alumno._id} value={alumno._id}>
                        {alumno.matricula ? `[${alumno.matricula}] ` : ''}{alumno.nombreCompleto}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="acciones acciones--mt">
            <Boton
              type="button"
              icono={<Icono nombre="ok" />}
              disabled={guardandoMapeo || cargandoRoster || alumnosClassroom.length === 0}
              onClick={() => void guardarMapeoCurso()}
            >
              {guardandoMapeo ? 'Guardando...' : 'Guardar Mapeo de Alumnos'}
            </Boton>
            <Boton
              type="button"
              variante="secundario"
              icono={<Icono nombre="recargar" />}
              disabled={cargandoRoster}
              onClick={() => void cargarRoster(courseIdSeleccionado, periodoId)}
            >
              {cargandoRoster ? 'Recargando...' : 'Recargar Alumnos'}
            </Boton>
          </div>
        </div>
      )}

      {/* ── 6. Actividades & Sincronización ── */}
      {estado?.conectado && courseIdSeleccionado && (
        <div className="cuenta-subpanel anim-fade-in">
          <div className="banco-section-title">
            <div className="banco-section-title__wrap">
              <span className="banco-section-pill banco-section-pill--violet">
                <span className="banco-section-pill__dot" aria-hidden="true" />
                <span>Tareas & Calificaciones Digitales</span>
              </span>
              <h3 className="entregas-title-heading">
                <Icono nombre="evaluaciones" /> Tareas de Classroom ({actividades.length})
              </h3>
              <p className="nota">Selecciona las actividades que deseas sincronizar para la evaluación continua.</p>
            </div>
          </div>

          {cargandoActividades && <InlineMensaje tipo="info">Cargando tareas desde Classroom...</InlineMensaje>}

          {!cargandoActividades && actividades.length === 0 && (
            <div className="item-row item-glass">
              <p className="nota">No se encontraron tareas o cuestionarios publicados en este curso de Classroom.</p>
            </div>
          )}

          <div className="lista lista--compacta" data-testid="classroom-actividades-lista">
            {actividades.map((actividad: ClassroomActividad) => {
              const editable = edicionActividades[actividad.id] || {
                courseId: courseIdSeleccionado,
                courseWorkId: actividad.id,
                tituloEvidencia: actividad.title,
                descripcionEvidencia: actividad.description || '',
                ponderacion: '1',
                corte: '1',
                activo: true
              };
              const seleccionada = actividadIdsSeleccionados.includes(actividad.id);

              return (
                <div key={actividad.id} className="item-row item-glass">
                  <div className="classroom-act-check">
                    <label className="checkbox-ui">
                      <input
                        type="checkbox"
                        checked={seleccionada}
                        aria-label={`Seleccionar ${actividad.title}`}
                        onChange={() => toggleActividad(actividad.id)}
                      />
                      <span className="checkbox-ui__box" aria-hidden="true" />
                    </label>
                  </div>
                  <div className="classroom-act-main">
                    <b>{actividad.title}</b>
                    <div className="nota">{actividad.description || 'Sin descripción'}</div>
                    <div className="classroom-act-meta">
                      <span>Puntos max: {actividad.maxPoints ?? 'N/D'}</span>
                      {actividad.state && <span>Estado: {actividad.state}</span>}
                    </div>
                  </div>
                  <div className="classroom-act-corte">
                    <label className="campo">
                      <span>Corte</span>
                      <select
                        value={editable.corte}
                        onChange={(e) =>
                          setEdicionActividades((prev) => ({
                            ...prev,
                            [actividad.id]: { ...editable, corte: e.target.value }
                          }))
                        }
                      >
                        <option value="1">Corte 1</option>
                        <option value="2">Corte 2</option>
                        <option value="3">Corte 3</option>
                      </select>
                    </label>
                  </div>
                  <div className="classroom-act-pond">
                    <label className="campo">
                      <span>Ponderación</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={editable.ponderacion}
                        onChange={(e) =>
                          setEdicionActividades((prev) => ({
                            ...prev,
                            [actividad.id]: { ...editable, ponderacion: e.target.value }
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="acciones acciones--mt">
            <Boton
              type="button"
              variante="secundario"
              disabled={ejecutando || cargandoActividades || actividades.length === 0}
              onClick={() => void previsualizarImportacion()}
            >
              {ejecutando ? 'Analizando...' : 'Previsualizar importación'}
            </Boton>
            <Boton
              type="button"
              variante="primario"
              icono={<Icono nombre="recargar" />}
              disabled={ejecutando || cargandoActividades || actividades.length === 0}
              onClick={() => void ejecutarImportacion()}
            >
              {ejecutando ? 'Sincronizando...' : 'Ejecutar Sincronización a EvaluaPro'}
            </Boton>
            <Boton
              type="button"
              variante="secundario"
              icono={<Icono nombre="recargar" />}
              disabled={cargandoActividades}
              onClick={() => void cargarActividades(courseIdSeleccionado, periodoId)}
            >
              {cargandoActividades ? 'Recargando...' : 'Recargar Tareas'}
            </Boton>
          </div>

          {/* Resultado de Previsualización / Sincronización */}
          {preview && (
            <div className="cuenta-toggle-card anim-fade-in cuenta-subpanel--mt">
              <div className="cuenta-toggle-info">
                <div className="cuenta-toggle-title">
                  {preview.dryRun ? '📊 Previsualización de Importación' : '✅ Sincronización Completada'}
                </div>
                <div className="cuenta-toggle-desc">
                  Tareas procesadas: <b>{preview.totalActividades}</b> · Calificaciones detectadas: <b>{preview.submissionsProcesadas}</b> · Importadas:{' '}
                  <b>{preview.importadas}</b> · Actualizadas: <b>{preview.actualizadas}</b> · Omitidas:{' '}
                  <b>{preview.omitidas}</b>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
