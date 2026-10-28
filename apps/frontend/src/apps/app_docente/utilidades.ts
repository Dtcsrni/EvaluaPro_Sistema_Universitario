/**
 * utilidades
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { mensajeUsuarioDeErrorConSugerencia } from '../../servicios_api/clienteComun';
import { obtenerSessionId } from '../../ui/ux/sesion';
import { tipoMensajeInline } from './mensajeInline';
import type {
  Alumno,
  EstadoRespuestaOmr,
  ExamenGeneradoClave,
  FlagRespuestaOmr,
  Pregunta,
  Periodo,
  PermisosUI,
  RespuestaDetectadaOmr,
  ResultadoOmr,
  RevisionPaginaOmr
} from './tipos';

const ESTADOS_RESPUESTA_OMR = new Set<EstadoRespuestaOmr>([
  'respondida',
  'sin_marca',
  'ambigua',
  'doble_marca',
  'tachada'
]);
const FLAGS_RESPUESTA_OMR = new Set<FlagRespuestaOmr>([
  'doble_marca',
  'bajo_contraste',
  'fuera_roi',
  'parcial_detectada',
  'tachada_detectada'
]);

function resolverEstadoRespuestaOmr(
  opcion: string | null,
  estado: unknown,
  flags: FlagRespuestaOmr[]
): EstadoRespuestaOmr {
  if (ESTADOS_RESPUESTA_OMR.has(estado as EstadoRespuestaOmr)) return estado as EstadoRespuestaOmr;
  if (flags.includes('tachada_detectada')) return 'tachada';
  if (flags.includes('doble_marca')) return 'doble_marca';
  if (opcion) return 'respondida';
  if (flags.length > 0) return 'ambigua';
  return 'sin_marca';
}

const VISTAS_VALIDAS = new Set([
  'periodos',
  'periodos_archivados',
  'alumnos',
  'banco',
  'plantillas',
  'entrega',
  'calificaciones',
  'rehidratacion',
  'evaluaciones',
  'publicar',
  'cuenta'
]);

export const patronNombreMateria = /^[\p{L}\p{N}][\p{L}\p{N}\s\-_.()#&/]*$/u;

/** Iniciales consistentes con las que se imprimen en los exámenes masivos. */
export function obtenerInicialesAlumno(nombreCompleto?: string): string {
  const particulas = new Set(['a', 'da', 'de', 'del', 'do', 'dos', 'la', 'las', 'los', 'y']);
  const palabras = String(nombreCompleto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .match(/[a-z0-9]+/g) ?? [];
  const significativas = palabras.filter((palabra) => !particulas.has(palabra));
  const iniciales = (significativas.length > 0 ? significativas : palabras)
    .map((palabra) => palabra.charAt(0))
    .join('')
    .toUpperCase();
  if (iniciales.length <= 6) return iniciales;
  return `${iniciales.slice(0, 3)}${iniciales.slice(-3)}`;
}

export function obtenerVistaInicial(): string {
  if (typeof window === 'undefined') return 'periodos';
  const params = new URLSearchParams(window.location.search);
  const vista = String(params.get('vista') || '').trim();
  const alias: Record<string, string> = {
    recepcion: 'entrega',
    escaneo: 'calificaciones',
    calificar: 'calificaciones'
  };
  const normalizada = alias[vista] ?? vista;
  return VISTAS_VALIDAS.has(normalizada) ? normalizada : 'periodos';
}

export function obtenerVersionPregunta(pregunta: Pregunta): Pregunta['versiones'][number] | null {
  const versiones = Array.isArray(pregunta.versiones) ? pregunta.versiones : [];
  if (versiones.length === 0) return null;
  const actual = versiones.find((v) => v.numeroVersion === pregunta.versionActual);
  return actual ?? versiones[versiones.length - 1] ?? null;
}

function pareceCodigo(texto: string): boolean {
  const t = String(texto ?? '');
  if (!t.trim()) return false;
  if (t.includes('```')) return true;
  if (t.includes('`')) return true;
  const lineas = t.split(/\r?\n/);
  if (lineas.some((l) => /^\s{2,}\S+/.test(l))) return true;
  if (/[{}();<>]=?>|=>|\/\*|\*\//.test(t)) return true;
  if (/\b(function|const|let|var|return|class|import|export)\b/.test(t)) return true;
  if (/\b(display\s*:\s*flex|justify-content\s*:\s*center|align-items\s*:\s*center|box-sizing\s*:\s*border-box)\b/.test(t)) return true;
  return false;
}

export function preguntaTieneCodigo(pregunta: Pregunta): boolean {
  const v = obtenerVersionPregunta(pregunta);
  if (!v) return false;
  if (pareceCodigo(String(v.enunciado ?? ''))) return true;
  const ops = Array.isArray(v.opciones) ? v.opciones : [];
  return ops.some((o) => pareceCodigo(String(o?.texto ?? '')));
}

function resolverLetraCorrectaEnOrden(opciones: Array<{ esCorrecta?: boolean }>, ordenOpciones: number[]): string | null {
  const indiceCorrecto = opciones.findIndex((opcion) => opcion?.esCorrecta === true);
  if (indiceCorrecto < 0) return null;
  const posicion = ordenOpciones.findIndex((indice) => Number(indice) === indiceCorrecto);
  if (posicion < 0) return null;
  return String.fromCharCode(65 + posicion);
}

type ClaveConstruida = { claveCorrectaPorNumero: Record<number, string>; ordenPreguntas: number[] };

function clavePersistida(examen: ExamenGeneradoClave | null | undefined): ClaveConstruida | null {
  const answerKeySet = examen?.answerKeySet;
  if (!answerKeySet || typeof answerKeySet !== 'object') return null;
  const version = answerKeySet.A ?? answerKeySet[Object.keys(answerKeySet).sort()[0] ?? ''] ?? [];
  const claveCorrectaPorNumero: Record<number, string> = {};
  const ordenPreguntas: number[] = [];
  for (const entry of version) {
    const numero = Number(entry?.numeroPregunta);
    const letra = String(entry?.correcta ?? '').trim().toUpperCase();
    if (!Number.isInteger(numero) || numero <= 0 || !/^[A-Z]$/.test(letra)) continue;
    claveCorrectaPorNumero[numero] = letra;
    ordenPreguntas.push(numero);
  }
  return ordenPreguntas.length > 0
    ? { claveCorrectaPorNumero, ordenPreguntas: ordenPreguntas.sort((a, b) => a - b) }
    : null;
}

function varianteSeleccionada(examen: ExamenGeneradoClave | null | undefined) {
  const variante = examen?.mapaVariante;
  return variante?.versions?.A ?? variante?.versions?.[Object.keys(variante?.versions ?? {}).sort()[0] ?? ''];
}

function ordenIdsDeExamen(examen: ExamenGeneradoClave | null | undefined): string[] {
  const variante = examen?.mapaVariante;
  const version = varianteSeleccionada(examen);
  if (Array.isArray(variante?.ordenPreguntas)) return variante.ordenPreguntas.map(String);
  if (Array.isArray(version?.ordenPreguntas)) return version.ordenPreguntas.map(String);
  return Array.isArray(examen?.preguntasIds) ? examen.preguntasIds.map(String) : [];
}

function claveDesdeBanco(examen: ExamenGeneradoClave | null | undefined, bancoPreguntas: Pregunta[]): ClaveConstruida {
  const ordenPreguntasIds = ordenIdsDeExamen(examen);
  if (ordenPreguntasIds.length === 0) {
    return { claveCorrectaPorNumero: {}, ordenPreguntas: [] };
  }
  const mapaPreguntas = new Map(bancoPreguntas.map((pregunta) => [String(pregunta._id), pregunta]));
  const claveCorrectaPorNumero: Record<number, string> = {};
  const ordenPreguntas: number[] = [];
  const variante = examen?.mapaVariante;
  const varianteVersion = varianteSeleccionada(examen);

  ordenPreguntasIds.forEach((idPregunta, idx) => {
    const pregunta = mapaPreguntas.get(idPregunta);
    if (!pregunta) return;
    const versiones = Array.isArray(pregunta.versiones) ? pregunta.versiones : [];
    const version =
      versiones.find((item) => Number(item?.numeroVersion) === Number(pregunta.versionActual)) ??
      versiones[versiones.length - 1];
    const opciones = Array.isArray(version?.opciones) ? version!.opciones! : [];
    const ordenOpcionesPorPregunta = variante?.ordenOpcionesPorPregunta ?? varianteVersion?.ordenOpcionesPorPregunta;
    const ordenOpciones = Array.isArray(ordenOpcionesPorPregunta?.[idPregunta])
      ? (ordenOpcionesPorPregunta[idPregunta] ?? [])
      : [0, 1, 2, 3, 4];
    const letra = resolverLetraCorrectaEnOrden(opciones, ordenOpciones);
    if (!letra) return;
    const numero = idx + 1;
    claveCorrectaPorNumero[numero] = letra;
    ordenPreguntas.push(numero);
  });

  return { claveCorrectaPorNumero, ordenPreguntas };
}

export function construirClaveCorrectaExamen(
  examen: ExamenGeneradoClave | null | undefined,
  bancoPreguntas: Pregunta[]
): ClaveConstruida {
  if (examen?.answerKeySnapshotStatus === 'unavailable') {
    return { claveCorrectaPorNumero: {}, ordenPreguntas: [] };
  }
  if (examen?.answerKeySnapshotStatus === 'verified') {
    const clave = clavePersistida(examen);
    const totalEsperado = Array.isArray(examen.mapaVariante?.ordenPreguntas)
      ? examen.mapaVariante.ordenPreguntas.length
      : Array.isArray(examen.preguntasIds) ? examen.preguntasIds.length : 0;
    const numeros = clave?.ordenPreguntas ?? [];
    const completa = Boolean(clave) && totalEsperado > 0 && numeros.length === totalEsperado
      && new Set(numeros).size === totalEsperado
      && numeros.every((numero) => Number.isInteger(numero) && numero >= 1 && numero <= totalEsperado)
      && Array.from({ length: totalEsperado }, (_item, index) => index + 1).every((numero) => numero in (clave?.claveCorrectaPorNumero ?? {}));
    return completa && clave ? clave : { claveCorrectaPorNumero: {}, ordenPreguntas: [] };
  }
  return clavePersistida(examen) ?? claveDesdeBanco(examen, bancoPreguntas);
}

export function combinarRespuestasOmrPaginas(
  paginas: RevisionPaginaOmr[]
): RespuestaDetectadaOmr[] {
  const porPregunta = new Map<number, RespuestaDetectadaOmr>();
  const paginasOrdenadas = [...paginas].sort((a, b) => a.numeroPagina - b.numeroPagina);
  for (const pagina of paginasOrdenadas) {
    const respuestasPagina = Array.isArray(pagina.respuestas) ? pagina.respuestas : [];
    for (const respuesta of respuestasPagina) {
      if (!Number.isFinite(Number(respuesta?.numeroPregunta))) continue;
      porPregunta.set(Number(respuesta.numeroPregunta), {
        numeroPregunta: Number(respuesta.numeroPregunta),
        opcion: typeof respuesta?.opcion === 'string' && respuesta.opcion ? respuesta.opcion : null,
        confianza: Number.isFinite(Number(respuesta?.confianza)) ? Number(respuesta.confianza) : 0,
        ...(respuesta.estadoRespuesta ? { estadoRespuesta: respuesta.estadoRespuesta } : {}),
        ...(Array.isArray(respuesta.flags) ? { flags: respuesta.flags } : {})
      });
    }
  }
  return Array.from(porPregunta.values()).sort((a, b) => a.numeroPregunta - b.numeroPregunta);
}

export function normalizarTemplateVersionOmrDetectada(valor: unknown): ResultadoOmr['templateVersionDetectada'] {
  void valor;
  return 4;
}

export function consolidarResultadoOmrExamen(paginas: RevisionPaginaOmr[]): ResultadoOmr | null {
  if (!Array.isArray(paginas) || paginas.length === 0) return null;
  const respuestasDetectadas = combinarRespuestasOmrPaginas(paginas);
  const advertencias = Array.from(
    new Set(
      paginas.flatMap((pagina) => (Array.isArray(pagina.resultado.advertencias) ? pagina.resultado.advertencias : []))
    )
  );
  const motivosRevision = Array.from(
    new Set(
      paginas.flatMap((pagina) => (Array.isArray(pagina.resultado.motivosRevision) ? pagina.resultado.motivosRevision : []))
    )
  );
  const estados = paginas.map((pagina) => pagina.resultado.estadoAnalisis);
  const estadoAnalisis: ResultadoOmr['estadoAnalisis'] = estados.includes('rechazado_calidad')
    ? 'rechazado_calidad'
    : estados.includes('requiere_revision')
      ? 'requiere_revision'
      : 'ok';
  const promedio = (vals: number[]) => (vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0);
  const calidadPagina = promedio(paginas.map((pagina) => Number(pagina.resultado.calidadPagina || 0)));
  const confianzaPromedioPagina = promedio(paginas.map((pagina) => Number(pagina.resultado.confianzaPromedioPagina || 0)));
  const ratioAmbiguas = promedio(paginas.map((pagina) => Number(pagina.resultado.ratioAmbiguas || 0)));
  const templateVersionDetectada = 4;
  const qrTextos = paginas.map((pagina) => pagina.resultado.qrTexto).filter((valor): valor is string => typeof valor === 'string' && valor.length > 0);
  const respuestasConEstado = respuestasDetectadas.map((respuesta) => ({
    ...respuesta,
    estadoRespuesta: respuesta.estadoRespuesta ?? (respuesta.opcion ? 'respondida' : 'sin_marca')
  }));
  const reactivosRespondidos = respuestasConEstado.filter((respuesta) => respuesta.estadoRespuesta === 'respondida').length;
  const reactivosSinMarca = respuestasConEstado.filter((respuesta) => respuesta.estadoRespuesta === 'sin_marca').length;
  const reactivosAmbiguos = respuestasConEstado.filter((respuesta) => respuesta.estadoRespuesta === 'ambigua').length;
  const reactivosInvalidos = respuestasConEstado.filter((respuesta) =>
    respuesta.estadoRespuesta === 'doble_marca' || respuesta.estadoRespuesta === 'tachada'
  ).length;
  const examenVacio = respuestasConEstado.length > 0 && reactivosSinMarca === respuestasConEstado.length;

  return {
    respuestasDetectadas: respuestasConEstado,
    autoCalificableOmr: paginas.every((pagina) => pagina.resultado.autoCalificableOmr === true),
    advertencias,
    qrTexto: qrTextos[0],
    engineVersion: paginas.every((pagina) => pagina.resultado.engineVersion === paginas[0]?.resultado.engineVersion)
      ? paginas[0]?.resultado.engineVersion
      : 'omr-cv-mixed',
    geomQuality: Math.min(...paginas.map((pagina) => numeroSeguro(pagina.resultado.geomQuality))),
    photoQuality: Math.min(...paginas.map((pagina) => numeroSeguro(pagina.resultado.photoQuality))),
    decisionPolicy: paginas.every((pagina) => pagina.resultado.decisionPolicy === paginas[0]?.resultado.decisionPolicy)
      ? paginas[0]?.resultado.decisionPolicy
      : 'mixed',
    calidadPagina,
    estadoAnalisis,
    motivosRevision,
    templateVersionDetectada,
    confianzaPromedioPagina,
    ratioAmbiguas,
    resumenRespuestas: {
      totalReactivos: respuestasConEstado.length,
      reactivosRespondidos,
      reactivosSinMarca,
      reactivosAmbiguos,
      reactivosInvalidos,
      examenVacio,
      examenVacioProbable: false,
      estadoExamen: examenVacio
        ? 'vacio_confirmado'
        : reactivosAmbiguos > 0 || reactivosInvalidos > 0
          ? 'requiere_revision'
          : reactivosRespondidos > 0
            ? 'con_respuestas'
            : 'requiere_revision'
    }
  };
}

function numeroSeguro(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function normalizarEstadoAnalisis(estado: unknown): ResultadoOmr['estadoAnalisis'] {
  if (estado === 'ok' || estado === 'rechazado_calidad' || estado === 'requiere_revision') return estado;
  return 'requiere_revision';
}

export function normalizarRespuestasDetectadas(
  respuestas: Array<{
    numeroPregunta: number;
    opcion: string | null;
    confianza?: number;
    estadoRespuesta?: EstadoRespuestaOmr;
    flags?: FlagRespuestaOmr[];
  }> | undefined
): RespuestaDetectadaOmr[] {
  if (!Array.isArray(respuestas)) return [];
  const normalizadas = new Map<number, RespuestaDetectadaOmr>();
  for (const item of respuestas) {
    const numeroPregunta = Number(item?.numeroPregunta);
    if (!Number.isInteger(numeroPregunta) || numeroPregunta <= 0) continue;
    const opcionCruda = typeof item?.opcion === 'string' ? item.opcion.trim().toUpperCase() : '';
    const opcion = opcionCruda.length === 1 && ['A', 'B', 'C', 'D', 'E'].includes(opcionCruda) ? opcionCruda : null;
    const confianzaRaw = Number(item?.confianza);
    const confianza = (Number.isFinite(confianzaRaw) && confianzaRaw >= 0 && confianzaRaw <= 1) ? confianzaRaw : 0;
    const flags = Array.isArray(item.flags)
      ? item.flags.filter((flag): flag is FlagRespuestaOmr => FLAGS_RESPUESTA_OMR.has(flag))
      : [];
    const estadoRespuesta = resolverEstadoRespuestaOmr(opcion, item.estadoRespuesta, flags);
    normalizadas.set(numeroPregunta, {
      numeroPregunta,
      opcion,
      confianza,
      estadoRespuesta,
      ...(flags.length > 0 ? { flags } : {})
    });
  }
  return [...normalizadas.values()].sort((a, b) => a.numeroPregunta - b.numeroPregunta);
}

export function normalizarResultadoOmr(entrada: Partial<ResultadoOmr> | null | undefined): ResultadoOmr {
  const respuestasDetectadas = normalizarRespuestasDetectadas(entrada?.respuestasDetectadas);
  return {
    respuestasDetectadas,
    ...normalizarMetadatosCalificacionOmr(entrada),
    advertencias: Array.isArray(entrada?.advertencias) ? entrada.advertencias : [],
    qrTexto: typeof entrada?.qrTexto === 'string' ? entrada.qrTexto : undefined,
    calidadPagina: numeroSeguro(entrada?.calidadPagina),
    estadoAnalisis: normalizarEstadoAnalisis(entrada?.estadoAnalisis),
    motivosRevision: Array.isArray(entrada?.motivosRevision) ? entrada.motivosRevision : [],
    templateVersionDetectada: normalizarTemplateVersionOmrDetectada(entrada?.templateVersionDetectada),
    confianzaPromedioPagina: numeroSeguro(entrada?.confianzaPromedioPagina),
    ratioAmbiguas: numeroSeguro(entrada?.ratioAmbiguas),
    resumenRespuestas: entrada?.resumenRespuestas
  };
}

function normalizarMetadatosCalificacionOmr(entrada: Partial<ResultadoOmr> | null | undefined) {
  return {
    autoCalificableOmr: entrada?.autoCalificableOmr === true,
    engineVersion: typeof entrada?.engineVersion === 'string' ? entrada.engineVersion : undefined,
    geomQuality: numeroSeguro(entrada?.geomQuality),
    photoQuality: numeroSeguro(entrada?.photoQuality),
    decisionPolicy: typeof entrada?.decisionPolicy === 'string' ? entrada.decisionPolicy : undefined
  };
}

export function obtenerSesionDocenteId(): string {
  return obtenerSessionId('sesionDocenteId');
}

export function mensajeDeError(error: unknown, fallback: string) {
  return mensajeUsuarioDeErrorConSugerencia(error, fallback);
}

export function tienePermisosCalificacionOmr(permisos: Pick<PermisosUI, 'omr' | 'banco' | 'calificaciones'>): boolean {
  return permisos.omr.analizar && permisos.banco.leer && permisos.calificaciones.calificar;
}

export function esMensajeError(texto: string): boolean {
  return tipoMensajeInline(texto) === 'error';
}

const LARGO_ID_MATERIA = 8;

export function idCortoMateria(id?: string, largo = LARGO_ID_MATERIA): string {
  const valor = String(id || '').trim();
  if (!valor) return '-';
  if (valor.length <= largo) return valor;
  return valor.slice(-largo);
}

function etiquetaMateriaConId(nombre?: string, id?: string): string {
  const nombreLimpio = String(nombre || '').trim();
  if (!nombreLimpio) return '-';
  const idLimpio = String(id || '').trim();
  if (!idLimpio) return nombreLimpio;
  return `${nombreLimpio} (ID: ${idCortoMateria(idLimpio)})`;
}

export function etiquetaMateria(periodo?: { _id?: string; nombre?: string } | null): string {
  return etiquetaMateriaConId(periodo?.nombre, periodo?._id);
}

export function nombreMateriaVisible(periodo?: Pick<Periodo, 'nombre'> | null): string {
  return String(periodo?.nombre || '').trim() || 'Materia sin nombre';
}

export function fechaMateriaVisible(fecha?: string): string {
  const partes = String(fecha || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : '';
}

export function etiquetaMateriaParaSelector(periodo?: Pick<Periodo, 'nombre' | 'fechaInicio'> | null): string {
  const nombre = nombreMateriaVisible(periodo);
  const inicio = fechaMateriaVisible(periodo?.fechaInicio);
  return inicio ? `${nombre} · inicia ${inicio}` : nombre;
}

export function etiquetarAlumnosParaSelectorManual(
  alumnos: Alumno[],
  periodos: Periodo[]
): Array<{ alumno: Alumno; etiqueta: string }> {
  const frecuencias = new Map<string, number>();
  const clave = (alumno: Alumno) => `${alumno.matricula.trim()}|${alumno.nombreCompleto.trim().toLocaleLowerCase('es-MX')}`;
  for (const alumno of alumnos) frecuencias.set(clave(alumno), (frecuencias.get(clave(alumno)) ?? 0) + 1);

  return alumnos.map((alumno) => {
    const etiquetaBase = `${alumno.matricula} - ${alumno.nombreCompleto}`;
    if ((frecuencias.get(clave(alumno)) ?? 0) < 2) return { alumno, etiqueta: etiquetaBase };
    const periodo = periodos.find((item) => item._id === alumno.periodoId);
    const contexto = [periodo ? etiquetaMateria(periodo) : '', alumno.grupo ? `Grupo ${alumno.grupo}` : ''].filter(Boolean).join(' · ');
    return { alumno, etiqueta: `${etiquetaBase} · ${contexto || 'Materia o grupo sin identificar'}` };
  });
}

