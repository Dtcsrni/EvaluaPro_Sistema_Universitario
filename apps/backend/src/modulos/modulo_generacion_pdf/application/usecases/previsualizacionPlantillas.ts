/**
 * previsualizacionPlantillas
 *
 * Responsabilidad: generar los payloads de preview JSON/PDF para plantillas
 * sin acoplar la lógica de dominio a Express.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ErrorAplicacion } from '../../../../compartido/errores/errorAplicacion';
import { generarPdfExamen } from '../../servicioGeneracionPdf';
import { generarVariante } from '../../servicioVariantes';
import { resolverNumeroPaginasPlantilla } from '../../domain/resolverNumeroPaginasPlantilla';
import { obtenerPlantillaDocente } from '../../shared/controladorGeneracionPdfShared';
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
  resolverDocentePdf,
  resolverPeriodoPlantillaActivo,
  resolverPreguntasPlantilla,
  resolverTemplateVersionOmr
} from '../../shared/controladorGeneracionPdfShared';
import { extraerPreguntasUsadasMapaOmr } from '../../domain/tv4Compat';

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
  const { preguntasDb, temas } = await resolverPreguntasPlantilla({
    docenteId,
    plantilla: plantilla as { periodoId?: unknown; preguntasIds?: unknown[]; temas?: unknown[] },
    ordenarPorRecencia: true
  });

  if (preguntasDb.length === 0) {
    throw new ErrorAplicacion('SIN_PREGUNTAS', 'La plantilla no tiene preguntas disponibles para previsualizar', 400);
  }

  const numeroPaginas = resolverNumeroPaginasPlantilla(plantilla as { numeroPaginas?: unknown });
  const preguntasBase = mapearPreguntasBase(preguntasDb);
  const seed = hash32(String(plantilla._id));
  const preguntasCandidatas = ordenarPreguntasDeterminista(preguntasBase, seed);
  const mapaVarianteDet = generarVarianteDeterminista(preguntasCandidatas, `plantilla:${plantilla._id}`);
  const [periodo, docenteDb] = await Promise.all([
    resolverPeriodoPlantillaActivo(plantilla as { periodoId?: unknown }),
    resolverDocentePdf(docenteId)
  ]);
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
    periodo,
    docenteDb,
    temas,
    templateVersionOmr
  };
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
    titulo: String(contexto.plantilla.titulo ?? ''),
    folio: 'PREVIEW',
    preguntas: contexto.preguntasCandidatas,
    mapaVariante: contexto.mapaVarianteDet as unknown as ReturnType<typeof generarVariante>,
    tipoExamen: contexto.plantilla.tipo as 'parcial' | 'global',
    totalPaginas: contexto.numeroPaginas,
    margenMm: contexto.plantilla.configuracionPdf?.margenMm ?? 10,
    templateVersion: contexto.templateVersionOmr,
    encabezado: construirEncabezadoPdf({
      periodo: contexto.periodo,
      docenteDb: contexto.docenteDb,
      instrucciones: (contexto.plantilla as { instrucciones?: unknown }).instrucciones,
      incluirPrefijosDocente: true
    })
  });

  const { paginas, metricasPaginas, mapaOmr, preguntasRestantes } = previewResultado;
  const porId = new Map<string, (typeof contexto.preguntasCandidatas)[number]>();
  for (const pregunta of contexto.preguntasCandidatas) porId.set(pregunta.id, pregunta);
  const ordenadas = (contexto.mapaVarianteDet.ordenPreguntas || [])
    .map((id) => porId.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const totalDisponibles = contexto.preguntasDb.length;
  const totalUsados = extraerPreguntasUsadasMapaOmr(mapaOmr as never).size;
  const ultima = (Array.isArray(metricasPaginas) ? metricasPaginas : []).find((item) => item.numero === contexto.numeroPaginas);
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
  if (paginas.length < contexto.numeroPaginas) {
    advertencias.push(`Se generaron ${paginas.length} de ${contexto.numeroPaginas} pagina(s) por falta de preguntas.`);
  }
  if ((preguntasRestantes ?? 0) > 0) {
    advertencias.push(
      `Hay ${preguntasRestantes} pregunta(s) que no caben en ${contexto.numeroPaginas} pagina(s). Aumenta el numero de paginas.`
    );
  }

  return {
    plantillaId: String(contexto.plantilla._id),
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
}) {
  const contexto = await resolverContextoPreview(params.docenteId, params.plantillaId);
  const esDev = esEntornoDevelopment();

  if (!esDev) {
    await limpiarPreviewTemporales();
  }

  const previewKey = clavePreviewPlantilla({
    plantillaId: params.plantillaId,
    plantillaUpdatedAt: (contexto.plantilla as { updatedAt?: unknown }).updatedAt,
    numeroPaginas: contexto.numeroPaginas,
    totalPreguntas: contexto.preguntasBase.length,
    temas: contexto.temas,
    preguntasFingerprint: construirFingerprintPreguntasPreview(contexto.preguntasDb),
    layoutFingerprint: construirFingerprintLayoutPreview()
  });
  const dirPreview = obtenerDirectorioPreview();
  const fileName = construirNombrePdfPreviewPlantilla({
    plantillaId: params.plantillaId,
    plantillaTitulo: String((contexto.plantilla as { titulo?: unknown }).titulo ?? ''),
    previewKey
  });
  const archivoPreview = path.join(dirPreview, fileName);

  if (!esDev) {
    try {
      const stat = await fs.stat(archivoPreview);
      const expiraEn = stat.mtimeMs + 10 * 60 * 1000;
      if (Date.now() < expiraEn) {
        return {
          buffer: await fs.readFile(archivoPreview),
          fileName
        };
      }
    } catch {
      // Se regenera.
    }
  }

  const previewResultado = await generarPdfExamen({
    titulo: String(contexto.plantilla.titulo ?? ''),
    folio: 'PREVIEW',
    preguntas: contexto.preguntasCandidatas,
    mapaVariante: contexto.mapaVarianteDet as unknown as ReturnType<typeof generarVariante>,
    tipoExamen: contexto.plantilla.tipo as 'parcial' | 'global',
    totalPaginas: contexto.numeroPaginas,
    margenMm: contexto.plantilla.configuracionPdf?.margenMm ?? 10,
    templateVersion: contexto.templateVersionOmr,
    encabezado: construirEncabezadoPdf({
      periodo: contexto.periodo,
      docenteDb: contexto.docenteDb,
      instrucciones: (contexto.plantilla as { instrucciones?: unknown }).instrucciones,
      incluirPrefijosDocente: false
    })
  });

  const buffer = Buffer.from(previewResultado.pdfBytes);
  if (!esDev) {
    try {
      await fs.mkdir(dirPreview, { recursive: true });
      await fs.writeFile(archivoPreview, buffer);
    } catch {
      // Best-effort: si falla caché, se devuelve en memoria.
    }
  }

  return { buffer, fileName };
}
