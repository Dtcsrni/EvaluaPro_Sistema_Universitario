/**
 * servicioListaAcademica
 *
 * Responsabilidad: Servicio de dominio/aplicacion con reglas de negocio reutilizables.
 * Limites: Mantener invariantes del dominio y errores controlados.
 */
import type { ListaAcademicaFila } from './tiposListaAcademica.js';
import { distribuirBonoExtracurricular } from './servicioBonoExtracurricular.js';
import {
  calcularColumnasFisicasParcial2,
  type CalificacionManualLista,
  type EvidenciaListaParcial2,
  type MapeoListaClassroom
} from './servicioListaFisicaParcial2.js';

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
  evaluacionContinuaTexto?: unknown;
  proyectoTexto?: unknown;
  createdAt?: unknown;
};

type ComponenteExamenFila = {
  alumnoId: unknown;
  corte?: unknown;
  examenCorteDecimal?: unknown;
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
 * Resuelve el corte que corresponde a una calificación usando la etiqueta
 * académica de la plantilla. El tipo persistido distingue parcial/global,
 * pero no distingue por sí solo Parcial 1 de Parcial 2.
 */
export function resolverCorteExamen(tipoExamen: unknown, plantillaTitulo?: unknown): CorteExamen | null {
  const tipo = normalizarParaCorte(tipoExamen);
  const titulo = normalizarParaCorte(plantillaTitulo);
  const texto = `${titulo} ${tipo}`.trim();

  if (texto.includes('global') || texto.includes('final')) return 'global';
  if (tipo === 'global') return 'global';

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

  return tipo === 'parcial' ? null : null;
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
  banderas: BanderaFila[],
  opciones: {
    evidencias?: EvidenciaListaParcial2[];
    mapeosClassroom?: MapeoListaClassroom[];
    calificacionesManuales?: CalificacionManualLista[];
    componentesExamen?: ComponenteExamenFila[];
    bonoExtracurricularPorAlumno?: ReadonlyMap<string, number>;
  } = {}
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

  const componenteGlobalPorAlumno = new Map<string, number>();
  for (const componente of opciones.componentesExamen ?? []) {
    const alumnoId = limpiarTexto(componente.alumnoId);
    const examen = Number(componente.examenCorteDecimal);
    if (alumnoId && limpiarTexto(componente.corte) === 'global' && Number.isFinite(examen)) {
      componenteGlobalPorAlumno.set(alumnoId, examen);
    }
  }

  return alumnos.map((alumno) => {
    const alumnoId = limpiarTexto(alumno._id);
    const calificacionesAlumno = (calificacionesPorAlumno.get(alumnoId) ?? [])
      .slice()
      .sort((a, b) => {
        const fechaA = new Date(String(a.createdAt ?? '')).getTime();
        const fechaB = new Date(String(b.createdAt ?? '')).getTime();
        if (Number.isFinite(fechaA) && Number.isFinite(fechaB) && fechaA !== fechaB) return fechaA - fechaB;
        return 0;
      });
    const parciales = calificacionesAlumno.filter((item) => limpiarTexto(item.tipoExamen) === 'parcial');
    const globales = calificacionesAlumno.filter((item) => resolverCorteExamen(item.tipoExamen, item.plantillaTitulo) === 'global');
    const parcialesSinCorte = parciales.filter((item) => resolverCorteExamen(item.tipoExamen, item.plantillaTitulo) === null);
    const parcial1Registro =
      parciales.filter((item) => resolverCorteExamen(item.tipoExamen, item.plantillaTitulo) === 'parcial1').slice(-1)[0] ??
      parcialesSinCorte[0];
    const parcial2Registro =
      parciales.filter((item) => resolverCorteExamen(item.tipoExamen, item.plantillaTitulo) === 'parcial2').slice(-1)[0] ??
      parcialesSinCorte.find((item) => item !== parcial1Registro);
    const globalRegistro = globales[globales.length - 1];
    const parcial1 = limitarTextoParcial(limpiarTexto(parcial1Registro?.calificacionParcialTexto));
    const parcial2 = limitarTextoParcial(limpiarTexto(parcial2Registro?.calificacionParcialTexto));
    const global = limitarTextoParcial(limpiarTexto(globalRegistro?.calificacionGlobalTexto));
    const columnasFisicasParcial2 = calcularColumnasFisicasParcial2({
      alumnoId,
      evidencias: opciones.evidencias ?? [],
      mapeosClassroom: opciones.mapeosClassroom ?? [],
      calificacionesManuales: opciones.calificacionesManuales ?? [],
      examenAutomatico: parcial2Registro?.calificacionExamenFinalTexto
    });
    const promedioC3 = calcularPromedioClassroomC3({
      alumnoId,
      evidencias: opciones.evidencias ?? [],
      mapeosClassroom: opciones.mapeosClassroom ?? []
    });
    const examenGlobalManual = (opciones.calificacionesManuales ?? []).find((registro) =>
      limpiarTexto(registro.alumnoId) === alumnoId && limpiarTexto(registro.componente) === 'Exámen Global'
    );
    const examenGlobalBase = numeroLista(examenGlobalManual?.calificacion)
      ?? numeroLista(globalRegistro?.calificacionExamenFinalTexto);
    const examenGlobalComponente = componenteGlobalPorAlumno.get(alumnoId) ?? null;
    const examenGlobalLista = examenGlobalBase !== null
      ? round4(Math.max(0, Math.min(5, examenGlobalBase)))
      : examenGlobalComponente !== null ? round4(Math.max(0, Math.min(10, examenGlobalComponente)) / 2) : null;
    const continuaTercerParcialLista = promedioC3 !== null
      ? round4(promedioC3 / 2)
      : limitarNumeroLista(globalRegistro?.proyectoTexto, 5);
    const parcial3Persistido = numeroLista(globalRegistro?.calificacionGlobalTexto);
    const parcial3Calculado = parcial3Persistido !== null
      ? round4(Math.max(0, Math.min(10, parcial3Persistido)))
      : examenGlobalLista !== null && continuaTercerParcialLista !== null
        ? round4(Math.max(0, Math.min(10, examenGlobalLista + continuaTercerParcialLista)))
        : null;
    const parcial1Base = numeroLista(parcial1);
    const parcial2Base = numeroLista(columnasFisicasParcial2.calificacionSegundoParcial) ?? numeroLista(parcial2);
    const p1Examen = limitarNumeroLista(parcial1Registro?.calificacionExamenFinalTexto, 5);
    const p1Continua = limitarNumeroLista(parcial1Registro?.evaluacionContinuaTexto, 5);
    const calificacionFinalBase = parcial1Base !== null && parcial2Base !== null && parcial3Calculado !== null
      ? round4((parcial1Base * 0.2) + (parcial2Base * 0.2) + (parcial3Calculado * 0.6))
      : null;
    const bonoRegistro = (opciones.calificacionesManuales ?? []).find((registro) =>
      limpiarTexto(registro.alumnoId) === alumnoId && limpiarTexto(registro.componente) === 'Bono extracurricular'
    );
    const bonoSolicitado = opciones.bonoExtracurricularPorAlumno?.has(alumnoId)
      ? limitarNumeroLista(opciones.bonoExtracurricularPorAlumno.get(alumnoId), 1) ?? 0
      : limitarNumeroLista(bonoRegistro?.calificacion, 1) ?? 0;
    const distribucionBono = distribuirBonoExtracurricular({
      bono: bonoSolicitado,
      componentes: {
        examenGlobal: examenGlobalLista,
        continuaGlobal: continuaTercerParcialLista,
        examenParcial2: numeroLista(columnasFisicasParcial2.examen2doParcial),
        continuaParcial2: numeroLista(columnasFisicasParcial2.evaluacionContinua2doParcial),
        examenParcial1: p1Examen,
        continuaParcial1: p1Continua
      },
      calificacionFinalBase,
      preferencia: 'continua'
    });
    const totalP1ConBono = parcial1Base === null ? null : round4(Math.min(10, parcial1Base + distribucionBono.asignacion.examenParcial1 + distribucionBono.asignacion.continuaParcial1));
    const totalP2ConBono = parcial2Base === null ? null : round4(Math.min(10, parcial2Base + distribucionBono.asignacion.examenParcial2 + distribucionBono.asignacion.continuaParcial2));
    const totalP3ConBono = parcial3Calculado === null ? null : round4(Math.min(10, parcial3Calculado + distribucionBono.asignacion.examenGlobal + distribucionBono.asignacion.continuaGlobal));
    const calificacionFinalCurso = totalP1ConBono !== null && totalP2ConBono !== null && totalP3ConBono !== null
      ? round4((totalP1ConBono * 0.2) + (totalP2ConBono * 0.2) + (totalP3ConBono * 0.6))
      : null;
    const finalesPersistidos = calificacionesAlumno
      .map((item) => limpiarTexto(item.calificacionExamenFinalTexto))
      .filter(Boolean);
    const finalPersistido = finalesPersistidos[finalesPersistidos.length - 1] ?? '';
    // La inserción tardía de un histórico no debe reemplazar un Parcial 2 ya
    // existente en la columna Final. Los cortes académicos tienen prioridad;
    // el valor persistido queda como compatibilidad para datos antiguos sin
    // calificacionParcialTexto.
    const final = limitarTextoParcial(global || parcial2 || parcial1 || finalPersistido);
    const banderasAlumno = (banderasPorAlumno.get(alumnoId) ?? []).join(';');
    const nombre = obtenerPartesNombre(alumno);

    return {
      alumnoId,
      matricula: limpiarTexto(alumno.matricula),
      apellidoPaterno: nombre.apellidoPaterno,
      apellidoMaterno: nombre.apellidoMaterno,
      nombre: nombre.nombre,
      grupo: limpiarTexto(alumno.grupo),
      parcial1: totalP1ConBono === null ? parcial1 : String(totalP1ConBono),
      examenPrimerParcialLista: p1Examen === null ? '' : String(p1Examen),
      continuaPrimerParcialLista: p1Continua === null ? '' : String(p1Continua),
      parcial2: totalP2ConBono === null ? parcial2 : String(totalP2ConBono),
      ...columnasFisicasParcial2,
      calificacionSegundoParcial: totalP2ConBono === null ? columnasFisicasParcial2.calificacionSegundoParcial : String(totalP2ConBono),
      global: global || (parcial3Calculado === null ? '' : String(parcial3Calculado)),
      examenGlobalComponente: examenGlobalComponente === null ? '' : String(round4(Math.max(0, Math.min(10, examenGlobalComponente)))),
      examenGlobalLista: examenGlobalLista === null ? '' : String(round4(examenGlobalLista)),
      examenGlobalListaVersion: numeroLista(examenGlobalManual?.version),
      continuaTercerParcialLista: continuaTercerParcialLista === null ? '' : String(round4(continuaTercerParcialLista)),
      calificacionTercerParcial: totalP3ConBono === null ? '' : String(totalP3ConBono),
      bonoExtracurricular: String(distribucionBono.aplicado),
      bonoExtracurricularSolicitado: String(bonoSolicitado),
      bonoExtracurricularVersion: numeroLista(bonoRegistro?.version),
      bonoDistribucion: distribucionBono.asignacion,
      calificacionFinalCurso: calificacionFinalCurso === null ? '' : String(calificacionFinalCurso),
      final,
      observaciones: banderasAlumno,
      conformidadAlumno: ''
    };
  });
}

function numeroLista(valor: unknown): number | null {
  if (valor === null || valor === undefined || (typeof valor === 'string' && !valor.trim())) return null;
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : null;
}

function limitarNumeroLista(valor: unknown, maximo: number): number | null {
  const numero = numeroLista(valor);
  return numero === null ? null : round4(Math.max(0, Math.min(maximo, numero)));
}

function limitarTextoParcial(valor: string): string {
  const nota = numeroLista(valor);
  if (nota === null) return valor;
  if (nota >= 0 && nota <= 10) return valor;
  return String(round4(Math.max(0, Math.min(10, nota))));
}

function round4(valor: number): number {
  return Number(Number(valor).toFixed(4));
}

function objetoLista(valor: unknown): Record<string, unknown> {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) return valor as Record<string, unknown>;
  if (typeof valor !== 'string' || !valor.trim()) return {};
  try {
    const parsed = JSON.parse(valor);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function calcularPromedioClassroomC3(params: {
  alumnoId: string;
  evidencias: readonly EvidenciaListaParcial2[];
  mapeosClassroom: readonly MapeoListaClassroom[];
}): number | null {
  const actividades = new Map<string, { courseId: string; courseWorkId: string; corte: number; destinoColumna: string; activo: boolean }>(params.mapeosClassroom.map((mapeo) => {
    const metadata = objetoLista(mapeo.metadata);
    return [{
      courseId: String(mapeo.courseId ?? '').trim(),
      courseWorkId: String(mapeo.courseWorkId ?? '').trim(),
      corte: Number(mapeo.corte ?? metadata.corte),
      destinoColumna: String(mapeo.destinoColumna ?? metadata.destinoColumna ?? '').trim(),
      activo: mapeo.activo !== false && metadata.activo !== false
    }, mapeo] as const;
  }).filter(([actividad]) => actividad.activo && actividad.corte === 3 && actividad.destinoColumna !== 'Excluir')
    .map(([actividad]) => [`${actividad.courseId}:${actividad.courseWorkId}`, actividad] as const));
  if (actividades.size === 0) return null;

  const evidenciaPorActividad = new Map<string, EvidenciaListaParcial2>();
  for (const evidencia of params.evidencias) {
    if (String(evidencia.alumnoId ?? '').trim() !== params.alumnoId) continue;
    if (String(evidencia.fuente ?? '').trim().toLowerCase() !== 'classroom') continue;
    const classroom = objetoLista(evidencia.classroomData);
    const clave = `${String(classroom.courseId ?? '').trim()}:${String(classroom.courseWorkId ?? '').trim()}`;
    if (!actividades.has(clave)) continue;
    const previa = evidenciaPorActividad.get(clave);
    if (!previa || new Date(String(evidencia.updatedAt ?? '')).getTime() >= new Date(String(previa.updatedAt ?? '')).getTime()) {
      evidenciaPorActividad.set(clave, evidencia);
    }
  }

  let obtenidos = 0;
  let posiblesTotales = 0;
  for (const evidencia of evidenciaPorActividad.values()) {
    const classroom = objetoLista(evidencia.classroomData);
    const metadata = objetoLista(evidencia.metadata);
    const posibles = numeroLista(classroom.maxPoints);
    if (posibles === null || posibles <= 0) continue;
    const estado = String(classroom.submissionState ?? '').trim().toUpperCase();
    const faltaConfirmada = Boolean(metadata.faltanteClassroomConfirmado) && ['NEW', 'CREATED'].includes(estado);
    const nota = numeroLista(evidencia.calificacionDecimal);
    const calificada = String(evidencia.estadoCaptura ?? '').trim().toLowerCase() === 'calificada' && nota !== null;
    if (!faltaConfirmada && !calificada) continue;
    obtenidos += faltaConfirmada ? 0 : Math.max(0, Math.min(posibles, (nota as number) * posibles / 10));
    posiblesTotales += posibles;
  }
  return posiblesTotales > 0 ? round4(Math.max(0, Math.min(10, obtenidos / posiblesTotales * 10))) : null;
}
