/**
 * servicioListaAcademica
 *
 * Responsabilidad: Servicio de dominio/aplicacion con reglas de negocio reutilizables.
 * Limites: Mantener invariantes del dominio y errores controlados.
 */
import type { ListaAcademicaFila } from './tiposListaAcademica.js';

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
  plantillaTitulo?: unknown;
  calificacionParcialTexto?: unknown;
  calificacionGlobalTexto?: unknown;
  calificacionExamenFinalTexto?: unknown;
  createdAt?: unknown;
};

export type CorteExamen = 'parcial1' | 'parcial2' | 'global';

function normalizarParaCorte(valor: unknown): string {
  return limpiarTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * El tipo persistido solo distingue parcial/global; el título de la plantilla
 * permite separar de forma determinista Parcial 1 y Parcial 2.
 */
export function resolverCorteExamen(tipoExamen: unknown, plantillaTitulo?: unknown): CorteExamen | null {
  const tipo = normalizarParaCorte(tipoExamen);
  const titulo = normalizarParaCorte(plantillaTitulo);
  const texto = `${titulo} ${tipo}`.trim();

  if (texto.includes('global') || texto.includes('final') || tipo === 'global') return 'global';
  if (
    /(?:parcial|p)\s*(?:2|ii)\b/.test(texto) ||
    /\b(?:segundo|segunda|dos)\s+parcial\b/.test(texto) ||
    /\b2(?:do|da|ndo|nda)\s+parcial\b/.test(texto)
  ) {
    return 'parcial2';
  }
  if (
    /(?:parcial|p)\s*(?:1|i)\b/.test(texto) ||
    /\b(?:primer|primero|primera|uno)\s+parcial\b/.test(texto) ||
    /\b1(?:er|ro|ra)\s+parcial\b/.test(texto)
  ) {
    return 'parcial1';
  }
  return null;
}

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

  const calificacionesPorAlumno = new Map<string, CalificacionFila[]>();
  for (const calificacion of calificaciones) {
    const alumnoId = limpiarTexto(calificacion.alumnoId);
    if (!alumnoId) continue;
    const lista = calificacionesPorAlumno.get(alumnoId) ?? [];
    lista.push(calificacion);
    calificacionesPorAlumno.set(alumnoId, lista);
  }

  return alumnos.map((alumno) => {
    const alumnoId = limpiarTexto(alumno._id);
    const calificacionesAlumno = (calificacionesPorAlumno.get(alumnoId) ?? []).slice().sort((a, b) => {
      const fechaA = new Date(String(a.createdAt ?? '')).getTime();
      const fechaB = new Date(String(b.createdAt ?? '')).getTime();
      if (Number.isFinite(fechaA) && Number.isFinite(fechaB) && fechaA !== fechaB) return fechaA - fechaB;
      return 0;
    });
    const parciales = calificacionesAlumno.filter((item) => {
      const corte = resolverCorteExamen(item.tipoExamen, item.plantillaTitulo);
      return corte === 'parcial1' || corte === 'parcial2' || (corte === null && normalizarParaCorte(item.tipoExamen) === 'parcial');
    });
    const parcial1Registro = parciales.find((item) => resolverCorteExamen(item.tipoExamen, item.plantillaTitulo) === 'parcial1')
      ?? parciales.find((item) => resolverCorteExamen(item.tipoExamen, item.plantillaTitulo) === null);
    const parcial2Registro = parciales.find((item) => resolverCorteExamen(item.tipoExamen, item.plantillaTitulo) === 'parcial2')
      ?? parciales.find((item) => item !== parcial1Registro && resolverCorteExamen(item.tipoExamen, item.plantillaTitulo) === null);
    const globales = calificacionesAlumno.filter((item) => resolverCorteExamen(item.tipoExamen, item.plantillaTitulo) === 'global');
    const globalRegistro = globales[globales.length - 1];
    const parcial1 = limpiarTexto(parcial1Registro?.calificacionParcialTexto);
    const parcial2 = limpiarTexto(parcial2Registro?.calificacionParcialTexto);
    const global = limpiarTexto(globalRegistro?.calificacionGlobalTexto);
    const finalesPersistidos = calificacionesAlumno.map((item) => limpiarTexto(item.calificacionExamenFinalTexto)).filter(Boolean);
    const finalPersistido = finalesPersistidos[finalesPersistidos.length - 1] ?? '';
    const final = global || parcial2 || parcial1 || finalPersistido;
    const banderasAlumno = (banderasPorAlumno.get(alumnoId) ?? []).join(';');
    const nombre = obtenerPartesNombre(alumno);

    return {
      alumnoId,
      matricula: limpiarTexto(alumno.matricula),
      apellidoPaterno: nombre.apellidoPaterno,
      apellidoMaterno: nombre.apellidoMaterno,
      nombre: nombre.nombre,
      grupo: limpiarTexto(alumno.grupo),
      parcial1,
      parcial2,
      resultadoAutomaticoParcial2: limpiarTexto(parcial2Registro?.calificacionExamenFinalTexto),
      tareasEjerciciosParcial2: '',
      puntosObtenidosParcial2: null,
      puntosPosiblesParcial2: null,
      actividadesCalificadasParcial2: 0,
      nombresActividadesParcial2: [],
      actividadesParcial2: [],
      practicaParcial2: '',
      examenManualParcial2: '',
      bonoGuiaEstudioParcial2: false,
      calificacionExamenConBonoParcial2: '',
      evaluacionContinuaParcial2: '',
      calificacionSegundoParcialFisica: '',
      global,
      final,
      observaciones: banderasAlumno,
      conformidadAlumno: ''
    };
  });
}
