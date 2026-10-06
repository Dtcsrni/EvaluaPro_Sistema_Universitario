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
import { guardarPreviewArchivadoValidado } from '../../domain/previewArchivado.js';
import { obtenerPlantillaDocente } from '../../shared/controladorGeneracionPdfShared.js';
import {
  clavePreviewPlantilla,
  claveTemaPreview,
  construirEncabezadoPdf,
  construirFingerprintLayoutPreview,
  construirFingerprintPreguntasPreview,
  construirNombrePdfPreviewPlantilla,
  esEntornoDevelopment,
  excluirReferenciasTecnologiaRetirada,
  generarVarianteDeterminista,
  hash32,
  limpiarPreviewTemporales,
  mapearPreguntasBase,
  normalizarNombreTemaPreview,
  obtenerConteoTemasMateria,
  obtenerDirectorioPreview,
  ordenarPreguntasDeterminista,
  resolverDocentePdf,
  resolverPaginasObjetivoPreferidas,
  resolverPeriodoPlantillaActivo,
  resolverPreguntasPlantilla,
  resolverPreguntasExtraordinarioArchivado,
  construirBlueprintPlantilla,
  resolverTemplateVersionOmr
} from '../../shared/controladorGeneracionPdfShared.js';
import { extraerPreguntasUsadasMapaOmr } from '../../domain/templateCanonico.js';
import { rasterizarPdfParaPreview, type PaginaPdfPreviewVisual } from '../../infra/rasterizadorPdfPreview.js';

const PREVIEW_MEMORIA_TTL_MS = 10 * 60 * 1000;
const MAX_PREVIEWS_MEMORIA = 8;
const INSTRUCCIONES_OMR_EXTRAORDINARIO = 'Lee cada pregunta y marca una sola opción rellenando por completo el círculo correspondiente. Si cambias tu respuesta, borra la marca anterior antes de seleccionar otra.';

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

function construirBookletConfigValidado(params: {
  bookletConfig: unknown;
  fontScale?: number;
  lineSpacing?: number;
  preguntasFingerprint: string;
  layoutFingerprint: string;
  numeroPaginas: number;
  totalPreguntas: number;
  temas: string[];
  blueprint?: unknown;
}) {
  const fontScale = Number(params.fontScale);
  const lineSpacing = Number(params.lineSpacing);
  if (!Number.isFinite(fontScale) || !Number.isFinite(lineSpacing)) return undefined;
  const base = (params.bookletConfig ?? {}) as Record<string, unknown>;
  return {
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
    ...(params.blueprint ? { blueprint: params.blueprint, blueprintStatus: 'ready', blueprintVersion: 2 } : {})
  };
}

