/**
 * portalAcademicoAssembler
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
type Registro = Record<string, unknown>;

export function construirColeccionesAcademicasPortal(params: {
  periodo: Registro;
  alumnos: Registro[];
  calificaciones: Registro[];
  examenes: Registro[];
}) {
  const { periodo, alumnos, calificaciones, examenes } = params;
  const periodoId = String(periodo?._id ?? '');
  const nombrePeriodo = String(periodo?.nombre ?? '').trim();

  const examenesPorId = new Map<string, Registro>(
    (Array.isArray(examenes) ? examenes : []).map((examen) => [String(examen?._id ?? ''), examen])
  );

  const calificacionesPorAlumno = new Map<string, Registro[]>();
  for (const calificacion of Array.isArray(calificaciones) ? calificaciones : []) {
    const alumnoId = String(calificacion?.alumnoId ?? '').trim();
    if (!alumnoId) continue;
    const lista = calificacionesPorAlumno.get(alumnoId) ?? [];
    lista.push(calificacion);
    calificacionesPorAlumno.set(alumnoId, lista);
  }

  const perfilAlumno: Registro[] = [];
  const materiasAlumno: Registro[] = [];
  const agendaAlumno: Registro[] = [];
  const avisosAlumno: Registro[] = [];
  const historialAlumno: Registro[] = [];

  for (const alumno of Array.isArray(alumnos) ? alumnos : []) {
    const alumnoId = String(alumno?._id ?? '').trim();
    if (!alumnoId) continue;

    const matricula = String(alumno?.matricula ?? '').trim().toUpperCase();
    const nombreCompleto = String(alumno?.nombreCompleto ?? '').trim();
    const grupo = String(alumno?.grupo ?? '').trim();
    const docenteId = String(alumno?.docenteId ?? '').trim();

    perfilAlumno.push({
      alumnoId,
      matricula,
      nombreCompleto,
      grupo: grupo || undefined,
      docenteId: docenteId || undefined,
      metadata: {
        periodoId,
        periodo: nombrePeriodo
      }
    });

    const materiaId = periodoId || `materia-${alumnoId}`;
    materiasAlumno.push({
      alumnoId,
      materiaId,
      nombre: nombrePeriodo || 'Materia',
      docente: undefined,
      estado: 'activa',
      metadata: { periodoId }
    });

    agendaAlumno.push({
      alumnoId,
      agendaId: `publicacion-${periodoId}-${alumnoId}`,
      titulo: 'Resultados publicados',
      descripcion: nombrePeriodo ? `Resultados disponibles para ${nombrePeriodo}` : 'Resultados disponibles',
      fecha: new Date().toISOString(),
      tipo: 'publicacion',
      metadata: { periodoId }
    });

    avisosAlumno.push({
      alumnoId,
      avisoId: `aviso-publicacion-${periodoId}-${alumnoId}`,
      titulo: 'Portal actualizado',
      mensaje: 'Tus resultados académicos están disponibles para consulta.',
      severidad: 'info',
      publicadoEn: new Date().toISOString(),
      metadata: { periodoId }
    });

    const historialAlumnoRaw = calificacionesPorAlumno.get(alumnoId) ?? [];
    for (const item of historialAlumnoRaw) {
      const examenId = String(item?.examenGeneradoId ?? '').trim();
      const examen = examenesPorId.get(examenId);
      const folio = String(examen?.folio ?? examenId).trim();
      historialAlumno.push({
        alumnoId,
        historialId: `${folio || examenId || alumnoId}-${String(item?._id ?? '')}`.slice(0, 120),
        folio: folio || undefined,
        tipoExamen: String(item?.tipoExamen ?? '').trim() || undefined,
        calificacionTexto: String(item?.calificacionExamenFinalTexto ?? '').trim() || undefined,
        aciertos: Number(item?.aciertos ?? 0),
        totalReactivos: Number(item?.totalReactivos ?? 0),
        fecha: new Date(String(item?.updatedAt ?? item?.createdAt ?? new Date().toISOString())).toISOString(),
        metadata: { periodoId }
      });
    }
  }

  return {
    perfilAlumno,
    materiasAlumno,
    agendaAlumno,
    avisosAlumno,
    historialAlumno
  };
}
