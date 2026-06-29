/**
 * CentroClassroom
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { emitToast } from '../../ui/toast/toastBus';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { clienteApi } from './clienteApiDocente';
import type {
  ClassroomActividad,
  ClassroomAlumnoCurso,
  ClassroomAlumnoLocal,
  ClassroomCurso,
  ClassroomEstado,
  ClassroomPreviewResultado
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

function apiOrigin(): string {
  try {
    return new URL(clienteApi.baseApi, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

export function CentroClassroom({
  periodoId,
  puedeClassroomConectar,
  puedeClassroomPull,
  classroomDisponible
}: {
  periodoId: string;
  puedeClassroomConectar: boolean;
  puedeClassroomPull: boolean;
  classroomDisponible: boolean;
}) {
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
  const [busquedaSubmissions, setBusquedaSubmissions] = useState('');
  const [historial, setHistorial] = useState<
    Array<{ _id: string; tipo: 'preview' | 'ejecucion'; resumen?: Record<string, unknown>; ejecutadoEn?: string }>
  >([]);
  const [cargandoEstado, setCargandoEstado] = useState(false);
  const [cargandoCursos, setCargandoCursos] = useState(false);
  const [cargandoActividades, setCargandoActividades] = useState(false);
  const [cargandoRoster, setCargandoRoster] = useState(false);
  const [guardandoMapeo, setGuardandoMapeo] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [mensaje, setMensaje] = useState('');

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

  const busquedaSubmissionsNormalizada = useMemo(() => normalizarBusqueda(busquedaSubmissions), [busquedaSubmissions]);

  const cargarEstado = useCallback(async () => {
    if (!puedeClassroomPull) return;
    setCargandoEstado(true);
    try {
      const respuesta = await clienteApi.obtener<{ estado: ClassroomEstado }>('/evaluaciones/v2/classroom/estado');
      setEstado(respuesta.estado);
    } catch (error) {
      setMensaje(mensajeDeError(error, 'No se pudo cargar el estado de Classroom.'));
    } finally {
      setCargandoEstado(false);
    }
  }, [puedeClassroomPull]);

  const cargarCursos = useCallback(async () => {
    if (!puedeClassroomPull || !classroomDisponible) return;
    setCargandoCursos(true);
    try {
      const respuesta = await clienteApi.obtener<{ cursos: ClassroomCurso[] }>('/evaluaciones/v2/classroom/cursos');
      setCursos(Array.isArray(respuesta.cursos) ? respuesta.cursos : []);
    } catch (error) {
      setMensaje(mensajeDeError(error, 'No se pudieron cargar los cursos de Classroom.'));
    } finally {
      setCargandoCursos(false);
    }
  }, [classroomDisponible, puedeClassroomPull]);

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

  const cargarHistorial = useCallback(async () => {
    if (!periodoId || !puedeClassroomPull) return;
    try {
      const respuesta = await clienteApi.obtener<{
        historial: Array<{ _id: string; tipo: 'preview' | 'ejecucion'; resumen?: Record<string, unknown>; ejecutadoEn?: string }>;
      }>(`/evaluaciones/v2/classroom/importaciones/historial?periodoId=${encodeURIComponent(periodoId)}`);
      setHistorial(Array.isArray(respuesta.historial) ? respuesta.historial : []);
    } catch {
      setHistorial([]);
    }
  }, [periodoId, puedeClassroomPull]);

  useEffect(() => {
    if (!classroomDisponible || !puedeClassroomPull) return;
    void cargarEstado();
    if (periodoId) {
      void cargarHistorial();
    }
  }, [cargarEstado, cargarHistorial, classroomDisponible, puedeClassroomPull, periodoId]);

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
    setBusquedaSubmissions('');
    if (!courseIdSeleccionado || !periodoId || !estado?.conectado) return;
    void cargarActividades(courseIdSeleccionado);
    void cargarRoster(courseIdSeleccionado);
  }, [cargarActividades, cargarRoster, courseIdSeleccionado, periodoId, estado?.conectado]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const data = (event.data || {}) as { source?: unknown; status?: unknown; message?: unknown };
      if (String(data.source || '') !== 'classroom-oauth') return;
      if (event.origin !== apiOrigin()) return;
      if (String(data.status || '') === 'ok') {
        emitToast({ level: 'ok', title: 'Classroom', message: String(data.message || 'Cuenta conectada') });
        void cargarEstado();
      } else {
        emitToast({ level: 'error', title: 'Classroom', message: String(data.message || 'No se pudo conectar') });
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [cargarEstado]);

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
        throw new Error('No se recibió URL de autorización');
      }
      window.open(url, 'oauth_classroom', 'width=980,height=760');
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
      emitToast({ level: 'ok', title: 'Classroom', message: 'Mapeo de alumnos guardado' });
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
      await cargarHistorial();
      if (persistir) {
        await cargarEstado();
      }
      emitToast({
        level: 'ok',
        title: persistir ? 'Classroom importado' : 'Classroom preview',
        message: `Procesadas ${respuesta.submissionsProcesadas} submissions`
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

  const sinSeleccion = actividadesSeleccionadas.length === 0;

  if (!classroomDisponible) {
    return <InlineMensaje tipo="info">Google Classroom no está disponible en este entorno.</InlineMensaje>;
  }

  return (
    <div className="panel">
      <h4>Google Classroom</h4>
      {mensaje && <InlineMensaje tipo="info">{mensaje}</InlineMensaje>}

      <div className="item-row">
        <Boton type="button" disabled={!puedeClassroomConectar} onClick={() => void conectarClassroom()}>
          {estado?.conectado ? 'Reconectar Google' : 'Conectar Google'}
        </Boton>
        <Boton type="button" variante="secundario" disabled={!estado?.conectado || !puedeClassroomConectar} onClick={() => void desconectarClassroom()}>
          Desconectar
        </Boton>
        <Boton type="button" variante="secundario" disabled={cargandoEstado} onClick={() => void cargarEstado()}>
          {cargandoEstado ? 'Actualizando...' : 'Actualizar estado'}
        </Boton>
      </div>

      <div className="item-row">
        <p><b>Cuenta:</b> {estado?.correoGoogle || 'Sin conectar'}</p>
        <p><b>Último sync:</b> {estado?.ultimaSincronizacionEn ? new Date(estado.ultimaSincronizacionEn).toLocaleString() : '-'}</p>
        <p><b>Último error:</b> {estado?.ultimoError || '-'}</p>
      </div>

      {estado?.conectado && (
        <>
          <div className="item-row">
            <label>
              Curso
              <select
                value={courseIdSeleccionado}
                onChange={(event) => setCourseIdSeleccionado(event.target.value)}
                disabled={cargandoCursos}
              >
                <option value="">Selecciona curso</option>
                {cursos.map((curso) => (
                  <option key={curso.id} value={curso.id}>
                    {curso.name}{curso.section ? ` (${curso.section})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <Boton type="button" variante="secundario" disabled={cargandoCursos || !estado?.conectado} onClick={() => void cargarCursos()}>
              {cargandoCursos ? 'Cargando cursos...' : 'Recargar cursos'}
            </Boton>
          </div>

          {courseIdSeleccionado && (
            <>
              <div className="panel">
                <h5>Actividades</h5>
                {cargandoActividades && <InlineMensaje tipo="info">Cargando actividades...</InlineMensaje>}
                {actividades.map((actividad) => {
                  const editable = edicionActividades[actividad.id];
                  const seleccionada = actividadIdsSeleccionados.includes(actividad.id);
                  return (
                    <div key={actividad.id} className="item-glass">
                      <label>
                        <input
                          type="checkbox"
                          checked={seleccionada}
                          onChange={() => toggleActividad(actividad.id)}
                        />
                        {' '}
                        {actividad.title} {actividad.maxPoints ? `(max ${actividad.maxPoints})` : ''}
                      </label>
                      {seleccionada && editable && (
                        <div className="grid grid--2">
                          <label>
                            Título evidencia
                            <input
                              value={editable.tituloEvidencia}
                              onChange={(event) =>
                                setEdicionActividades((prev) => ({
                                  ...prev,
                                  [actividad.id]: { ...editable, tituloEvidencia: event.target.value }
                                }))
                              }
                            />
                          </label>
                          <label>
                            Descripción
                            <input
                              value={editable.descripcionEvidencia}
                              onChange={(event) =>
                                setEdicionActividades((prev) => ({
                                  ...prev,
                                  [actividad.id]: { ...editable, descripcionEvidencia: event.target.value }
                                }))
                              }
                            />
                          </label>
                          <label>
                            Ponderación
                            <input
                              value={editable.ponderacion}
                              onChange={(event) =>
                                setEdicionActividades((prev) => ({
                                  ...prev,
                                  [actividad.id]: { ...editable, ponderacion: event.target.value }
                                }))
                              }
                            />
                          </label>
                          <label>
                            Corte
                            <select
                              value={editable.corte}
                              onChange={(event) =>
                                setEdicionActividades((prev) => ({
                                  ...prev,
                                  [actividad.id]: { ...editable, corte: event.target.value }
                                }))
                              }
                            >
                              <option value="1">C1</option>
                              <option value="2">C2</option>
                              <option value="3">C3</option>
                            </select>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="panel">
                <h5>Mapeo de alumnos por curso</h5>
                {cargandoRoster && <InlineMensaje tipo="info">Cargando alumnos Classroom...</InlineMensaje>}
                {alumnosClassroom.length > 0 && (
                  <>
                    <div className="item-row">
                      <label>
                        Buscar alumno Classroom
                        <input
                          value={busquedaAlumnos}
                          onChange={(event) => setBusquedaAlumnos(event.target.value)}
                          placeholder="Nombre, correo, matricula o match"
                        />
                      </label>
                      <p>Mostrando {alumnosClassroomFiltrados.length} de {alumnosClassroom.length} alumnos</p>
                    </div>
                    <div className="lista lista--compacta" data-testid="classroom-mapeo-alumnos">
                      {alumnosClassroomFiltrados.map((fila) => (
                        <div key={fila.classroomUserId} className="item-row">
                          <div>
                            <div><b>{fila.fullName || fila.classroomUserId}</b></div>
                            <div>{fila.emailAddress || '-'}</div>
                            <div>Estrategia sugerida: {fila.matchStrategy}</div>
                          </div>
                          <label>
                            Alumno local
                            <select
                              value={mapeoEditable[fila.classroomUserId] || ''}
                              onChange={(event) =>
                                setMapeoEditable((prev) => ({
                                  ...prev,
                                  [fila.classroomUserId]: event.target.value
                                }))
                              }
                            >
                              <option value="">Sin asignar</option>
                              {alumnosLocales.map((alumno) => (
                                <option key={alumno._id} value={alumno._id}>
                                  {alumno.nombreCompleto} {alumno.matricula ? `(${alumno.matricula})` : ''}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="acciones acciones--mt">
                  <Boton type="button" disabled={guardandoMapeo || alumnosClassroom.length === 0} onClick={() => void guardarMapeoCurso()}>
                    {guardandoMapeo ? 'Guardando mapeo...' : 'Guardar mapeo'}
                  </Boton>
                </div>
              </div>

              <div className="item-row">
                <Boton type="button" disabled={sinSeleccion || ejecutando} onClick={() => void ejecutarPreview(false)}>
                  {ejecutando ? 'Procesando...' : 'Preview importación'}
                </Boton>
                <Boton type="button" disabled={sinSeleccion || ejecutando} onClick={() => void ejecutarPreview(true)}>
                  {ejecutando ? 'Importando...' : 'Ejecutar importación'}
                </Boton>
              </div>

              {preview && (
                <div className="panel" data-testid="classroom-preview">
                  <h5>{preview.tipo === 'preview' ? 'Preview' : 'Resultado de importación'}</h5>
                  <p>
                    Procesadas: {preview.submissionsProcesadas} | Matched: {preview.matched} | Pendientes: {preview.pending} |
                    Calificadas: {preview.graded} | Unmatched: {preview.unmatched}
                  </p>
                  <label>
                    Buscar submission Classroom
                    <input
                      value={busquedaSubmissions}
                      onChange={(event) => setBusquedaSubmissions(event.target.value)}
                      placeholder="Alumno, estado, match o submission"
                    />
                  </label>
                  {preview.actividades.map((actividad) => (
                    <div key={`${actividad.courseId}-${actividad.courseWorkId}`} className="item-glass">
                      <div>
                        <b>{actividad.courseWorkTitle || actividad.courseWorkId}</b> ({actividad.courseName || actividad.courseId})
                      </div>
                      <div>
                        Procesadas {actividad.submissionsProcesadas} | Crear {actividad.wouldCreate} | Actualizar {actividad.wouldUpdate}
                      </div>
                      {actividad.submissions.length > 0 && (
                        <div className="lista lista--compacta">
                          {(() => {
                            const submissionsFiltradas = busquedaSubmissionsNormalizada
                              ? actividad.submissions.filter((submission) =>
                                  [
                                    submission.submissionId,
                                    submission.classroomUserId,
                                    submission.studentName,
                                    submission.studentEmail,
                                    submission.alumnoNombre,
                                    submission.matchStrategy,
                                    submission.estadoCaptura,
                                    typeof submission.calificacionDecimal === 'number' ? String(submission.calificacionDecimal) : ''
                                  ]
                                    .map(normalizarBusqueda)
                                    .some((valor) => valor.includes(busquedaSubmissionsNormalizada))
                                )
                              : actividad.submissions;
                            return (
                              <>
                                <p>Mostrando {submissionsFiltradas.length} de {actividad.submissions.length} submissions</p>
                                {submissionsFiltradas.map((submission) => (
                                  <div key={submission.submissionId}>
                                    {submission.studentName || submission.classroomUserId}{' -> '}{submission.alumnoNombre || 'Sin mapear'} · {submission.estadoCaptura}
                                    {typeof submission.calificacionDecimal === 'number' ? ` · ${submission.calificacionDecimal}` : ''}
                                  </div>
                                ))}
                              </>
                            );
                          })()}
                        </div>
                      )}
                      {actividad.errors.length > 0 && (
                        <InlineMensaje tipo="warning">
                          {actividad.errors.map((error) => error.mensaje).join(' | ')}
                        </InlineMensaje>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      <div className="panel">
        <h5>Historial reciente</h5>
        {historial.length === 0 && <InlineMensaje tipo="info">Aún no hay ejecuciones registradas para este periodo.</InlineMensaje>}
        {historial.length > 0 && (
          <div className="lista lista--compacta">
            {historial.map((item) => (
              <div key={item._id}>
                <b>{item.tipo}</b> · {item.ejecutadoEn ? new Date(item.ejecutadoEn).toLocaleString() : '-'} · procesadas:{' '}
                {Number(item.resumen?.submissionsProcesadas ?? 0)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