async function guardarLayoutValidadoPlantilla(params: {
  plantillaId: string;
  bookletConfig: unknown;
  fontScale?: number;
  lineSpacing?: number;
  preguntasFingerprint: string;
  layoutFingerprint: string;
  numeroPaginas: number;
  totalPreguntas: number;
  temas: string[];
  blueprint?: unknown;
}) {
  const bookletConfig = construirBookletConfigValidado(params);
  if (!bookletConfig) return;
  await prisma.examenPlantilla.update({
    where: { id: params.plantillaId },
    data: { bookletConfig: JSON.stringify(bookletConfig) }
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
  const esExtraordinarioArchivado = Boolean(plantilla.archivadoEn) && periodoResuelto?.activo === false;
  const resultadoPreguntas = esExtraordinarioArchivado
    ? await resolverPreguntasExtraordinarioArchivado({
      docenteId,
      materiaNombre: periodoResuelto?.nombre,
      plantilla: plantilla as { id: string; periodoId?: unknown; tipo?: unknown; titulo?: unknown; preguntasIds?: unknown[]; temas?: unknown[]; reactivosObjetivo?: unknown }
    })
    : await resolverPreguntasPlantilla({
      docenteId,
      plantilla: plantilla as { id: string; periodoId?: unknown; preguntasIds?: unknown[]; temas?: unknown[] },
      ordenarPorRecencia: true,
      permitirArchivados
    });
  const preguntasAntesDeRetirar = resultadoPreguntas.preguntasDb;
  const preguntasFiltradas = excluirReferenciasTecnologiaRetirada(periodoResuelto?.nombre, preguntasAntesDeRetirar);
  const preguntasDb = preguntasFiltradas.preguntasDb;
  const temas = resultadoPreguntas.temas;
  const temasPlantilla = ('temasPlantilla' in resultadoPreguntas ? resultadoPreguntas.temasPlantilla : temas) as string[];
  const fuentesExtraordinario = ('fuentesExtraordinario' in resultadoPreguntas ? resultadoPreguntas.fuentesExtraordinario : []) as string[];
  const reactivosOmitidosPorOmr = ('reactivosOmitidosPorOmr' in resultadoPreguntas
    ? resultadoPreguntas.reactivosOmitidosPorOmr
    : []) as Array<{ id: string; enunciado: string; problemas: string[] }>;
  const totalPreguntasFuenteBase = Number('totalPreguntasFuente' in resultadoPreguntas
    ? resultadoPreguntas.totalPreguntasFuente
    : preguntasAntesDeRetirar.length);
  const totalPreguntasOmitidasTecnologiaRetiradaBase = Number('totalPreguntasOmitidasTecnologiaRetirada' in resultadoPreguntas
    ? resultadoPreguntas.totalPreguntasOmitidasTecnologiaRetirada
    : 0);
  const totalPreguntasFuente = Math.max(0, totalPreguntasFuenteBase - preguntasFiltradas.idsExcluidos.size);
  const totalPreguntasOmitidasTecnologiaRetirada = totalPreguntasOmitidasTecnologiaRetiradaBase + preguntasFiltradas.idsExcluidos.size;

  if (preguntasDb.length === 0) {
    throw new ErrorAplicacion('SIN_PREGUNTAS', 'La plantilla no tiene preguntas disponibles para previsualizar', 400);
  }

  const docenteDb = await resolverDocentePdf(docenteId);
  // La preferencia de extraordinario es independiente de la plantilla global
  // archivada para poder ajustar su extensión sin cambiar el examen fuente.
  const numeroPaginas = esExtraordinarioArchivado
    ? resolverPaginasObjetivoPreferidas(docenteDb, 'extraordinario')
    : resolverNumeroPaginasPlantilla(plantilla as { numeroPaginas?: unknown });
  const preguntasBase = mapearPreguntasBase(preguntasDb);
  const preguntasFingerprint = construirFingerprintPreguntasPreview(preguntasDb);
  const omrTemplateId = resolverOmrTemplateId(plantilla.omrConfig?.examTemplateId);
  const layoutFingerprint = `${construirFingerprintLayoutPreview()}|${omrTemplateId}${esExtraordinarioArchivado ? `|extra-duplex-${numeroPaginas}p-v1` : ''}`;
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
  const templateVersionOmr = resolverTemplateVersionOmr({
    docenteId,
    periodoId: plantilla.periodoId,
    plantillaId: plantilla._id
  });

  return {
    plantilla,
    esExtraordinarioArchivado,
    preguntasDb,
    preguntasBase,
    fuentesExtraordinario,
    reactivosOmitidosPorOmr,
    totalPreguntasFuente,
    totalPreguntasOmitidasTecnologiaRetirada,
    preguntasCandidatas,
    mapaVarianteDet,
    numeroPaginas,
    periodo: periodoResuelto,
    docenteDb,
    temas,
    temasPlantilla,
    templateVersionOmr,
    omrTemplateId,
    layoutFingerprint,
    bookletConfig
  };
}

async function guardarLayoutPreview(params: {
  docenteId: unknown;
  contexto: Awaited<ReturnType<typeof resolverContextoPreview>>;
  previewResultado: Awaited<ReturnType<typeof generarPdfExamen>>;
}) {
  const { contexto, previewResultado } = params;
  const metricas = previewResultado.metricasLayout;
  const paginasValidas = previewResultado.paginas.length === contexto.numeroPaginas;
  const tipografiaLegible = Number(metricas?.fontSizePregunta ?? 0) >= 8;
  if (contexto.esExtraordinarioArchivado) {
    if (!paginasValidas || !tipografiaLegible) return false;
    const usados = extraerPreguntasUsadasMapaOmr(previewResultado.mapaOmr as never);
    const preguntasPorId = new Map(contexto.preguntasDb.map((pregunta) => [String(pregunta.id), pregunta]));
    const preguntasImpresas = contexto.mapaVarianteDet.ordenPreguntas
      .filter((id) => usados.has(id))
      .map((id) => preguntasPorId.get(id))
      .filter((pregunta): pregunta is NonNullable<typeof pregunta> => Boolean(pregunta));
    if (preguntasImpresas.length !== usados.size || preguntasImpresas.length === 0) return false;
    const idsImpresos = new Set(preguntasImpresas.map((pregunta) => String(pregunta.id)));
    const blueprint = await construirBlueprintPlantilla(preguntasImpresas, { legacyOnly: true });
    const bookletConfig = construirBookletConfigValidado({
      bookletConfig: contexto.plantilla.bookletConfig,
      fontScale: previewResultado.fontScaleAplicada,
      lineSpacing: previewResultado.lineSpacingAplicado,
      preguntasFingerprint: construirFingerprintPreguntasPreview(preguntasImpresas),
      layoutFingerprint: contexto.layoutFingerprint,
      numeroPaginas: contexto.numeroPaginas,
      totalPreguntas: preguntasImpresas.length,
      temas: contexto.temasPlantilla
    });
    if (!bookletConfig || !contexto.plantilla.periodoId) return false;
    guardarPreviewArchivadoValidado({
      docenteId: String(params.docenteId),
      periodoId: String(contexto.plantilla.periodoId),
      plantillaId: String(contexto.plantilla._id),
      bookletConfig,
      blueprintJson: JSON.stringify(blueprint),
      mapaVariante: {
        ordenPreguntas: contexto.mapaVarianteDet.ordenPreguntas.filter((id) => idsImpresos.has(id)),
        ordenOpcionesPorPregunta: Object.fromEntries(
          Object.entries(contexto.mapaVarianteDet.ordenOpcionesPorPregunta)
            .filter(([id]) => idsImpresos.has(id))
        )
      }
    });
    return true;
  }
  if (previewResultado.preguntasRestantes !== 0 || previewResultado.paginas.length > contexto.numeroPaginas) return false;
  await guardarLayoutValidadoPlantilla({
    plantillaId: String(contexto.plantilla._id),
    bookletConfig: contexto.plantilla.bookletConfig,
    fontScale: previewResultado.fontScaleAplicada,
    lineSpacing: previewResultado.lineSpacingAplicado,
    preguntasFingerprint: construirFingerprintPreguntasPreview(contexto.preguntasDb),
    layoutFingerprint: contexto.layoutFingerprint,
    numeroPaginas: contexto.numeroPaginas,
    totalPreguntas: contexto.preguntasBase.length,
    temas: contexto.temas,
    blueprint: await construirBlueprintPlantilla(contexto.preguntasDb, { legacyOnly: contexto.periodo?.activo === false })
  });
  return true;
}

export async function previsualizarPlantillaUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
}) {
  const contexto = await resolverContextoPreview(params.docenteId, params.plantillaId);
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

  const previewResultado = await generarPdfExamen({
    titulo: contexto.esExtraordinarioArchivado ? 'Examen Extraordinario' : String(contexto.plantilla.titulo ?? ''),
    folio: 'PREVIEW',
    loteId: 'PREVIEW',
    examId: `PREVIEW-${String(contexto.plantilla._id ?? contexto.plantilla.id ?? '').slice(0, 24)}`,
    preguntas: contexto.preguntasCandidatas,
    mapaVariante: contexto.mapaVarianteDet as unknown as ReturnType<typeof generarVariante>,
    tipoExamen: contexto.periodo?.activo === false && contexto.plantilla.archivadoEn
      ? 'extraordinario'
      : contexto.plantilla.tipo as 'parcial' | 'global',
    totalPaginas: contexto.numeroPaginas,
    margenMm: contexto.plantilla.configuracionPdf?.margenMm ?? 8,
    templateVersion: contexto.templateVersionOmr,
    omrTemplateId: contexto.omrTemplateId,
    bookletConfig: contexto.bookletConfig,
    encabezado: construirEncabezadoPdf({
      periodo: contexto.periodo,
      docenteDb: contexto.docenteDb,
      instrucciones: contexto.esExtraordinarioArchivado
        ? INSTRUCCIONES_OMR_EXTRAORDINARIO
        : (contexto.plantilla as { instrucciones?: unknown }).instrucciones,
      incluirPrefijosDocente: true
    })
  });
  const layoutValidado = await guardarLayoutPreview({ docenteId: params.docenteId, contexto, previewResultado });

  const { paginas, metricasPaginas, mapaOmr, preguntasRestantes } = previewResultado;
  const porId = new Map<string, (typeof contexto.preguntasCandidatas)[number]>();
  for (const pregunta of contexto.preguntasCandidatas) porId.set(pregunta.id, pregunta);
  const ordenadas = (contexto.mapaVarianteDet.ordenPreguntas || [])
    .map((id) => porId.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const totalDisponibles = contexto.totalPreguntasFuente;
  const totalUsados = extraerPreguntasUsadasMapaOmr(mapaOmr as never).size;
  const preguntasOmitidasPorFormato = Math.max(0, contexto.preguntasBase.length - totalUsados);
  const metricasPaginasSeguras = Array.isArray(metricasPaginas) ? metricasPaginas : [];
  const ultima = metricasPaginasSeguras[metricasPaginasSeguras.length - 1];
  const fraccionVaciaUltimaPagina = Number(ultima?.fraccionVacia ?? 0);
  const umbralVacioResidual = 0.05;
  const consumioTodas = totalUsados >= totalDisponibles;
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
      `Hay ${preguntasRestantes} pregunta(s) válida(s) que no caben en ${contexto.numeroPaginas} página(s) con la tipografía legible.`
    );
  }
  if (contexto.reactivosOmitidosPorOmr.length > 0) {
    advertencias.push(`${contexto.reactivosOmitidosPorOmr.length} reactivo(s) parcial(es) se excluyeron por defectos OMR; revisa su detalle antes de confirmar.`);
  }
  if (contexto.totalPreguntasOmitidasTecnologiaRetirada > 0) {
    advertencias.push(`${contexto.totalPreguntasOmitidasTecnologiaRetirada} reactivo(s) con tecnología retirada se excluyeron de esta copia; las fuentes históricas siguen intactas.`);
  }

  return {
    plantillaId: String(contexto.plantilla._id),
    tipoExamen: contexto.esExtraordinarioArchivado ? 'extraordinario' : contexto.plantilla.tipo,
    tituloImpreso: contexto.esExtraordinarioArchivado ? 'Examen Extraordinario' : String(contexto.plantilla.titulo ?? ''),
    fuentesExtraordinario: contexto.fuentesExtraordinario,
    preguntasOmitidasPorFormato,
    preguntasOmitidasPorOmr: contexto.reactivosOmitidosPorOmr,
    totalPreguntasOmitidasPorOmr: contexto.reactivosOmitidosPorOmr.length,
    layoutConfirmado: contexto.esExtraordinarioArchivado
      ? layoutValidado && previewResultado.paginas.length === contexto.numeroPaginas && Number(previewResultado.metricasLayout?.fontSizePregunta ?? 0) >= 8
      : previewResultado.preguntasRestantes === 0 && previewResultado.paginas.length <= contexto.numeroPaginas,
    numeroPaginas: contexto.numeroPaginas,
    numeroPaginasConfiguradas: contexto.numeroPaginas,
    totalDisponibles,
    totalUsados,
    totalPreguntasOmitidasTecnologiaRetirada: contexto.totalPreguntasOmitidasTecnologiaRetirada,
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
  const contexto = await resolverContextoPreview(params.docenteId, params.plantillaId);
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

  const previewResultado = await generarPdfExamen({
    titulo: contexto.esExtraordinarioArchivado ? 'Examen Extraordinario' : String(contexto.plantilla.titulo ?? ''),
    folio: 'PREVIEW',
    loteId: 'PREVIEW',
    examId: `PREVIEW-${String(contexto.plantilla._id ?? contexto.plantilla.id ?? '').slice(0, 24)}`,
    preguntas: contexto.preguntasCandidatas,
    mapaVariante: contexto.mapaVarianteDet as unknown as ReturnType<typeof generarVariante>,
    tipoExamen: contexto.periodo?.activo === false && contexto.plantilla.archivadoEn
      ? 'extraordinario'
      : contexto.plantilla.tipo as 'parcial' | 'global',
    totalPaginas: contexto.numeroPaginas,
    margenMm: contexto.plantilla.configuracionPdf?.margenMm ?? 8,
    templateVersion: contexto.templateVersionOmr,
    omrTemplateId: contexto.omrTemplateId,
    bookletConfig: contexto.bookletConfig,
    encabezado: construirEncabezadoPdf({
      periodo: contexto.periodo,
      docenteDb: contexto.docenteDb,
      instrucciones: contexto.esExtraordinarioArchivado
        ? INSTRUCCIONES_OMR_EXTRAORDINARIO
        : (contexto.plantilla as { instrucciones?: unknown }).instrucciones,
      incluirPrefijosDocente: false
    })
  });

  await guardarLayoutPreview({ docenteId: params.docenteId, contexto, previewResultado });

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
