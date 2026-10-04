import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { clienteApi } from './clienteApiDocente';
import { etiquetaMateria } from './utilidades';
import type { Alumno, Periodo, PermisosUI } from './tipos';

type CursoClassroom = { id: string; name: string; section?: string; courseState?: string };
type ActividadClassroom = { id: string; title: string; state?: string; maxPoints?: number; mapeo?: { corte?: number } | null };
type ResultadoImportacionClassroom = {
  totalActividades?: number;
  graded?: number;
  pending?: number;
  unmatched?: number;
  wouldCreate?: number;
  wouldUpdate?: number;
  importadas?: number;
  actualizadas?: number;
  errores?: Array<{ mensaje?: string }>;
  actividades?: Array<{
    courseId: string;
    courseWorkId: string;
    courseWorkTitle?: string;
    submissions?: Array<{
      submissionId: string;
      alumnoId?: string | null;
      alumnoNombre?: string | null;
      estadoClassroom?: string;
      vencida?: boolean;
      puedeConfirmarFaltante?: boolean;
      faltanteExplicito?: boolean;
    }>;
  }>;
  promediosEvaluacionContinuaTercerParcial?: Array<{
    alumnoId: string;
    alumnoNombre: string;
    puntosObtenidos: number;
    puntosPosibles: number;
    promedioSobre10: number;
    continuaSobre5: number;
    actividadesCalificadas: number;
    actividadesFaltantesConfirmadas: number;
  }>;
};
type EvidenciaClassroom = {
  id: string;
  alumnoId: string;
  titulo: string;
  fechaEvidencia: string;
  calificacionDecimal?: number | null;
  estadoCaptura: 'pendiente' | 'calificada';
  fuente: string;
  archivadaEn?: string | null;
  metadata?: { alternateLink?: unknown } | null;
  classroom?: {
    courseId?: string;
    courseWorkId?: string;
    courseWorkTitle?: string;
    assignedGrade?: number;
    maxPoints?: number;
    submissionState?: string;
  } | null;
};

