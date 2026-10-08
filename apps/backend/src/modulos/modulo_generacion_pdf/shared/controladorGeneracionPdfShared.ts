/**
 * controladorGeneracionPdfShared
 *
 * Responsabilidad: centralizar helpers y reglas reutilizables del módulo PDF
 * para que el controlador HTTP sea una fachada delgada.
 */
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { prisma } from '../../../infraestructura/baseDatos/sqlite.js';
import { barajar } from '../../../compartido/utilidades/aleatoriedad.js';
import { ErrorAplicacion } from '../../../compartido/errores/errorAplicacion.js';
import { configuracion } from '../../../configuracion.js';
import { normalizarParaNombreArchivo } from '../../../compartido/utilidades/texto.js';
import { construirFirmaVisualPdf } from '../infra/pdfVisualBaseline.js';
import {
  construirMapaVarianteUsadaCanonica,
  extraerPreguntasUsadasMapaOmr,
  normalizarPreguntasCanonicas
} from '../domain/templateCanonico.js';
import { normalizarTituloPlantilla } from '../modeloExamenPlantilla.js';
import { normalizarEnunciadoBanco } from '../../modulo_banco_preguntas/normalizarEnunciadoBanco.js';

export type MapaVariante = {
  ordenPreguntas: string[];
  ordenOpcionesPorPregunta: Record<string, number[]>;
};

export type BancoPreguntaLean = {
  _id: unknown;
  id: string;
  tema?: string;
  updatedAt?: unknown;
  versionActual: number;
  versiones: Array<{
    numeroVersion: number;
    enunciado: string;
    imagenUrl?: string;
    opciones: Array<{ texto: string; esCorrecta: boolean }>;
  }>;
};

export function normalizarNombreTemaPreview(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function claveTemaPreview(valor: unknown): string {
  return normalizarNombreTemaPreview(valor).toLowerCase();
}

function parseJsonSafe<T>(val: unknown): T | null {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return null;
    }
  }
  return val as T;
}

function formatearPlantillaPrisma(raw: any, preguntasIds: string[] = []) {
  if (!raw) return null;
  const bookletConfig = parseJsonSafe<Record<string, unknown>>(raw.bookletConfig) ?? {};
  const blueprint = bookletConfig.blueprint as { version?: unknown } | undefined;
  const blueprintStatus = raw.blueprintStatus ?? bookletConfig.blueprintStatus ?? (blueprint ? 'ready' : 'legacy_dynamic');
  const blueprintVersion = raw.blueprintVersion ?? bookletConfig.blueprintVersion ?? (blueprint ? blueprint.version : undefined);
  return {
    _id: raw.id,
    id: raw.id,
    docenteId: raw.docenteId,
    periodoId: raw.periodoId ?? undefined,
    tipo: raw.tipo,
    titulo: raw.titulo,
    tituloNormalizado: raw.tituloNormalizado,
    instrucciones: raw.instrucciones ?? undefined,
    numeroPaginas: raw.numeroPaginas,
    reactivosObjetivo: raw.reactivosObjetivo,
    defaultVersionCount: raw.defaultVersionCount,
    answerKeyMode: raw.answerKeyMode,
    archivadoEn: raw.archivadoEn ?? undefined,
    bookletConfig,
    omrConfig: parseJsonSafe<any>(raw.omrConfig),
    configuracionPdf: parseJsonSafe<any>(raw.configuracionPdf),
    temas: parseJsonSafe<string[]>(raw.temas) ?? [],
    preguntasIds,
    blueprintJson: raw.blueprintJson ?? (blueprint ? JSON.stringify(blueprint) : undefined),
    blueprintHash: raw.blueprintHash ?? undefined,
    blueprintStatus,
    blueprintVersion,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt
  };
}

type BlueprintReactivo = {
  id: string;
  version: number;
  contentHash: string;
  source?: 'canonical' | 'legacy';
  reactivoId?: string;
  reactivoVersionId?: string;
  reactivoVersion?: number;
};

type BlueprintPlantilla = {
  version: 1 | 2;
  engine: 'omr-canonical-v4';
  items: BlueprintReactivo[];
  setHash: string;
};

