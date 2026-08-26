/**
 * SeccionClassroom
 *
 * Responsabilidad: Seccion dedicada e independiente para Google Classroom & Workspace.
 * Limites: Sin estilos inline, soporte Dark/Light y diseño Bento estandarizado.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { emitToast } from '../../ui/toast/toastBus';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { Icono } from '../../ui/iconos';
import { clienteApi } from './clienteApiDocente';
import { GuiaClassroomVisual } from './GuiaClassroomVisual';
import type {
  ClassroomActividad,
  ClassroomAlumnoCurso,
  ClassroomAlumnoLocal,
  ClassroomCurso,
  ClassroomEstado,
  ClassroomPreviewResultado,
  Periodo
} from './tipos';
import { mensajeDeError } from './utilidades';

type ActividadEditable = {
  courseId: string;
  courseWorkId: string;
  tituloEvidencia: string;
  descripcionEvidencia: string;
  ponderacion: string;
  corte: string;
  activo: boolean;
};

function normalizarBusqueda(valor: unknown): string {
  return String(valor ?? '').trim().toLowerCase();
}

export function SeccionClassroom({
  periodos,
  puedeClassroomConectar,
  puedeClassroomPull,
  classroomDisponible
}: {
  periodos: Periodo[];
  puedeClassroomConectar: boolean;
  puedeClassroomPull: boolean;
  classroomDisponible: boolean;
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
  const [ejecutando, setEjecutando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  // Si cambia periodos y periodoId no es valido, actualizar
  useEffect(() => {
    if (periodos.length > 0 && !periodos.some((p) => p._id === periodoId)) {
      setPeriodoId(periodos[0]._id);
    }
  }, [periodos, periodoId]);

  useEffect(() => {
    if (cursos.length > 0 && !courseIdSeleccionado) {
      setCourseIdSeleccionado(cursos[0].id);
    }
  }, [cursos, courseIdSeleccionado]);

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
    return alumnosClassroom.filter((fila) => {
      const alumnoLocal =
        alumnosLocalesPorId.get(mapeoEditable[fila.classroomUserId] || '') ||
        fila.alumnoConfirmado ||
        fila.alumnoSugerido ||
        null;
      return [
        fila.classroomUserId,
        fila.fullName,
        fila.emailAddress,
        fila.matchStrategy,
        alumnoLocal?.nombreCompleto,
        alumnoLocal?.matricula,
        alumnoLocal?.correo
      ]
        .map(normalizarBusqueda)
        .some((valor) => valor.includes(busqueda));
    });
  }, [alumnosClassroom, alumnosLocalesPorId, busquedaAlumnos, mapeoEditable]);

  const cargarCursos = useCallback(async () => {
    if (!puedeClassroomPull || !classroomDisponible) return;
    setCargandoCursos(true);
    try {
      setMensaje('');
      const respuesta = await clienteApi.obtener<{ cursos: ClassroomCurso[] }>('/evaluaciones/v2/classroom/cursos');
      const lista = Array.isArray(respuesta.cursos)
        ? respuesta.cursos.filter((c) => !c.courseState || c.courseState.toUpperCase() === 'ACTIVE')
        : [];
      setCursos(lista);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron cargar los cursos de Classroom.');
      setMensaje(msg);
    } finally {
      setCargandoCursos(false);
    }
  }, [classroomDisponible, puedeClassroomPull]);

  const cargarEstado = useCallback(async () => {
    if (!puedeClassroomPull) return;
    setCargandoEstado(true);
    try {
      const respuesta = await clienteApi.obtener<{ estado: ClassroomEstado }>('/evaluaciones/v2/classroom/estado');
      setEstado(respuesta.estado);
      if (respuesta.estado?.conectado) {
        void cargarCursos();
      }
    } catch (error) {
      setMensaje(mensajeDeError(error, 'No se pudo cargar el estado de Classroom.'));
    } finally {
      setCargandoEstado(false);
    }
  }, [cargarCursos, puedeClassroomPull]);

  const cargarActividades = useCallback(async (courseId: string) => {
    if (!periodoId || !courseId) return;
    setCargandoActividades(true);
    try {
      const respuesta = await clienteApi.obtener<{ actividades: ClassroomActividad[] }>(
        `/evaluaciones/v2/classroom/cursos/${encodeURIComponent(courseId)}/actividades?periodoId=${encodeURIComponent(periodoId)}`
      );
      const lista = Array.isArray(respuesta.actividades) ? respuesta.actividades : [];
      setActividades(lista);
      setEdicionActividades(
        Object.fromEntries(
          lista.map((actividad) => [
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
      setMensaje(mensajeDeError(error, 'No se pudieron cargar las actividades de Classroom.'));
    } finally {
      setCargandoActividades(false);
    }
  }, [periodoId]);

  const cargarRoster = useCallback(async (courseId: string) => {
    if (!periodoId || !courseId) return;
    setCargandoRoster(true);
    try {
      const respuesta = await clienteApi.obtener<{
        alumnosLocales: ClassroomAlumnoLocal[];
        alumnosClassroom: ClassroomAlumnoCurso[];
      }>(`/evaluaciones/v2/classroom/cursos/${encodeURIComponent(courseId)}/alumnos?periodoId=${encodeURIComponent(periodoId)}`);
      const locales = Array.isArray(respuesta.alumnosLocales) ? respuesta.alumnosLocales : [];
      const classroom = Array.isArray(respuesta.alumnosClassroom) ? respuesta.alumnosClassroom : [];
      setAlumnosLocales(locales);
      setAlumnosClassroom(classroom);
      setMapeoEditable(
        Object.fromEntries(
          classroom.map((fila) => [
            fila.classroomUserId,
            String(fila.alumnoIdConfirmado ?? fila.alumnoIdSugerido ?? '')
          ])
        )
      );
    } catch (error) {
      setMensaje(mensajeDeError(error, 'No se pudo cargar el mapeo de alumnos Classroom.'));
    } finally {
      setCargandoRoster(false);
    }
  }, [periodoId]);

  useEffect(() => {
    if (!classroomDisponible || !puedeClassroomPull) return;
    void cargarEstado();
  }, [cargarEstado, classroomDisponible, puedeClassroomPull]);

  useEffect(() => {
    if (!classroomDisponible || !estado?.conectado) {
      setCursos([]);
      return;
    }
    void cargarCursos();
  }, [cargarCursos, classroomDisponible, estado?.conectado]);

  useEffect(() => {
    setPreview(null);
    setActividadIdsSeleccionados([]);
    setActividades([]);
    setAlumnosLocales([]);
    setAlumnosClassroom([]);
    setBusquedaAlumnos('');
    if (!courseIdSeleccionado || !periodoId || !estado?.conectado) return;
    void cargarActividades(courseIdSeleccionado);
    void cargarRoster(courseIdSeleccionado);
  }, [cargarActividades, cargarRoster, courseIdSeleccionado, periodoId, estado?.conectado]);

  useEffect(() => {
    function onSyncEvent(data: { source?: unknown; status?: unknown; message?: unknown }) {
      if (String(data.source || '') !== 'classroom-oauth') return;
      if (String(data.status || '') === 'ok') {
        emitToast({ level: 'ok', title: 'Classroom', message: String(data.message || 'Cuenta conectada con éxito') });
        void cargarEstado();
        void cargarCursos();
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

  async function conectarClassroom() {
    if (!puedeClassroomConectar) return;
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
            void cargarEstado();
            void cargarCursos();
          }
        }, 600);
      }
    } catch (error) {
      emitToast({ level: 'error', title: 'Classroom', message: mensajeDeError(error, 'No se pudo conectar Google Classroom.') });
    }
  }

  async function desconectarClassroom() {
    if (!puedeClassroomConectar) return;
    try {
      await clienteApi.enviar('/evaluaciones/v2/classroom/oauth/desconectar', {});
      emitToast({ level: 'ok', title: 'Classroom', message: 'Cuenta Classroom desconectada' });
      setEstado({ conectado: false });
      setCursos([]);
      setActividades([]);
      setAlumnosClassroom([]);
      setPreview(null);
    } catch (error) {
      emitToast({ level: 'error', title: 'Classroom', message: mensajeDeError(error, 'No se pudo desconectar Classroom.') });
    }
  }

  async function guardarMapeoCurso() {
    if (!periodoId || !courseIdSeleccionado) return;
    setGuardandoMapeo(true);
    try {
      const asignaciones = alumnosClassroom.map((fila) => ({
        classroomUserId: fila.classroomUserId,
        alumnoId: mapeoEditable[fila.classroomUserId] || null
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
      emitToast({ level: 'ok', title: 'Classroom', message: 'Mapeo de alumnos guardado correctamente' });
    } catch (error) {
      emitToast({ level: 'error', title: 'Classroom', message: mensajeDeError(error, 'No se pudo guardar el mapeo de alumnos.') });
    } finally {
      setGuardandoMapeo(false);
    }
  }

  async function ejecutarPreview(persistir: boolean) {
    if (!periodoId || actividadesSeleccionadas.length === 0) return;
    setEjecutando(true);
    try {
      const ruta = persistir
        ? '/evaluaciones/v2/classroom/importaciones/ejecutar'
        : '/evaluaciones/v2/classroom/importaciones/preview';
      const respuesta = await clienteApi.enviar<ClassroomPreviewResultado>(ruta, {
        periodoId,
        actividades: payloadActividadesSeleccionadas()
      });
      setPreview(respuesta);
      if (persistir) {
        await cargarEstado();
      }
      emitToast({
        level: 'ok',
        title: persistir ? 'Classroom Importado' : 'Classroom Preview',
        message: `Procesadas ${respuesta.submissionsProcesadas} entregas de alumnos`
      });
    } catch (error) {
      emitToast({
        level: 'error',
        title: 'Classroom',
        message: mensajeDeError(error, persistir ? 'No se pudo ejecutar la importación.' : 'No se pudo generar el preview.')
      });
    } finally {
      setEjecutando(false);
    }
  }

  return (
    <div className="panel cuenta-panel anim-entrada" aria-label="Módulo Google Classroom">
      {/* ── 1. Hero Header Bento ── */}
      <div className="banco-panel__head cuenta-panel__head anim-fade-in">
        <div className="banco-panel__lead">
          <div className="banco-panel__icon-orb cuenta-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <Icono nombre="classroom" />
          </div>
          <div className="banco-panel__text-block">
            <div className="banco-panel__meta-row">
              <span className="banco-status-pill cuenta-status-pill">
                <span className="banco-pulse-dot" aria-hidden="true" />
                <span>Integración Cloud · Google Workspace</span>
              </span>
              <span className="banco-counter-tag">{estado?.correoGoogle || 'Google Cloud'}</span>
            </div>
            <h2 className="banco-panel__title eyebrow">Classroom</h2>
            <p className="nota">
              Sincroniza tus asignaturas, empareja alumnos automáticamente e importa tareas y calificaciones digitales.
            </p>
          </div>
        </div>

        {/* Mini-KPIs */}
        <div className="banco-header-kpis" aria-live="polite">
          <div className="banco-mini-kpi banco-mini-kpi--preguntas anim-kpi-hover" data-tooltip="Estado de conexión con Google">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <Icono nombre="entrar" />
            </span>
            <span className={`banco-mini-kpi__num banco-mini-kpi__num--sm ${estado?.conectado ? 'banco-mini-kpi__num--emerald' : 'banco-mini-kpi__num--slate'}`}>
              {estado?.conectado ? 'Conectado' : 'Manual'}
            </span>
            <span className="banco-mini-kpi__lbl">Estado</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temas anim-kpi-hover" data-tooltip="Cursos detectados en Google Classroom">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <Icono nombre="periodos" />
            </span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--sm banco-mini-kpi__num--sky">
              {cursos.length}
            </span>
            <span className="banco-mini-kpi__lbl">Cursos</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temaactual anim-kpi-hover" data-tooltip="Actividades y tareas encontradas">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <Icono nombre="evaluaciones" />
            </span>
            <span className="banco-mini-kpi__num banco-mini-kpi__num--sm banco-mini-kpi__num--amber">
              {actividades.length}
            </span>
            <span className="banco-mini-kpi__lbl">Tareas</span>
          </div>
        </div>
      </div>

      {/* ── 2. Guía Visual Rápida ── */}
      <GuiaClassroomVisual />

      {mensaje && (() => {
        const esApiDeshabilitada = mensaje.toLowerCase().includes('google classroom api') || mensaje.toLowerCase().includes('has not been used') || mensaje.toLowerCase().includes('disabled');
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
                  <a
                    href={urlHabilitar}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="boton"
                  >
                    🔗 Habilitar Google Classroom API en Google Cloud
                  </a>
                  <Boton
                    type="button"
                    variante="secundario"
                    onClick={() => void cargarCursos()}
                  >
                    🔄 Ya la habilité, reintentar
                  </Boton>
                </div>
              </div>
            </div>
          );
        }
        return <InlineMensaje tipo="info">{mensaje}</InlineMensaje>;
      })()}

      {/* ── 3. Bento Connection Deck ── */}
      <div className="cuenta-subpanel cuenta-oauth anim-fade-in">
        <div className="banco-section-title">
          <div className="banco-section-title__wrap">
            <span className="banco-section-pill banco-section-pill--amber">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Cuenta Google & Sesión</span>
            </span>
            <h3 className="entregas-title-heading">
              <Icono nombre="candado" /> Vinculación de Cuenta Google
            </h3>
            <p className="nota">
              {estado?.conectado
                ? `Cuenta vinculada: ${estado.correoGoogle || 'Google Workspace'}. Lista para consultar cursos y tareas.`
                : 'Conecta tu cuenta institucional de Google para autorizar la lectura de Classroom.'}
            </p>
          </div>
          <div className="banco-section-side-meta">
            <span className={estado?.conectado ? 'banco-counter-tag banco-counter-tag--emerald' : 'banco-counter-tag'}>
              {estado?.conectado ? '● Vinculado' : '○ Desconectado'}
            </span>
          </div>
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
              disabled={!puedeClassroomConectar}
              onClick={() => void desconectarClassroom()}
            >
              Desconectar
            </Boton>
          )}
          <Boton
            type="button"
            variante="secundario"
            icono={<Icono nombre="recargar" />}
            disabled={cargandoEstado}
            onClick={() => void cargarEstado()}
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
                {periodos.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.nombre}
                  </option>
                ))}
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
                      : `-- Selecciona un curso activo (${cursos.length}) --`}
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
              onClick={() => void cargarCursos()}
            >
              {cargandoCursos ? 'Cargando cursos...' : 'Recargar cursos de Classroom'}
            </Boton>
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
              <p className="nota">Asocia a los estudiantes de Google Classroom con los alumnos registrados en EvaluaPro.</p>
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
              disabled={guardandoMapeo || cargandoRoster}
              onClick={() => void guardarMapeoCurso()}
            >
              {guardandoMapeo ? 'Guardando...' : 'Guardar Mapeo de Alumnos'}
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

          {cargandoActividades && <InlineMensaje tipo="info">Cargando tareas de Classroom...</InlineMensaje>}

          <div className="grid">
            {actividades.map((actividad) => {
              const editable = edicionActividades[actividad.id];
              const seleccionada = actividadIdsSeleccionados.includes(actividad.id);
              return (
                <div key={actividad.id} className="item-glass">
                  <label className="campo">
                    <input
                      type="checkbox"
                      checked={seleccionada}
                      onChange={() => toggleActividad(actividad.id)}
                    />
                    <span>
                      {actividad.title} {actividad.maxPoints ? `(Puntos: ${actividad.maxPoints})` : ''}
                    </span>
                  </label>

                  {seleccionada && editable && (
                    <div className="grid grid--2">
                      <label className="campo">
                        <span>Título evidencia</span>
                        <input
                          value={editable.tituloEvidencia}
                          onChange={(e) =>
                            setEdicionActividades((prev) => ({
                              ...prev,
                              [actividad.id]: { ...editable, tituloEvidencia: e.target.value }
                            }))
                          }
                        />
                      </label>
                      <label className="campo">
                        <span>Corte evaluativo</span>
                        <select
                          value={editable.corte}
                          onChange={(e) =>
                            setEdicionActividades((prev) => ({
                              ...prev,
                              [actividad.id]: { ...editable, corte: e.target.value }
                            }))
                          }
                        >
                          <option value="1">Corte 1 (C1)</option>
                          <option value="2">Corte 2 (C2)</option>
                          <option value="3">Corte 3 (C3)</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="acciones acciones--mt">
            <Boton
              type="button"
              variante="secundario"
              disabled={actividadesSeleccionadas.length === 0 || ejecutando}
              onClick={() => void ejecutarPreview(false)}
            >
              {ejecutando ? 'Procesando...' : 'Previsualizar importación'}
            </Boton>
            <Boton
              type="button"
              disabled={actividadesSeleccionadas.length === 0 || ejecutando}
              onClick={() => void ejecutarPreview(true)}
            >
              {ejecutando ? 'Sincronizando...' : 'Ejecutar Sincronización a EvaluaPro'}
            </Boton>
          </div>

          {preview && (
            <div className="item-glass anim-fade-in">
              <h4>Resumen de Importación</h4>
              <p><b>Submissions procesadas:</b> {preview.submissionsProcesadas}</p>
              <p><b>Emparejadas / Sin emparejar:</b> {preview.matched} / {preview.unmatched}</p>
              <p><b>Importadas / Actualizadas:</b> {preview.importadas} / {preview.actualizadas}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
