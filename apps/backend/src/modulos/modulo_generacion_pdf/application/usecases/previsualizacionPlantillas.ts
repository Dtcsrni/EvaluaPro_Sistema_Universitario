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
import { generarVariante, type PreguntaBase } from '../../servicioVariantes.js';
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
  resolverPreguntasExtraordinarioArchivado,
  resolverPreguntasPlantilla,
  construirBlueprintPlantilla,
  resolverTemplateVersionOmr
} from '../../shared/controladorGeneracionPdfShared.js';
import { extraerPreguntasUsadasMapaOmr } from '../../domain/templateCanonico.js';
import { rasterizarPdfParaPreview, type PaginaPdfPreviewVisual } from '../../infra/rasterizadorPdfPreview.js';
import type { ResultadoGeneracionPdf } from '../../shared/tiposPdf.js';

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
const previewsExtraordinariosMaximos = new Map<string, { resultado: ResultadoGeneracionPdf; expiraEn: number }>();

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
  persistir?: boolean;
}): Promise<Record<string, unknown> | undefined> {
  const bookletConfig = construirBookletConfigValidado(params);
  if (!bookletConfig) return undefined;
  if (params.persistir !== false) {
    await prisma.examenPlantilla.update({
      where: { id: params.plantillaId },
      data: { bookletConfig: JSON.stringify(bookletConfig) }
    });
  }
  return bookletConfig;
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

function extraerPreguntasHastaPagina(mapaOmr: {
  paginas?: Array<{ numeroPagina?: number; preguntas?: Array<{ idPregunta?: string }> }>;
}, numeroPaginaMaximo: number) {
  const ids = new Set<string>();
  for (const pagina of mapaOmr.paginas ?? []) {
    if (Number(pagina.numeroPagina) > numeroPaginaMaximo) continue;
    for (const pregunta of pagina.preguntas ?? []) {
      const id = String(pregunta.idPregunta ?? '').trim();
      if (id) ids.add(id);
    }
  }
  return ids;
}

export async function generarExtraordinarioMaximo(params: {
  preguntas: PreguntaBase[];
  paginasObjetivo: number;
  renderizar: (preguntas: PreguntaBase[]) => Promise<ResultadoGeneracionPdf>;
}) {
  let mejorResultado: ResultadoGeneracionPdf | undefined;
  let mejorCardinalidad = 0;
  const alturasRenderizadas = new Map<string, number>();

  const registrarAlturas = (resultado: ResultadoGeneracionPdf) => {
    for (const pagina of resultado.mapaOmr.paginas ?? []) {
      for (const pregunta of pagina.layoutDebug?.plannedQuestionHeights ?? []) {
        const altura = Number(pregunta.renderedHeightPt || pregunta.plannedHeightPt);
        if (pregunta.questionId && Number.isFinite(altura) && altura > 0) {
          alturasRenderizadas.set(pregunta.questionId, altura);
        }
      }
    }
  };

  const evaluarOrden = async (preguntasOrdenadas: PreguntaBase[]) => {
    let minimo = 1;
    let maximo = preguntasOrdenadas.length - 1;
    while (minimo <= maximo) {
      const cantidad = Math.floor((minimo + maximo) / 2);
      let resultado: ResultadoGeneracionPdf;
      try {
        resultado = await params.renderizar(preguntasOrdenadas.slice(0, cantidad));
      } catch (error) {
        if (error instanceof Error && /^Layout invalido:/u.test(error.message)) {
          maximo = cantidad - 1;
          continue;
        }
        throw error;
      }
      registrarAlturas(resultado);
      const idsUsados = extraerPreguntasHastaPagina(resultado.mapaOmr, params.paginasObjetivo);
      const cabeEnObjetivo = resultado.preguntasRestantes === 0 &&
        resultado.paginas.length <= params.paginasObjetivo &&
        idsUsados.size === cantidad;
      if (cabeEnObjetivo) {
        if (cantidad > mejorCardinalidad) {
          mejorResultado = resultado;
          mejorCardinalidad = cantidad;
        }
        minimo = cantidad + 1;
      } else {
        maximo = cantidad - 1;
      }
    }
  };

  try {
    const resultadoCompleto = await params.renderizar(params.preguntas);
    registrarAlturas(resultadoCompleto);
    const idsUsados = extraerPreguntasHastaPagina(resultadoCompleto.mapaOmr, params.paginasObjetivo);
    if (resultadoCompleto.preguntasRestantes === 0 &&
      resultadoCompleto.paginas.length === params.paginasObjetivo &&
      idsUsados.size === params.preguntas.length) {
      return resultadoCompleto;
    }
  } catch (error) {
    if (!(error instanceof Error) || !/^Layout invalido:/u.test(error.message)) throw error;
  }

  // Conserva el orden de variante como primer desempate y prueba además un
  // orden compacto medido por el renderer; la altura textual es el fallback
  // para preguntas que no llegaron a renderizarse en la pasada completa.
  const preguntasCompactas = params.preguntas
    .map((pregunta, indice) => {
      const textoEstimado = pregunta.enunciado.length +
        pregunta.opciones.reduce((total, opcion) => total + opcion.texto.length, 0) +
        (pregunta.imagenUrl ? 500 : 0);
      return {
        pregunta,
        indice,
        altura: alturasRenderizadas.get(pregunta.id) ?? Math.max(1, textoEstimado)
      };
    })
    .sort((a, b) => a.altura - b.altura || a.indice - b.indice)
    .map(({ pregunta }) => pregunta);

  await evaluarOrden(params.preguntas);
  await evaluarOrden(preguntasCompactas);

  if (!mejorResultado || mejorResultado.paginas.length !== params.paginasObjetivo) {
    throw new ErrorAplicacion(
      'LAYOUT_EXTRAORDINARIO_NO_VALIDABLE',
      `No se pudo ajustar el extraordinario a ${params.paginasObjetivo} páginas con reactivos legibles. Revisa el banco o aumenta la preferencia de páginas.`,
      409
    );
  }
  return mejorResultado;
}

async function resolverContextoPreview(docenteId: unknown, plantillaId: string) {
  const plantilla = await obtenerPlantillaDocente(docenteId, plantillaId);
  const periodoResuelto = await resolverPeriodoPlantillaActivo(plantilla, { permitirArchivado: true, docenteId });
  const permitirArchivados = Boolean(plantilla.archivadoEn) && periodoResuelto?.activo === false;
  const esExtraordinarioArchivado = permitirArchivados;
  if (periodoResuelto?.activo === false && !permitirArchivados) {
    throw new ErrorAplicacion('PERIODO_INACTIVO', 'La materia esta archivada', 409);
  }
  const preguntasResueltas = esExtraordinarioArchivado
    ? await resolverPreguntasExtraordinarioArchivado({
      docenteId,
      materiaNombre: periodoResuelto?.nombre,
      plantilla: plantilla as {
        id: string;
        periodoId?: unknown;
        tipo?: unknown;
        titulo?: unknown;
        preguntasIds?: unknown[];
        temas?: unknown[];
        reactivosObjetivo?: unknown;
      }
    })
    : await resolverPreguntasPlantilla({
      docenteId,
      plantilla: plantilla as { id: string; periodoId?: unknown; preguntasIds?: unknown[]; temas?: unknown[] },
      ordenarPorRecencia: true,
      permitirArchivados
    });
  const filtradas = esExtraordinarioArchivado
    ? { preguntasDb: preguntasResueltas.preguntasDb, idsExcluidos: new Set<string>() }
    : excluirReferenciasTecnologiaRetirada(periodoResuelto?.nombre, preguntasResueltas.preguntasDb);
  const preguntasDb = filtradas.preguntasDb;
  const temas = preguntasResueltas.temas;

  if (preguntasDb.length === 0) {
    throw new ErrorAplicacion('SIN_PREGUNTAS', 'La plantilla no tiene preguntas disponibles para previsualizar', 400);
  }

  // El extraordinario archivado usa su preferencia global de páginas, sin
  // modificar la plantilla global que sirve como fuente.
  const docenteDb = await resolverDocentePdf(docenteId);
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
    temas
  });
  const bookletConfig = {
    ...(plantilla.bookletConfig ?? {}),
    targetPages: numeroPaginas,
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
    preguntasDb,
    preguntasBase,
    preguntasCandidatas,
    mapaVarianteDet,
    numeroPaginas,
    periodo: periodoResuelto,
    esExtraordinarioArchivado,
    docenteDb,
    temas,
    fuentesExtraordinario: 'fuentesExtraordinario' in preguntasResueltas ? preguntasResueltas.fuentesExtraordinario : [],
    reactivosOmitidosPorOmr: 'reactivosOmitidosPorOmr' in preguntasResueltas ? preguntasResueltas.reactivosOmitidosPorOmr : [],
    totalPreguntasFuente: 'totalPreguntasFuente' in preguntasResueltas ? preguntasResueltas.totalPreguntasFuente : preguntasDb.length,
    totalPreguntasOmitidasTecnologiaRetirada: 'totalPreguntasOmitidasTecnologiaRetirada' in preguntasResueltas
      ? preguntasResueltas.totalPreguntasOmitidasTecnologiaRetirada
      : filtradas.idsExcluidos.size,
    templateVersionOmr,
    omrTemplateId,
    layoutFingerprint,
    bookletConfig
  };
}

