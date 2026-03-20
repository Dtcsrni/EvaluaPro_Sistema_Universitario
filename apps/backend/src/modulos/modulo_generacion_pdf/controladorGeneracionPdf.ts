/**
 * Controlador para plantillas y examenes generados.
 *
 * Contrato de seguridad:
 * - Todas las operaciones son multi-tenant por `docenteId`.
 * - Para acciones sobre una plantilla existente, se valida propiedad (`plantilla.docenteId`).
 *
 * Efectos laterales:
 * - `generarExamen` escribe el PDF a almacenamiento local y crea un `ExamenGenerado`.
 */
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Types } from 'mongoose';
import { BancoPregunta } from '../modulo_banco_preguntas/modeloBancoPregunta';
import { Alumno } from '../modulo_alumnos/modeloAlumno';
import { barajar } from '../../compartido/utilidades/aleatoriedad';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { configuracion } from '../../configuracion';
import { guardarPdfExamen, resolverRutaPdfExamen } from '../../infraestructura/archivos/almacenLocal';
import { Periodo } from '../modulo_alumnos/modeloPeriodo';
import { normalizarParaNombreArchivo } from '../../compartido/utilidades/texto';
import { PDFDocument } from 'pdf-lib';
import { obtenerDocenteId } from '../modulo_autenticacion/middlewareAutenticacion';
import type { SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { Docente } from '../modulo_autenticacion/modeloDocente';
import { BanderaRevision } from '../modulo_analiticas/modeloBanderaRevision';
import { Calificacion } from '../modulo_calificacion/modeloCalificacion';
import { Entrega } from '../modulo_vinculacion_entrega/modeloEntrega';
import { ExamenGenerado } from './modeloExamenGenerado';
import { ExamenRecoveryBundle } from './modeloExamenRecoveryBundle';
import { ExamenRecoveryManifest } from './modeloExamenRecoveryManifest';
import { ExamenPlantilla, normalizarTituloPlantilla } from './modeloExamenPlantilla';
import { construirMetadataRetencion } from './servicioRetencionExamenes';
import { generarPdfExamen } from './servicioGeneracionPdf';
import { generarVariante } from './servicioVariantes';
import { construirRecoveryBundle, construirRecoveryManifest } from './domain/recoveryManifest';
import { resolverNumeroPaginasPlantilla } from './domain/resolverNumeroPaginasPlantilla';
import { guardarEnPapelera } from '../modulo_papelera/servicioPapelera';
import {
  construirMapaVarianteUsadaTv4,
  extraerPreguntasUsadasMapaOmr,
  normalizarPreguntasParaTv4
} from './domain/tv4Compat';

type MapaVariante = {
  ordenPreguntas: string[];
  ordenOpcionesPorPregunta: Record<string, number[]>;
};

type BancoPreguntaLean = {
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

function normalizarNombreTemaPreview(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Clave estable para comparar/buscar temas sin sensibilidad de mayúsculas.
 */
function claveTemaPreview(valor: unknown): string {
  return normalizarNombreTemaPreview(valor).toLowerCase();
}

/**
 * Construye un nombre de archivo legible y estable para trazabilidad operativa.
 * Incluye materia/tema/lote/folio cuando estén disponibles.
 */
function construirNombrePdfExamen(parametros: {
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

function construirNombrePdfPreviewPlantilla(parametros: {
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

function construirNombrePdfLote(parametros: {
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

function construirNombrePdfLoteAnterior(parametros: {
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
  const n = String(nombreCompleto ?? '').trim();
  if (!n) return '';

  // Si ya viene con prefijo (ej. "I.S.C."), respetarlo.
  if (/^(I\.?S\.?C\.?\s+)/i.test(n)) return n;

  // Requerimiento: mostrar con prefijo profesional por defecto.
  return `I.S.C. ${n}`;
}

function resolverTemplateVersionOmr(params: { docenteId: unknown; periodoId?: unknown; plantillaId?: unknown }): 4 {
  void params;
  return 4;
}

function construirEncabezadoPdf(params: {
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

async function validarTituloPlantillaDisponible(params: {
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
        // Compatibilidad con documentos legacy que no tengan tituloNormalizado.
        titulo: { $regex: `^\\s*${titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\s*$`, $options: 'i' }
      }
    ]
  })
    .select({ _id: 1 })
    .lean();

  if (existente) {
    throw new ErrorAplicacion('PLANTILLA_DUPLICADA', 'Ya existe una plantilla activa con ese nombre', 409);
  }
}

/**
 * Filtra la variante a las preguntas realmente renderizadas en el mapa OMR.
 * Evita inconsistencias cuando hay autoajuste de paginación.
 */
function construirMapaVarianteUsadaDesdeOmr(
  mapaVariante: MapaVariante,
  mapaOmr: { paginas?: Array<{ preguntas?: Array<{ idPregunta?: string }> }> }
) {
  const usados = extraerPreguntasUsadasMapaOmr(mapaOmr as never);
  return construirMapaVarianteUsadaTv4(mapaVariante as never, usados);
}

function construirFirmaVariante(mapaVariante: MapaVariante): string {
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

function obtenerDirectorioPreview() {
  return path.resolve(os.tmpdir(), 'evaluapro-preview');
}

/**
 * Firma de preview para invalidación de caché por cambios de plantilla/layout.
 */
function clavePreviewPlantilla(params: {
  plantillaId: string;
  plantillaUpdatedAt?: unknown;
  numeroPaginas: number;
  totalPreguntas: number;
  temas: string[];
}) {
  const base = [
    'v2-autoextend',
    String(params.plantillaId || ''),
    String(params.plantillaUpdatedAt || ''),
    String(params.numeroPaginas || 0),
    String(params.totalPreguntas || 0),
    params.temas.join('|')
  ].join('|');
  return hash32(base).toString(16);
}

async function limpiarPreviewTemporales() {
  const ahora = Date.now();
  if (ahora - ultimoLimpiezaPreview < PREVIEW_CLEANUP_INTERVAL_MS) return;
  ultimoLimpiezaPreview = ahora;

  const dir = obtenerDirectorioPreview();
  try {
    const archivos = await fs.readdir(dir);
    const entradas = await Promise.all(
      archivos.map(async (archivo) => {
        const full = path.join(dir, archivo);
        try {
          const stat = await fs.stat(full);
          return { full, mtimeMs: stat.mtimeMs, isFile: stat.isFile() };
        } catch {
          return null;
        }
      })
    );

    const files = entradas.filter((e): e is { full: string; mtimeMs: number; isFile: boolean } => Boolean(e?.isFile));
    const vencidos = files.filter((f) => ahora - f.mtimeMs > PREVIEW_TTL_MS);
    await Promise.allSettled(vencidos.map((f) => fs.unlink(f.full)));

    const restantes = files.filter((f) => !vencidos.some((v) => v.full === f.full));
    if (restantes.length > PREVIEW_MAX_FILES) {
      const ordenados = restantes.sort((a, b) => a.mtimeMs - b.mtimeMs);
      const exceso = ordenados.slice(0, Math.max(0, ordenados.length - PREVIEW_MAX_FILES));
      await Promise.allSettled(exceso.map((f) => fs.unlink(f.full)));
    }
  } catch {
    // Best-effort: no bloquear la previsualizacion por limpieza.
  }
}

/**
 * Lista plantillas del docente autenticado (opcionalmente filtradas por periodo).
 */
export async function listarPlantillas(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtro: Record<string, unknown> = { docenteId };
  if (req.query.periodoId) filtro.periodoId = String(req.query.periodoId);
  const queryArchivado = String(req.query.archivado ?? '').trim().toLowerCase();
  const filtrarArchivadas = queryArchivado === '1' || queryArchivado === 'true' || queryArchivado === 'si' || queryArchivado === 's';
  if (filtrarArchivadas) {
    filtro.archivadoEn = { $exists: true };
  } else {
    filtro.archivadoEn = { $exists: false };
  }

  const limite = Number(req.query.limite ?? 0);
  const consulta = ExamenPlantilla.find(filtro);
  const plantillas = await (limite > 0 ? consulta.limit(limite) : consulta).lean();
  res.json({ plantillas });
}

/**
 * Crea una plantilla asociandola al docente autenticado.
 */
export async function crearPlantilla(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const titulo = String((req.body as { titulo?: unknown }).titulo ?? '').trim();

  const periodoId = (req.body as { periodoId?: string }).periodoId;
  if (periodoId) {
    const periodo = await Periodo.findOne({ _id: String(periodoId).trim(), docenteId }).lean();
    if (!periodo) {
      throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
    }
    if ((periodo as unknown as { activo?: boolean }).activo === false) {
      throw new ErrorAplicacion('PERIODO_INACTIVO', 'La materia esta archivada', 409);
    }
  }

  const temasRaw = (req.body as { temas?: unknown }).temas;
  const temas = Array.isArray(temasRaw)
    ? Array.from(
        new Set(
          temasRaw
            .map((t) => String(t ?? '').trim())
            .filter(Boolean)
            .map((t) => t.replace(/\s+/g, ' '))
        )
      )
    : undefined;

  await validarTituloPlantillaDisponible({ docenteId, titulo });
  const plantilla = await ExamenPlantilla.create({
    ...req.body,
    titulo,
    tituloNormalizado: normalizarTituloPlantilla(titulo),
    temas,
    reactivosObjetivo: Number((req.body as { reactivosObjetivo?: unknown }).reactivosObjetivo ?? 20) || 20,
    defaultVersionCount: Number((req.body as { defaultVersionCount?: unknown }).defaultVersionCount ?? 1) || 1,
    answerKeyMode: String((req.body as { answerKeyMode?: unknown }).answerKeyMode ?? 'digital'),
    bookletConfig: {
      targetPages:
        Number((req.body as { bookletConfig?: { targetPages?: unknown } }).bookletConfig?.targetPages ?? (req.body as { numeroPaginas?: unknown }).numeroPaginas ?? 2) || 2,
      densityMode: String((req.body as { bookletConfig?: { densityMode?: unknown } }).bookletConfig?.densityMode ?? 'balanced'),
      allowImages: (req.body as { bookletConfig?: { allowImages?: unknown } }).bookletConfig?.allowImages !== false,
      imageBudgetPolicy: String((req.body as { bookletConfig?: { imageBudgetPolicy?: unknown } }).bookletConfig?.imageBudgetPolicy ?? 'balanced'),
      headerStyle: String((req.body as { bookletConfig?: { headerStyle?: unknown } }).bookletConfig?.headerStyle ?? 'institutional'),
      fontScale: Number((req.body as { bookletConfig?: { fontScale?: unknown } }).bookletConfig?.fontScale ?? 1) || 1,
      lineSpacing: Number((req.body as { bookletConfig?: { lineSpacing?: unknown } }).bookletConfig?.lineSpacing ?? 1.1) || 1.1,
      separateCoverPage: Boolean((req.body as { bookletConfig?: { separateCoverPage?: unknown } }).bookletConfig?.separateCoverPage)
    },
    omrConfig: {
      sheetFamilyCode: String((req.body as { omrConfig?: { sheetFamilyCode?: unknown } }).omrConfig?.sheetFamilyCode ?? 'S50_5A_ID5_VR6'),
      sheetRevisionId: (req.body as { omrConfig?: { sheetRevisionId?: unknown } }).omrConfig?.sheetRevisionId,
      prefillMode: String((req.body as { omrConfig?: { prefillMode?: unknown } }).omrConfig?.prefillMode ?? 'none'),
      identityMode: 'qr_plus_bubbled_id',
      allowBlankGenericSheets:
        (req.body as { omrConfig?: { allowBlankGenericSheets?: unknown } }).omrConfig?.allowBlankGenericSheets !== false,
      versionMode: String((req.body as { omrConfig?: { versionMode?: unknown } }).omrConfig?.versionMode ?? 'single'),
      ignoreUnusedTrailingQuestions:
        (req.body as { omrConfig?: { ignoreUnusedTrailingQuestions?: unknown } }).omrConfig?.ignoreUnusedTrailingQuestions !== false,
      captureMode: 'pdf_and_mobile'
    },
    docenteId
  });
  res.status(201).json({ plantilla });
}

function normalizarTemas(temasRaw: unknown): string[] | undefined {
  const temas = Array.isArray(temasRaw)
    ? Array.from(
        new Set(
          temasRaw
            .map((t) => String(t ?? '').trim())
            .filter(Boolean)
            .map((t) => t.replace(/\s+/g, ' '))
        )
      )
    : undefined;
  return temas && temas.length > 0 ? temas : undefined;
}

function hash32(input: string) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * PRNG liviano para shuffle determinista sin dependencias externas.
 */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shuffle determinista para reproducibilidad entre corridas y auditoría.
 */
function barajarDeterminista<T>(items: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const copia = items.slice();
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
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

/**
 * Variante determinista por semilla textual (folio/lote/plantilla).
 */
function generarVarianteDeterminista(preguntas: Array<{ id: string; opciones: Array<unknown> }>, seedTexto: string): MapaVariante {
  if (!mezclaOpcionesPreguntasHabilitada()) {
    const ordenPreguntas = preguntas.map((p) => p.id);
    const ordenOpcionesPorPregunta: Record<string, number[]> = {};
    for (const pregunta of preguntas) {
      ordenOpcionesPorPregunta[pregunta.id] = Array.from({ length: pregunta.opciones.length }, (_v, i) => i);
    }
    return { ordenPreguntas, ordenOpcionesPorPregunta };
  }

  const seedBase = hash32(seedTexto);
  const ordenPreguntas = barajarDeterminista(
    preguntas.map((p) => p.id),
    seedBase
  );
  const ordenOpcionesPorPregunta: Record<string, number[]> = {};
  for (const pregunta of preguntas) {
    const indices = Array.from({ length: pregunta.opciones.length }, (_v, i) => i);
    ordenOpcionesPorPregunta[pregunta.id] = barajarDeterminista(indices, hash32(`${seedTexto}:${pregunta.id}`));
  }
  return { ordenPreguntas, ordenOpcionesPorPregunta };
}

function ordenarPreguntasDeterminista<T extends { id: string; opciones: Array<unknown> }>(preguntas: T[], seed: number): T[] {
  if (!mezclaOpcionesPreguntasHabilitada()) return preguntas.slice();
  return barajarDeterminista(preguntas, seed);
}

function ordenarPreguntasAleatorio<T extends { id: string; opciones: Array<unknown> }>(preguntas: T[]): T[] {
  if (!mezclaOpcionesPreguntasHabilitada()) return preguntas.slice();
  return barajar(preguntas);
}

/**
 * Actualiza una plantilla del docente autenticado.
 *
 * Nota: se hace merge con valores actuales para validar invariantes (temas/preguntasIds).
 */
export async function actualizarPlantilla(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const plantillaId = String(req.params.id || '').trim();
  const actual = await ExamenPlantilla.findById(plantillaId).lean();
  if (!actual) {
    throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
  }
  if (String(actual.docenteId) !== String(docenteId)) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a la plantilla', 403);
  }

  const temas = normalizarTemas((req.body as { temas?: unknown })?.temas);
  const patch = { ...(req.body as Record<string, unknown>), ...(temas !== undefined ? { temas } : {}) };
  // Si se manda explicitamente temas=[] vacio, se respeta como vacio.
  if (Array.isArray((req.body as { temas?: unknown })?.temas) && (temas === undefined || temas.length === 0)) {
    (patch as Record<string, unknown>).temas = [];
  }

  if ((patch as { periodoId?: unknown }).periodoId) {
    const periodoId = String((patch as { periodoId?: unknown }).periodoId ?? '').trim();
    const periodo = await Periodo.findOne({ _id: periodoId, docenteId }).lean();
    if (!periodo) {
      throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
    }
    if ((periodo as unknown as { activo?: boolean }).activo === false) {
      throw new ErrorAplicacion('PERIODO_INACTIVO', 'La materia esta archivada', 409);
    }
  }

  const merged = {
    periodoId: (patch as { periodoId?: unknown }).periodoId ?? actual.periodoId,
    tipo: (patch as { tipo?: unknown }).tipo ?? actual.tipo,
    titulo: (patch as { titulo?: unknown }).titulo ?? actual.titulo,
    instrucciones: (patch as { instrucciones?: unknown }).instrucciones ?? actual.instrucciones,
    numeroPaginas:
      (patch as { numeroPaginas?: unknown }).numeroPaginas ??
      (actual as unknown as { numeroPaginas?: unknown }).numeroPaginas,
    reactivosObjetivo:
      (patch as { reactivosObjetivo?: unknown }).reactivosObjetivo ??
      (actual as unknown as { reactivosObjetivo?: unknown }).reactivosObjetivo,
    defaultVersionCount:
      (patch as { defaultVersionCount?: unknown }).defaultVersionCount ??
      (actual as unknown as { defaultVersionCount?: unknown }).defaultVersionCount,
    answerKeyMode:
      (patch as { answerKeyMode?: unknown }).answerKeyMode ?? (actual as unknown as { answerKeyMode?: unknown }).answerKeyMode,
    preguntasIds: (patch as { preguntasIds?: unknown }).preguntasIds ?? actual.preguntasIds,
    temas: (patch as { temas?: unknown }).temas ?? (actual as unknown as { temas?: unknown }).temas,
    bookletConfig:
      (patch as { bookletConfig?: unknown }).bookletConfig ?? (actual as unknown as { bookletConfig?: unknown }).bookletConfig,
    omrConfig: (patch as { omrConfig?: unknown }).omrConfig ?? (actual as unknown as { omrConfig?: unknown }).omrConfig,
    configuracionPdf: (patch as { configuracionPdf?: unknown }).configuracionPdf ?? actual.configuracionPdf
  };

  const preguntasIds = Array.isArray(merged.preguntasIds) ? merged.preguntasIds : [];
  const temasMerged = Array.isArray(merged.temas) ? merged.temas : [];
  if (preguntasIds.length === 0 && temasMerged.length === 0) {
    throw new ErrorAplicacion('PLANTILLA_INVALIDA', 'La plantilla debe incluir preguntasIds o temas', 400);
  }
  if (temasMerged.length > 0 && !merged.periodoId) {
    throw new ErrorAplicacion('PLANTILLA_INVALIDA', 'periodoId es obligatorio cuando se usan temas', 400);
  }

  await validarTituloPlantillaDisponible({
    docenteId,
    titulo: merged.titulo,
    excluirPlantillaId: plantillaId
  });

  const actualizado = await ExamenPlantilla.findOneAndUpdate(
    { _id: plantillaId, docenteId },
    {
      $set: {
        ...patch,
        titulo: String(merged.titulo ?? '').trim(),
        tituloNormalizado: normalizarTituloPlantilla(String(merged.titulo ?? ''))
      }
    },
    { returnDocument: 'after' }
  ).lean();

  res.json({ plantilla: actualizado });
}

/**
 * Archiva una plantilla sin borrar sus datos.
 */
export async function archivarPlantilla(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const plantillaId = String(req.params.id || '').trim();
  const plantilla = await ExamenPlantilla.findById(plantillaId).lean();
  if (!plantilla) {
    throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
  }
  if (String(plantilla.docenteId) !== String(docenteId)) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a la plantilla', 403);
  }

  if ((plantilla as unknown as { archivadoEn?: unknown }).archivadoEn) {
    return res.json({ ok: true, plantilla });
  }

  const actualizado = await ExamenPlantilla.findOneAndUpdate(
    { _id: plantillaId, docenteId },
    { $set: { archivadoEn: new Date() } },
    { returnDocument: 'after' }
  ).lean();

  res.json({ ok: true, plantilla: actualizado });
}

/**
 * Elimina una plantilla y sus examenes asociados (solo admin en desarrollo).
 */
export async function eliminarPlantilla(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const plantillaId = String(req.params.id || '').trim();
  const plantilla = await ExamenPlantilla.findById(plantillaId).lean();
  if (!plantilla) {
    throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
  }
  if (String(plantilla.docenteId) !== String(docenteId)) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a la plantilla', 403);
  }

  const examenes = await ExamenGenerado.find({ docenteId, plantillaId }).select('_id').lean();
  const examenesIds = examenes.map((examen) => String(examen._id));

  const [entregasDocs, calificacionesDocs, banderasDocs] = examenesIds.length
    ? await Promise.all([
        Entrega.find({ docenteId, examenGeneradoId: { $in: examenesIds } }).lean(),
        Calificacion.find({ docenteId, examenGeneradoId: { $in: examenesIds } }).lean(),
        BanderaRevision.find({ docenteId, examenGeneradoId: { $in: examenesIds } }).lean()
      ])
    : [[], [], []];

  await guardarEnPapelera({
    docenteId,
    tipo: 'plantilla',
    entidadId: plantillaId,
    payload: {
      plantilla,
      examenes,
      entregas: entregasDocs,
      calificaciones: calificacionesDocs,
      banderas: banderasDocs
    }
  });

  const [entregasResp, calificacionesResp, banderasResp] = examenesIds.length
    ? await Promise.all([
        Entrega.deleteMany({ docenteId, examenGeneradoId: { $in: examenesIds } }),
        Calificacion.deleteMany({ docenteId, examenGeneradoId: { $in: examenesIds } }),
        BanderaRevision.deleteMany({ docenteId, examenGeneradoId: { $in: examenesIds } })
      ])
    : [{ deletedCount: 0 }, { deletedCount: 0 }, { deletedCount: 0 }];

  const examenesResp = examenesIds.length
    ? await ExamenGenerado.deleteMany({ docenteId, _id: { $in: examenesIds } })
    : { deletedCount: 0 };

  const plantillaResp = await ExamenPlantilla.deleteOne({ _id: plantillaId, docenteId });

  res.json({
    ok: true,
    eliminados: {
      plantillas: plantillaResp.deletedCount ?? 0,
      examenes: examenesResp.deletedCount ?? 0,
      entregas: (entregasResp as { deletedCount?: number }).deletedCount ?? 0,
      calificaciones: (calificacionesResp as { deletedCount?: number }).deletedCount ?? 0,
      banderas: (banderasResp as { deletedCount?: number }).deletedCount ?? 0
    }
  });
}

/**
 * Genera un boceto de previsualizacion para una plantilla (por pagina), usando una seleccion determinista.
 */
export async function previsualizarPlantilla(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const plantillaId = String(req.params.id || '').trim();

  const plantilla = await ExamenPlantilla.findById(plantillaId).lean();
  if (!plantilla) {
    throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
  }
  if (String(plantilla.docenteId) !== String(docenteId)) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a la plantilla', 403);
  }

  const preguntasIds = Array.isArray(plantilla.preguntasIds) ? plantilla.preguntasIds : [];
  const temas = Array.isArray((plantilla as unknown as { temas?: unknown[] }).temas)
    ? ((plantilla as unknown as { temas?: unknown[] }).temas ?? []).map((t) => String(t ?? '').trim()).filter(Boolean)
    : [];

  const temasNormalizados = temas.map((t) => normalizarNombreTemaPreview(t)).filter(Boolean);
  const conteoPorTema = [] as Array<{ tema: string; disponibles: number }>;
  const temasDisponiblesEnMateria = [] as Array<{ tema: string; disponibles: number }>;

  let preguntasDb: BancoPreguntaLean[] = [];
  if (temas.length > 0) {
    if (!plantilla.periodoId) {
      throw new ErrorAplicacion('PLANTILLA_INVALIDA', 'La plantilla por temas requiere materia (periodoId)', 400);
    }
    preguntasDb = (await BancoPregunta.find({
      docenteId,
      activo: true,
      periodoId: plantilla.periodoId,
      tema: { $in: temas }
    })
      .sort({ updatedAt: -1, _id: -1 })
      .lean()) as BancoPreguntaLean[];

    // Desglose por tema (solo aplica en modo por temas)
    const mapaConteo = new Map<string, number>();
    for (const p of preguntasDb) {
      const k = claveTemaPreview((p as unknown as { tema?: unknown })?.tema);
      if (!k) continue;
      mapaConteo.set(k, (mapaConteo.get(k) ?? 0) + 1);
    }
    for (const tema of temasNormalizados) {
      const k = claveTemaPreview(tema);
      conteoPorTema.push({ tema, disponibles: mapaConteo.get(k) ?? 0 });
    }

    // Además, para diagnosticar: temas disponibles en la materia (top)
    try {
      const docenteObjectId = new Types.ObjectId(String(docenteId));
      const periodoObjectId = new Types.ObjectId(String(plantilla.periodoId));
      const filas = (await BancoPregunta.aggregate([
        { $match: { docenteId: docenteObjectId, activo: true, periodoId: periodoObjectId } },
        { $project: { tema: { $ifNull: ['$tema', ''] } } },
        { $group: { _id: '$tema', disponibles: { $sum: 1 } } },
        { $sort: { disponibles: -1, _id: 1 } },
        { $limit: 30 }
      ])) as Array<{ _id: unknown; disponibles: number }>;

      for (const fila of filas) {
        const tema = normalizarNombreTemaPreview(fila._id);
        temasDisponiblesEnMateria.push({ tema: tema || 'Sin tema', disponibles: Number(fila.disponibles ?? 0) });
      }
    } catch {
      // Best-effort: no bloquea la previsualizacion.
    }
  } else {
    preguntasDb = (await BancoPregunta.find({
      docenteId,
      activo: true,
      ...(plantilla.periodoId ? { periodoId: plantilla.periodoId } : {}),
      _id: { $in: preguntasIds }
    })
      .sort({ updatedAt: -1, _id: -1 })
      .lean()) as BancoPreguntaLean[];
  }

  if (preguntasDb.length === 0) {
    throw new ErrorAplicacion('SIN_PREGUNTAS', 'La plantilla no tiene preguntas disponibles para previsualizar', 400);
  }

  const totalDisponibles = preguntasDb.length;
  const numeroPaginas = resolverNumeroPaginasPlantilla(plantilla as unknown as { numeroPaginas?: unknown });

  const preguntasBase = normalizarPreguntasParaTv4(
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

  const seed = hash32(String(plantilla._id));
  const preguntasCandidatas = ordenarPreguntasDeterminista(preguntasBase, seed);
  const mapaVarianteDet = generarVarianteDeterminista(preguntasCandidatas, `plantilla:${plantilla._id}`);

  const [periodo, docenteDb] = await Promise.all([
    plantilla.periodoId ? Periodo.findById(plantilla.periodoId).lean() : Promise.resolve(null),
    Docente.findById(docenteId).lean()
  ]);
  const templateVersionOmr = resolverTemplateVersionOmr({
    docenteId,
    periodoId: plantilla.periodoId,
    plantillaId: plantilla._id
  });

  const generarPreview = (paginasObjetivo: number) =>
    generarPdfExamen({
      titulo: String(plantilla.titulo ?? ''),
      folio: 'PREVIEW',
      preguntas: preguntasCandidatas,
      mapaVariante: mapaVarianteDet as unknown as ReturnType<typeof generarVariante>,
      tipoExamen: plantilla.tipo as 'parcial' | 'global',
      totalPaginas: paginasObjetivo,
      margenMm: plantilla.configuracionPdf?.margenMm ?? 10,
      templateVersion: templateVersionOmr,
      encabezado: construirEncabezadoPdf({
        periodo,
        docenteDb,
        instrucciones: (plantilla as unknown as { instrucciones?: unknown })?.instrucciones,
        incluirPrefijosDocente: true
      })
    });

  const paginasObjetivo = numeroPaginas;
  const previewResultado = await generarPreview(paginasObjetivo);

  const { paginas, metricasPaginas, mapaOmr, preguntasRestantes } = previewResultado;

  const porId = new Map<string, (typeof preguntasCandidatas)[number]>();
  for (const p of preguntasCandidatas) porId.set(p.id, p);
  const ordenadas = (mapaVarianteDet.ordenPreguntas || []).map((id) => porId.get(id)).filter(Boolean) as Array<
    (typeof preguntasCandidatas)[number]
  >;

  const totalUsados = extraerPreguntasUsadasMapaOmr(mapaOmr as never).size;
  const ultima = (Array.isArray(metricasPaginas) ? metricasPaginas : []).find((m) => m.numero === paginasObjetivo);
  const fraccionVaciaUltimaPagina = Number(ultima?.fraccionVacia ?? 0);
  const umbralVacioResidual = 0.05;
  const consumioTodas = totalUsados >= totalDisponibles;
  const advertencias: string[] = [];
  if (consumioTodas && fraccionVaciaUltimaPagina > umbralVacioResidual) {
    advertencias.push(
      `No hay suficientes preguntas para llenar ${paginasObjetivo} pagina(s). ` +
        `La ultima pagina queda ${(fraccionVaciaUltimaPagina * 100).toFixed(0)}% vacia.`
    );
  }
  if (paginas.length < paginasObjetivo) {
    advertencias.push(`Se generaron ${paginas.length} de ${paginasObjetivo} pagina(s) por falta de preguntas.`);
  }
  if ((preguntasRestantes ?? 0) > 0) {
    advertencias.push(
      `Hay ${preguntasRestantes} pregunta(s) que no caben en ${paginasObjetivo} pagina(s). Aumenta el numero de paginas.`
    );
  }

  const elementosBase = [
    'Titulo',
    'Folio (placeholder)',
    'QR por pagina',
    'Marcas de registro',
    'OMR (burbujas por opcion)'
  ];

  const paginasSketch = (Array.isArray(paginas) ? paginas : []).map((p) => {
    const del = Number((p as { preguntasDel?: number }).preguntasDel ?? 0);
    const al = Number((p as { preguntasAl?: number }).preguntasAl ?? 0);
    const preguntasPagina = del > 0 && al > 0 ? ordenadas.slice(del - 1, al) : [];
    return {
      numero: (p as { numero: number }).numero,
      preguntasDel: del,
      preguntasAl: al,
      elementos: elementosBase,
      preguntas: preguntasPagina.map((pr, idx) => {
        const n = del + idx;
        const enunciado = String(pr.enunciado ?? '').trim().replace(/\s+/g, ' ');
        return {
          numero: n,
          id: pr.id,
          tieneImagen: Boolean(String(pr.imagenUrl ?? '').trim()),
          enunciadoCorto: enunciado.length > 120 ? `${enunciado.slice(0, 117)}…` : enunciado
        };
      })
    };
  });

  res.json({
    plantillaId: String(plantilla._id),
    numeroPaginas: paginasObjetivo,
    numeroPaginasConfiguradas: numeroPaginas,
    totalDisponibles,
    totalUsados,
    fraccionVaciaUltimaPagina,
    advertencias,
    conteoPorTema,
    temasDisponiblesEnMateria,
    paginas: paginasSketch
  });
}

/**
 * Genera un PDF real de previsualizacion para una plantilla.
 * Esto permite ver el documento exactamente como se renderizara (layout, QR/OMR, etc.).
 */
export async function previsualizarPlantillaPdf(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const plantillaId = String(req.params.id || '').trim();

  const plantilla = await ExamenPlantilla.findById(plantillaId).lean();
  if (!plantilla) {
    throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
  }
  if (String(plantilla.docenteId) !== String(docenteId)) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a la plantilla', 403);
  }

  const preguntasIds = Array.isArray(plantilla.preguntasIds) ? plantilla.preguntasIds : [];
  const temas = Array.isArray((plantilla as unknown as { temas?: unknown[] }).temas)
    ? ((plantilla as unknown as { temas?: unknown[] }).temas ?? []).map((t) => String(t ?? '').trim()).filter(Boolean)
    : [];

  let preguntasDb: BancoPreguntaLean[] = [];
  if (temas.length > 0) {
    if (!plantilla.periodoId) {
      throw new ErrorAplicacion('PLANTILLA_INVALIDA', 'La plantilla por temas requiere materia (periodoId)', 400);
    }
    preguntasDb = (await BancoPregunta.find({
      docenteId,
      activo: true,
      periodoId: plantilla.periodoId,
      tema: { $in: temas }
    })
      .sort({ updatedAt: -1, _id: -1 })
      .lean()) as BancoPreguntaLean[];
  } else {
    preguntasDb = (await BancoPregunta.find({
      docenteId,
      activo: true,
      ...(plantilla.periodoId ? { periodoId: plantilla.periodoId } : {}),
      _id: { $in: preguntasIds }
    })
      .sort({ updatedAt: -1, _id: -1 })
      .lean()) as BancoPreguntaLean[];
  }

  if (preguntasDb.length === 0) {
    throw new ErrorAplicacion('SIN_PREGUNTAS', 'La plantilla no tiene preguntas disponibles para previsualizar', 400);
  }

  const numeroPaginas = resolverNumeroPaginasPlantilla(plantilla as unknown as { numeroPaginas?: unknown });

  const preguntasBase = normalizarPreguntasParaTv4(
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

  const esDev = String(configuracion.entorno).toLowerCase() === 'development';
  if (!esDev) {
    await limpiarPreviewTemporales();
  }
  const previewKey = clavePreviewPlantilla({
    plantillaId,
    plantillaUpdatedAt: (plantilla as unknown as { updatedAt?: unknown })?.updatedAt,
    numeroPaginas,
    totalPreguntas: preguntasBase.length,
    temas
  });
  const dirPreview = obtenerDirectorioPreview();
  const nombreArchivoPreview = construirNombrePdfPreviewPlantilla({
    plantillaId,
    plantillaTitulo: String((plantilla as unknown as { titulo?: unknown })?.titulo ?? ''),
    previewKey
  });
  const archivoPreview = path.join(dirPreview, nombreArchivoPreview);
  if (!esDev) {
    try {
      const stat = await fs.stat(archivoPreview);
      const expiraEn = stat.mtimeMs + PREVIEW_TTL_MS;
      if (Date.now() < expiraEn) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${nombreArchivoPreview}"`);
        const buffer = await fs.readFile(archivoPreview);
        res.send(buffer);
        return;
      }
    } catch {
      // Si no existe o fallo stat, se regenera.
    }
  }

  const seed = hash32(String(plantilla._id));
  const preguntasCandidatas = ordenarPreguntasDeterminista(preguntasBase, seed);
  const mapaVarianteDet = generarVarianteDeterminista(preguntasCandidatas, `plantilla:${plantilla._id}`);

  const [periodo, docenteDb] = await Promise.all([
    plantilla.periodoId ? Periodo.findById(plantilla.periodoId).lean() : Promise.resolve(null),
    Docente.findById(docenteId).lean()
  ]);
  const templateVersionOmr = resolverTemplateVersionOmr({
    docenteId,
    periodoId: plantilla.periodoId,
    plantillaId: plantilla._id
  });

  const generarPreviewPdf = (paginasObjetivo: number) =>
    generarPdfExamen({
      titulo: String(plantilla.titulo ?? ''),
      folio: 'PREVIEW',
      preguntas: preguntasCandidatas,
      mapaVariante: mapaVarianteDet as unknown as ReturnType<typeof generarVariante>,
      tipoExamen: plantilla.tipo as 'parcial' | 'global',
      totalPaginas: paginasObjetivo,
      margenMm: plantilla.configuracionPdf?.margenMm ?? 10,
      templateVersion: templateVersionOmr,
      encabezado: construirEncabezadoPdf({
        periodo,
        docenteDb,
        instrucciones: (plantilla as unknown as { instrucciones?: unknown })?.instrucciones,
        incluirPrefijosDocente: false
      })
    });

  const paginasObjetivo = numeroPaginas;
  const previewResultado = await generarPreviewPdf(paginasObjetivo);
  const { pdfBytes } = previewResultado;

  if (!esDev) {
    try {
      await fs.mkdir(dirPreview, { recursive: true });
      await fs.writeFile(archivoPreview, Buffer.from(pdfBytes));
    } catch {
      // Best-effort: si falla el cache, se devuelve el PDF en memoria.
    }
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${nombreArchivoPreview}"`);
  res.send(Buffer.from(pdfBytes));
}

/**
 * Genera un examen a partir de una plantilla.
 *
 * Contrato de autorizacion por objeto:
 * - La plantilla debe pertenecer al docente autenticado.
 *
 * Notas de implementacion:
 * - `folio` se deriva de `randomUUID()` para minimizar colisiones.
 * - El PDF se persiste en almacenamiento local y se registra la ruta.
 */
export async function generarExamen(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { plantillaId } = req.body;
  const plantilla = await ExamenPlantilla.findById(plantillaId).lean();

  if (!plantilla) {
    throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
  }
  if (String(plantilla.docenteId) !== String(docenteId)) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a la plantilla', 403);
  }
  if ((plantilla as unknown as { archivadoEn?: unknown }).archivadoEn) {
    throw new ErrorAplicacion('PLANTILLA_ARCHIVADA', 'La plantilla esta archivada', 409);
  }

  const periodo = plantilla.periodoId ? await Periodo.findById(plantilla.periodoId).lean() : null;
  if (plantilla.periodoId && !periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }
  if (periodo && (periodo as unknown as { activo?: boolean }).activo === false) {
    throw new ErrorAplicacion('PERIODO_INACTIVO', 'La materia esta archivada', 409);
  }

  const docenteDb = await Docente.findById(docenteId).lean();

  const preguntasIds = Array.isArray(plantilla.preguntasIds) ? plantilla.preguntasIds : [];
  const temas = Array.isArray((plantilla as unknown as { temas?: unknown[] }).temas)
    ? ((plantilla as unknown as { temas?: unknown[] }).temas ?? []).map((t) => String(t ?? '').trim()).filter(Boolean)
    : [];

  let preguntasDb: BancoPreguntaLean[] = [];
  if (temas.length > 0) {
    if (!plantilla.periodoId) {
      throw new ErrorAplicacion('PLANTILLA_INVALIDA', 'La plantilla por temas requiere materia (periodoId)', 400);
    }
    preguntasDb = (await BancoPregunta.find({
      docenteId,
      activo: true,
      periodoId: plantilla.periodoId,
      tema: { $in: temas }
    }).lean()) as BancoPreguntaLean[];
  } else {
    preguntasDb = (await BancoPregunta.find({
      docenteId,
      activo: true,
      ...(plantilla.periodoId ? { periodoId: plantilla.periodoId } : {}),
      _id: { $in: preguntasIds }
    }).lean()) as BancoPreguntaLean[];
  }

  if (preguntasDb.length === 0) {
    throw new ErrorAplicacion('SIN_PREGUNTAS', 'La plantilla no tiene preguntas asociadas', 400);
  }
  const numeroPaginas = resolverNumeroPaginasPlantilla(plantilla as unknown as { numeroPaginas?: unknown });

  const preguntasBase = normalizarPreguntasParaTv4(
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

  const preguntasCandidatas = ordenarPreguntasAleatorio(preguntasBase);
  const mapaVariante = generarVariante(preguntasCandidatas);
  const loteId = randomUUID().split('-')[0].toUpperCase();
  const folio = randomUUID().split('-')[0].toUpperCase();
  const examenGeneradoId = new Types.ObjectId();
  const templateVersionOmr = resolverTemplateVersionOmr({
    docenteId,
    periodoId: plantilla.periodoId,
    plantillaId: plantilla._id
  });

  const generarConPaginas = (paginasObjetivo: number) =>
    generarPdfExamen({
      titulo: plantilla.titulo,
      folio,
      examId: String(examenGeneradoId),
      preguntas: preguntasCandidatas,
      mapaVariante,
      tipoExamen: plantilla.tipo as 'parcial' | 'global',
      totalPaginas: paginasObjetivo,
      margenMm: plantilla.configuracionPdf?.margenMm ?? 10,
      templateVersion: templateVersionOmr,
      encabezado: construirEncabezadoPdf({
        periodo,
        docenteDb,
        instrucciones: (plantilla as unknown as { instrucciones?: unknown })?.instrucciones,
        incluirPrefijosDocente: true
      })
    });

  const paginasObjetivo = numeroPaginas;
  const resultadoPdf = await generarConPaginas(paginasObjetivo);

  const { pdfBytes, paginas, metricasPaginas, mapaOmr, preguntasRestantes } = resultadoPdf;

  const usadosSet = extraerPreguntasUsadasMapaOmr(mapaOmr as never);
  const mapaVarianteUsada = construirMapaVarianteUsadaDesdeOmr(mapaVariante, mapaOmr);

  const ultima = (Array.isArray(metricasPaginas) ? metricasPaginas : []).find((m) => m.numero === paginasObjetivo);
  const fraccionVaciaUltimaPagina = Number(ultima?.fraccionVacia ?? 0);
  const consumioTodas = usadosSet.size >= preguntasDb.length;
  const advertencias: string[] = [];
  const umbralVacioResidual = 0.05;
  const esTest = String(configuracion.entorno).toLowerCase() === 'test';
  if ((preguntasRestantes ?? 0) > 0) {
    if (!esTest) {
      throw new ErrorAplicacion(
        'PAGINAS_INSUFICIENTES_POR_EXCESO',
        `No caben ${preguntasRestantes} pregunta(s) en ${paginasObjetivo} pagina(s). Aumenta el numero de paginas.`,
        409,
        { preguntasRestantes, numeroPaginas: paginasObjetivo }
      );
    }
    advertencias.push(
      `No caben ${preguntasRestantes} pregunta(s) en ${paginasObjetivo} pagina(s). Aumenta el numero de paginas.`
    );
  }
  if (consumioTodas && fraccionVaciaUltimaPagina > 0.5) {
    if (!esTest) {
      throw new ErrorAplicacion(
        'PAGINAS_INSUFICIENTES',
        `No hay suficientes preguntas para llenar ${paginasObjetivo} pagina(s). La ultima pagina queda ${(fraccionVaciaUltimaPagina * 100).toFixed(
          0
        )}% vacia.`,
        409,
        { fraccionVaciaUltimaPagina, numeroPaginas: paginasObjetivo }
      );
    }
    advertencias.push(
      `No hay suficientes preguntas para llenar ${paginasObjetivo} pagina(s). La ultima pagina queda ${(fraccionVaciaUltimaPagina * 100).toFixed(0)}% vacia.`
    );
  }
  if (consumioTodas && fraccionVaciaUltimaPagina > umbralVacioResidual) {
    advertencias.push(
      `La ultima pagina queda ${(fraccionVaciaUltimaPagina * 100).toFixed(0)}% vacia por falta de preguntas.`
    );
  }

  const nombreArchivo = construirNombrePdfExamen({
    folio,
    loteId,
    materiaNombre: String((periodo as unknown as { nombre?: unknown })?.nombre ?? ''),
    temas,
    plantillaTitulo: String(plantilla.titulo ?? '')
  });
  const rutaPdf = await guardarPdfExamen(nombreArchivo, pdfBytes);
  const recoveryManifest = construirRecoveryManifest({
    examId: String(examenGeneradoId),
    docenteId: String(docenteId),
    periodoId: plantilla.periodoId ? String(plantilla.periodoId) : undefined,
    plantillaId: String(plantilla._id),
    loteId,
    folio,
    templateVersion: templateVersionOmr,
    preguntas: preguntasCandidatas,
    mapaVariante: mapaVarianteUsada,
    mapaOmr,
    paginas
  });

  const examenGenerado = await ExamenGenerado.create({
    _id: examenGeneradoId,
    docenteId,
    periodoId: plantilla.periodoId,
    plantillaId: plantilla._id,
    loteId,
    origenGeneracion: 'individual',
    folio,
    estado: 'generado',
    preguntasIds: mapaVarianteUsada.ordenPreguntas,
    mapaVariante: mapaVarianteUsada,
    paginas,
    mapaOmr,
    rutaPdf,
    retentionStatus: 'active',
    recoveryKeyId: recoveryManifest.keyId,
    recoveryManifestHash: recoveryManifest.manifestHash,
    recoveryManifest
  });
  await ExamenRecoveryManifest.create({
    docenteId,
    periodoId: plantilla.periodoId,
    plantillaId: plantilla._id,
    examId: String(examenGeneradoId),
    folio,
    loteId,
    keyId: recoveryManifest.keyId,
    manifestHash: recoveryManifest.manifestHash,
    manifest: recoveryManifest
  });

  res.status(201).json({ examenGenerado, advertencias });
}

/**
 * Genera examenes para todos los alumnos activos de la materia (periodo) asociada a la plantilla.
 *
 * Nota: esta operacion puede ser pesada; se incluye un guard-rail para grupos grandes.
 */
export async function generarExamenesLote(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { plantillaId, confirmarMasivo, loteId: loteIdEntrada } = req.body as {
    plantillaId: string;
    confirmarMasivo?: boolean;
    loteId?: string;
  };

  const plantilla = await ExamenPlantilla.findById(plantillaId).lean();
  if (!plantilla) {
    throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
  }
  if (String(plantilla.docenteId) !== String(docenteId)) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a la plantilla', 403);
  }
  if ((plantilla as unknown as { archivadoEn?: unknown }).archivadoEn) {
    throw new ErrorAplicacion('PLANTILLA_ARCHIVADA', 'La plantilla esta archivada', 409);
  }
  if (!plantilla.periodoId) {
    throw new ErrorAplicacion('PLANTILLA_INVALIDA', 'La plantilla requiere materia (periodoId) para generar en lote', 400);
  }

  const loteIdNormalizado = normalizarParaNombreArchivo(String(loteIdEntrada ?? '').trim(), { maxLen: 16 }).toUpperCase();
  let loteId = loteIdNormalizado || randomUUID().split('-')[0].toUpperCase();
  if (loteIdNormalizado) {
    const loteExistente = await ExamenGenerado.exists({ docenteId, loteId });
    if (loteExistente) {
      loteId = randomUUID().split('-')[0].toUpperCase();
    }
  }
  const periodo = await Periodo.findById(plantilla.periodoId).lean();
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }
  if ((periodo as unknown as { activo?: boolean }).activo === false) {
    throw new ErrorAplicacion('PERIODO_INACTIVO', 'La materia esta archivada', 409);
  }
  const docenteDb = await Docente.findById(docenteId).lean();

  const alumnos = await Alumno.find({ docenteId, periodoId: plantilla.periodoId, activo: true }).lean();
  const totalAlumnos = Array.isArray(alumnos) ? alumnos.length : 0;
  const esTest = String(configuracion.entorno).toLowerCase() === 'test';
  if (totalAlumnos === 0) {
    throw new ErrorAplicacion('SIN_ALUMNOS', 'No hay alumnos activos en esta materia', 400);
  }

  const LIMITE_SIN_CONFIRMAR = 200;
  if (totalAlumnos > LIMITE_SIN_CONFIRMAR && !confirmarMasivo) {
    throw new ErrorAplicacion(
      'CONFIRMAR_MASIVO',
      `Vas a generar ${totalAlumnos} examenes. Reintenta con confirmarMasivo=true para continuar.`,
      400
    );
  }

  const preguntasIds = Array.isArray(plantilla.preguntasIds) ? plantilla.preguntasIds : [];
  const temas = Array.isArray((plantilla as unknown as { temas?: unknown[] }).temas)
    ? ((plantilla as unknown as { temas?: unknown[] }).temas ?? []).map((t) => String(t ?? '').trim()).filter(Boolean)
    : [];

  let preguntasDb: BancoPreguntaLean[] = [];
  if (temas.length > 0) {
    preguntasDb = (await BancoPregunta.find({
      docenteId,
      activo: true,
      periodoId: plantilla.periodoId,
      tema: { $in: temas }
    }).lean()) as BancoPreguntaLean[];
  } else {
    preguntasDb = (await BancoPregunta.find({
      docenteId,
      activo: true,
      periodoId: plantilla.periodoId,
      _id: { $in: preguntasIds }
    }).lean()) as BancoPreguntaLean[];
  }

  if (preguntasDb.length === 0) {
    throw new ErrorAplicacion('SIN_PREGUNTAS', 'La plantilla no tiene preguntas asociadas', 400);
  }
  const numeroPaginas = resolverNumeroPaginasPlantilla(plantilla as unknown as { numeroPaginas?: unknown });

  const preguntasBase = normalizarPreguntasParaTv4(
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

  // Pre-chequeo: fija el set de preguntas del lote para que TODOS los examenes
  // usen exactamente las mismas preguntas y cantidad de reactivos.
  const templateVersionOmr = resolverTemplateVersionOmr({
    docenteId,
    periodoId: plantilla.periodoId,
    plantillaId: plantilla._id
  });
  let preguntasBaseLote: ReturnType<typeof normalizarPreguntasParaTv4> = [];
  let reactivosTotalesLote = 0;
  {
    const preguntasCandidatas = ordenarPreguntasDeterminista(preguntasBase, hash32(`${String(plantilla._id)}:${loteId}:lote-base`));
    const mapaVariante = generarVarianteDeterminista(preguntasCandidatas, `plantilla:${plantilla._id}:lote-base:${loteId}`);
    const { metricasPaginas, mapaOmr, preguntasRestantes } = await generarPdfExamen({
      titulo: plantilla.titulo,
      folio: 'PRECHECK',
      preguntas: preguntasCandidatas,
      mapaVariante: mapaVariante as unknown as ReturnType<typeof generarVariante>,
      tipoExamen: plantilla.tipo as 'parcial' | 'global',
      totalPaginas: numeroPaginas,
      margenMm: plantilla.configuracionPdf?.margenMm ?? 10,
      templateVersion: templateVersionOmr,
      encabezado: construirEncabezadoPdf({
        periodo,
        docenteDb,
        instrucciones: (plantilla as unknown as { instrucciones?: unknown })?.instrucciones,
        incluirPrefijosDocente: true
      })
    });
    if ((preguntasRestantes ?? 0) > 0) {
      throw new ErrorAplicacion(
        'PAGINAS_INSUFICIENTES_POR_EXCESO',
        `No caben ${preguntasRestantes} pregunta(s) en ${numeroPaginas} pagina(s). Aumenta el numero de paginas.`,
        409,
        { preguntasRestantes, numeroPaginas }
      );
    }

    const mapaVarianteUsada = construirMapaVarianteUsadaDesdeOmr(mapaVariante, mapaOmr);
    const idsPreguntasLote = Array.from(
      new Set(
        (Array.isArray(mapaVarianteUsada.ordenPreguntas) ? mapaVarianteUsada.ordenPreguntas : [])
          .map((id) => String(id ?? '').trim())
          .filter(Boolean)
      )
    );

    if (idsPreguntasLote.length === 0) {
      throw new ErrorAplicacion('SIN_PREGUNTAS', 'No se pudo determinar el set de preguntas del lote', 409);
    }

    const preguntasPorId = new Map(preguntasBase.map((pregunta) => [String(pregunta.id), pregunta]));
    preguntasBaseLote = normalizarPreguntasParaTv4(
      idsPreguntasLote
        .map((id) => preguntasPorId.get(id))
        .filter((pregunta): pregunta is NonNullable<typeof pregunta> => Boolean(pregunta))
    );
    reactivosTotalesLote = preguntasBaseLote.length;

    if (reactivosTotalesLote !== idsPreguntasLote.length) {
      throw new ErrorAplicacion(
        'PREGUNTAS_NO_DISPONIBLES',
        'No se pudieron resolver todas las preguntas seleccionadas para el lote.',
        409
      );
    }

    const usadosSet = new Set(idsPreguntasLote);
    const ultima = (Array.isArray(metricasPaginas) ? metricasPaginas : []).find((m) => m.numero === numeroPaginas);
    const fraccionVaciaUltimaPagina = Number(ultima?.fraccionVacia ?? 0);
    const consumioTodas = usadosSet.size >= reactivosTotalesLote;
    if (!esTest && consumioTodas && fraccionVaciaUltimaPagina > 0.5) {
      throw new ErrorAplicacion(
        'PAGINAS_INSUFICIENTES',
        `No hay suficientes preguntas para llenar ${numeroPaginas} pagina(s). La ultima pagina queda ${(fraccionVaciaUltimaPagina * 100).toFixed(
          0
        )}% vacia.`,
        409,
        { fraccionVaciaUltimaPagina, numeroPaginas }
      );
    }
  }

  const firmasVariantesLote = new Set<string>();
  const maxIntentosVarianteUnica = Math.min(36, Math.max(10, totalAlumnos * 2));

  async function crearExamenSinAlumno() {
    for (let intento = 0; intento < maxIntentosVarianteUnica; intento += 1) {
      const preguntasCandidatas = ordenarPreguntasAleatorio(preguntasBaseLote);
      const mapaVariante = generarVariante(preguntasCandidatas);
      const esUltimoIntentoVariante = intento + 1 >= maxIntentosVarianteUnica;
      let folio = randomUUID().split('-')[0].toUpperCase();
      try {
        const examenGeneradoId = new Types.ObjectId();
        const { pdfBytes, paginas, metricasPaginas, mapaOmr, preguntasRestantes } = await generarPdfExamen({
          titulo: plantilla.titulo,
          folio,
          examId: String(examenGeneradoId),
          preguntas: preguntasCandidatas,
          mapaVariante,
          tipoExamen: plantilla.tipo as 'parcial' | 'global',
          totalPaginas: numeroPaginas,
          margenMm: plantilla.configuracionPdf?.margenMm ?? 10,
          templateVersion: templateVersionOmr,
          encabezado: construirEncabezadoPdf({
            periodo,
            docenteDb,
            instrucciones: (plantilla as unknown as { instrucciones?: unknown })?.instrucciones,
            incluirPrefijosDocente: true
          })
        });

        const usadosSet = extraerPreguntasUsadasMapaOmr(mapaOmr as never);
        const mapaVarianteUsada = construirMapaVarianteUsadaDesdeOmr(mapaVariante, mapaOmr);
        const reactivosUsados = Array.isArray(mapaVarianteUsada.ordenPreguntas) ? mapaVarianteUsada.ordenPreguntas.length : 0;

        if ((preguntasRestantes ?? 0) > 0 || reactivosUsados !== reactivosTotalesLote) {
          if (!esUltimoIntentoVariante) {
            continue;
          }
          throw new ErrorAplicacion(
            'LOTE_VARIANTE_INCONSISTENTE',
            `No se pudo mantener un lote consistente de ${reactivosTotalesLote} reactivos en ${numeroPaginas} pagina(s).`,
            409,
            { preguntasRestantes, reactivosUsados, reactivosTotalesLote, numeroPaginas }
          );
        }

        const firmaVariante = construirFirmaVariante(mapaVarianteUsada);

        const ultima = (Array.isArray(metricasPaginas) ? metricasPaginas : []).find((m) => m.numero === numeroPaginas);
        const fraccionVaciaUltimaPagina = Number(ultima?.fraccionVacia ?? 0);
        const consumioTodas = usadosSet.size >= reactivosTotalesLote;
        if (!esTest && consumioTodas && fraccionVaciaUltimaPagina > 0.5) {
          throw new ErrorAplicacion(
            'PAGINAS_INSUFICIENTES',
            `No hay suficientes preguntas para llenar ${numeroPaginas} pagina(s). La ultima pagina queda ${(fraccionVaciaUltimaPagina * 100).toFixed(
              0
            )}% vacia.`,
            409,
            { fraccionVaciaUltimaPagina, numeroPaginas }
          );
        }

        if (firmasVariantesLote.has(firmaVariante) && !esUltimoIntentoVariante) {
          continue;
        }

        const nombreArchivo = construirNombrePdfExamen({
          folio,
          loteId,
          materiaNombre: String((periodo as unknown as { nombre?: unknown })?.nombre ?? ''),
          temas,
          plantillaTitulo: String(plantilla.titulo ?? '')
        });
        const rutaPdf = await guardarPdfExamen(nombreArchivo, pdfBytes);
        const recoveryManifest = construirRecoveryManifest({
          examId: String(examenGeneradoId),
          docenteId: String(docenteId),
          periodoId: plantilla.periodoId ? String(plantilla.periodoId) : undefined,
          plantillaId: String(plantilla._id),
          loteId,
          folio,
          templateVersion: templateVersionOmr,
          preguntas: preguntasCandidatas,
          mapaVariante: mapaVarianteUsada,
          mapaOmr,
          paginas
        });

        const examenGenerado = await ExamenGenerado.create({
          _id: examenGeneradoId,
          docenteId,
          periodoId: plantilla.periodoId,
          plantillaId: plantilla._id,
          loteId,
          origenGeneracion: 'lote',
          folio,
          estado: 'generado',
          preguntasIds: mapaVarianteUsada.ordenPreguntas,
          mapaVariante: mapaVarianteUsada,
          paginas,
          mapaOmr,
          rutaPdf,
          retentionStatus: 'active',
          recoveryKeyId: recoveryManifest.keyId,
          recoveryManifestHash: recoveryManifest.manifestHash,
          recoveryManifest
        });
        await ExamenRecoveryManifest.create({
          docenteId,
          periodoId: plantilla.periodoId,
          plantillaId: plantilla._id,
          examId: String(examenGeneradoId),
          folio,
          loteId,
          keyId: recoveryManifest.keyId,
          manifestHash: recoveryManifest.manifestHash,
          manifest: recoveryManifest
        });

        firmasVariantesLote.add(firmaVariante);

        return { examenGenerado, pdfBytes, recoveryManifest };
      } catch (error) {
        // Reintenta solo en colision de folio.
        const msg = String((error as { message?: unknown })?.message ?? '');
        if (msg.includes('E11000') && msg.toLowerCase().includes('folio')) {
          folio = randomUUID().split('-')[0].toUpperCase();
          continue;
        }
        throw error;
      }
    }
    throw new ErrorAplicacion('FOLIO_COLISION', 'No se pudo generar un folio unico', 500);
  }

  const examenesGenerados = [] as Array<{ _id: string; folio: string; generadoEn: Date }>;
  const pdfsLote: Uint8Array[] = [];
  const recoveryManifests = [] as Array<ReturnType<typeof construirRecoveryManifest>>;
  for (let indice = 0; indice < totalAlumnos; indice += 1) {
    const { examenGenerado, pdfBytes, recoveryManifest } = await crearExamenSinAlumno();
    examenesGenerados.push({
      _id: String(examenGenerado._id),
      folio: examenGenerado.folio,
      generadoEn: examenGenerado.generadoEn
    });
    if (pdfBytes) pdfsLote.push(pdfBytes);
    recoveryManifests.push(recoveryManifest);
  }

  if (recoveryManifests.length > 0) {
    const recoveryBundle = construirRecoveryBundle({
      loteId,
      docenteId: String(docenteId),
      periodoId: plantilla.periodoId ? String(plantilla.periodoId) : undefined,
      plantillaId: String(plantilla._id),
      templateVersion: templateVersionOmr,
      manifests: recoveryManifests
    });
    const bundlePersistido = await ExamenRecoveryBundle.create({
      docenteId,
      periodoId: plantilla.periodoId,
      plantillaId: plantilla._id,
      loteId,
      keyId: recoveryBundle.keyId,
      bundleHash: recoveryBundle.bundleHash,
      bundle: recoveryBundle
    });
    await ExamenGenerado.updateMany(
      { docenteId, loteId },
      {
        $set: {
          recoveryBundleId: bundlePersistido._id,
          recoveryBundleHash: recoveryBundle.bundleHash
        }
      }
    );
  }

  let lotePdfUrl: string | undefined;
  if (pdfsLote.length > 0) {
    const lotePdf = await PDFDocument.create();
    for (const bytes of pdfsLote) {
      const src = await PDFDocument.load(bytes);
      const pages = await lotePdf.copyPages(src, src.getPageIndices());
      pages.forEach((p) => lotePdf.addPage(p));
    }
    const loteBytes = Buffer.from(await lotePdf.save());
    const loteSafe = normalizarParaNombreArchivo(loteId, { maxLen: 16 }) || loteId;
    const nombreArchivo = construirNombrePdfLote({
      loteId: loteSafe,
      materiaNombre: String((periodo as unknown as { nombre?: unknown })?.nombre ?? ''),
      plantillaTitulo: String((plantilla as unknown as { titulo?: unknown })?.titulo ?? ''),
      totalExamenes: totalAlumnos
    });
    await guardarPdfExamen(nombreArchivo, loteBytes);
    lotePdfUrl = `/examenes/generados/lote/${encodeURIComponent(loteSafe)}/pdf`;
  }

  res.status(201).json({ loteId, totalAlumnos, examenesGenerados, lotePdfUrl });
}

export async function obtenerProgresoGeneracionLote(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const lote = normalizarParaNombreArchivo(String(req.params.loteId || '').trim(), { maxLen: 16 }).toUpperCase();
  if (!lote) {
    throw new ErrorAplicacion('LOTE_INVALIDO', 'Lote invalido', 400);
  }

  const plantillaId = String(req.query.plantillaId || '').trim();
  let totalEsperado = 0;
  if (plantillaId) {
    const plantilla = await ExamenPlantilla.findById(plantillaId).lean();
    if (plantilla && String(plantilla.docenteId) === String(docenteId) && plantilla.periodoId) {
      totalEsperado = await Alumno.countDocuments({
        docenteId,
        periodoId: plantilla.periodoId,
        activo: true
      });
    }
  }

  const generados = await ExamenGenerado.countDocuments({
    docenteId,
    loteId: lote,
    archivadoEn: { $exists: false }
  });

  const porcentajeBase = totalEsperado > 0 ? Math.round((generados / totalEsperado) * 100) : 0;
  const porcentaje = Math.max(0, Math.min(100, porcentajeBase));
  const completado = totalEsperado > 0 ? generados >= totalEsperado : false;
  const estado = completado ? 'completado' : generados > 0 ? 'generando' : 'iniciando';

  res.json({
    loteId: lote,
    totalEsperado,
    generados,
    porcentaje,
    completado,
    estado
  });
}

export async function descargarPdfLote(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const lote = normalizarParaNombreArchivo(String(req.params.loteId || '').trim(), { maxLen: 16 });
  if (!lote) {
    throw new ErrorAplicacion('LOTE_INVALIDO', 'Lote invalido', 400);
  }
  const examenLote = await ExamenGenerado.findOne({ docenteId, loteId: lote })
    .sort({ generadoEn: -1, _id: -1 })
    .select({ plantillaId: 1, periodoId: 1, retentionStatus: 1, artifactsPurgedAt: 1 })
    .lean();
  if (examenLote) {
    const retention = construirMetadataRetencion(examenLote as unknown as Record<string, unknown>);
    if (retention.retentionStatus === 'artifacts_purged') {
      throw new ErrorAplicacion('EXAMEN_ARTIFACTOS_EXPURGADOS', 'Los artefactos de este lote fueron expurgados por política de retención.', 410, retention);
    }
  }
  const [plantilla, periodo, totalExamenes] = await Promise.all([
    (examenLote as unknown as { plantillaId?: unknown })?.plantillaId
      ? ExamenPlantilla.findById(String((examenLote as unknown as { plantillaId?: unknown })?.plantillaId ?? '')).lean()
      : Promise.resolve(null),
    (examenLote as unknown as { periodoId?: unknown })?.periodoId
      ? Periodo.findById(String((examenLote as unknown as { periodoId?: unknown })?.periodoId ?? '')).lean()
      : Promise.resolve(null),
    ExamenGenerado.countDocuments({ docenteId, loteId: lote })
  ]);

  const nombreArchivo = construirNombrePdfLote({
    loteId: lote,
    materiaNombre: String((periodo as unknown as { nombre?: unknown })?.nombre ?? ''),
    plantillaTitulo: String((plantilla as unknown as { titulo?: unknown })?.titulo ?? ''),
    totalExamenes: Number(totalExamenes ?? 0)
  });
  const nombreArchivoAnterior = construirNombrePdfLoteAnterior({
    loteId: lote,
    materiaNombre: String((periodo as unknown as { nombre?: unknown })?.nombre ?? ''),
    plantillaTitulo: String((plantilla as unknown as { titulo?: unknown })?.titulo ?? '')
  });
  const ruta = resolverRutaPdfExamen(nombreArchivo);
  const rutaAnterior = resolverRutaPdfExamen(nombreArchivoAnterior);
  const rutaLegacy = resolverRutaPdfExamen(`examenes-lote-${lote}.pdf`);
  try {
    let buffer: Buffer;
    try {
      buffer = await fs.readFile(ruta);
    } catch {
      try {
        buffer = await fs.readFile(rutaAnterior);
      } catch {
        buffer = await fs.readFile(rutaLegacy);
      }
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.send(buffer);
  } catch {
    throw new ErrorAplicacion('PDF_NO_DISPONIBLE', 'PDF de lote no disponible', 404, { docenteId });
  }
}
