/**
 * previsualizacionPlantillas
 *
 * Responsabilidad: generar los payloads de preview JSON/PDF para plantillas
 * sin acoplar la lógica de dominio a Express.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ErrorAplicacion } from '../../../../compartido/errores/errorAplicacion.js';
import { prisma } from '../../../../infraestructura/baseDatos/sqlite.js';
import { generarPdfExamen } from '../../servicioGeneracionPdf.js';
import { generarVariante } from '../../servicioVariantes.js';
import { resolverNumeroPaginasPlantilla } from '../../domain/resolverNumeroPaginasPlantilla.js';
import { resolverOmrTemplateId } from '../../domain/templateCanonico.js';
import { obtenerPlantillaDocente } from '../../shared/controladorGeneracionPdfShared.js';
import {
  clavePreviewPlantilla,
  claveTemaPreview,
  construirEncabezadoPdf,
  construirFingerprintLayoutPreview,
  construirFingerprintPreguntasPreview,
  construirNombrePdfPreviewPlantilla,
  esEntornoDevelopment,
  generarVarianteDeterminista,
  hash32,
  limpiarPreviewTemporales,
  mapearPreguntasBase,
  normalizarNombreTemaPreview,
  obtenerConteoTemasMateria,
  obtenerDirectorioPreview,
  ordenarPreguntasDeterminista,
  construirBlueprintPlantilla,
  resolverDocentePdf,
  resolverPeriodoPlantillaActivo,
  resolverPreguntasPlantilla,
  resolverTemplateVersionOmr,
  validarPreguntasBase
} from '../../shared/controladorGeneracionPdfShared.js';
import { extraerPreguntasUsadasMapaOmr } from '../../domain/templateCanonico.js';
import { rasterizarPdfParaPreview, type PaginaPdfPreviewVisual } from '../../infra/rasterizadorPdfPreview.js';
import { resolverInstruccionesExamen, resolverTituloExamen } from '../../shared/tiposPdf.js';
import { guardarPreviewArchivadoValidado } from '../../domain/previewArchivado.js';

const PREVIEW_MEMORIA_TTL_MS = 10 * 60 * 1000;
const MAX_PREVIEWS_MEMORIA = 8;

type PreviewPdfMemoria = {
  buffer: Buffer;
  fileName: string;
  expiraEn: number;
};

type PreviewVisualMemoria = {
  expiraEn: number;
  payload: {
    fileName: string;
    pdfBase64: string;
    paginas: PaginaPdfPreviewVisual[];
    paginasTotales: number;
    paginasOmitidas: number;
  };
};

const previewsPdfMemoria = new Map<string, PreviewPdfMemoria>();
const previewsVisualesMemoria = new Map<string, PreviewVisualMemoria>();

type LayoutValidadoPlantilla = {
  version?: number;
  fontScale?: number;
  lineSpacing?: number;
  preguntasFingerprint?: string;
  layoutFingerprint?: string;
  numeroPaginas?: number;
  totalPreguntas?: number;
  temas?: string[];
};

function resolverLayoutValidadoPlantilla(params: {
  plantilla: { bookletConfig?: unknown };
  preguntasFingerprint: string;
  layoutFingerprint: string;
  numeroPaginas: number;
  totalPreguntas: number;
  temas: string[];
}) {
  const config = (params.plantilla.bookletConfig ?? {}) as Record<string, unknown>;
  const layout = config.resolvedLayout as LayoutValidadoPlantilla | undefined;
  if (!layout || layout.version !== 1) return undefined;
  if (layout.preguntasFingerprint !== params.preguntasFingerprint) return undefined;
  if (layout.layoutFingerprint !== params.layoutFingerprint) return undefined;
  if (Number(layout.numeroPaginas) !== params.numeroPaginas) return undefined;
  if (Number(layout.totalPreguntas) !== params.totalPreguntas) return undefined;
  if (JSON.stringify(layout.temas ?? []) !== JSON.stringify(params.temas)) return undefined;
  const fontScale = Number(layout.fontScale);
  const lineSpacing = Number(layout.lineSpacing);
  if (!Number.isFinite(fontScale) || !Number.isFinite(lineSpacing)) return undefined;
  return { fontScale, lineSpacing };
}

async function guardarLayoutValidadoPlantilla(params: {
  plantillaId: string;
  docenteId: string;
  periodoId?: string;
  mantenerFuenteInmutable?: boolean;
  bookletConfig: unknown;
  fontScale?: number;
  lineSpacing?: number;
  preguntasFingerprint: string;
  layoutFingerprint: string;
  numeroPaginas: number;
  totalPreguntas: number;
  temas: string[];
  blueprint?: unknown;
  fuentesExtraordinarioIds?: string[];
  totalPreguntasCandidatas?: number;
}) {
  const fontScale = Number(params.fontScale);
  const lineSpacing = Number(params.lineSpacing);
  if (!Number.isFinite(fontScale) || !Number.isFinite(lineSpacing)) return;
  const base = (params.bookletConfig ?? {}) as Record<string, unknown>;
  const bookletConfigValidado = {
    ...base,
    autoFitPages: false,
    autoFitTypography: false,
    fontScale,
    lineSpacing,
    resolvedLayout: {
      version: 1,
      fontScale,
      lineSpacing,
      preguntasFingerprint: params.preguntasFingerprint,
      layoutFingerprint: params.layoutFingerprint,
      numeroPaginas: params.numeroPaginas,
      totalPreguntas: params.totalPreguntas,
      temas: params.temas
    },
    ...(params.fuentesExtraordinarioIds?.length ? {
      extraordinarioFuentesPlantillaIds: params.fuentesExtraordinarioIds,
      extraordinarioTotalPreguntasCandidatas: params.totalPreguntasCandidatas
    } : {}),
    ...(params.blueprint ? { blueprint: params.blueprint, blueprintStatus: 'ready', blueprintVersion: 2 } : {})
  };
  if (params.mantenerFuenteInmutable) {
    if (!params.periodoId || !params.blueprint) return;
    guardarPreviewArchivadoValidado({
      docenteId: params.docenteId,
      periodoId: params.periodoId,
      plantillaId: params.plantillaId,
      bookletConfig: bookletConfigValidado,
      blueprintJson: JSON.stringify(params.blueprint)
    });
    return;
  }
  await prisma.examenPlantilla.update({
    where: { id: params.plantillaId },
    data: { bookletConfig: JSON.stringify(bookletConfigValidado) }
  });
}

function guardarPreviewMemoria<T>(mapa: Map<string, T>, clave: string, valor: T) {
  mapa.delete(clave);
  mapa.set(clave, valor);
  while (mapa.size > MAX_PREVIEWS_MEMORIA) {
    const primera = mapa.keys().next().value;
    if (typeof primera !== 'string') break;
    mapa.delete(primera);
  }
}

function construirPaginasSketch(params: {
  paginas: Array<{ numero: number; preguntasDel?: number; preguntasAl?: number }>;
  preguntasOrdenadas: Array<{ id: string; enunciado: string; imagenUrl?: string }>;
}) {
  const elementosBase = [
    'Titulo',
    'Folio (placeholder)',
    'QR por pagina',
    'Marcas de registro',
    'OMR (burbujas por opcion)'
  ];

  return params.paginas.map((pagina) => {
    const del = Number(pagina.preguntasDel ?? 0);
    const al = Number(pagina.preguntasAl ?? 0);
    const preguntasPagina = del > 0 && al > 0 ? params.preguntasOrdenadas.slice(del - 1, al) : [];
    return {
      numero: pagina.numero,
      preguntasDel: del,
      preguntasAl: al,
      elementos: elementosBase,
      preguntas: preguntasPagina.map((pregunta, index) => {
        const numero = del + index;
        const enunciado = String(pregunta.enunciado ?? '').trim().replace(/\s+/g, ' ');
        return {
          numero,
          id: pregunta.id,
          tieneImagen: Boolean(String(pregunta.imagenUrl ?? '').trim()),
          enunciadoCorto: enunciado.length > 120 ? `${enunciado.slice(0, 117)}…` : enunciado
        };
      })
    };
  });
}

async function resolverContextoPreview(docenteId: unknown, plantillaId: string) {
  const plantilla = await obtenerPlantillaDocente(docenteId, plantillaId);
  const periodoResuelto = await resolverPeriodoPlantillaActivo(plantilla, { permitirArchivado: true, docenteId });
  const permitirArchivados = Boolean(plantilla.archivadoEn) && periodoResuelto?.activo === false;
  if (periodoResuelto?.activo === false && !permitirArchivados) {
    throw new ErrorAplicacion('PERIODO_INACTIVO', 'La materia esta archivada', 409);
  }
  const resultadoBase = await resolverPreguntasPlantilla({
    docenteId,
    plantilla: plantilla as { id: string; periodoId?: unknown; preguntasIds?: unknown[]; temas?: unknown[] },
    ordenarPorRecencia: true,
    permitirArchivados
  });
  let preguntasDb = resultadoBase.preguntasDb;
  let temas = resultadoBase.temas;
  const temasPlantilla = [...resultadoBase.temas];
  const fuentesExtraordinario: string[] = [];
  const fuentesExtraordinarioIds: string[] = [];
  const preguntasGlobalesIds = resultadoBase.preguntasDb.map((pregunta) => String(pregunta.id));
  const idsPreguntasFuente = new Set(preguntasGlobalesIds);
  const reactivosOmitidosOmrPorId = new Map<string, { id: string; enunciado: string; problemas: string[] }>();
  const esPlantillaGlobal = String(plantilla.tipo) === 'global' || /\bglobal\b/i.test(String(plantilla.titulo ?? ''));
  if (permitirArchivados && esPlantillaGlobal && plantilla.periodoId) {
    const parciales = await prisma.examenPlantilla.findMany({
      where: {
        docenteId: String(docenteId),
        periodoId: String(plantilla.periodoId),
        tipo: 'parcial',
        archivadoEn: { not: null },
        id: { not: String(plantilla._id) }
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });
    const preguntasPorId = new Map(preguntasDb.map((pregunta) => [String(pregunta.id), pregunta]));
    const temasCombinados = new Set(temas);
    for (const parcialRaw of parciales) {
      const parcial = await obtenerPlantillaDocente(docenteId, String(parcialRaw.id));
      const resultadoParcial = await resolverPreguntasPlantilla({
        docenteId,
        plantilla: parcial as { id: string; periodoId?: unknown; preguntasIds?: unknown[]; temas?: unknown[] },
        ordenarPorRecencia: true,
        permitirArchivados: true
      });
      const validacionParcial = validarPreguntasBase(resultadoParcial.preguntasDb);
      const idsInvalidos = new Set(validacionParcial.invalidas.map((item) => item.id));
      validacionParcial.invalidas.forEach((item) => reactivosOmitidosOmrPorId.set(item.id, item));
      for (const pregunta of resultadoParcial.preguntasDb) {
        const id = String(pregunta.id);
        idsPreguntasFuente.add(id);
        if (idsInvalidos.has(id)) continue;
        if (!preguntasPorId.has(id)) preguntasPorId.set(id, pregunta);
      }
      resultadoParcial.temas.forEach((tema) => temasCombinados.add(tema));
      fuentesExtraordinario.push(String(parcial.titulo ?? 'Parcial'));
      fuentesExtraordinarioIds.push(String(parcial.id));
    }
    preguntasDb = [...preguntasPorId.values()];
    temas = [...temasCombinados];
  }

  if (preguntasDb.length === 0) {
    throw new ErrorAplicacion('SIN_PREGUNTAS', 'La plantilla no tiene preguntas disponibles para previsualizar', 400);
  }

  // Un extraordinario desde un periodo archivado se imprime en dos hojas
  // dúplex. Este formato no modifica el número configurado en el global fuente.
  const esExtraordinarioArchivado = Boolean(plantilla.archivadoEn) && periodoResuelto?.activo === false;
  const numeroPaginas = esExtraordinarioArchivado
    ? 4
    : resolverNumeroPaginasPlantilla(plantilla as { numeroPaginas?: unknown });
  const preguntasBase = mapearPreguntasBase(preguntasDb);
  const preguntasFingerprint = construirFingerprintPreguntasPreview(preguntasDb);
  const omrTemplateId = resolverOmrTemplateId(plantilla.omrConfig?.examTemplateId);
  const layoutFingerprint = `${construirFingerprintLayoutPreview()}|${omrTemplateId}${esExtraordinarioArchivado ? '|extra-duplex-4p-v1' : ''}`;
  const layoutValidado = resolverLayoutValidadoPlantilla({
    plantilla: plantilla as { bookletConfig?: unknown },
    preguntasFingerprint,
    layoutFingerprint,
    numeroPaginas,
    totalPreguntas: preguntasBase.length,
    temas: temasPlantilla
  });
  const bookletConfig = {
    ...(plantilla.bookletConfig ?? {}),
    distribuirEnPaginasObjetivo: esExtraordinarioArchivado,
    autoFitPages: layoutValidado ? false : true,
    autoFitTypography: layoutValidado ? false : true,
    fontScale: layoutValidado?.fontScale ?? 1,
    lineSpacing: layoutValidado?.lineSpacing ?? 1.1
  };
  const seed = hash32(String(plantilla._id));
  const preguntasCandidatas = ordenarPreguntasDeterminista(preguntasBase, seed);
  const mapaVarianteDet = generarVarianteDeterminista(preguntasCandidatas, `plantilla:${plantilla._id}`);
  const docenteDb = await resolverDocentePdf(docenteId);
  const templateVersionOmr = resolverTemplateVersionOmr({
    docenteId,
    periodoId: plantilla.periodoId,
    plantillaId: plantilla._id
  });

  return {
    plantilla,
    preguntasDb,
    preguntasBase,
    preguntasCandidatas,
    mapaVarianteDet,
    numeroPaginas,
    periodo: periodoResuelto,
    docenteDb,
    temas,
    temasPlantilla,
    fuentesExtraordinario,
    fuentesExtraordinarioIds,
    preguntasGlobalesIds,
    totalPreguntasFuente: idsPreguntasFuente.size,
    reactivosOmitidosOmr: [...reactivosOmitidosOmrPorId.values()],
    totalPreguntasCandidatas: preguntasDb.length,
    templateVersionOmr,
    omrTemplateId,
    layoutFingerprint,
    bookletConfig
  };
}

function puntajeDensidadPregunta(pregunta: { enunciado: string; imagenUrl?: string; opciones: Array<{ texto: string }> }) {
  const textoOpciones = pregunta.opciones.reduce((total, opcion) => total + String(opcion.texto ?? '').length, 0);
  return String(pregunta.enunciado ?? '').length + textoOpciones * 0.7 + (pregunta.imagenUrl ? 320 : 0);
}

async function generarPdfPreviewContexto(contexto: Awaited<ReturnType<typeof resolverContextoPreview>>, incluirPrefijosDocente: boolean) {
  const tipoExamen = contexto.periodo?.activo === false && contexto.plantilla.archivadoEn
    ? 'extraordinario'
    : contexto.plantilla.tipo as 'parcial' | 'global';
  return generarPdfExamen({
    titulo: resolverTituloExamen(tipoExamen, String(contexto.plantilla.titulo ?? '')),
    folio: 'PREVIEW',
    examId: `PREVIEW-${String(contexto.plantilla._id ?? contexto.plantilla.id ?? '').slice(0, 24)}`,
    preguntas: contexto.preguntasCandidatas,
    mapaVariante: contexto.mapaVarianteDet as unknown as ReturnType<typeof generarVariante>,
    tipoExamen,
    totalPaginas: contexto.numeroPaginas,
    margenMm: contexto.plantilla.configuracionPdf?.margenMm ?? 8,
    templateVersion: contexto.templateVersionOmr,
    omrTemplateId: contexto.omrTemplateId,
    bookletConfig: contexto.bookletConfig,
    encabezado: construirEncabezadoPdf({
      periodo: contexto.periodo,
      docenteDb: contexto.docenteDb,
      instrucciones: resolverInstruccionesExamen(tipoExamen, (contexto.plantilla as { instrucciones?: unknown }).instrucciones),
      incluirPrefijosDocente
    })
  });
}

async function prepararPreviewMaximo(docenteId: unknown, plantillaId: string, incluirPrefijosDocente: boolean) {
  let contexto = await resolverContextoPreview(docenteId, plantillaId);
  const preguntasCompletas = contexto.preguntasDb.length;
  const idsGlobales = new Set(contexto.preguntasGlobalesIds);
  const preguntasAdicionales = contexto.preguntasBase
    .filter((pregunta) => !idsGlobales.has(String(pregunta.id)))
    .sort((a, b) => puntajeDensidadPregunta(a) - puntajeDensidadPregunta(b) || a.id.localeCompare(b.id));
  let resultado = await generarPdfPreviewContexto(contexto, incluirPrefijosDocente);

  while ((resultado.preguntasRestantes ?? 0) > 0 && preguntasAdicionales.length > 0) {
    preguntasAdicionales.pop();
    const idsSeleccionados = new Set([
      ...contexto.preguntasGlobalesIds,
      ...preguntasAdicionales.map((pregunta) => String(pregunta.id))
    ]);
    const preguntasDb = contexto.preguntasDb.filter((pregunta) => idsSeleccionados.has(String(pregunta.id)));
    const preguntasBase = mapearPreguntasBase(preguntasDb);
    const preguntasCandidatas = ordenarPreguntasDeterminista(preguntasBase, hash32(String(contexto.plantilla._id)));
    contexto = {
      ...contexto,
      preguntasDb,
      preguntasBase,
      preguntasCandidatas,
      mapaVarianteDet: generarVarianteDeterminista(preguntasCandidatas, `plantilla:${contexto.plantilla._id}`)
    };
    resultado = await generarPdfPreviewContexto(contexto, incluirPrefijosDocente);
  }

  return {
    contexto,
    previewResultado: resultado,
    totalPreguntasCandidatas: preguntasCompletas,
    totalPreguntasFuente: contexto.totalPreguntasFuente,
    reactivosOmitidosOmr: contexto.reactivosOmitidosOmr
  };
}

export async function previsualizarPlantillaUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
}) {
  const { contexto, previewResultado, totalPreguntasCandidatas, totalPreguntasFuente, reactivosOmitidosOmr } =
    await prepararPreviewMaximo(params.docenteId, params.plantillaId, true);
  const temasNormalizados = contexto.temas.map((tema) => normalizarNombreTemaPreview(tema)).filter(Boolean);
  const conteoPorTema: Array<{ tema: string; disponibles: number }> = [];
  const temasDisponiblesEnMateria: Array<{ tema: string; disponibles: number }> = [];

  if (contexto.temas.length > 0) {
    const mapaConteo = new Map<string, number>();
    for (const pregunta of contexto.preguntasDb) {
      const clave = claveTemaPreview((pregunta as { tema?: unknown }).tema);
      if (!clave) continue;
      mapaConteo.set(clave, (mapaConteo.get(clave) ?? 0) + 1);
    }
    for (const tema of temasNormalizados) {
      conteoPorTema.push({ tema, disponibles: mapaConteo.get(claveTemaPreview(tema)) ?? 0 });
    }

    if (contexto.plantilla.periodoId) {
      const filas = await obtenerConteoTemasMateria({
        docenteId: params.docenteId,
        periodoId: contexto.plantilla.periodoId
      });
      for (const fila of filas) {
        const tema = normalizarNombreTemaPreview(fila._id);
        temasDisponiblesEnMateria.push({ tema: tema || 'Sin tema', disponibles: Number(fila.disponibles ?? 0) });
      }
    }
  }

  if (previewResultado.preguntasRestantes === 0 && previewResultado.paginas.length <= contexto.numeroPaginas) {
    await guardarLayoutValidadoPlantilla({
      plantillaId: String(contexto.plantilla._id),
      docenteId: String(params.docenteId),
      periodoId: contexto.plantilla.periodoId ? String(contexto.plantilla.periodoId) : undefined,
      mantenerFuenteInmutable: Boolean(contexto.plantilla.archivadoEn) && contexto.periodo?.activo === false,
      bookletConfig: contexto.plantilla.bookletConfig,
      fontScale: previewResultado.fontScaleAplicada,
      lineSpacing: previewResultado.lineSpacingAplicado,
      preguntasFingerprint: construirFingerprintPreguntasPreview(contexto.preguntasDb),
      layoutFingerprint: contexto.layoutFingerprint,
      numeroPaginas: contexto.numeroPaginas,
      totalPreguntas: contexto.preguntasBase.length,
      temas: contexto.temasPlantilla,
      blueprint: await construirBlueprintPlantilla(contexto.preguntasDb, { legacyOnly: contexto.periodo?.activo === false }),
      fuentesExtraordinarioIds: contexto.fuentesExtraordinarioIds,
      totalPreguntasCandidatas
    });
  }

  const { paginas, metricasPaginas, mapaOmr, preguntasRestantes } = previewResultado;
  const porId = new Map<string, (typeof contexto.preguntasCandidatas)[number]>();
  for (const pregunta of contexto.preguntasCandidatas) porId.set(pregunta.id, pregunta);
  const ordenadas = (contexto.mapaVarianteDet.ordenPreguntas || [])
    .map((id) => porId.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const totalDisponibles = totalPreguntasFuente;
  const totalUsados = extraerPreguntasUsadasMapaOmr(mapaOmr as never).size;
  const metricasPaginasSeguras = Array.isArray(metricasPaginas) ? metricasPaginas : [];
  const ultima = metricasPaginasSeguras[metricasPaginasSeguras.length - 1];
  const fraccionVaciaUltimaPagina = Number(ultima?.fraccionVacia ?? 0);
  const umbralVacioResidual = 0.05;
  const consumioTodas = totalUsados >= totalPreguntasCandidatas;
  const advertencias: string[] = [];

  if (consumioTodas && fraccionVaciaUltimaPagina > umbralVacioResidual) {
    advertencias.push(
      `No hay suficientes preguntas para llenar ${contexto.numeroPaginas} pagina(s). La ultima pagina queda ${(
        fraccionVaciaUltimaPagina * 100
      ).toFixed(0)}% vacia.`
    );
  }
  if (paginas.length !== contexto.numeroPaginas) {
    if (paginas.length > contexto.numeroPaginas) {
      advertencias.push(`El contenido requiere ${paginas.length} pagina(s); la configuración indica ${contexto.numeroPaginas}.`);
    } else {
      advertencias.push(`Se generaron ${paginas.length} de ${contexto.numeroPaginas} pagina(s) por falta de preguntas.`);
    }
  }
  if ((preguntasRestantes ?? 0) > 0) {
    advertencias.push(
      `Hay ${preguntasRestantes} pregunta(s) que no caben en ${contexto.numeroPaginas} pagina(s). Aumenta el numero de paginas.`
    );
  }

  return {
    plantillaId: String(contexto.plantilla._id),
    fuentesExtraordinario: contexto.fuentesExtraordinario,
    preguntasOmitidasPorFormato: Math.max(0, totalPreguntasCandidatas - contexto.preguntasDb.length),
    preguntasOmitidasPorOmr: reactivosOmitidosOmr,
    totalPreguntasOmitidasPorOmr: reactivosOmitidosOmr.length,
    layoutConfirmado: previewResultado.preguntasRestantes === 0 && previewResultado.paginas.length <= contexto.numeroPaginas,
    numeroPaginas: contexto.numeroPaginas,
    numeroPaginasConfiguradas: contexto.numeroPaginas,
    totalDisponibles,
    totalUsados,
    fraccionVaciaUltimaPagina,
    advertencias,
    conteoPorTema,
    temasDisponiblesEnMateria,
    paginas: construirPaginasSketch({
      paginas: (Array.isArray(paginas) ? paginas : []) as Array<{ numero: number; preguntasDel?: number; preguntasAl?: number }>,
      preguntasOrdenadas: ordenadas
    })
  };
}

export async function previsualizarPlantillaPdfUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
  forzarRegeneracion?: boolean;
}) {
  const { contexto, previewResultado, totalPreguntasCandidatas } = await prepararPreviewMaximo(
    params.docenteId,
    params.plantillaId,
    false
  );
  const esDev = esEntornoDevelopment();

  if (!esDev && !params.forzarRegeneracion) {
    await limpiarPreviewTemporales();
  }

  const previewKey = clavePreviewPlantilla({
    plantillaId: params.plantillaId,
    plantillaUpdatedAt: (contexto.plantilla as { updatedAt?: unknown }).updatedAt,
    numeroPaginas: contexto.numeroPaginas,
    totalPreguntas: contexto.preguntasBase.length,
    temas: contexto.temas,
    preguntasFingerprint: construirFingerprintPreguntasPreview(contexto.preguntasDb),
    layoutFingerprint: contexto.layoutFingerprint
  });
  const dirPreview = obtenerDirectorioPreview();
  const fileName = construirNombrePdfPreviewPlantilla({
    plantillaId: params.plantillaId,
    plantillaTitulo: String((contexto.plantilla as { titulo?: unknown }).titulo ?? ''),
    previewKey
  });
  const archivoPreview = path.join(dirPreview, fileName);

  if (!params.forzarRegeneracion) {
    const memoria = previewsPdfMemoria.get(fileName);
    if (memoria && Date.now() < memoria.expiraEn) {
      return { buffer: Buffer.from(memoria.buffer), fileName: memoria.fileName };
    }
    if (memoria) previewsPdfMemoria.delete(fileName);
  }

  try {
    const stat = await fs.stat(archivoPreview);
    const expiraEn = stat.mtimeMs + PREVIEW_MEMORIA_TTL_MS;
    if (!params.forzarRegeneracion && Date.now() < expiraEn) {
      const buffer = await fs.readFile(archivoPreview);
      guardarPreviewMemoria(previewsPdfMemoria, fileName, {
        buffer,
        fileName,
        expiraEn
      });
      return { buffer, fileName };
    }
  } catch {
    // Se regenera.
  }

  if (previewResultado.preguntasRestantes === 0 && previewResultado.paginas.length <= contexto.numeroPaginas) {
    await guardarLayoutValidadoPlantilla({
      plantillaId: String(contexto.plantilla._id),
      docenteId: String(params.docenteId),
      periodoId: contexto.plantilla.periodoId ? String(contexto.plantilla.periodoId) : undefined,
      mantenerFuenteInmutable: Boolean(contexto.plantilla.archivadoEn) && contexto.periodo?.activo === false,
      bookletConfig: contexto.plantilla.bookletConfig,
      fontScale: previewResultado.fontScaleAplicada,
      lineSpacing: previewResultado.lineSpacingAplicado,
      preguntasFingerprint: construirFingerprintPreguntasPreview(contexto.preguntasDb),
      layoutFingerprint: contexto.layoutFingerprint,
      numeroPaginas: contexto.numeroPaginas,
      totalPreguntas: contexto.preguntasBase.length,
      temas: contexto.temasPlantilla,
      blueprint: await construirBlueprintPlantilla(contexto.preguntasDb, { legacyOnly: contexto.periodo?.activo === false }),
      fuentesExtraordinarioIds: contexto.fuentesExtraordinarioIds,
      totalPreguntasCandidatas
    });
  }

  const buffer = Buffer.from(previewResultado.pdfBytes);
  previewsVisualesMemoria.delete(fileName);
  guardarPreviewMemoria(previewsPdfMemoria, fileName, {
    buffer,
    fileName,
    expiraEn: Date.now() + PREVIEW_MEMORIA_TTL_MS
  });
  if (!params.forzarRegeneracion) {
    try {
      await fs.mkdir(dirPreview, { recursive: true });
      await fs.writeFile(archivoPreview, buffer);
    } catch {
      // Best-effort: si falla caché, se devuelve en memoria.
    }
  }

  return { buffer, fileName };
}

export async function previsualizarPlantillaPdfVisualUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
  forzarRegeneracion?: boolean;
}): Promise<{
  fileName: string;
  pdfBase64: string;
  paginas: PaginaPdfPreviewVisual[];
  paginasTotales: number;
  paginasOmitidas: number;
}> {
  const pdf = await previsualizarPlantillaPdfUseCase(params);
  if (!params.forzarRegeneracion) {
    const memoria = previewsVisualesMemoria.get(pdf.fileName);
    if (memoria && Date.now() < memoria.expiraEn) return memoria.payload;
    if (memoria) previewsVisualesMemoria.delete(pdf.fileName);
  }
  const visual = await rasterizarPdfParaPreview(pdf.buffer);
  const payload = {
    fileName: pdf.fileName,
    pdfBase64: pdf.buffer.toString('base64'),
    ...visual
  };
  guardarPreviewMemoria(previewsVisualesMemoria, pdf.fileName, {
    expiraEn: Date.now() + PREVIEW_MEMORIA_TTL_MS,
    payload
  });
  return payload;
}