function clavePreviewContexto(contexto: Awaited<ReturnType<typeof resolverContextoPreview>>) {
  const encabezado = construirEncabezadoPdf({
    periodo: contexto.periodo,
    docenteDb: contexto.docenteDb,
    instrucciones: contexto.esExtraordinarioArchivado
      ? INSTRUCCIONES_OMR_EXTRAORDINARIO
      : (contexto.plantilla as { instrucciones?: unknown }).instrucciones,
    incluirPrefijosDocente: true
  });
  return clavePreviewPlantilla({
    plantillaId: String(contexto.plantilla._id ?? contexto.plantilla.id),
    plantillaUpdatedAt: (contexto.plantilla as { updatedAt?: unknown }).updatedAt,
    numeroPaginas: contexto.numeroPaginas,
    totalPreguntas: contexto.preguntasBase.length,
    temas: contexto.temas,
    preguntasFingerprint: construirFingerprintPreguntasPreview(contexto.preguntasDb),
    layoutFingerprint: `${contexto.layoutFingerprint}|encabezado-${hash32(JSON.stringify(encabezado))}`
  });
}

function obtenerPreviewExtraordinarioMaximo(clave: string) {
  const preview = previewsExtraordinariosMaximos.get(clave);
  if (!preview) return undefined;
  if (Date.now() >= preview.expiraEn) {
    previewsExtraordinariosMaximos.delete(clave);
    return undefined;
  }
  return preview.resultado;
}

