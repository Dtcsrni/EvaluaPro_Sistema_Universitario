/**
 * utilidades
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { mensajeUsuarioDeErrorConSugerencia } from '../../servicios_api/clienteComun';
import { obtenerSessionId } from '../../ui/ux/sesion';
import { tipoMensajeInline } from './mensajeInline';
import type { ExamenGeneradoClave, Pregunta, ResultadoOmr, RevisionPaginaOmr } from './tipos';

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

export function construirClaveCorrectaExamen(
  examen: ExamenGeneradoClave | null | undefined,
  bancoPreguntas: Pregunta[]
): { claveCorrectaPorNumero: Record<number, string>; ordenPreguntas: number[] } {
  const ordenPreguntasIds = Array.isArray(examen?.mapaVariante?.ordenPreguntas)
    ? examen!.mapaVariante!.ordenPreguntas!.map((id) => String(id))
    : Array.isArray(examen?.preguntasIds)
      ? examen!.preguntasIds!.map((id) => String(id))
      : [];
  if (ordenPreguntasIds.length === 0) {
    return { claveCorrectaPorNumero: {}, ordenPreguntas: [] };
  }
  const mapaPreguntas = new Map(bancoPreguntas.map((pregunta) => [String(pregunta._id), pregunta]));
  const claveCorrectaPorNumero: Record<number, string> = {};
  const ordenPreguntas: number[] = [];

  ordenPreguntasIds.forEach((idPregunta, idx) => {
    const pregunta = mapaPreguntas.get(idPregunta);
    if (!pregunta) return;
    const versiones = Array.isArray(pregunta.versiones) ? pregunta.versiones : [];
    const version =
      versiones.find((item) => Number(item?.numeroVersion) === Number(pregunta.versionActual)) ??
      versiones[versiones.length - 1];
    const opciones = Array.isArray(version?.opciones) ? version!.opciones! : [];
    const ordenOpciones = Array.isArray(examen?.mapaVariante?.ordenOpcionesPorPregunta?.[idPregunta])
      ? (examen!.mapaVariante!.ordenOpcionesPorPregunta![idPregunta] ?? [])
      : [0, 1, 2, 3, 4];
    const letra = resolverLetraCorrectaEnOrden(opciones, ordenOpciones);
    if (!letra) return;
    const numero = idx + 1;
    claveCorrectaPorNumero[numero] = letra;
    ordenPreguntas.push(numero);
  });

  return { claveCorrectaPorNumero, ordenPreguntas };
}

export function combinarRespuestasOmrPaginas(
  paginas: RevisionPaginaOmr[]
): Array<{ numeroPregunta: number; opcion: string | null; confianza: number }> {
  const porPregunta = new Map<number, { numeroPregunta: number; opcion: string | null; confianza: number }>();
  const paginasOrdenadas = [...paginas].sort((a, b) => a.numeroPagina - b.numeroPagina);
  for (const pagina of paginasOrdenadas) {
    const respuestasPagina = Array.isArray(pagina.respuestas) ? pagina.respuestas : [];
    for (const respuesta of respuestasPagina) {
      if (!Number.isFinite(Number(respuesta?.numeroPregunta))) continue;
      porPregunta.set(Number(respuesta.numeroPregunta), {
        numeroPregunta: Number(respuesta.numeroPregunta),
        opcion: typeof respuesta?.opcion === 'string' && respuesta.opcion ? respuesta.opcion : null,
        confianza: Number.isFinite(Number(respuesta?.confianza)) ? Number(respuesta.confianza) : 0
      });
    }
  }
  return Array.from(porPregunta.values()).sort((a, b) => a.numeroPregunta - b.numeroPregunta);
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
  const templateVersionDetectada = 3 as const;
  const qrTextos = paginas.map((pagina) => pagina.resultado.qrTexto).filter((valor): valor is string => typeof valor === 'string' && valor.length > 0);

  return {
    respuestasDetectadas,
    advertencias,
    qrTexto: qrTextos[0],
    calidadPagina,
    estadoAnalisis,
    motivosRevision,
    templateVersionDetectada,
    confianzaPromedioPagina,
    ratioAmbiguas
  };
}

function numeroSeguro(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function opcionOmrSegura(valor: unknown): string | null {
  return typeof valor === 'string' && valor ? valor : null;
}

function normalizarEstadoAnalisis(estado: unknown): ResultadoOmr['estadoAnalisis'] {
  if (estado === 'ok' || estado === 'rechazado_calidad' || estado === 'requiere_revision') return estado;
  return 'requiere_revision';
}

function normalizarRespuestasDetectadas(
  respuestas: Partial<ResultadoOmr>['respuestasDetectadas']
): ResultadoOmr['respuestasDetectadas'] {
  if (!Array.isArray(respuestas)) return [];
  return respuestas.map((item) => ({
    numeroPregunta: numeroSeguro(item?.numeroPregunta),
    opcion: opcionOmrSegura(item?.opcion),
    confianza: numeroSeguro(item?.confianza)
  }));
}

export function normalizarResultadoOmr(entrada: Partial<ResultadoOmr> | null | undefined): ResultadoOmr {
  const respuestasDetectadas = normalizarRespuestasDetectadas(entrada?.respuestasDetectadas);
  return {
    respuestasDetectadas,
    advertencias: Array.isArray(entrada?.advertencias) ? entrada.advertencias : [],
    qrTexto: typeof entrada?.qrTexto === 'string' ? entrada.qrTexto : undefined,
    calidadPagina: numeroSeguro(entrada?.calidadPagina),
    estadoAnalisis: normalizarEstadoAnalisis(entrada?.estadoAnalisis),
    motivosRevision: Array.isArray(entrada?.motivosRevision) ? entrada.motivosRevision : [],
    templateVersionDetectada: Number(entrada?.templateVersionDetectada) === 3 ? 3 : 1,
    confianzaPromedioPagina: numeroSeguro(entrada?.confianzaPromedioPagina),
    ratioAmbiguas: numeroSeguro(entrada?.ratioAmbiguas)
  };
}

export function obtenerSesionDocenteId(): string {
  return obtenerSessionId('sesionDocenteId');
}

export function mensajeDeError(error: unknown, fallback: string) {
  return mensajeUsuarioDeErrorConSugerencia(error, fallback);
}

export function esMensajeError(texto: string): boolean {
  return tipoMensajeInline(texto) === 'error';
}

export function obtenerDominiosCorreoPermitidosFrontend(): string[] {
  return String(import.meta.env.VITE_DOMINIOS_CORREO_PERMITIDOS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

function obtenerDominioCorreo(correo: string): string | null {
  const valor = String(correo || '').trim().toLowerCase();
  const at = valor.lastIndexOf('@');
  if (at < 0) return null;
  const dominio = valor.slice(at + 1).trim();
  return dominio ? dominio : null;
}

export function esCorreoDeDominioPermitidoFrontend(correo: string, dominiosPermitidos: string[]): boolean {
  const lista = Array.isArray(dominiosPermitidos) ? dominiosPermitidos : [];
  if (lista.length === 0) return true;
  const dominio = obtenerDominioCorreo(correo);
  if (!dominio) return false;
  return lista.includes(dominio);
}

export function textoDominiosPermitidos(dominios: string[]): string {
  return dominios.map((d) => `@${d}`).join(', ');
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

