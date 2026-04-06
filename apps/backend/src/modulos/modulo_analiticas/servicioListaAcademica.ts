/**
 * servicioListaAcademica
 *
 * Responsabilidad: Servicio de dominio/aplicacion con reglas de negocio reutilizables.
 * Limites: Mantener invariantes del dominio y errores controlados.
 */
import type { ListaAcademicaFila } from './tiposListaAcademica';

type AlumnoFila = {
  _id: unknown;
  matricula?: unknown;
  nombres?: unknown;
  apellidos?: unknown;
  nombreCompleto?: unknown;
  grupo?: unknown;
};

type CalificacionFila = {
  alumnoId: unknown;
  tipoExamen?: unknown;
  calificacionParcialTexto?: unknown;
  calificacionGlobalTexto?: unknown;
  calificacionExamenFinalTexto?: unknown;
};

type BanderaFila = {
  alumnoId: unknown;
  tipo?: unknown;
};

function limpiarTexto(valor: unknown): string {
  return String(valor ?? '').trim();
}

function separarNombreCompleto(nombreCompleto: string): { apellidoPaterno: string; apellidoMaterno: string; nombre: string } {
  const partes = nombreCompleto
    .split(/\s+/)
    .map((parte) => parte.trim())
    .filter(Boolean);

  if (partes.length === 0) return { apellidoPaterno: '', apellidoMaterno: '', nombre: '' };
  if (partes.length === 1) return { apellidoPaterno: '', apellidoMaterno: '', nombre: partes[0] };
  if (partes.length === 2) return { apellidoPaterno: partes[0], apellidoMaterno: '', nombre: partes[1] };

  return {
    apellidoPaterno: partes[0],
    apellidoMaterno: partes[1],
    nombre: partes.slice(2).join(' ')
  };
}

function obtenerPartesNombre(alumno: AlumnoFila) {
  const nombres = limpiarTexto(alumno.nombres);
  const apellidos = limpiarTexto(alumno.apellidos);
  if (nombres || apellidos) {
    const apellidosPartes = apellidos
      .split(/\s+/)
      .map((parte) => parte.trim())
      .filter(Boolean);
    return {
      apellidoPaterno: apellidosPartes[0] ?? '',
      apellidoMaterno: apellidosPartes.slice(1).join(' '),
      nombre: nombres
    };
  }
  return separarNombreCompleto(limpiarTexto(alumno.nombreCompleto));
}

export function construirListaAcademica(
  alumnos: AlumnoFila[],
  calificaciones: CalificacionFila[],
  banderas: BanderaFila[]
): ListaAcademicaFila[] {
  const banderasPorAlumno = new Map<string, string[]>();
  for (const bandera of banderas) {
    const alumnoId = limpiarTexto(bandera.alumnoId);
    if (!alumnoId) continue;
    const lista = banderasPorAlumno.get(alumnoId) ?? [];
    const tipo = limpiarTexto(bandera.tipo);
    if (tipo) lista.push(tipo);
    banderasPorAlumno.set(alumnoId, lista);
  }

  const calificacionesPorAlumno = new Map<string, CalificacionFila>();
  for (const calificacion of calificaciones) {
    const alumnoId = limpiarTexto(calificacion.alumnoId);
    if (!alumnoId) continue;
    calificacionesPorAlumno.set(alumnoId, calificacion);
  }

  return alumnos.map((alumno) => {
    const alumnoId = limpiarTexto(alumno._id);
    const calificacion = calificacionesPorAlumno.get(alumnoId);
    const tipoExamen = limpiarTexto(calificacion?.tipoExamen);
    const parcial = limpiarTexto(calificacion?.calificacionParcialTexto);
    const global = limpiarTexto(calificacion?.calificacionGlobalTexto);
    const final = global || parcial || limpiarTexto(calificacion?.calificacionExamenFinalTexto);
    const banderasAlumno = (banderasPorAlumno.get(alumnoId) ?? []).join(';');
    const nombre = obtenerPartesNombre(alumno);

    return {
      matricula: limpiarTexto(alumno.matricula),
      apellidoPaterno: nombre.apellidoPaterno,
      apellidoMaterno: nombre.apellidoMaterno,
      nombre: nombre.nombre,
      grupo: limpiarTexto(alumno.grupo),
      parcial1: tipoExamen === 'parcial' ? parcial : '',
      parcial2: '',
      global: tipoExamen === 'global' ? global : '',
      final,
      observaciones: banderasAlumno,
      conformidadAlumno: ''
    };
  });
}