function guardarPreviewExtraordinarioMaximo(clave: string, resultado: ResultadoGeneracionPdf) {
  guardarPreviewMemoria(previewsExtraordinariosMaximos, clave, {
    resultado,
    expiraEn: Date.now() + PREVIEW_MEMORIA_TTL_MS
  });
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

  const renderizar = (preguntas: PreguntaBase[]) => generarPdfExamen({
    titulo: contexto.esExtraordinarioArchivado ? 'Examen Extraordinario' : String(contexto.plantilla.titulo ?? ''),
    folio: 'PREVIEW',
    examId: `PREVIEW-${String(contexto.plantilla._id ?? contexto.plantilla.id ?? '').slice(0, 24)}`,
    preguntas,
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
  const previewResultado = contexto.esExtraordinarioArchivado
    ? await generarExtraordinarioMaximo({
      preguntas: contexto.preguntasCandidatas,
      paginasObjetivo: contexto.numeroPaginas,
      renderizar
    })
    : await renderizar(contexto.preguntasCandidatas);
  if (contexto.esExtraordinarioArchivado) {
    guardarPreviewExtraordinarioMaximo(clavePreviewContexto(contexto), previewResultado);
  }

  if (!contexto.esExtraordinarioArchivado && previewResultado.preguntasRestantes === 0 && previewResultado.paginas.length <= contexto.numeroPaginas) {
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
  }

  const { paginas, metricasPaginas, mapaOmr, preguntasRestantes } = previewResultado;
  const porId = new Map<string, (typeof contexto.preguntasCandidatas)[number]>();
  for (const pregunta of contexto.preguntasCandidatas) porId.set(pregunta.id, pregunta);
  let ordenadas = (contexto.mapaVarianteDet.ordenPreguntas || [])
    .map((id) => porId.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const totalDisponibles = contexto.preguntasDb.length;
  const paginasParaPreview = contexto.esExtraordinarioArchivado ? paginas.slice(0, contexto.numeroPaginas) : paginas;
  const preguntasUsadasIds = contexto.esExtraordinarioArchivado
    ? extraerPreguntasHastaPagina(mapaOmr, contexto.numeroPaginas)
    : extraerPreguntasUsadasMapaOmr(mapaOmr as never);
  if (contexto.esExtraordinarioArchivado) {
    ordenadas = ordenadas.filter((pregunta) => preguntasUsadasIds.has(String(pregunta.id)));
  }
  const totalUsados = preguntasUsadasIds.size;
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
    advertencias.push(contexto.esExtraordinarioArchivado
      ? `Hay ${Math.max(0, totalDisponibles - totalUsados)} pregunta(s) que no caben en las ${contexto.numeroPaginas} páginas configuradas; la vista previa conserva las que sí caben con tipografía legible.`
      : `Hay ${preguntasRestantes} pregunta(s) que no caben en ${contexto.numeroPaginas} pagina(s). Aumenta el numero de paginas.`);
  }

  return {
    plantillaId: String(contexto.plantilla._id),
    layoutConfirmado: contexto.esExtraordinarioArchivado
      ? totalUsados > 0 && paginasParaPreview.length === contexto.numeroPaginas
      : previewResultado.preguntasRestantes === 0 && previewResultado.paginas.length <= contexto.numeroPaginas,
    numeroPaginas: contexto.numeroPaginas,
    numeroPaginasConfiguradas: contexto.numeroPaginas,
    totalDisponibles,
    totalUsados,
    totalPreguntasOmitidasTecnologiaRetirada: contexto.totalPreguntasOmitidasTecnologiaRetirada,
    fuentesExtraordinario: contexto.fuentesExtraordinario,
    totalPreguntasFuente: contexto.totalPreguntasFuente,
    preguntasOmitidasPorFormato: Math.max(0, totalDisponibles - totalUsados),
    preguntasOmitidasPorOmr: contexto.reactivosOmitidosPorOmr,
    fraccionVaciaUltimaPagina,
    advertencias,
    conteoPorTema,
    temasDisponiblesEnMateria,
    paginas: construirPaginasSketch({
      paginas: (Array.isArray(paginasParaPreview) ? paginasParaPreview : []) as Array<{ numero: number; preguntasDel?: number; preguntasAl?: number }>,
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

  const previewKey = clavePreviewContexto(contexto);
  const dirPreview = obtenerDirectorioPreview();
  const fileName = construirNombrePdfPreviewPlantilla({
    plantillaId: params.plantillaId,
    plantillaTitulo: String((contexto.plantilla as { titulo?: unknown }).titulo ?? ''),
    previewKey
  });
  const archivoPreview = path.join(dirPreview, fileName);

  if (!params.forzarRegeneracion && !contexto.esExtraordinarioArchivado) {
    const memoria = previewsPdfMemoria.get(fileName);
    if (memoria && Date.now() < memoria.expiraEn) {
      return { buffer: Buffer.from(memoria.buffer), fileName: memoria.fileName };
    }
    if (memoria) previewsPdfMemoria.delete(fileName);
  }

  try {
    const stat = await fs.stat(archivoPreview);
    const expiraEn = stat.mtimeMs + PREVIEW_MEMORIA_TTL_MS;
    if (!params.forzarRegeneracion && !contexto.esExtraordinarioArchivado && Date.now() < expiraEn) {
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

  const renderizar = (preguntas: PreguntaBase[]) => generarPdfExamen({
    titulo: contexto.esExtraordinarioArchivado ? 'Examen Extraordinario' : String(contexto.plantilla.titulo ?? ''),
    folio: 'PREVIEW',
    examId: `PREVIEW-${String(contexto.plantilla._id ?? contexto.plantilla.id ?? '').slice(0, 24)}`,
    preguntas,
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
  const previewResultado = contexto.esExtraordinarioArchivado
    ? (!params.forzarRegeneracion ? obtenerPreviewExtraordinarioMaximo(previewKey) : undefined) ?? await generarExtraordinarioMaximo({
      preguntas: contexto.preguntasCandidatas,
      paginasObjetivo: contexto.numeroPaginas,
      renderizar
    })
    : await renderizar(contexto.preguntasCandidatas);
  if (contexto.esExtraordinarioArchivado) guardarPreviewExtraordinarioMaximo(previewKey, previewResultado);

  const paginasParaPdf = contexto.esExtraordinarioArchivado
    ? previewResultado.paginas.slice(0, contexto.numeroPaginas)
    : previewResultado.paginas;
  const preguntasUsadasIds = contexto.esExtraordinarioArchivado
    ? extraerPreguntasHastaPagina(previewResultado.mapaOmr, contexto.numeroPaginas)
    : extraerPreguntasUsadasMapaOmr(previewResultado.mapaOmr as never);
  const preguntasSeleccionadas = contexto.preguntasDb.filter((pregunta) => preguntasUsadasIds.has(String(pregunta.id)));
  const vistaPreviaUsable = contexto.esExtraordinarioArchivado
    ? preguntasSeleccionadas.length > 0 && paginasParaPdf.length === contexto.numeroPaginas
    : previewResultado.preguntasRestantes === 0 && previewResultado.paginas.length <= contexto.numeroPaginas;
  if (vistaPreviaUsable) {
    const preguntasBlueprint = contexto.esExtraordinarioArchivado ? preguntasSeleccionadas : contexto.preguntasDb;
    const blueprint = await construirBlueprintPlantilla(preguntasBlueprint, { legacyOnly: contexto.periodo?.activo === false });
    const ordenPreguntasConfirmadas = contexto.mapaVarianteDet.ordenPreguntas.filter((id) => preguntasUsadasIds.has(String(id)));
    const ordenOpcionesConfirmadas = Object.fromEntries(
      Object.entries(contexto.mapaVarianteDet.ordenOpcionesPorPregunta).filter(([id]) => preguntasUsadasIds.has(id))
    );
    const temasBlueprint = contexto.esExtraordinarioArchivado
      ? (await resolverPreguntasPlantilla({
        docenteId: params.docenteId,
        plantilla: {
          ...contexto.plantilla,
          blueprintJson: JSON.stringify(blueprint),
          blueprintStatus: 'ready'
        } as { id: string; periodoId?: unknown; preguntasIds?: unknown[]; temas?: unknown[]; blueprintJson?: unknown; blueprintStatus?: unknown },
        usarBlueprint: true,
        permitirArchivados: true,
        ordenarPorRecencia: true
      })).temas
      : contexto.temas;
    const bookletConfigValidado = await guardarLayoutValidadoPlantilla({
      plantillaId: String(contexto.plantilla._id),
      bookletConfig: contexto.plantilla.bookletConfig,
      fontScale: previewResultado.fontScaleAplicada,
      lineSpacing: previewResultado.lineSpacingAplicado,
      preguntasFingerprint: construirFingerprintPreguntasPreview(preguntasBlueprint),
      layoutFingerprint: contexto.layoutFingerprint,
      numeroPaginas: contexto.numeroPaginas,
      totalPreguntas: preguntasBlueprint.length,
      temas: temasBlueprint,
      blueprint,
      persistir: !contexto.esExtraordinarioArchivado
    });
    if (contexto.esExtraordinarioArchivado && contexto.plantilla.periodoId && bookletConfigValidado) {
      guardarPreviewArchivadoValidado({
        docenteId: String(params.docenteId),
        periodoId: String(contexto.plantilla.periodoId),
        plantillaId: String(contexto.plantilla._id),
        bookletConfig: bookletConfigValidado,
        blueprintJson: JSON.stringify(blueprint),
        mapaVariante: { ordenPreguntas: ordenPreguntasConfirmadas, ordenOpcionesPorPregunta: ordenOpcionesConfirmadas }
      });
    }
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