export function obtenerUrlActividadClassroom(enlace: unknown): string | null {
  if (typeof enlace !== 'string' || !enlace.trim()) return null;
  try {
    const url = new URL(enlace);
    if (url.protocol !== 'https:' || url.hostname !== 'classroom.google.com' || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
type AlumnoClassroom = {
  classroomUserId: string;
  fullName?: string;
  emailAddress?: string;
  alumnoIdConfirmado?: string | null;
};

function normalizarBusquedaClassroom(valor: unknown): string {
  return String(valor ?? '').trim().toLocaleLowerCase('es-MX').normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function ClassroomEnCalificaciones({
  periodoId,
  periodos,
  onPeriodoChange,
  alumnos,
  permisos
}: {
  periodoId: string;
  periodos: Periodo[];
  onPeriodoChange: (periodoId: string) => void;
  alumnos: Alumno[];
  permisos: PermisosUI;
}) {
  const [evidencias, setEvidencias] = useState<EvidenciaClassroom[]>([]);
  const [busquedaEvidencias, setBusquedaEvidencias] = useState('');
  const [cursos, setCursos] = useState<CursoClassroom[]>([]);
  const [cargandoCursos, setCargandoCursos] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [actividades, setActividades] = useState<ActividadClassroom[]>([]);
  const [busquedaActividades, setBusquedaActividades] = useState('');
  const [cargandoActividades, setCargandoActividades] = useState(false);
  const [cortes, setCortes] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ResultadoImportacionClassroom | null>(null);
  const [faltantesConfirmados, setFaltantesConfirmados] = useState<Record<string, string[]>>({});
  const [proyeccionPendiente, setProyeccionPendiente] = useState(false);
  const [mapeoEjecutado, setMapeoEjecutado] = useState(false);
  const [alumnosCurso, setAlumnosCurso] = useState<AlumnoClassroom[]>([]);
  const [cargandoAlumnosCurso, setCargandoAlumnosCurso] = useState(false);
  const [busquedaAlumnos, setBusquedaAlumnos] = useState('');
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [mensajeEsError, setMensajeEsError] = useState(false);
  const [previsualizando, setPrevisualizando] = useState(false);
  const [aplicandoMapeo, setAplicandoMapeo] = useState(false);
  const confirm = useConfirmDialog();
  const periodoExiste = periodos.some((periodo) => periodo._id === periodoId);
  const alumnosPorId = useMemo(() => new Map(alumnos.map((alumno) => [alumno._id, alumno])), [alumnos]);
  const alumnosCursoFiltrados = useMemo(() => {
    const busqueda = normalizarBusquedaClassroom(busquedaAlumnos);
    if (!busqueda) return alumnosCurso;
    return alumnosCurso.filter((fila) => {
      const alumnoLocal = alumnosPorId.get(asignaciones[fila.classroomUserId] || fila.alumnoIdConfirmado || '');
      return [
        fila.classroomUserId,
        fila.fullName,
        fila.emailAddress,
        alumnoLocal?.nombreCompleto,
        alumnoLocal?.matricula,
        alumnoLocal?.correo
      ].some((valor) => normalizarBusquedaClassroom(valor).includes(busqueda));
    });
  }, [alumnosCurso, alumnosPorId, asignaciones, busquedaAlumnos]);
  const evidenciasFiltradas = useMemo(() => {
    const busqueda = normalizarBusquedaClassroom(busquedaEvidencias);
    if (!busqueda) return evidencias;
    return evidencias.filter((fila) => {
      const alumno = alumnosPorId.get(fila.alumnoId);
      return [
        alumno?.nombreCompleto,
        alumno?.matricula,
        alumno?.correo,
        fila.classroom?.courseWorkTitle,
        fila.titulo,
        fila.classroom?.assignedGrade,
        fila.classroom?.maxPoints,
        fila.classroom?.submissionState,
        fila.estadoCaptura
      ].some((valor) => normalizarBusquedaClassroom(valor).includes(busqueda));
    });
  }, [alumnosPorId, busquedaEvidencias, evidencias]);
  const actividadesFiltradas = useMemo(() => {
    const busqueda = normalizarBusquedaClassroom(busquedaActividades);
    return busqueda
      ? actividades.filter((actividad) => normalizarBusquedaClassroom(actividad.title).includes(busqueda))
      : actividades;
  }, [actividades, busquedaActividades]);
  const faltantesRevisables = useMemo(() => (preview?.actividades ?? []).flatMap((actividad) =>
    (actividad.submissions ?? [])
      .filter((submission) => submission.puedeConfirmarFaltante)
      .map((submission) => ({ actividad, submission }))
  ), [preview]);

  const cargarEvidencias = useCallback(async (): Promise<boolean> => {
    if (!periodoId || !periodoExiste || !permisos.evaluaciones.leer) {
      setEvidencias([]);
      return false;
    }
    setCargando(true);
    setMensaje('');
    setMensajeEsError(false);
    try {
      const filas: EvidenciaClassroom[] = [];
      const cursores = new Set<string>();
      let cursor: string | undefined;
      do {
        const query = new URLSearchParams({ periodoId, limite: '400' });
        if (cursor) query.set('cursor', cursor);
        const pagina = await clienteApi.obtener<{ evidencias?: EvidenciaClassroom[]; nextCursor?: string | null }>(
          `/evaluaciones/evidencias?${query}`
        );
        filas.push(...(pagina.evidencias ?? []));
        cursor = pagina.nextCursor || undefined;
        if (cursor && cursores.has(cursor)) throw new Error('La paginación de evidencias repitió un cursor.');
        if (cursor) cursores.add(cursor);
      } while (cursor);
      setEvidencias(filas.filter((fila) => fila.fuente === 'classroom' && !fila.archivadaEn));
      return true;
    } catch (error) {
      setEvidencias([]);
      setMensaje(error instanceof Error ? error.message : 'No se pudieron consultar las evidencias Classroom.');
      setMensajeEsError(true);
      return false;
    } finally {
      setCargando(false);
    }
  }, [periodoExiste, periodoId, permisos.evaluaciones.leer]);

  useEffect(() => { void cargarEvidencias(); }, [cargarEvidencias]);

  useEffect(() => {
    let cancelado = false;
    if (!permisos.classroom.pull) {
      setCursos([]);
      setCourseId('');
      setCargandoCursos(false);
      return () => { cancelado = true; };
    }
    setCargandoCursos(true);
    void clienteApi.obtener<{ cursos?: CursoClassroom[] }>('/evaluaciones/v2/classroom/cursos')
      .then((respuesta) => {
        if (cancelado) return;
        const activos = (respuesta.cursos ?? []).filter((curso) => !curso.courseState || curso.courseState.toUpperCase() === 'ACTIVE');
        setCursos(activos);
        setCourseId((actual) => activos.some((curso) => curso.id === actual) ? actual : '');
        setCargandoCursos(false);
      })
      .catch((error) => {
        if (cancelado) return;
        setCursos([]);
        setMensaje(error instanceof Error ? error.message : 'No se pudieron consultar los cursos de Google Classroom.');
        setMensajeEsError(true);
      })
      .finally(() => {
        if (!cancelado) setCargandoCursos(false);
      });
    return () => { cancelado = true; };
  }, [permisos.classroom.pull]);

  useEffect(() => {
    let cancelado = false;
    if (!periodoId || !courseId || !permisos.classroom.pull) {
      setAlumnosCurso([]);
      setAsignaciones({});
      setCargandoAlumnosCurso(false);
      return () => { cancelado = true; };
    }
    setCargandoAlumnosCurso(true);
    const query = new URLSearchParams({ periodoId });
    void clienteApi.obtener<{ alumnosClassroom?: AlumnoClassroom[] }>(
      `/evaluaciones/v2/classroom/cursos/${encodeURIComponent(courseId)}/alumnos?${query}`
    ).then((respuesta) => {
      if (cancelado) return;
      const filas = respuesta.alumnosClassroom ?? [];
      setAlumnosCurso(filas);
      setAsignaciones(Object.fromEntries(filas.map((fila) => [fila.classroomUserId, fila.alumnoIdConfirmado ?? ''])));
    }).catch((error) => {
      if (cancelado) return;
      setAlumnosCurso([]);
      setAsignaciones({});
      setMensaje(error instanceof Error ? error.message : 'No se pudo consultar la vinculación de estudiantes.');
      setMensajeEsError(true);
    }).finally(() => {
      if (!cancelado) setCargandoAlumnosCurso(false);
    });
    return () => { cancelado = true; };
  }, [courseId, periodoId, permisos.classroom.pull]);

  useEffect(() => {
    let cancelado = false;
    setPreview(null);
    setMapeoEjecutado(false);
    if (!periodoId || !courseId || !permisos.classroom.pull) {
      setActividades([]);
      setCortes({});
      setCargandoActividades(false);
      return () => { cancelado = true; };
    }
    setCargandoActividades(true);
    const query = new URLSearchParams({ periodoId });
    void clienteApi.obtener<{ actividades?: ActividadClassroom[] }>(
      `/evaluaciones/v2/classroom/cursos/${encodeURIComponent(courseId)}/actividades?${query}`
    ).then((respuesta) => {
      if (cancelado) return;
      const publicadas = (respuesta.actividades ?? []).filter((actividad) => String(actividad.state ?? '').toUpperCase() === 'PUBLISHED');
      setActividades(publicadas);
      setCortes(Object.fromEntries(publicadas.map((actividad) => [actividad.id, actividad.mapeo?.corte ? String(actividad.mapeo.corte) : ''])));
    }).catch((error) => {
      if (cancelado) return;
      setActividades([]);
      setCortes({});
      setMensaje(error instanceof Error ? error.message : 'No se pudieron consultar las actividades Classroom.');
      setMensajeEsError(true);
    }).finally(() => {
      if (!cancelado) setCargandoActividades(false);
    });
    return () => { cancelado = true; };
  }, [courseId, periodoId, permisos.classroom.pull]);

  async function guardarVinculaciones() {
    if (!periodoId || !courseId || !permisos.classroom.pull) return;
    setGuardando(true);
    setMensaje('');
    setMensajeEsError(false);
    try {
      await clienteApi.actualizar(`/evaluaciones/v2/classroom/cursos/${encodeURIComponent(courseId)}/mapeo-alumnos`, {
        periodoId,
        asignaciones: alumnosCurso.map((fila) => ({
          classroomUserId: fila.classroomUserId,
          alumnoId: asignaciones[fila.classroomUserId] || null
        })).filter((fila) => fila.alumnoId)
      });
      setMensaje('Vinculaciones guardadas. Las calificaciones nuevas podrán asociarse con estos alumnos.');
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudieron guardar las vinculaciones.');
      setMensajeEsError(true);
    } finally {
      setGuardando(false);
    }
  }

  function actividadesMapeadas(incluirConfirmaciones = false) {
    return actividades.filter((actividad) => ['1', '2', '3'].includes(cortes[actividad.id] ?? '')).map((actividad) => ({
      courseId,
      courseWorkId: actividad.id,
      corte: Number(cortes[actividad.id]),
      ...(incluirConfirmaciones && (preview?.actividades ?? []).some((fila) =>
        fila.courseWorkId === actividad.id && (fila.submissions ?? []).some((submission) => submission.puedeConfirmarFaltante)
      ) ? { faltantesConfirmados: faltantesConfirmados[actividad.id] ?? [] } : {})
    }));
  }

  async function previsualizarMapeo(preservarConfirmaciones = false) {
    const seleccion = actividadesMapeadas(preservarConfirmaciones);
    if (!periodoId || !courseId || seleccion.length === 0) {
      setMensaje('Selecciona al menos una actividad y su parcial destino antes de previsualizar.');
      setMensajeEsError(false);
      return;
    }
    setPrevisualizando(true);
    setMensaje('');
    setMensajeEsError(false);
    setPreview(null);
    if (!preservarConfirmaciones) setFaltantesConfirmados({});
    try {
      const respuesta = await clienteApi.enviar<ResultadoImportacionClassroom>('/evaluaciones/v2/classroom/importaciones/preview', {
        periodoId,
        actividades: seleccion
      });
      setPreview(respuesta);
      setFaltantesConfirmados(Object.fromEntries((respuesta.actividades ?? []).map((actividad) => [
        actividad.courseWorkId,
        (actividad.submissions ?? []).filter((submission) => submission.faltanteExplicito).map((submission) => submission.submissionId)
      ])));
      setProyeccionPendiente(false);
      setMapeoEjecutado(false);
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudo previsualizar la evaluación continua.');
      setMensajeEsError(true);
    } finally {
      setPrevisualizando(false);
    }
  }

  async function aplicarMapeo() {
    if (!preview) return;
    const confirmado = await confirm({
      title: 'Actualizar evaluación continua',
      message: 'Se sincronizarán las calificaciones ya asignadas en Classroom para las actividades y parciales seleccionados. No se crearán actividades ni se editarán notas en Classroom.',
      confirmLabel: 'Sincronizar selección',
      tone: 'warning'
    });
    if (!confirmado) return;
    setAplicandoMapeo(true);
    setMensaje('');
    setMensajeEsError(false);
    try {
      const respuesta = await clienteApi.enviar<ResultadoImportacionClassroom>('/evaluaciones/v2/classroom/importaciones/ejecutar', {
        periodoId,
        actividades: actividadesMapeadas(true)
      });
      setPreview((actual) => actual ? { ...actual, ...respuesta } : respuesta);
      setMapeoEjecutado(true);
      const evidenciasReleidas = await cargarEvidencias();
      const actividadesConError = respuesta.errores?.length ?? 0;
      const resumen = actividadesConError > 0
        ? `Sincronización finalizada con errores. Nuevas: ${respuesta.importadas ?? 0}; actualizadas: ${respuesta.actualizadas ?? 0}; actividades con error: ${actividadesConError}.`
        : `Sincronización completada. Nuevas: ${respuesta.importadas ?? 0}; actualizadas: ${respuesta.actualizadas ?? 0}.`;
      setMensaje(evidenciasReleidas ? `${resumen} Evidencias releídas.` : `${resumen} No se pudieron releer las evidencias; revisa la consulta antes de continuar.`);
      setMensajeEsError(!evidenciasReleidas || actividadesConError > 0);
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudo actualizar la evaluación continua.');
      setMensajeEsError(true);
    } finally {
      setAplicandoMapeo(false);
    }
  }

  return (
    <section className="calificaciones-workspace-view anim-fade-in" aria-labelledby="calificaciones-classroom-heading">
      <div className="calificaciones-view-heading">
        <span className="calificaciones-kicker">Origen: Google Classroom</span>
        <h3 id="calificaciones-classroom-heading">Calificaciones asignadas y evidencias</h3>
        <p className="nota">Aquí vinculas alumnos, asignas actividades a un parcial y consultas las notas sincronizadas. Para revisar entregas o asignar una nota, abre la actividad en Google Classroom.</p>
      </div>
      {mensaje && <InlineMensaje tipo={mensajeEsError ? 'error' : 'info'}>{mensaje}</InlineMensaje>}
      {!periodoId && <InlineMensaje tipo="info">Selecciona una materia para consultar sus calificaciones Classroom.</InlineMensaje>}
      {!permisos.evaluaciones.leer && <InlineMensaje tipo="warning">No tienes permiso para consultar evidencias de evaluación.</InlineMensaje>}

      {permisos.classroom.pull && periodoId && (
        <div className="cuenta-subpanel">
          <h4>Vincular estudiantes para la sincronización</h4>
          <p className="nota">Relaciona cuentas del curso con alumnos existentes en la materia. Esta vinculación no crea alumnos ni cambia calificaciones.</p>
          <label className="campo"><span>Materia local destino</span><select value={periodoId} onChange={(event) => onPeriodoChange(event.target.value)}>
            <option value="">Selecciona materia...</option>{periodos.map((periodo) => <option key={periodo._id} value={periodo._id}>
              {etiquetaMateria(periodo)}{periodo.activo === false ? ' (Archivada)' : ''}
            </option>)}
          </select></label>
          <label className="campo"><span>Curso de Classroom</span><select value={courseId} disabled={cargandoCursos} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">Selecciona un curso…</option>{cursos.map((curso) => <option key={curso.id} value={curso.id}>{curso.name}{curso.section ? ` · ${curso.section}` : ''}</option>)}
          </select></label>
          {cargandoCursos && <InlineMensaje tipo="info">Cargando cursos de Google Classroom…</InlineMensaje>}
          {!cargandoCursos && cursos.length === 0 && <InlineMensaje tipo="info">No hay cursos activos disponibles. Revisa la conexión en Classroom o vuelve a cargar la sección.</InlineMensaje>}
          {courseId && <label className="campo">
            <span>Buscar actividad para asignar parcial</span>
            <input type="search" value={busquedaActividades} onChange={(event) => setBusquedaActividades(event.target.value)} placeholder="Nombre de actividad" />
          </label>}
          {courseId && <label className="campo">
            <span>Buscar estudiante vinculado</span>
            <input type="search" value={busquedaAlumnos} onChange={(event) => setBusquedaAlumnos(event.target.value)} placeholder="Nombre, correo o matrícula" />
          </label>}
          {cargandoAlumnosCurso && <InlineMensaje tipo="info">Cargando estudiantes del curso…</InlineMensaje>}
          {alumnosCurso.length > 0 && <>
            <p className="nota" aria-live="polite">Mostrando {alumnosCursoFiltrados.length} de {alumnosCurso.length} estudiantes</p>
            <div className="lista lista--compacta">{alumnosCursoFiltrados.map((fila) => <div className="item-row item-glass" key={fila.classroomUserId}>
              <div><b>{fila.fullName || fila.classroomUserId}</b><div className="nota">{fila.emailAddress || 'Correo no disponible'}</div></div>
              <label className="campo"><span>Alumno en esta materia</span><select value={asignaciones[fila.classroomUserId] ?? ''} onChange={(event) => setAsignaciones((actual) => ({ ...actual, [fila.classroomUserId]: event.target.value }))}>
                <option value="">Sin vincular</option>{alumnos.filter((alumno) => alumno.periodoId === periodoId).map((alumno) => <option key={alumno._id} value={alumno._id}>{alumno.matricula ? `${alumno.matricula} · ` : ''}{alumno.nombreCompleto}</option>)}
              </select></label>
            </div>)}</div>
            {alumnosCursoFiltrados.length === 0 && <p className="nota">Ningún estudiante coincide con la búsqueda.</p>}
            <Boton type="button" variante="secundario" disabled={guardando} cargando={guardando} onClick={() => void guardarVinculaciones()}>Guardar vinculaciones</Boton>
          </>}
          {courseId && !cargandoAlumnosCurso && alumnosCurso.length === 0 && <p className="nota">No hay estudiantes disponibles en el curso seleccionado.</p>}
          <div className="cuenta-subpanel" aria-labelledby="classroom-cortes-heading">
            <h4 id="classroom-cortes-heading">Vincular actividades a evaluación continua</h4>
            <p className="nota">Selecciona el parcial de cada actividad ya existente. EvaluaPro conservará la nota asignada y la evidencia de origen; no crea actividades ni permite editarlas aquí. La previsualización no cambia notas ni evidencias, pero queda registrada en el historial de sincronización.</p>
            {cargandoActividades && <InlineMensaje tipo="info">Cargando actividades publicadas…</InlineMensaje>}
            {actividades.length === 0 && !cargandoActividades ? <p className="nota">No hay actividades publicadas para mapear en este curso.</p> : <div className="lista lista--compacta">
              {actividadesFiltradas.map((actividad) => <div className="item-row item-glass" key={actividad.id}>
                <div><b>{actividad.title}</b><div className="nota">{typeof actividad.maxPoints === 'number' ? `${actividad.maxPoints} puntos posibles` : 'Puntos posibles no especificados'}</div></div>
                <label className="campo"><span>Parcial destino</span><select disabled={previsualizando || aplicandoMapeo} value={cortes[actividad.id] ?? ''} onChange={(event) => {
                  setCortes((actual) => ({ ...actual, [actividad.id]: event.target.value }));
                  setPreview(null);
                  setFaltantesConfirmados({});
                  setMapeoEjecutado(false);
                }}>
                  <option value="">Sin asignar</option><option value="1">Primer parcial</option><option value="2">Segundo parcial</option><option value="3">Tercer parcial</option>
                </select></label>
              </div>)}
            </div>}
            {actividades.length > 0 && <p className="nota" aria-live="polite">Mostrando {actividadesFiltradas.length} de {actividades.length} actividades</p>}
            {actividades.length > 0 && actividadesFiltradas.length === 0 && <p className="nota">Ninguna actividad coincide con la búsqueda.</p>}
            <Boton type="button" variante="secundario" disabled={!actividadesMapeadas().length || previsualizando || aplicandoMapeo} cargando={previsualizando} onClick={() => void previsualizarMapeo()}>
              Previsualizar evaluación continua
            </Boton>
            {preview && <div className="cuenta-subpanel" role="status" aria-live="polite">
              <p>{preview.totalActividades ?? actividadesMapeadas().length} actividades · {preview.graded ?? 0} calificadas · {preview.pending ?? 0} pendientes · {preview.unmatched ?? 0} sin alumno vinculado · {mapeoEjecutado ? preview.importadas ?? 0 : preview.wouldCreate ?? preview.importadas ?? 0} nuevas · {mapeoEjecutado ? preview.actualizadas ?? 0 : preview.wouldUpdate ?? preview.actualizadas ?? 0} {mapeoEjecutado ? 'actualizadas' : 'por actualizar'}</p>
              {(preview.errores ?? []).map((error, index) => <InlineMensaje key={`${index}:${error.mensaje}`} tipo="warning">{error.mensaje || 'Elemento pendiente de revisión.'}</InlineMensaje>)}
              {(preview.promediosEvaluacionContinuaTercerParcial ?? []).length > 0 && <div>
                <h5>Proyección de evaluación continua · tercer parcial</h5>
                <p className="nota">Por alumno: puntos obtenidos ÷ puntos posibles × 10; esa nota se divide entre 2 para aportar hasta 5 puntos al tercer parcial. Las actividades pendientes no suman hasta que Classroom las califique; una entrega faltante solo cuenta como cero si fue confirmada y está vencida. Esta vista previa no escribe calificaciones.</p>
                <div className="calificaciones-consulta__table-wrap">
                  <table className="calificaciones-consulta__table">
                    <caption className="sr-only">Proyección de evaluación continua del tercer parcial desde Classroom</caption>
                    <thead><tr><th scope="col">Alumno</th><th scope="col">Puntos</th><th scope="col">Promedio de actividades / 10</th><th scope="col">Continua / 5</th><th scope="col">Calificadas</th><th scope="col">Faltantes confirmadas</th></tr></thead>
                    <tbody>{preview.promediosEvaluacionContinuaTercerParcial?.map((fila) => <tr key={fila.alumnoId}>
                      <th scope="row">{fila.alumnoNombre}</th>
                      <td>{fila.puntosObtenidos} / {fila.puntosPosibles}</td>
                      <td>{fila.promedioSobre10.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</td>
                      <td>{fila.continuaSobre5.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</td>
                      <td>{fila.actividadesCalificadas}</td>
                      <td>{fila.actividadesFaltantesConfirmadas}</td>
                    </tr>)}</tbody>
                  </table>
                </div>
              </div>}
              {faltantesRevisables.length > 0 && <fieldset className="cuenta-subpanel">
                <legend>Confirmar entregas faltantes vencidas</legend>
                <p className="nota">Solo marca una entrega tras revisarla. La confirmación la registra como cero en la evaluación continua y puede cambiar la calificación del parcial.</p>
                {faltantesRevisables.map(({ actividad, submission }) => {
                  const alumno = submission.alumnoNombre || submission.alumnoId || 'Alumno sin vincular';
                  const seleccionados = faltantesConfirmados[actividad.courseWorkId] ?? [];
                  const id = `${actividad.courseWorkId}:${submission.submissionId}`;
                  return <label className="campo" key={id}>
                    <input
                      type="checkbox"
                      checked={seleccionados.includes(submission.submissionId)}
                      onChange={(event) => {
                        setProyeccionPendiente(true);
                        setFaltantesConfirmados((actual) => {
                          const ids = new Set(actual[actividad.courseWorkId] ?? []);
                          if (event.target.checked) ids.add(submission.submissionId);
                          else ids.delete(submission.submissionId);
                          return { ...actual, [actividad.courseWorkId]: [...ids] };
                        });
                      }}
                    />
                    <span>Contar como 0 · {alumno} · {actividad.courseWorkTitle || actividad.courseWorkId}</span>
                  </label>;
                })}
              </fieldset>}
              {proyeccionPendiente && <>
                <InlineMensaje tipo="warning">Cambiaste las faltas seleccionadas. Actualiza la proyección para ver el efecto exacto antes de sincronizar.</InlineMensaje>
                <Boton type="button" variante="secundario" disabled={aplicandoMapeo || previsualizando} cargando={previsualizando} onClick={() => void previsualizarMapeo(true)}>Actualizar proyección</Boton>
              </>}
              {!mapeoEjecutado && <Boton type="button" variante="primario" disabled={aplicandoMapeo || previsualizando || proyeccionPendiente} cargando={aplicandoMapeo} onClick={() => void aplicarMapeo()}>Confirmar y sincronizar selección</Boton>}
            </div>}
          </div>
        </div>
      )}

      <div className="calificaciones-view-heading">
        <h4>Evidencias sincronizadas</h4>
        <p className="nota">Las notas se consultan desde la última sincronización. Usa el enlace de cada actividad para revisar o calificar en Google Classroom.</p>
      </div>
      <label className="campo">
        <span>Buscar evidencias</span>
        <input type="search" value={busquedaEvidencias} onChange={(event) => setBusquedaEvidencias(event.target.value)} placeholder="Alumno, matrícula, actividad, nota o estado" />
      </label>
      <p className="nota" aria-live="polite">Mostrando {evidenciasFiltradas.length} de {evidencias.length} evidencias</p>
      <div className="calificaciones-consulta__table-wrap">
        <table className="calificaciones-consulta__table">
          <caption className="sr-only">Evidencias y calificaciones Classroom de la materia seleccionada</caption>
          <thead><tr><th scope="col">Alumno</th><th scope="col">Actividad</th><th scope="col">Calificación Classroom</th><th scope="col">Estado</th><th scope="col">Actualizada</th><th scope="col">Revisar en Classroom</th></tr></thead>
          <tbody>
            {evidenciasFiltradas.map((fila) => {
              const alumno = alumnosPorId.get(fila.alumnoId);
              const urlActividad = obtenerUrlActividadClassroom(fila.metadata?.alternateLink);
              return <tr key={fila.id}>
                <th scope="row" data-label="Alumno">{alumno?.nombreCompleto || 'Alumno no disponible'}</th>
                <td data-label="Actividad">{fila.classroom?.courseWorkTitle || fila.titulo}</td>
                <td data-label="Calificación Classroom">{typeof fila.classroom?.assignedGrade === 'number' ? `${fila.classroom.assignedGrade}${typeof fila.classroom.maxPoints === 'number' ? ` / ${fila.classroom.maxPoints}` : ''}` : 'Sin calificación asignada'}</td>
                <td data-label="Estado">{fila.estadoCaptura === 'calificada' ? 'Calificada' : fila.classroom?.submissionState || 'Pendiente'}</td>
                <td data-label="Actualizada">{new Date(fila.fechaEvidencia).toLocaleDateString('es-MX')}</td>
                <td data-label="Revisar en Classroom">{urlActividad ? <a href={urlActividad} target="_blank" rel="noopener noreferrer" aria-label={`Abrir en Google Classroom: ${fila.classroom?.courseWorkTitle || fila.titulo}`}>Abrir actividad</a> : '—'}</td>
              </tr>;
            })}
            {!cargando && periodoId && evidencias.length === 0 && <tr><td colSpan={6}>No hay calificaciones Classroom sincronizadas para esta materia.</td></tr>}
            {!cargando && evidencias.length > 0 && evidenciasFiltradas.length === 0 && <tr><td colSpan={6}>Ninguna evidencia coincide con la búsqueda.</td></tr>}
          </tbody>
        </table>
      </div>
      {cargando && <InlineMensaje tipo="info">Cargando calificaciones Classroom…</InlineMensaje>}
    </section>
  );
}
