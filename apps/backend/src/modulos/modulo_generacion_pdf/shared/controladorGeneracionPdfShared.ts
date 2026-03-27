/**
 * controladorGeneracionPdfShared
 *
 * Responsabilidad: centralizar helpers y reglas reutilizables del módulo PDF
 * para que el controlador HTTP sea una fachada delgada.
 *
 * Limites:
 * - No define rutas HTTP.
 * - No escribe respuestas Express.
 * - Conserva contratos internos ya validados del flujo PDF/preview/lote.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Types } from 'mongoose';
import { barajar } from '../../../compartido/utilidades/aleatoriedad';
import { ErrorAplicacion } from '../../../compartido/errores/errorAplicacion';
import { configuracion } from '../../../configuracion';
import { normalizarParaNombreArchivo } from '../../../compartido/utilidades/texto';
import { BancoPregunta } from '../../modulo_banco_preguntas/modeloBancoPregunta';
import { Periodo } from '../../modulo_alumnos/modeloPeriodo';
import { Docente } from '../../modulo_autenticacion/modeloDocente';
import { ExamenPlantilla, normalizarTituloPlantilla } from '../modeloExamenPlantilla';
import { resolverPdfEngine } from '../infra/resolverPdfEngine';
import { construirFirmaVisualPdf } from '../infra/pdfVisualBaseline';
import {
  construirMapaVarianteUsadaTv4,
  extraerPreguntasUsadasMapaOmr,
  normalizarPreguntasParaTv4
} from '../domain/tv4Compat';

export type MapaVariante = {
  ordenPreguntas: string[];
  ordenOpcionesPorPregunta: Record<string, number[]>;
};

export type BancoPreguntaLean = {
  _id: unknown;
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

export function construirNombrePdfLoteAnterior(parametros: {
  loteId: string;
  materiaNombre?: string;
  plantillaTitulo?: string;
}): string {
  const lote = normalizarParaNombreArchivo(parametros.loteId, { maxLen: 16 }) || 'sinlote';
  const materia = normalizarParaNombreArchivo(parametros.materiaNombre, { maxLen: 36 });
  const titulo = normalizarParaNombreArchivo(parametros.plantillaTitulo, { maxLen: 36 });
  const partes = ['evaluapro', 'lote', 'examenes'];
  if (materia) partes.push(`materia-${materia}`);
  if (titulo) partes.push(`plantilla-${titulo}`);
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

export function construirEncabezadoPdf(params: {
  periodo: unknown;
  docenteDb: unknown;
  instrucciones: unknown;
  incluirPrefijosDocente?: boolean;
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

  const nombreDocente = params.incluirPrefijosDocente
    ? formatearDocente(docente?.nombreCompleto)
    : String(docente?.nombreCompleto ?? '').trim();

  return {
    materia: String(periodo?.nombre ?? ''),
    docente: nombreDocente,
    instrucciones: String(params.instrucciones ?? ''),
    institucion: String(docente?.preferenciasPdf?.institucion ?? '').trim() || undefined,
    lema: String(docente?.preferenciasPdf?.lema ?? '').trim() || undefined,
    logos: {
      izquierdaPath: String(docente?.preferenciasPdf?.logos?.izquierdaPath ?? '').trim() || undefined,
      derechaPath: String(docente?.preferenciasPdf?.logos?.derechaPath ?? '').trim() || undefined
    }
  };
}

export async function validarTituloPlantillaDisponible(params: {
  docenteId: unknown;
  titulo: unknown;
  excluirPlantillaId?: string;
}) {
  const titulo = String(params.titulo ?? '').trim();
  const tituloNormalizado = normalizarTituloPlantilla(titulo);
  if (!tituloNormalizado) return;

  const filtroBase: Record<string, unknown> = {
    docenteId: params.docenteId,
    archivadoEn: { $exists: false }
  };
  if (params.excluirPlantillaId) {
    filtroBase._id = { $ne: params.excluirPlantillaId };
  }

  const existente = await ExamenPlantilla.findOne({
    ...filtroBase,
    $or: [
      { tituloNormalizado },
      {
        titulo: {
          $regex: `^\\s*${titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\s*$`,
          $options: 'i'
        }
      }
    ]
  })
    .select({ _id: 1 })
    .lean();

  if (existente) {
    throw new ErrorAplicacion('PLANTILLA_DUPLICADA', 'Ya existe una plantilla activa con ese nombre', 409);
  }
}

export function construirMapaVarianteUsadaDesdeOmr(
  mapaVariante: MapaVariante,
  mapaOmr: { paginas?: Array<{ preguntas?: Array<{ idPregunta?: string }> }> }
) {
  const usados = extraerPreguntasUsadasMapaOmr(mapaOmr as never);
  return construirMapaVarianteUsadaTv4(mapaVariante as never, usados);
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
    'v3-a050929d-baseline',
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
  const partes = preguntasDb.map((pregunta) => {
    const version = Number(pregunta.versionActual ?? 0);
    const updatedAt = String(pregunta.updatedAt ?? '');
    return `${String(pregunta._id ?? '')}:${version}:${updatedAt}`;
  });
  return hash32(partes.join('|')).toString(16);
}

export function construirFingerprintLayoutPreview(): string {
  const variables = [
    'EXAMEN_PDF_ENGINE',
    'PLAYWRIGHT_CHROMIUM_EXECUTABLE',
    'PLAYWRIGHT_BROWSER_CHANNEL',
    'EXAM_PRINT_PROFILE',
    'PDF_PRINT_PROFILE',
    'EXAMEN_LAYOUT_GRID_MM',
    'EXAMEN_LAYOUT_HEADER_FIRST_MM',
    'EXAMEN_LAYOUT_HEADER_OTHER_MM',
    'EXAMEN_LAYOUT_BOTTOM_SAFE_MM',
    'EXAMEN_LAYOUT_USAR_RELLENOS_DECORATIVOS',
    'EXAMEN_LAYOUT_USAR_ETIQUETA_OMR_SOLIDA'
  ];
  const base = [
    resolverPdfEngine(),
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
  const plantilla = await ExamenPlantilla.findById(plantillaId).lean();
  if (!plantilla) {
    throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
  }
  if (String(plantilla.docenteId) !== String(docenteId)) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a la plantilla', 403);
  }
  return plantilla;
}

export function asegurarPlantillaActiva(plantilla: { archivadoEn?: unknown }) {
  if (plantilla.archivadoEn) {
    throw new ErrorAplicacion('PLANTILLA_ARCHIVADA', 'La plantilla esta archivada', 409);
  }
}

export async function validarPeriodoDocenteActivo(docenteId: unknown, periodoId?: unknown) {
  if (!periodoId) return null;
  const periodo = await Periodo.findOne({ _id: String(periodoId).trim(), docenteId }).lean();
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }
  if ((periodo as { activo?: boolean }).activo === false) {
    throw new ErrorAplicacion('PERIODO_INACTIVO', 'La materia esta archivada', 409);
  }
  return periodo;
}

export async function resolverPeriodoPlantillaActivo(plantilla: { periodoId?: unknown }) {
  if (!plantilla.periodoId) return null;
  const periodo = await Periodo.findById(plantilla.periodoId).lean();
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }
  if ((periodo as { activo?: boolean }).activo === false) {
    throw new ErrorAplicacion('PERIODO_INACTIVO', 'La materia esta archivada', 409);
  }
  return periodo;
}

export async function resolverDocentePdf(docenteId: unknown) {
  return Docente.findById(docenteId).lean();
}

export function resolverTemasPlantilla(plantilla: { temas?: unknown[] }) {
  return Array.isArray(plantilla.temas) ? (plantilla.temas ?? []).map((tema) => String(tema ?? '').trim()).filter(Boolean) : [];
}

export async function resolverPreguntasPlantilla(params: {
  docenteId: unknown;
  plantilla: { periodoId?: unknown; preguntasIds?: unknown[]; temas?: unknown[] };
  ordenarPorRecencia?: boolean;
}) {
  const preguntasIds = Array.isArray(params.plantilla.preguntasIds) ? params.plantilla.preguntasIds : [];
  const temas = resolverTemasPlantilla(params.plantilla);

  let consulta;
  if (temas.length > 0) {
    if (!params.plantilla.periodoId) {
      throw new ErrorAplicacion('PLANTILLA_INVALIDA', 'La plantilla por temas requiere materia (periodoId)', 400);
    }
    consulta = BancoPregunta.find({
      docenteId: params.docenteId,
      activo: true,
      periodoId: params.plantilla.periodoId,
      tema: { $in: temas }
    });
  } else {
    consulta = BancoPregunta.find({
      docenteId: params.docenteId,
      activo: true,
      ...(params.plantilla.periodoId ? { periodoId: params.plantilla.periodoId } : {}),
      _id: { $in: preguntasIds }
    });
  }

  if (params.ordenarPorRecencia) {
    consulta = consulta.sort({ updatedAt: -1, _id: -1 });
  }

  const preguntasDb = (await consulta.lean()) as BancoPreguntaLean[];
  if (preguntasDb.length === 0) {
    throw new ErrorAplicacion('SIN_PREGUNTAS', 'La plantilla no tiene preguntas asociadas', 400);
  }

  return { preguntasDb, preguntasIds, temas };
}

export function mapearPreguntasBase(preguntasDb: BancoPreguntaLean[]) {
  return normalizarPreguntasParaTv4(
    preguntasDb.map((pregunta) => {
      const version =
        pregunta.versiones.find((item: { numeroVersion: number }) => item.numeroVersion === pregunta.versionActual) ??
        pregunta.versiones[0];
      return {
        id: String(pregunta._id),
        enunciado: version.enunciado,
        imagenUrl: version.imagenUrl ?? undefined,
        opciones: version.opciones
      };
    })
  );
}

export async function obtenerConteoTemasMateria(params: { docenteId: unknown; periodoId: unknown }) {
  try {
    const docenteObjectId = new Types.ObjectId(String(params.docenteId));
    const periodoObjectId = new Types.ObjectId(String(params.periodoId));
    return (await BancoPregunta.aggregate([
      { $match: { docenteId: docenteObjectId, activo: true, periodoId: periodoObjectId } },
      { $project: { tema: { $ifNull: ['$tema', ''] } } },
      { $group: { _id: '$tema', disponibles: { $sum: 1 } } },
      { $sort: { disponibles: -1, _id: 1 } },
      { $limit: 30 }
    ])) as Array<{ _id: unknown; disponibles: number }>;
  } catch {
    return [];
  }
}

export function normalizarLoteId(valor: unknown) {
  return normalizarParaNombreArchivo(String(valor ?? '').trim(), { maxLen: 16 }).toUpperCase();
}