function hashSha256Local(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function hashContenidoPregunta(pregunta: BancoPreguntaLean, numeroVersion: number): string {
  const version = pregunta.versiones.find((item) => item.numeroVersion === numeroVersion) ?? pregunta.versiones[0];
  return hashSha256Local(JSON.stringify({
    id: pregunta.id,
    version: numeroVersion,
    // The blueprint is built from formatearPreguntaPrisma(), which normalizes
    // editorial prefixes. Validation also receives raw Prisma rows, so hash
    // the same rendered text in both paths.
    enunciado: normalizarEnunciadoBanco(version?.enunciado ?? ''),
    opciones: (version?.opciones ?? []).map((opcion) => ({ texto: opcion.texto, esCorrecta: opcion.esCorrecta }))
  }));
}

function imagenDesdeReactivoMetadata(metadataJson: string): string | undefined {
  try {
    const metadata = JSON.parse(metadataJson || '{}') as { imageDataUrl?: unknown };
    return typeof metadata.imageDataUrl === 'string' ? metadata.imageDataUrl : undefined;
  } catch {
    return undefined;
  }
}

async function marcarPlantillaRequiereRepreview(plantillaId: string) {
  const plantilla = await prisma.examenPlantilla.findUnique({ where: { id: plantillaId }, select: { bookletConfig: true } });
  if (!plantilla) return;
  const config = parseJsonSafe<Record<string, unknown>>(plantilla.bookletConfig) ?? {};
  if (config.blueprintStatus === 'requires_repreview') return;
  await prisma.examenPlantilla.update({
    where: { id: plantillaId },
    data: { bookletConfig: JSON.stringify({ ...config, blueprintStatus: 'requires_repreview' }) }
  });
}

export async function construirBlueprintPlantilla(
  preguntasDb: BancoPreguntaLean[],
  opciones: { legacyOnly?: boolean } = {}
): Promise<BlueprintPlantilla> {
  const legacyIds = preguntasDb.map((pregunta) => String(pregunta.id));
  const canonicos = !opciones.legacyOnly && legacyIds.length > 0
    ? await prisma.reactivo.findMany({
      where: { legacyPreguntaId: { in: legacyIds }, estado: 'published' },
      include: { versiones: true }
    })
    : [];
  const canonicosPorLegacy = new Map(canonicos.map((reactivo) => [String(reactivo.legacyPreguntaId), reactivo]));
  const items = preguntasDb.map((pregunta) => {
    const legacyVersion = Number(pregunta.versionActual);
    const reactivo = canonicosPorLegacy.get(String(pregunta.id));
    const reactivoVersion = reactivo?.versiones.find((version) => version.numeroVersion === reactivo.versionActual);
    return reactivo && reactivoVersion
      ? {
        id: String(pregunta.id),
        version: legacyVersion,
        contentHash: reactivoVersion.contentHash,
        source: 'canonical' as const,
        reactivoId: reactivo.id,
        reactivoVersionId: reactivoVersion.id,
        reactivoVersion: reactivoVersion.numeroVersion
      }
      : {
        id: String(pregunta.id),
        version: legacyVersion,
        contentHash: hashContenidoPregunta(pregunta, legacyVersion),
        source: 'legacy' as const
      };
  });
  return {
    version: 2,
    engine: 'omr-canonical-v4',
    items,
    setHash: hashSha256Local(JSON.stringify(items))
  };
}

function leerBlueprint(plantilla: { blueprintJson?: unknown; blueprintStatus?: unknown }): BlueprintPlantilla | null {
  if (plantilla.blueprintStatus !== 'ready' || typeof plantilla.blueprintJson !== 'string') return null;
  try {
    const parsed = JSON.parse(plantilla.blueprintJson) as BlueprintPlantilla;
    if (![1, 2].includes(parsed?.version) || parsed.engine !== 'omr-canonical-v4' || !Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function construirSnapshotVersionesBlueprint(params: {
  plantilla: { blueprintJson?: unknown; blueprintStatus?: unknown };
  preguntaIds?: string[];
}) {
  const blueprint = leerBlueprint(params.plantilla);
  const ids = params.preguntaIds ? new Set(params.preguntaIds) : null;
  const items = blueprint?.items.filter((item) => !ids || ids.has(item.id)) ?? [];
  return {
    previewFingerprint: blueprint?.setHash ?? null,
    versionSet: items.map((item) => ({
      preguntaId: item.id,
      version: item.version,
      contentHash: item.contentHash,
      source: item.source ?? 'legacy',
      reactivoId: item.reactivoId ?? null,
      reactivoVersionId: item.reactivoVersionId ?? null,
      reactivoVersion: item.reactivoVersion ?? null
    })),
    questionMap: Object.fromEntries(items.map((item) => [item.id, {
      version: item.version,
      contentHash: item.contentHash,
      reactivoId: item.reactivoId ?? null,
      reactivoVersionId: item.reactivoVersionId ?? null,
      reactivoVersion: item.reactivoVersion ?? null
    }]))
  };
}

function formatearPreguntaPrisma(raw: any) {
  if (!raw) return null;
  return {
    _id: raw.id,
    id: raw.id,
    docenteId: raw.docenteId,
    periodoId: raw.periodoId,
    tema: raw.tema ?? undefined,
    activo: raw.activo,
    versionActual: raw.versionActual,
    recoverySource: raw.recoverySource ? JSON.parse(raw.recoverySource) : undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    versiones: (raw.versiones || []).map((v: any) => ({
      numeroVersion: v.numeroVersion,
      enunciado: normalizarEnunciadoBanco(v.enunciado),
      imagenUrl: v.imagenUrl ?? undefined,
      opciones: (v.opciones || []).map((o: any) => ({
        texto: o.texto,
        esCorrecta: o.esCorrecta
      }))
    }))
  };
}

export function construirNombrePdfExamen(parametros: {
  folio: string;
  loteId?: string;
  materiaNombre?: string;
  temas?: string[];
  plantillaTitulo?: string;
}): string {
  const materia = normalizarParaNombreArchivo(parametros.materiaNombre, { maxLen: 42 });
  const titulo = normalizarParaNombreArchivo(parametros.plantillaTitulo, { maxLen: 42 });
  const folio = normalizarParaNombreArchivo(parametros.folio, { maxLen: 16 });
  const lote = normalizarParaNombreArchivo(parametros.loteId, { maxLen: 16 });

  const temas = Array.isArray(parametros.temas) ? parametros.temas.map((t) => String(t ?? '').trim()).filter(Boolean) : [];
  let tema = '';
  if (temas.length === 1) {
    tema = normalizarParaNombreArchivo(temas[0], { maxLen: 36 });
  } else if (temas.length > 1) {
    const primero = normalizarParaNombreArchivo(temas[0], { maxLen: 26 });
    tema = primero ? `${primero}_mas-${temas.length - 1}` : `mas-${temas.length}`;
  }

  const partes = ['evaluapro', 'examen'];
  if (materia) partes.push(materia);
  if (tema) partes.push(`tema-${tema}`);
  if (titulo) partes.push(`plantilla-${titulo}`);
  if (lote) partes.push(`lote-${lote}`);
  if (folio) partes.push(`folio-${folio}`);

  const nombre = partes.filter(Boolean).join('_');
  return `${nombre}.pdf`;
}

export function construirNombrePdfPreviewPlantilla(parametros: {
  plantillaId: string;
  plantillaTitulo?: string;
  previewKey?: string;
}): string {
  const titulo = normalizarParaNombreArchivo(parametros.plantillaTitulo, { maxLen: 42 });
  const pid = normalizarParaNombreArchivo(String(parametros.plantillaId ?? '').slice(-8), { maxLen: 8 }) || 'sinid';
  const sig = normalizarParaNombreArchivo(parametros.previewKey, { maxLen: 16 });
  const partes = ['evaluapro', 'preview', 'plantilla'];
  if (titulo) partes.push(`titulo-${titulo}`);
  partes.push(`pid-${pid}`);
  if (sig) partes.push(`sig-${sig}`);
  return `${partes.join('_')}.pdf`;
}

export function construirNombrePdfLote(parametros: {
  loteId: string;
  materiaNombre?: string;
  plantillaTitulo?: string;
  totalExamenes?: number;
}): string {
  const lote = normalizarParaNombreArchivo(parametros.loteId, { maxLen: 16 }) || 'sinlote';
  const materia = normalizarParaNombreArchivo(parametros.materiaNombre, { maxLen: 36 });
  const titulo = normalizarParaNombreArchivo(parametros.plantillaTitulo, { maxLen: 36 });
  const totalExamenes = Number(parametros.totalExamenes ?? 0);
  const partes = ['evaluapro', 'paquete', 'examenes'];
  if (materia) partes.push(`materia-${materia}`);
  if (titulo) partes.push(`plantilla-${titulo}`);
  if (Number.isFinite(totalExamenes) && totalExamenes > 0) partes.push(`total-${Math.floor(totalExamenes)}`);
  partes.push(`lote-${lote}`);
  return `${partes.join('_')}.pdf`;
}

function formatearDocente(nombreCompleto: unknown): string {
  const nombre = String(nombreCompleto ?? '').trim();
  if (!nombre) return '';
  if (/^(I\.?S\.?C\.?\s+)/i.test(nombre)) return nombre;
  return `I.S.C. ${nombre}`;
}

export function resolverTemplateVersionOmr(params: { docenteId: unknown; periodoId?: unknown; plantillaId?: unknown }): 4 {
  void params;
  return 4;
}

/**
 * Construye un identificador breve y legible para imprimir en cada examen.
 * Se omiten partículas habituales de nombres hispanos para no desperdiciar
 * espacio (p. ej. "de la"), conservando como máximo seis iniciales.
 */
export function construirInicialesAlumno(nombreCompleto: unknown): string {
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

function construirIdentidadCortaAlumno(params: {
  nombreCompleto?: unknown;
  nombres?: unknown;
  apellidos?: unknown;
}): { primerNombre: string; iniciales: string } {
  const tokensCompletos = String(params.nombreCompleto ?? '').trim().split(/\s+/).filter(Boolean);
  const nombres = String(params.nombres ?? '').trim().split(/\s+/).filter(Boolean);
  const apellidos = String(params.apellidos ?? '').trim().split(/\s+/).filter(Boolean);
  const tieneNombresEstructurados = nombres.length > 0 && apellidos.length > 0;
  // El padrón importado de Classroom de este grupo conserva los apellidos antes
  // de los nombres. Cuando el modelo sí trae campos estructurados, éstos mandan.
  const tokensNombre = tieneNombresEstructurados
    ? nombres
    : tokensCompletos.length >= 3
      ? tokensCompletos.slice(2)
      : tokensCompletos.slice(0, 1);
  const primerNombreOriginal = tokensNombre[0] ?? '';
  const tokensRestantes = tieneNombresEstructurados
    ? [...nombres.slice(1), ...apellidos]
    : tokensCompletos.filter((_, indice) => indice !== (tokensCompletos.length >= 3 ? 2 : 0));
  const primerNombre = primerNombreOriginal
    ? `${primerNombreOriginal.charAt(0).toLocaleUpperCase('es-MX')}${primerNombreOriginal.slice(1).toLocaleLowerCase('es-MX')}`
    : '';
  const inicialesPrimerNombre = construirInicialesAlumno(primerNombreOriginal).slice(0, 1);
  const inicialesRestantes = construirInicialesAlumno(tokensRestantes.join(' '));
  return { primerNombre, iniciales: `${inicialesPrimerNombre}${inicialesRestantes}` };
}

export function construirEncabezadoPdf(params: {
  periodo: unknown;
  docenteDb: unknown;
  instrucciones: unknown;
  incluirPrefijosDocente?: boolean;
  alumno?: { nombreCompleto?: unknown; nombres?: unknown; apellidos?: unknown; grupo?: unknown };
}) {
  const periodo = params.periodo as { nombre?: unknown } | null | undefined;
  const docente = params.docenteDb as
    | {
        nombreCompleto?: unknown;
        preferenciasPdf?: {
          institucion?: unknown;
          lema?: unknown;
          logos?: { izquierdaPath?: unknown; derechaPath?: unknown };
        };
      }
    | null
    | undefined;

  const nombreDocenteBase = String(docente?.nombreCompleto ?? '').trim();
  if (!nombreDocenteBase) {
    throw new ErrorAplicacion(
      'DOCENTE_SIN_NOMBRE',
      'No se puede generar el PDF sin el nombre del docente autenticado.',
      409
    );
  }
  const nombreDocente = params.incluirPrefijosDocente
    ? formatearDocente(nombreDocenteBase)
    : nombreDocenteBase;
  const identidadAlumno = params.alumno ? construirIdentidadCortaAlumno(params.alumno) : undefined;

  return {
    materia: String(periodo?.nombre ?? ''),
    docente: nombreDocente,
    instrucciones: String(params.instrucciones ?? ''),
    institucion: String(docente?.preferenciasPdf?.institucion ?? '').trim() || undefined,
    lema: String(docente?.preferenciasPdf?.lema ?? '').trim() || undefined,
    alumno: params.alumno
      ? {
          nombre: String(params.alumno.nombreCompleto ?? '').trim() || undefined,
          primerNombre: identidadAlumno?.primerNombre || undefined,
          grupo: String(params.alumno.grupo ?? '').trim() || undefined,
          iniciales: identidadAlumno?.iniciales ?? ''
        }
      : undefined,
    logos: {
      izquierdaPath: String(docente?.preferenciasPdf?.logos?.izquierdaPath ?? '').trim() || undefined,
      derechaPath: String(docente?.preferenciasPdf?.logos?.derechaPath ?? '').trim() || undefined
    }
  };
}

export async function validarTituloPlantillaDisponible(params: {
  docenteId: unknown;
  titulo: unknown;
  periodoId?: unknown;
  excluirPlantillaId?: string;
}) {
  const titulo = String(params.titulo ?? '').trim();
  const tituloNormalizado = normalizarTituloPlantilla(titulo);
  if (!tituloNormalizado) return;

  const docId = String(params.docenteId);
  const where: any = {
    docenteId: docId,
    archivadoEn: null,
    OR: [
      { tituloNormalizado },
      { titulo: { equals: titulo } }
    ]
  };
  if (params.periodoId !== undefined) {
    where.periodoId = params.periodoId === null ? null : String(params.periodoId).trim() || null;
  }
  if (params.excluirPlantillaId) {
    where.id = { not: params.excluirPlantillaId };
  }

  const existente = await prisma.examenPlantilla.findFirst({ where });
  if (existente) {
    throw new ErrorAplicacion('PLANTILLA_DUPLICADA', 'Ya existe una plantilla activa con ese nombre', 409);
  }
}

export function construirMapaVarianteUsadaDesdeOmr(
  mapaVariante: MapaVariante,
  mapaOmr: { paginas?: Array<{ preguntas?: Array<{ idPregunta?: string }> }> }
) {
  const usados = extraerPreguntasUsadasMapaOmr(mapaOmr as never);
  return construirMapaVarianteUsadaCanonica(mapaVariante as never, usados);
}

export function construirFirmaVariante(mapaVariante: MapaVariante): string {
  const ordenPreguntas = Array.isArray(mapaVariante.ordenPreguntas) ? mapaVariante.ordenPreguntas : [];
  const bloques = ordenPreguntas.map((idPregunta) => {
    const ordenOpciones = Array.isArray(mapaVariante.ordenOpcionesPorPregunta?.[idPregunta])
      ? mapaVariante.ordenOpcionesPorPregunta[idPregunta]
      : [];
    return `${idPregunta}:${ordenOpciones.join('.')}`;
  });
  return `${ordenPreguntas.join('|')}__${bloques.join('|')}`;
}

const PREVIEW_TTL_MS = 10 * 60 * 1000;
const PREVIEW_CLEANUP_INTERVAL_MS = 2 * 60 * 1000;
const PREVIEW_MAX_FILES = 10;
let ultimoLimpiezaPreview = 0;

export function obtenerDirectorioPreview() {
  return path.resolve(os.tmpdir(), 'evaluapro-preview');
}

export function clavePreviewPlantilla(params: {
  plantillaId: string;
  plantillaUpdatedAt?: unknown;
  numeroPaginas: number;
  totalPreguntas: number;
  temas: string[];
  preguntasFingerprint?: string;
  layoutFingerprint?: string;
}) {
  const base = [
    'v4-auto-fit-body-fixed-header',
    String(params.plantillaId || ''),
    String(params.plantillaUpdatedAt || ''),
    String(params.numeroPaginas || 0),
    String(params.totalPreguntas || 0),
    params.temas.join('|'),
    String(params.preguntasFingerprint || ''),
    String(params.layoutFingerprint || '')
  ].join('|');
  return hash32(base).toString(16);
}

export function construirFingerprintPreguntasPreview(preguntasDb: BancoPreguntaLean[]): string {
  // El fingerprint describe el conjunto y sus versiones, no el orden de una
  // consulta concreta: preview puede ordenar por recencia y producción por
  // los IDs de la plantilla.
  const partes = [...preguntasDb]
    .sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')))
    .map((pregunta) => {
    const version = Number(pregunta.versionActual ?? 0);
    const updatedAt = String(pregunta.updatedAt ?? '');
    return `${String(pregunta.id ?? '')}:${version}:${updatedAt}`;
    });
  return hash32(partes.join('|')).toString(16);
}

export function construirFingerprintLayoutPreview(): string {
  const variables = [
    'EXAMEN_FONT_ECOFONT_PATH',
    'EXAMEN_LOGO_IZQ_PATH',
    'EXAMEN_LOGO_DER_PATH',
    'EXAMEN_LAYOUT_GRID_MM',
    'EXAMEN_LAYOUT_HEADER_FIRST_MM',
    'EXAMEN_LAYOUT_HEADER_OTHER_MM',
    'EXAMEN_LAYOUT_BOTTOM_SAFE_MM',
    'EXAMEN_LAYOUT_USAR_RELLENOS_DECORATIVOS',
    'EXAMEN_LAYOUT_USAR_ETIQUETA_OMR_SOLIDA'
  ];
  const base = [
    // Versionar explícitamente el contrato de composición. Así un PDF
    // cacheado antes de un cambio geométrico (por ejemplo, el pie fuera de
    // página) nunca se reutiliza como si fuera una preview actual.
    // Cambia al modificar burbujas, paso o fiduciales del perfil movil v4.
    // Asi un preview anterior no se reutiliza con una geometria distinta.
    'pdf-lib-canonical-layout-20260922-directional-fiducial-sparse-ink-staple-v1',
    construirFirmaVisualPdf(),
    ...variables.map((nombre) => `${nombre}=${String(process.env[nombre] ?? '').trim()}`)
  ].join('|');
  return hash32(base).toString(16);
}

export async function limpiarPreviewTemporales() {
  const ahora = Date.now();
  if (ahora - ultimoLimpiezaPreview < PREVIEW_CLEANUP_INTERVAL_MS) return;
  ultimoLimpiezaPreview = ahora;

  const directorio = obtenerDirectorioPreview();
  try {
    const archivos = await fs.readdir(directorio);
    const entradas = await Promise.all(
      archivos.map(async (archivo) => {
        const full = path.join(directorio, archivo);
        try {
          const stat = await fs.stat(full);
          return { full, mtimeMs: stat.mtimeMs, isFile: stat.isFile() };
        } catch {
          return null;
        }
      })
    );

    const files = entradas.filter((entrada): entrada is { full: string; mtimeMs: number; isFile: boolean } => Boolean(entrada?.isFile));
    const vencidos = files.filter((file) => ahora - file.mtimeMs > PREVIEW_TTL_MS);
    await Promise.allSettled(vencidos.map((file) => fs.unlink(file.full)));

    const restantes = files.filter((file) => !vencidos.some((vencido) => vencido.full === file.full));
    if (restantes.length > PREVIEW_MAX_FILES) {
      const ordenados = restantes.sort((a, b) => a.mtimeMs - b.mtimeMs);
      const exceso = ordenados.slice(0, Math.max(0, ordenados.length - PREVIEW_MAX_FILES));
      await Promise.allSettled(exceso.map((file) => fs.unlink(file.full)));
    }
  } catch {
    // Best-effort: no bloquear preview por limpieza.
  }
}

export function normalizarTemas(temasRaw: unknown): string[] | undefined {
  const temas = Array.isArray(temasRaw)
    ? Array.from(
        new Set(
          temasRaw
            .map((tema) => String(tema ?? '').trim())
            .filter(Boolean)
            .map((tema) => tema.replace(/\s+/g, ' '))
        )
      )
    : undefined;
  return temas && temas.length > 0 ? temas : undefined;
}

export function hash32(input: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function barajarDeterminista<T>(items: T[], seed: number): T[] {
  const random = mulberry32(seed);
  const copia = items.slice();
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = copia[i];
    copia[i] = copia[j];
    copia[j] = tmp;
  }
  return copia;
}

function mezclaOpcionesPreguntasHabilitada(): boolean {
  const raw = String(process.env.EXAMEN_MEZCLAR_PREGUNTAS_OPCIONES ?? '1').trim().toLowerCase();
  if (!raw) return true;
  return !['0', 'false', 'no', 'off'].includes(raw);
}

export function generarVarianteDeterminista(
  preguntas: Array<{ id: string; opciones: Array<unknown> }>,
  seedTexto: string
): MapaVariante {
  if (!mezclaOpcionesPreguntasHabilitada()) {
    const ordenPreguntas = preguntas.map((pregunta) => pregunta.id);
    const ordenOpcionesPorPregunta: Record<string, number[]> = {};
    for (const pregunta of preguntas) {
      ordenOpcionesPorPregunta[pregunta.id] = Array.from({ length: pregunta.opciones.length }, (_value, index) => index);
    }
    return { ordenPreguntas, ordenOpcionesPorPregunta };
  }

  const seedBase = hash32(seedTexto);
  const ordenPreguntas = barajarDeterminista(
    preguntas.map((pregunta) => pregunta.id),
    seedBase
  );
  const ordenOpcionesPorPregunta: Record<string, number[]> = {};
  for (const pregunta of preguntas) {
    const indices = Array.from({ length: pregunta.opciones.length }, (_value, index) => index);
    ordenOpcionesPorPregunta[pregunta.id] = barajarDeterminista(indices, hash32(`${seedTexto}:${pregunta.id}`));
  }
  return { ordenPreguntas, ordenOpcionesPorPregunta };
}

export function ordenarPreguntasDeterminista<T extends { id: string; opciones: Array<unknown> }>(preguntas: T[], seed: number): T[] {
  if (!mezclaOpcionesPreguntasHabilitada()) return preguntas.slice();
  return barajarDeterminista(preguntas, seed);
}

export function ordenarPreguntasAleatorio<T extends { id: string; opciones: Array<unknown> }>(preguntas: T[]): T[] {
  if (!mezclaOpcionesPreguntasHabilitada()) return preguntas.slice();
  return barajar(preguntas);
}

export function esEntornoTest() {
  return String(configuracion.entorno).toLowerCase() === 'test';
}

export function esEntornoDevelopment() {
  return String(configuracion.entorno).toLowerCase() === 'development';
}

export async function obtenerPlantillaDocente(docenteId: unknown, plantillaId: string) {
  const docId = String(docenteId);
  const raw = await prisma.examenPlantilla.findUnique({
    where: { id: plantillaId }
  });
  if (!raw) {
    throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
  }
  if (raw.docenteId !== docId) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'No autorizado', 403);
  }
  const junction = await prisma.preguntaPlantilla.findMany({
    where: { plantillaId },
    orderBy: { orden: 'asc' }
  });
  const preguntasIds = junction.map((j) => j.preguntaId);
  const formatted = formatearPlantillaPrisma(raw, preguntasIds);
  if (!formatted) {
    throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
  }
  return formatted;
}

export function asegurarPlantillaActiva(plantilla: { archivadoEn?: unknown }) {
  if (plantilla.archivadoEn) {
    throw new ErrorAplicacion('PLANTILLA_ARCHIVADA', 'La plantilla esta archivada', 409);
  }
}

export async function validarPeriodoDocenteActivo(docenteId: unknown, periodoId?: unknown) {
  if (!periodoId) return null;
  const docId = String(docenteId);
  const pId = String(periodoId).trim();
  const periodo = await prisma.periodo.findFirst({
    where: { id: pId, docenteId: docId }
  });
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }
  if (periodo.activo === false) {
    throw new ErrorAplicacion('PERIODO_INACTIVO', 'La materia esta archivada', 409);
  }
  return {
    ...periodo,
    _id: periodo.id,
    grupos: parseJsonSafe(periodo.grupos)
  };
}

export async function resolverPeriodoPlantillaActivo(
  plantilla: { periodoId?: unknown },
  opciones: { permitirArchivado?: boolean; docenteId?: unknown } = {}
) {
  if (!plantilla.periodoId) return null;
  const pId = String(plantilla.periodoId);
  const periodo = opciones.docenteId
    ? await prisma.periodo.findFirst({ where: { id: pId, docenteId: String(opciones.docenteId) } })
    : await prisma.periodo.findUnique({ where: { id: pId } });
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }
  if (opciones.permitirArchivado && periodo.activo === false) {
    const fechaFin = periodo.fechaFin.getTime();
    if (!Number.isFinite(fechaFin) || fechaFin >= Date.now()) {
      throw new ErrorAplicacion('PERIODO_NO_CONCLUIDO', 'Los extraordinarios solo pueden generarse después de la fecha de fin del periodo.', 409);
    }
  }
  if (periodo.activo === false && !opciones.permitirArchivado) {
    throw new ErrorAplicacion('PERIODO_INACTIVO', 'La materia esta archivada', 409);
  }
  return {
    ...periodo,
    _id: periodo.id,
    grupos: parseJsonSafe(periodo.grupos)
  };
}

export async function resolverDocentePdf(docenteId: unknown) {
  const dId = String(docenteId);
  const docente = await prisma.docente.findUnique({
    where: { id: dId }
  });
  if (!docente) return null;
  return {
    ...docente,
    _id: docente.id,
    roles: parseJsonSafe(docente.roles),
    preferenciasPdf: parseJsonSafe(docente.preferenciasPdf)
  };
}

export function resolverPaginasObjetivoPreferidas(
  docenteDb: unknown,
  tipo: 'parcial' | 'global' | 'extraordinario'
): number {
  const predeterminadas = { parcial: 2, global: 4, extraordinario: 4 };
  const preferencias = (docenteDb as {
    preferenciasPdf?: { paginasPorTipo?: Partial<Record<typeof tipo, unknown>> };
  } | null | undefined)?.preferenciasPdf?.paginasPorTipo;
  const valor = Number(preferencias?.[tipo]);
  return Number.isInteger(valor) && valor >= 2 && valor <= 50 && valor % 2 === 0
    ? valor
    : predeterminadas[tipo];
}

export function resolverTemasPlantilla(plantilla: { temas?: unknown[] }) {
  return Array.isArray(plantilla.temas) ? (plantilla.temas ?? []).map((tema) => String(tema ?? '').trim()).filter(Boolean) : [];
}

function limitarPreguntasPorObjetivo(preguntas: any[], objetivoRaw: unknown) {
  const objetivo = Math.floor(Number(objetivoRaw));
  if (!Number.isFinite(objetivo) || objetivo <= 0 || preguntas.length <= objetivo) return preguntas;

  // Reparte el objetivo entre los temas para conservar cobertura al reducir
  // reactivos desde el configurador.
  const grupos = new Map<string, any[]>();
  for (const pregunta of preguntas) {
    const clave = String(pregunta?.tema ?? '').trim().toLocaleLowerCase() || '__sin_tema__';
    const grupo = grupos.get(clave) ?? [];
    grupo.push(pregunta);
    grupos.set(clave, grupo);
  }

  const seleccionadas: any[] = [];
  const filas = Array.from(grupos.values());
  for (let indice = 0; seleccionadas.length < objetivo; indice += 1) {
    let agregadas = 0;
    for (const fila of filas) {
      const pregunta = fila[indice];
      if (!pregunta) continue;
      seleccionadas.push(pregunta);
      agregadas += 1;
      if (seleccionadas.length >= objetivo) break;
    }
    if (agregadas === 0) break;
  }
  return seleccionadas;
}

export async function resolverPreguntasPlantilla(params: {
  docenteId: unknown;
  plantilla: { id: string; periodoId?: unknown; preguntasIds?: unknown[]; temas?: unknown[]; reactivosObjetivo?: unknown; blueprintJson?: unknown; blueprintStatus?: unknown; bookletConfig?: unknown };
  ordenarPorRecencia?: boolean;
  usarBlueprint?: boolean;
  permitirArchivados?: boolean;
}) {
  const docId = String(params.docenteId);
  const periodoId = String(params.plantilla.periodoId ?? '').trim();
  if (!periodoId) {
    throw new ErrorAplicacion('PLANTILLA_INVALIDA', 'La plantilla debe estar vinculada a una materia y periodo para generar el examen desde su banco', 400, { plantillaId: params.plantilla.id });
  }
  if (params.usarBlueprint && params.plantilla.blueprintStatus === 'requires_repreview') {
    throw new ErrorAplicacion('BLUEPRINT_REQUIERE_REPREVIEW', 'La plantilla cambió porque cambió el banco publicado. Previsualiza el PDF nuevamente.', 409, { plantillaId: params.plantilla.id });
  }
  const blueprint = params.usarBlueprint ? leerBlueprint(params.plantilla) : null;
  if (params.usarBlueprint && !blueprint) {
    throw new ErrorAplicacion('BLUEPRINT_REQUERIDO', 'La generación requiere un preview confirmado de la plantilla', 409, { plantillaId: params.plantilla.id });
  }
  const temas = resolverTemasPlantilla(params.plantilla);

  let rawPreguntas: any[];
  if (blueprint) {
    const listIds = blueprint.items.map((item) => item.id);
    rawPreguntas = await prisma.bancoPregunta.findMany({
      where: {
        docenteId: docId,
        periodoId,
        ...(params.permitirArchivados ? {} : { activo: true }),
        id: { in: listIds }
      },
      include: { versiones: { include: { opciones: true } } }
    });
    const byId = new Map(rawPreguntas.map((pregunta) => [pregunta.id, pregunta]));
    const faltantes = listIds.filter((id) => !byId.has(id));
    if (faltantes.length > 0) {
      if (!params.permitirArchivados) await marcarPlantillaRequiereRepreview(params.plantilla.id);
      throw new ErrorAplicacion('BLUEPRINT_OBSOLETO', 'El blueprint contiene reactivos que ya no están disponibles', 409, { faltantes });
    }
    const canonicalVersionIds = blueprint.items.map((item) => item.reactivoVersionId).filter((id): id is string => Boolean(id));
    const canonicalVersions = canonicalVersionIds.length > 0
      ? await prisma.reactivoVersion.findMany({
        where: { id: { in: canonicalVersionIds } },
        include: { opciones: true, reactivo: { include: { asignaciones: { select: { periodoId: true } } } } }
      })
      : [];
    const canonicalById = new Map(canonicalVersions.map((version) => [version.id, version]));
    const blueprintHash = hashSha256Local(JSON.stringify(blueprint.items));
    const divergentes = blueprint.items.filter((item) => {
      const pregunta = byId.get(item.id);
      if (item.reactivoVersionId) {
        const versionCanonica = canonicalById.get(item.reactivoVersionId);
        return !versionCanonica ||
          versionCanonica.reactivoId !== item.reactivoId ||
          versionCanonica.contentHash !== item.contentHash ||
          versionCanonica.reactivo.docenteId !== docId ||
          versionCanonica.reactivo.legacyPreguntaId !== item.id ||
          !versionCanonica.reactivo.asignaciones.some((asignacion) => asignacion.periodoId === periodoId) ||
          versionCanonica.reactivo.estado !== 'published' ||
          versionCanonica.reactivo.versionActual !== item.reactivoVersion ||
          versionCanonica.numeroVersion !== item.reactivoVersion;
      }
      const version = pregunta?.versiones?.find((candidate: { numeroVersion: number }) => candidate.numeroVersion === item.version);
      return !version || hashContenidoPregunta(pregunta as unknown as BancoPreguntaLean, item.version) !== item.contentHash;
    }).map((item) => ({ id: item.id, version: item.version, reactivoVersionId: item.reactivoVersionId, contentHash: item.contentHash }));
    if (blueprintHash !== blueprint.setHash) divergentes.push({ id: '__set__', version: 0, reactivoVersionId: undefined, contentHash: blueprint.setHash });
    if (divergentes.length > 0) {
      if (!params.permitirArchivados) await marcarPlantillaRequiereRepreview(params.plantilla.id);
      throw new ErrorAplicacion('BLUEPRINT_OBSOLETO', 'El contenido de una versión fijada cambió o ya no está disponible', 409, { divergentes });
    }
    rawPreguntas = listIds.map((id) => {
      const pregunta = byId.get(id);
      const item = blueprint.items.find((entry) => entry.id === id);
      const versionCanonica = item?.reactivoVersionId ? canonicalById.get(item.reactivoVersionId) : null;
      if (!versionCanonica) return { ...pregunta, versionActual: item?.version ?? pregunta?.versionActual };
      return {
        ...pregunta,
        versionActual: item?.version ?? pregunta?.versionActual,
        versiones: [{
          numeroVersion: item?.version ?? pregunta?.versionActual,
          enunciado: versionCanonica.enunciado,
          imagenUrl: imagenDesdeReactivoMetadata(versionCanonica.metadataJson),
          opciones: versionCanonica.opciones.map((opcion) => ({ texto: opcion.texto, esCorrecta: opcion.esCorrecta }))
        }]
      };
    });
  } else if (temas.length > 0) {
    if (!params.plantilla.periodoId) {
      throw new ErrorAplicacion('PLANTILLA_INVALIDA', 'La plantilla por temas requiere materia (periodoId)', 400);
    }
    rawPreguntas = await prisma.bancoPregunta.findMany({
      where: {
        docenteId: docId,
        ...(params.permitirArchivados ? {} : { activo: true }),
        periodoId,
        tema: { in: temas }
      },
      include: {
        versiones: {
          include: {
            opciones: true
          }
        }
      },
      orderBy: params.ordenarPorRecencia
        ? [{ updatedAt: 'desc' }, { id: 'desc' }]
        : undefined
    });
    rawPreguntas = limitarPreguntasPorObjetivo(rawPreguntas, params.plantilla.reactivosObjetivo);
  } else {
    let listIds = params.plantilla.preguntasIds as string[];
    if (!listIds || listIds.length === 0) {
      const junction = await prisma.preguntaPlantilla.findMany({
        where: { plantillaId: params.plantilla.id },
        orderBy: { orden: 'asc' }
      });
      listIds = junction.map((j) => j.preguntaId);
    }

    rawPreguntas = await prisma.bancoPregunta.findMany({
      where: {
        docenteId: docId,
        ...(params.permitirArchivados ? {} : { activo: true }),
        periodoId,
        id: { in: listIds }
      },
      include: {
        versiones: {
          include: {
            opciones: true
          }
        }
      },
      orderBy: params.ordenarPorRecencia
        ? [{ updatedAt: 'desc' }, { id: 'desc' }]
        : undefined
    });

    const idsEncontrados = new Set(rawPreguntas.map((pregunta) => String(pregunta.id)));
    const faltantes = (listIds ?? []).filter((id) => !idsEncontrados.has(String(id)));
    if (faltantes.length > 0) {
      throw new ErrorAplicacion(
        'REACTIVOS_FUERA_DEL_BANCO_MATERIA',
        'La plantilla contiene reactivos que no están disponibles en el banco de esta materia; corrige la selección antes de generar',
        409,
        { plantillaId: params.plantilla.id, reactivosNoDisponibles: faltantes }
      );
    }

    if (!params.ordenarPorRecencia && listIds && listIds.length > 0) {
      const map = new Map(rawPreguntas.map((p) => [p.id, p]));
      rawPreguntas = listIds.map((id) => map.get(id)).filter(Boolean);
    }
  }

  if (rawPreguntas.length === 0) {
    throw new ErrorAplicacion('SIN_PREGUNTAS', 'La plantilla no tiene preguntas asociadas', 400);
  }

  const preguntasDb = rawPreguntas.map(formatearPreguntaPrisma) as BancoPreguntaLean[];
  const preguntasIds = rawPreguntas.map((p) => p.id);

  return { preguntasDb, preguntasIds, temas };
}

export function validarPreguntasBase(preguntasDb: BancoPreguntaLean[]) {
  const preguntas = preguntasDb.map((pregunta) => {
    const version =
      pregunta.versiones.find((item) => item.numeroVersion === pregunta.versionActual) ??
      pregunta.versiones[0];
    return {
      id: String(pregunta.id),
      enunciado: String(version?.enunciado ?? ''),
      imagenUrl: version?.imagenUrl ?? undefined,
      opciones: Array.isArray(version?.opciones) ? version.opciones : []
    };
  });
  const invalidas = preguntas.flatMap((pregunta) => {
    const problemas: string[] = [];
    const opciones = Array.isArray(pregunta.opciones) ? pregunta.opciones : [];
    if (opciones.length !== 5) problemas.push('requiere exactamente cinco opciones');
    if (opciones.some((opcion) => !String(opcion.texto ?? '').trim())) problemas.push('contiene opciones vacías');
    if (opciones.filter((opcion) => opcion.esCorrecta === true).length !== 1) {
      problemas.push('requiere exactamente una respuesta correcta');
    }
    const opcionesNormalizadas = opciones.map((opcion) => String(opcion.texto ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[*_`]/g, '')
      .trim()
      .replace(/[.:;!?]+$/g, '')
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('es-MX'));
    if (opcionesNormalizadas.some((texto) => /^(?:opcion|option)\s+[a-e]$/.test(texto))) {
      problemas.push('contiene opciones genéricas de relleno');
    }
    const opcionesNoVacias = opcionesNormalizadas.filter(Boolean);
    if (new Set(opcionesNoVacias).size !== opcionesNoVacias.length) problemas.push('contiene opciones repetidas');
    return problemas.length > 0
      ? [{ id: pregunta.id, enunciado: pregunta.enunciado.slice(0, 240), problemas }]
      : [];
  });
  const idsInvalidos = new Set(invalidas.map((pregunta) => pregunta.id));
  const preguntasValidas = preguntas.filter((pregunta) => !idsInvalidos.has(pregunta.id));
  return {
    preguntas: preguntasValidas.length > 0 ? normalizarPreguntasCanonicas(preguntasValidas) : [],
    invalidas
  };
}

export function mapearPreguntasBase(preguntasDb: BancoPreguntaLean[]) {
  const { preguntas, invalidas } = validarPreguntasBase(preguntasDb);
  if (invalidas.length > 0) {
    const resumen = invalidas.slice(0, 12).map(({ id, problemas }) => `${id} (${problemas.join(', ')})`).join('; ');
    throw new ErrorAplicacion(
      'PLANTILLA_REACTIVOS_OMR_INVALIDOS',
      `No se puede previsualizar o generar la plantilla: corrige en Banco los reactivos OMR inválidos. ${resumen}${invalidas.length > 12 ? `; y ${invalidas.length - 12} más` : ''}.`,
      422,
      { reactivosInvalidos: invalidas }
    );
  }
  return preguntas;
}

export function excluirReferenciasTecnologiaRetirada(
  materiaNombre: unknown,
  preguntasDb: BancoPreguntaLean[]
) {
  if (!/\bdiseño y desarrollo de aplicaciones web\b/i.test(String(materiaNombre ?? ''))) {
    return { preguntasDb, idsExcluidos: new Set<string>() };
  }

  const idsExcluidos = new Set<string>();
  const preguntasFiltradas = preguntasDb.filter((pregunta) => {
    const version = pregunta.versiones.find((item) => item.numeroVersion === pregunta.versionActual)
      ?? pregunta.versiones[0];
    const contenido = [
      version?.enunciado ?? '',
      ...(version?.opciones ?? []).map((opcion) => opcion.texto)
    ].join(' ');
    if (!/\b(?:mongodb|mongoose)\b/i.test(contenido)) return true;
    idsExcluidos.add(String(pregunta.id));
    return false;
  });

  return { preguntasDb: preguntasFiltradas, idsExcluidos };
}

export async function resolverPreguntasExtraordinarioArchivado(params: {
  docenteId: unknown;
  materiaNombre?: unknown;
  plantilla: {
    id: string;
    periodoId?: unknown;
    tipo?: unknown;
    titulo?: unknown;
    preguntasIds?: unknown[];
    temas?: unknown[];
    reactivosObjetivo?: unknown;
  };
}) {
  const base = await resolverPreguntasPlantilla({
    docenteId: params.docenteId,
    plantilla: params.plantilla,
    ordenarPorRecencia: true,
    permitirArchivados: true
  });
  const esGlobal = String(params.plantilla.tipo) === 'global'
    || /\bglobal\b/i.test(String(params.plantilla.titulo ?? ''));
  if (!esGlobal || !params.plantilla.periodoId) {
    return {
      ...base,
      fuentesExtraordinario: [] as string[],
      reactivosOmitidosPorOmr: [] as Array<{ id: string; enunciado: string; problemas: string[] }>,
      totalPreguntasFuente: base.preguntasDb.length,
      totalPreguntasOmitidasTecnologiaRetirada: 0
    };
  }

  const baseFiltrada = excluirReferenciasTecnologiaRetirada(params.materiaNombre, base.preguntasDb);

  const plantillaId = String(params.plantilla.id);
  const parciales = await prisma.examenPlantilla.findMany({
    where: {
      docenteId: String(params.docenteId),
      periodoId: String(params.plantilla.periodoId),
      tipo: 'parcial',
      archivadoEn: { not: null },
      id: { not: plantillaId }
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
  });
  const preguntasPorId = new Map(baseFiltrada.preguntasDb.map((pregunta) => [String(pregunta.id), pregunta]));
  const temasCombinados = new Set(base.temas);
  const temasPlantilla = [...base.temas];
  const idsFuente = new Set(baseFiltrada.preguntasDb.map((pregunta) => String(pregunta.id)));
  const idsExcluidosTecnologia = new Set(baseFiltrada.idsExcluidos);
  const invalidasPorId = new Map<string, { id: string; enunciado: string; problemas: string[] }>();
  const fuentesExtraordinario: string[] = [];

  for (const parcialRaw of parciales) {
    const parcial = await obtenerPlantillaDocente(params.docenteId, String(parcialRaw.id));
    const preguntasParcial = await resolverPreguntasPlantilla({
      docenteId: params.docenteId,
      plantilla: parcial as { id: string; periodoId?: unknown; preguntasIds?: unknown[]; temas?: unknown[]; reactivosObjetivo?: unknown },
      ordenarPorRecencia: true,
      permitirArchivados: true
    });
    const parcialFiltrado = excluirReferenciasTecnologiaRetirada(params.materiaNombre, preguntasParcial.preguntasDb);
    parcialFiltrado.idsExcluidos.forEach((id) => idsExcluidosTecnologia.add(id));
    const validacion = validarPreguntasBase(parcialFiltrado.preguntasDb);
    const idsInvalidos = new Set(validacion.invalidas.map((item) => item.id));
    validacion.invalidas.forEach((item) => invalidasPorId.set(item.id, item));
    for (const pregunta of parcialFiltrado.preguntasDb) {
      const id = String(pregunta.id);
      idsFuente.add(id);
      if (!idsInvalidos.has(id) && !preguntasPorId.has(id)) preguntasPorId.set(id, pregunta);
    }
    preguntasParcial.temas.forEach((tema) => temasCombinados.add(tema));
    fuentesExtraordinario.push(String(parcial.titulo ?? 'Parcial'));
  }

  return {
    ...base,
    preguntasDb: [...preguntasPorId.values()],
    temas: [...temasCombinados],
    temasPlantilla,
    fuentesExtraordinario,
    reactivosOmitidosPorOmr: [...invalidasPorId.values()],
    totalPreguntasFuente: idsFuente.size,
    totalPreguntasOmitidasTecnologiaRetirada: idsExcluidosTecnologia.size
  };
}

export async function obtenerConteoTemasMateria(params: { docenteId: unknown; periodoId: unknown }) {
  try {
    const questions = await prisma.bancoPregunta.findMany({
      where: {
        docenteId: String(params.docenteId),
        activo: true,
        periodoId: String(params.periodoId)
      },
      select: { tema: true }
    });
    const counts = new Map<string, number>();
    for (const q of questions) {
      const t = q.tema || '';
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    const result = Array.from(counts.entries()).map(([tema, disponibles]) => ({
      _id: tema,
      disponibles
    }));
    result.sort((a, b) => b.disponibles - a.disponibles || String(a._id).localeCompare(String(b._id)));
    return result.slice(0, 30);
  } catch {
    return [];
  }
}

export function normalizarLoteId(valor: unknown) {
  return normalizarParaNombreArchivo(String(valor ?? '').trim(), { maxLen: 16 }).toUpperCase();
}
