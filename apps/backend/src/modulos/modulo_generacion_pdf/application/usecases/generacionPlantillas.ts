/**
 * generacionPlantillas
 *
 * Responsabilidad: encapsular la generación individual y masiva de exámenes,
 * así como las consultas operativas de lotes, sin acoplar la lógica a HTTP.
 */
import { createHash, randomUUID } from 'crypto';
import fs from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { prisma } from '../../../../infraestructura/baseDatos/sqlite.js';
import { ErrorAplicacion } from '../../../../compartido/errores/errorAplicacion.js';
import { eliminarArchivoExamen, guardarPdfExamen, resolverRutaPdfExamen } from '../../../../infraestructura/archivos/almacenLocal.js';
import { normalizarParaNombreArchivo } from '../../../../compartido/utilidades/texto.js';
import { construirMetadataRetencion } from '../../servicioRetencionExamenes.js';
import { generarPdfExamen } from '../../servicioGeneracionPdf.js';
import { generarVariante } from '../../servicioVariantes.js';
import { construirRecoveryBundle, construirRecoveryManifest, verificarRecoveryManifest } from '../../domain/recoveryManifest.js';
import { resolverNumeroPaginasPlantilla } from '../../domain/resolverNumeroPaginasPlantilla.js';
import { obtenerPreviewArchivadoValidado } from '../../domain/previewArchivado.js';
import { extraerPreguntasUsadasMapaOmr, resolverOmrTemplateId } from '../../domain/templateCanonico.js';
import { validarPdfConsolidadoLote, validarPdfIndividualLote } from '../../domain/validacionLotePdf.js';
import {
  construirEncabezadoPdf,
  construirFirmaVariante,
  construirMapaVarianteUsadaDesdeOmr,
  construirSnapshotVersionesBlueprint,
  construirFingerprintLayoutPreview,
  construirFingerprintPreguntasPreview,
  construirNombrePdfExamen,
  construirNombrePdfLote,
  esEntornoTest,
  excluirReferenciasTecnologiaRetirada,
  mapearPreguntasBase,
  normalizarLoteId,
  obtenerPlantillaDocente,
  ordenarPreguntasAleatorio,
  resolverDocentePdf,
  resolverPaginasObjetivoPreferidas,
  resolverPeriodoPlantillaActivo,
  resolverPreguntasPlantilla,
  resolverTemplateVersionOmr
} from '../../shared/controladorGeneracionPdfShared.js';

const INSTRUCCIONES_OMR_EXTRAORDINARIO = 'Lee cada pregunta y marca una sola opción rellenando por completo el círculo correspondiente. Si cambias tu respuesta, borra la marca anterior antes de seleccionar otra.';

function parsearJsonPersistido<T>(valor: unknown): T | undefined {
  if (typeof valor !== 'string') return valor as T | undefined;
  try {
    return JSON.parse(valor) as T;
  } catch {
    return undefined;
  }
}

async function validarPdfIndividualLoteAplicacion(input: Parameters<typeof validarPdfIndividualLote>[0]) {
  try {
    return await validarPdfIndividualLote(input);
  } catch (error) {
    const validacion = error as Error & { code?: string; detalles?: unknown };
    throw new ErrorAplicacion(
      validacion.code ?? 'LOTE_PDF_INDIVIDUAL_INVALIDO',
      validacion.message || 'El PDF individual del lote no pasó la validación.',
      409,
      validacion.detalles
    );
  }
}

async function validarPdfConsolidadoLoteAplicacion(pdfBytes: Uint8Array, paginasEsperadas: number) {
  try {
    return await validarPdfConsolidadoLote(pdfBytes, paginasEsperadas);
  } catch (error) {
    const validacion = error as Error & { code?: string; detalles?: unknown };
    throw new ErrorAplicacion(
      validacion.code ?? 'LOTE_PDF_CONSOLIDADO_INVALIDO',
      validacion.message || 'El PDF consolidado no pasó la validación.',
      409,
      validacion.detalles
    );
  }
}


type ResultadoGeneracionExamen = Awaited<ReturnType<typeof generarExamenUseCaseInterno>>;
const generacionesIndividualesEnCurso = new Map<string, Promise<ResultadoGeneracionExamen>>();

function recuperarGeneracionIndividual(params: { docenteId: string; plantillaId: string; clientRequestId: string }) {
  return prisma.examenGenerado.findUnique({ where: { id: params.clientRequestId } }).then((raw) => {
    if (!raw) return null;
    if (raw.docenteId !== params.docenteId || raw.plantillaId !== params.plantillaId || raw.origenGeneracion !== 'individual') {
      throw new ErrorAplicacion('IDEMPOTENCY_KEY_CONFLICT', 'clientRequestId ya pertenece a otra generación de examen.', 409);
    }
    const mapaVariante = parsearJsonPersistido<Record<string, unknown>>(raw.mapaVariante);
    const mapaOmr = parsearJsonPersistido(raw.mapaOmr);
    const paginas = parsearJsonPersistido(raw.paginas) ?? [];
    const recoveryManifest = parsearJsonPersistido(raw.recoveryManifest);
    const preguntasIds = Array.isArray((mapaVariante as { ordenPreguntas?: unknown[] } | undefined)?.ordenPreguntas)
      ? (mapaVariante as { ordenPreguntas: string[] }).ordenPreguntas
      : [];
    return {
      examenGenerado: { ...raw, _id: raw.id, mapaVariante, mapaOmr, paginas, recoveryManifest, preguntasIds },
      advertencias: []
    };
  });
}

export async function generarExamenUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
  clientRequestId?: string;
}) {
  const docenteId = String(params.docenteId);
  const clientRequestId = String(params.clientRequestId ?? '').trim();
  if (!clientRequestId) return generarExamenUseCaseInterno(params);

  const clave = `${docenteId}:${clientRequestId}`;
  const existente = await recuperarGeneracionIndividual({ docenteId, plantillaId: params.plantillaId, clientRequestId });
  if (existente) return existente;

  let generacion = generacionesIndividualesEnCurso.get(clave);
  if (!generacion) {
    generacion = generarExamenUseCaseInterno({ ...params, examenGeneradoId: clientRequestId });
    generacionesIndividualesEnCurso.set(clave, generacion);
  }
  try {
    await generacion;
    const recuperada = await recuperarGeneracionIndividual({ docenteId, plantillaId: params.plantillaId, clientRequestId });
    if (recuperada) return recuperada;
    throw new ErrorAplicacion('GENERACION_NO_RECUPERABLE', 'No se encontró el examen generado con la clave solicitada.', 500);
  } catch (error) {
    const existenteTrasConflicto = await recuperarGeneracionIndividual({ docenteId, plantillaId: params.plantillaId, clientRequestId });
    if (existenteTrasConflicto) return existenteTrasConflicto;
    throw error;
  } finally {
    if (generacionesIndividualesEnCurso.get(clave) === generacion) generacionesIndividualesEnCurso.delete(clave);
  }
}

async function generarExamenUseCaseInterno(params: {
  docenteId: unknown;
  plantillaId: string;
  examenGeneradoId?: string;
}) {
  const docId = String(params.docenteId);
  const plantilla = await obtenerPlantillaDocente(docId, params.plantillaId);
  if (plantilla.archivadoEn) {
    throw new ErrorAplicacion('PLANTILLA_ARCHIVADA', 'La plantilla esta archivada', 409);
  }

  const periodo = await resolverPeriodoPlantillaActivo(plantilla as { periodoId?: unknown });
  const docenteDb = await resolverDocentePdf(docId);
  const preguntasResueltas = await resolverPreguntasPlantilla({
    docenteId: docId,
    plantilla: plantilla as any,
    usarBlueprint: true
  });
  let preguntasDb = preguntasResueltas.preguntasDb;
  const { temas } = preguntasResueltas;
  preguntasDb = excluirReferenciasTecnologiaRetirada(periodo?.nombre, preguntasDb).preguntasDb;

  const numeroPaginas = resolverNumeroPaginasPlantilla(plantilla as { numeroPaginas?: unknown });
  const preguntasBase = mapearPreguntasBase(preguntasDb);
  // La tipografía y el interlineado ya no son opciones de la plantilla:
  // todas las generaciones usan el autoajuste dentro de límites legibles.
  // El renderer mantiene la cabecera y la geometría OMR fuera de este ajuste.
  const bookletConfig = {
    ...(plantilla.bookletConfig ?? {}),
    autoFitPages: true,
    autoFitTypography: true,
    fontScale: 1,
    lineSpacing: 1.1
  };
  const preguntasCandidatas = ordenarPreguntasAleatorio(preguntasBase);
  const mapaVariante = generarVariante(preguntasCandidatas);
  const loteId = randomUUID().split('-')[0].toUpperCase();
  const folio = randomUUID().split('-')[0].toUpperCase();
  const examenGeneradoId = params.examenGeneradoId ?? randomUUID();
  const templateVersionOmr = resolverTemplateVersionOmr({
    docenteId: docId,
    periodoId: plantilla.periodoId,
    plantillaId: plantilla.id
  });
  const omrTemplateId = resolverOmrTemplateId(plantilla.omrConfig?.examTemplateId);

  const resultadoPdf = await generarPdfExamen({
    titulo: plantilla.titulo,
    folio,
    loteId,
    examId: examenGeneradoId,
    preguntas: preguntasCandidatas,
    mapaVariante,
    tipoExamen: plantilla.tipo as import('../../shared/tiposPdf.js').TipoExamen,
    totalPaginas: numeroPaginas,
    margenMm: plantilla.configuracionPdf?.margenMm ?? 8,
    templateVersion: templateVersionOmr,
    omrTemplateId,
    bookletConfig,
    encabezado: construirEncabezadoPdf({
      periodo,
      docenteDb,
      instrucciones: plantilla.instrucciones,
      incluirPrefijosDocente: true
    })
  });

  const { pdfBytes, paginas, metricasPaginas, mapaOmr, preguntasRestantes } = resultadoPdf;
  const usadosSet = extraerPreguntasUsadasMapaOmr(mapaOmr as never);
  const mapaVarianteUsada = construirMapaVarianteUsadaDesdeOmr(mapaVariante, mapaOmr);
  const snapshotVersiones = construirSnapshotVersionesBlueprint({
    plantilla,
    preguntaIds: mapaVarianteUsada.ordenPreguntas
  });
  const ultima = (Array.isArray(metricasPaginas) ? metricasPaginas : []).find((item) => item.numero === numeroPaginas);
  const fraccionVaciaUltimaPagina = Number(ultima?.fraccionVacia ?? 0);
  const consumioTodas = usadosSet.size >= preguntasDb.length;
  const advertencias: string[] = [];
  const umbralVacioResidual = 0.05;
  const esTest = esEntornoTest();

  if ((preguntasRestantes ?? 0) > 0) {
    if (!esTest) {
      throw new ErrorAplicacion(
        'PAGINAS_INSUFICIENTES_POR_EXCESO',
        `No caben ${preguntasRestantes} pregunta(s) en ${numeroPaginas} pagina(s). Aumenta el numero de paginas.`,
        409,
        { preguntasRestantes, numeroPaginas }
      );
    }
    advertencias.push(`No caben ${preguntasRestantes} pregunta(s) en ${numeroPaginas} pagina(s). Aumenta el numero de paginas.`);
  }
  if (consumioTodas && fraccionVaciaUltimaPagina > 0.5) {
    if (!esTest) {
      throw new ErrorAplicacion(
        'PAGINAS_INSUFICIENTES',
        `No hay suficientes preguntas para llenar ${numeroPaginas} pagina(s). La ultima pagina queda ${(
          fraccionVaciaUltimaPagina * 100
        ).toFixed(0)}% vacia.`,
        409,
        { fraccionVaciaUltimaPagina, numeroPaginas }
      );
    }
    advertencias.push(
      `No hay suficientes preguntas para llenar ${numeroPaginas} pagina(s). La ultima pagina queda ${(fraccionVaciaUltimaPagina * 100).toFixed(0)}% vacia.`
    );
  }
  if (consumioTodas && fraccionVaciaUltimaPagina > umbralVacioResidual) {
    advertencias.push(`La ultima pagina queda ${(fraccionVaciaUltimaPagina * 100).toFixed(0)}% vacia por falta de preguntas.`);
  }

  const nombreArchivo = construirNombrePdfExamen({
    folio,
    loteId,
    materiaNombre: String((periodo as { nombre?: unknown } | null)?.nombre ?? ''),
    temas,
    plantillaTitulo: String(plantilla.titulo ?? '')
  });
  const rutaPdf = await guardarPdfExamen(nombreArchivo, pdfBytes);
  const recoveryManifest = construirRecoveryManifest({
    examId: examenGeneradoId,
    docenteId: docId,
    periodoId: plantilla.periodoId ? String(plantilla.periodoId) : undefined,
    plantillaId: String(plantilla.id),
    loteId,
    folio,
    templateVersion: templateVersionOmr,
    preguntas: preguntasCandidatas,
    mapaVariante: mapaVarianteUsada,
    mapaOmr,
    paginas,
    pdfBytes,
    layoutVersion: 4
  });

  const raw = await prisma.examenGenerado.create({
    data: {
      id: examenGeneradoId,
      docenteId: docId,
      periodoId: plantilla.periodoId ? String(plantilla.periodoId) : null,
      plantillaId: String(plantilla.id),
      tipoExamen: String(plantilla.tipo),
      loteId,
      origenGeneracion: 'individual',
      folio,
      estado: 'generado',
      mapaVariante: JSON.stringify(mapaVarianteUsada),
      paginas: JSON.stringify(paginas),
      mapaOmr: JSON.stringify(mapaOmr),
      questionMap: JSON.stringify(snapshotVersiones.questionMap),
      versionSet: JSON.stringify(snapshotVersiones.versionSet),
      previewFingerprint: snapshotVersiones.previewFingerprint,
      rutaPdf,
      retentionStatus: 'active',
      recoveryKeyId: recoveryManifest.keyId,
      recoveryManifestHash: recoveryManifest.manifestHash,
      recoveryManifest: JSON.stringify(recoveryManifest)
    }
  }).catch(async (error: unknown) => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      await eliminarArchivoExamen(rutaPdf).catch(() => undefined);
    }
    throw error;
  });

  await prisma.examenRecoveryManifest.create({
    data: {
      docenteId: docId,
      manifestHash: recoveryManifest.manifestHash,
      nombre: `manifest-${folio}`,
      metadata: JSON.stringify(recoveryManifest)
    }
  });

  let preguntasIds: string[] = [];
  const mvUsada = mapaVarianteUsada as any;
  if (mvUsada && mvUsada.versions) {
    const firstVer = Object.values(mvUsada.versions)[0] as { ordenPreguntas?: string[] };
    if (firstVer && Array.isArray(firstVer.ordenPreguntas)) {
      preguntasIds = firstVer.ordenPreguntas;
    }
  } else if (mvUsada && Array.isArray(mvUsada.ordenPreguntas)) {
    preguntasIds = mvUsada.ordenPreguntas;
  }

  // Preserve the legacy API response shape for existing clients.
  const examenGenerado = {
    ...raw,
    _id: raw.id,
    mapaVariante: mapaVarianteUsada,
    paginas,
    mapaOmr,
    recoveryManifest,
    preguntasIds
  };

  return { examenGenerado, advertencias };
}

const lotesEnGeneracion = new Set<string>();

export async function generarExamenesLoteUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
  confirmarMasivo?: boolean;
  loteId?: string;
  tipoExamen?: 'extraordinario';
  alumnoIds?: string[];
}) {
  const docenteId = String(params.docenteId);
  const loteSolicitado = normalizarLoteId(params.loteId);
  const llave = `${docenteId}:${loteSolicitado || randomUUID()}`;
  if (lotesEnGeneracion.has(llave)) {
    throw new ErrorAplicacion('LOTE_EN_PROGRESO', 'Este lote ya se está generando en esta instancia.', 409);
  }
  lotesEnGeneracion.add(llave);
  try {
    return await generarExamenesLoteUseCaseInterno(params);
  } finally {
    lotesEnGeneracion.delete(llave);
  }
}

async function generarExamenesLoteUseCaseInterno(params: {
  docenteId: unknown;
  plantillaId: string;
  confirmarMasivo?: boolean;
  loteId?: string;
  tipoExamen?: 'extraordinario';
  alumnoIds?: string[];
}) {
  const docId = String(params.docenteId);
  const plantilla = await obtenerPlantillaDocente(docId, params.plantillaId);
  if (!plantilla.periodoId) {
    throw new ErrorAplicacion('PLANTILLA_INVALIDA', 'La plantilla requiere materia (periodoId) para generar en lote', 400);
  }
  const tipoExamen = params.tipoExamen ?? String(plantilla.tipo);
  if (!['parcial', 'global', 'extraordinario'].includes(tipoExamen)) {
    throw new ErrorAplicacion('TIPO_EXAMEN_INVALIDO', 'El tipo de examen no está admitido.', 400);
  }
  if (tipoExamen === 'extraordinario' && (!Array.isArray(params.alumnoIds) || params.alumnoIds.length === 0)) {
    throw new ErrorAplicacion('ALUMNOS_REQUERIDOS', 'Selecciona al menos un alumno para generar el extraordinario.', 400);
  }
  if (tipoExamen !== 'extraordinario' && params.alumnoIds) {
    throw new ErrorAplicacion('SELECCION_ALUMNOS_NO_ADMITIDA', 'La selección individual de alumnos solo está disponible para extraordinarios.', 400);
  }
  const esExtraordinarioArchivado = tipoExamen === 'extraordinario' && Boolean(plantilla.archivadoEn);
  if (plantilla.archivadoEn && !esExtraordinarioArchivado) {
    throw new ErrorAplicacion('PLANTILLA_ARCHIVADA', 'Las plantillas archivadas solo admiten extraordinarios del periodo cerrado.', 409);
  }

  const loteIdNormalizado = normalizarLoteId(params.loteId);
  const loteId = loteIdNormalizado || randomUUID().split('-')[0].toUpperCase();
  const artefactoLotePrevio = await prisma.examenLoteArtefactoPdf.findFirst({
    where: { docenteId: docId, loteId },
    select: { archivadoEn: true }
  });
  if (artefactoLotePrevio?.archivadoEn) {
    throw new ErrorAplicacion('LOTE_ARCHIVADO', 'El lote está archivado; restáuralo o genera un lote nuevo.', 409, { loteId });
  }

  const periodo = await resolverPeriodoPlantillaActivo(
    plantilla as { periodoId?: unknown },
    { permitirArchivado: esExtraordinarioArchivado, docenteId: docId }
  );
  if (esExtraordinarioArchivado && periodo?.activo !== false) {
    throw new ErrorAplicacion('PLANTILLA_ARCHIVADA', 'El extraordinario requiere una plantilla de una materia archivada.', 409);
  }
  if (!esExtraordinarioArchivado && periodo?.activo === false) {
    throw new ErrorAplicacion('PERIODO_INACTIVO', 'Una materia archivada solo admite extraordinarios con su plantilla archivada.', 409);
  }
  const previewArchivado = esExtraordinarioArchivado
    ? obtenerPreviewArchivadoValidado({
      docenteId: docId,
      periodoId: String(plantilla.periodoId),
      plantillaId: String(plantilla.id)
    })
    : undefined;
  const docenteDb = await resolverDocentePdf(docId);
  const idsExtraordinario = tipoExamen === 'extraordinario' ? new Set(params.alumnoIds ?? []) : null;
  let alumnos: Array<{ id: string; nombreCompleto?: unknown; nombres?: unknown; apellidos?: unknown; grupo?: unknown }>;
  if (idsExtraordinario) {
    if (idsExtraordinario.size !== (params.alumnoIds ?? []).length) {
      throw new ErrorAplicacion('ALUMNOS_DUPLICADOS', 'La selección contiene alumnos duplicados.', 400);
    }
    const alumnosSeleccionados = await prisma.alumno.findMany({
      where: {
        periodoId: String(plantilla.periodoId),
        id: { in: [...idsExtraordinario] },
        ...(esExtraordinarioArchivado ? {} : { activo: true })
      }
    });
    const alumnosPorId = new Map(alumnosSeleccionados.map((alumno) => [String(alumno.id), alumno]));
    if ([...idsExtraordinario].some((alumnoId) => !alumnosPorId.has(alumnoId))) {
      const estadoRequerido = esExtraordinarioArchivado ? 'pertenecer al periodo de la plantilla' : 'estar activos en la materia de la plantilla';
      throw new ErrorAplicacion('ALUMNOS_NO_VALIDOS', `Todos los alumnos seleccionados deben ${estadoRequerido}.`, 400);
    }
    alumnos = (params.alumnoIds ?? []).map((alumnoId) => alumnosPorId.get(alumnoId)!);
  } else {
    alumnos = await prisma.alumno.findMany({
      where: { periodoId: String(plantilla.periodoId), activo: true }
    });
  }
  const cohorteLoteHash = tipoExamen === 'extraordinario'
    ? createHash('sha256').update([...(params.alumnoIds ?? [])].sort().join('\n')).digest('hex')
    : null;
  const totalAlumnos = Array.isArray(alumnos) ? alumnos.length : 0;
  const esTest = esEntornoTest();

  if (totalAlumnos === 0) {
    throw new ErrorAplicacion('SIN_ALUMNOS', 'No hay alumnos activos en esta materia', 400);
  }
  if (totalAlumnos > 200 && !params.confirmarMasivo) {
    throw new ErrorAplicacion(
      'CONFIRMAR_MASIVO',
      `Vas a generar ${totalAlumnos} examenes. Reintenta con confirmarMasivo=true para continuar.`,
      400
    );
  }

  if (esExtraordinarioArchivado && !previewArchivado) {
    throw new ErrorAplicacion(
      'PLANTILLA_NO_VALIDADA',
      'Previsualiza el extraordinario y confirma el diseño antes de generar. La vista previa vence a los 10 minutos o al reiniciar el proceso.',
      409,
      { plantillaId: plantilla.id }
    );
  }
  const plantillaParaGeneracion = previewArchivado
    ? {
      ...plantilla,
      blueprintJson: previewArchivado.blueprintJson,
      blueprintStatus: 'ready',
      bookletConfig: previewArchivado.bookletConfig
    }
    : plantilla;

  const preguntasResueltas = await resolverPreguntasPlantilla({
    docenteId: docId,
    plantilla: plantillaParaGeneracion as any,
    usarBlueprint: true,
    permitirArchivados: esExtraordinarioArchivado,
    // Debe coincidir con la resolución usada por la previsualización. Cuando
    // reactivosObjetivo limita un banco, el orden de la consulta determina el
    // subconjunto y, por tanto, su fingerprint de layout validado.
    ordenarPorRecencia: true
  });
  let preguntasDb = preguntasResueltas.preguntasDb;
  const { temas } = preguntasResueltas;
  preguntasDb = excluirReferenciasTecnologiaRetirada(periodo?.nombre, preguntasDb).preguntasDb;
  // Mantener la preferencia global del extraordinario independiente del global
  // fuente; la misma configuración ya se validó en la vista previa archivada.
  const numeroPaginas = esExtraordinarioArchivado
    ? resolverPaginasObjetivoPreferidas(docenteDb, 'extraordinario')
    : resolverNumeroPaginasPlantilla(plantilla as { numeroPaginas?: unknown });
  const preguntasBase = mapearPreguntasBase(preguntasDb);
  const bookletConfigPlantilla = (plantillaParaGeneracion.bookletConfig ?? {}) as Record<string, unknown>;
  const omrTemplateId = resolverOmrTemplateId(plantilla.omrConfig?.examTemplateId);
  const layoutFingerprintOmr = `${construirFingerprintLayoutPreview()}|${omrTemplateId}${esExtraordinarioArchivado ? `|extra-duplex-${numeroPaginas}p-v1` : ''}`;
  const layoutValidado = bookletConfigPlantilla.resolvedLayout as {
    version?: number;
    fontScale?: number;
    lineSpacing?: number;
    preguntasFingerprint?: string;
    layoutFingerprint?: string;
    numeroPaginas?: number;
    totalPreguntas?: number;
    temas?: string[];
  } | undefined;
  const fingerprintPreguntasVigente = layoutValidado?.preguntasFingerprint === construirFingerprintPreguntasPreview(preguntasDb);
  // Archivar actualiza updatedAt en los reactivos legacy aunque su contenido no
  // cambie. Para el extraordinario cerrado, resolverPreguntasPlantilla ya
  // verificó el hash de cada versión fijada por el blueprint.
  const blueprintArchivadoVerificado = esExtraordinarioArchivado && Boolean(plantillaParaGeneracion.blueprintJson);
  const layoutVigente = layoutValidado?.version === 1 &&
    (fingerprintPreguntasVigente || blueprintArchivadoVerificado) &&
    layoutValidado.layoutFingerprint === layoutFingerprintOmr &&
    Number(layoutValidado.numeroPaginas) === numeroPaginas &&
    Number(layoutValidado.totalPreguntas) === preguntasBase.length &&
    JSON.stringify(layoutValidado.temas ?? []) === JSON.stringify(temas) &&
    Number.isFinite(Number(layoutValidado.fontScale)) &&
    Number.isFinite(Number(layoutValidado.lineSpacing));
  if (!layoutVigente) {
    throw new ErrorAplicacion(
      'PLANTILLA_NO_VALIDADA',
      'La plantilla no tiene una previsualización PDF válida para el banco actual. Previsualiza el PDF antes de generar el paquete.',
      409,
      { plantillaId: plantilla.id, numeroPaginas, totalPreguntas: preguntasBase.length }
    );
  }
  const bookletConfig = {
    ...bookletConfigPlantilla,
    // En producción masiva se consume la configuración ya validada de la
    // plantilla. No se ejecuta el auto-fit ni se prueban variantes de layout.
    autoFitPages: false,
    autoFitTypography: false,
    fontScale: Number(layoutValidado?.fontScale),
    lineSpacing: Number(layoutValidado?.lineSpacing)
  };
  const templateVersionOmr = resolverTemplateVersionOmr({
    docenteId: docId,
    periodoId: plantilla.periodoId,
    plantillaId: plantilla.id
  });

  // El conjunto de reactivos también forma parte de la plantilla. El lote no
  // hace una previsualización técnica para decidir qué preguntas conservar:
  // imprime exactamente las preguntas resueltas desde ella.
  const preguntasBaseLote = preguntasBase;
  const reactivosTotalesLote = preguntasBaseLote.length;
  if (reactivosTotalesLote === 0) {
    throw new ErrorAplicacion('SIN_PREGUNTAS', 'No se pudo determinar el set de preguntas del lote', 409);
  }

  const alumnosIdsActivos = new Set(alumnos.map((alumno) => String((alumno as { id?: unknown }).id ?? '')));
  const examenesPrevios = await prisma.examenGenerado.findMany({
    where: { docenteId: docId, loteId },
    orderBy: { generadoEn: 'asc' }
  });
  let paginasPorExamenLote: number | null = null;
  const examenPrevioPorAlumno = new Map<string, (typeof examenesPrevios)[number]>();
  const pdfPrevioPorAlumno = new Map<string, Uint8Array>();
  const manifiestoPrevioPorAlumno = new Map<string, ReturnType<typeof construirRecoveryManifest>>();
  const preguntasIdsEsperadas = new Set(preguntasBaseLote.map((pregunta) => String(pregunta.id)));

  for (const examenPrevio of examenesPrevios) {
    const alumnoId = String(examenPrevio.alumnoId ?? '');
    const tipoExamenPrevio = String(examenPrevio.tipoExamen ?? plantilla.tipo);
    if (
      !alumnoId ||
      !alumnosIdsActivos.has(alumnoId) ||
      examenPrevio.plantillaId !== String(plantilla.id) ||
      (idsExtraordinario && !idsExtraordinario.has(alumnoId)) ||
      tipoExamenPrevio !== tipoExamen ||
      (tipoExamen === 'extraordinario' && examenPrevio.cohorteLoteHash !== cohorteLoteHash)
    ) {
      throw new ErrorAplicacion(
        'LOTE_REANUDACION_INCOMPATIBLE',
        'El lote previo no coincide con la plantilla, el tipo o la lista de alumnos; no se mezclaron ni regeneraron sus exámenes.',
        409,
        { loteId, examenId: examenPrevio.id }
      );
    }
    if (!['generado', 'generando', 'fallido'].includes(String(examenPrevio.estado))) {
      throw new ErrorAplicacion('LOTE_REANUDACION_INCOMPATIBLE', 'El estado persistido del lote no permite reanudarlo.', 409, { loteId });
    }
    if (examenPrevioPorAlumno.has(alumnoId)) {
      throw new ErrorAplicacion('LOTE_ALUMNO_DUPLICADO', 'El lote contiene más de un examen para el mismo alumno.', 409, { loteId, alumnoId });
    }

    const mapaVariantePrevio = parsearJsonPersistido<{ ordenPreguntas?: unknown[] }>(examenPrevio.mapaVariante);
    const preguntaIdsPrevias = (mapaVariantePrevio?.ordenPreguntas ?? []).map((id) => String(id));
    if (
      preguntaIdsPrevias.length !== preguntasIdsEsperadas.size ||
      new Set(preguntaIdsPrevias).size !== preguntasIdsEsperadas.size ||
      preguntaIdsPrevias.some((id) => !preguntasIdsEsperadas.has(id))
    ) {
      throw new ErrorAplicacion('LOTE_REANUDACION_BANCO_CAMBIADO', 'El banco del lote cambió desde su generación parcial.', 409, { loteId, alumnoId });
    }
    const snapshotPrevio = construirSnapshotVersionesBlueprint({ plantilla: plantillaParaGeneracion, preguntaIds: preguntaIdsPrevias });
    if (!examenPrevio.previewFingerprint || examenPrevio.previewFingerprint !== snapshotPrevio.previewFingerprint) {
      throw new ErrorAplicacion('LOTE_REANUDACION_PLANTILLA_CAMBIADA', 'La plantilla o sus versiones cambiaron desde la generación parcial.', 409, { loteId, alumnoId });
    }

    const mapaOmrPrevio = parsearJsonPersistido<{ paginas?: import('../../shared/tiposPdf.js').PaginaOmr[] }>(examenPrevio.mapaOmr);
    const manifiestoPrevio = parsearJsonPersistido<Parameters<typeof verificarRecoveryManifest>[0]>(examenPrevio.recoveryManifest);
    if (
      !mapaOmrPrevio?.paginas ||
      !manifiestoPrevio ||
      !verificarRecoveryManifest(manifiestoPrevio) ||
      manifiestoPrevio.folio !== examenPrevio.folio ||
      manifiestoPrevio.loteId !== loteId
    ) {
      throw new ErrorAplicacion('LOTE_REANUDACION_MANIFIESTO_INVALIDO', 'No se pudo verificar la evidencia de recuperación del lote.', 409, { loteId, alumnoId });
    }
    if (!examenPrevio.rutaPdf) {
      throw new ErrorAplicacion('LOTE_REANUDACION_PDF_AUSENTE', 'Falta un PDF individual requerido para reanudar el lote.', 409, { loteId, alumnoId });
    }
    let bytesPrevios: Uint8Array;
    try {
      bytesPrevios = await fs.readFile(examenPrevio.rutaPdf);
    } catch {
      throw new ErrorAplicacion('LOTE_REANUDACION_PDF_AUSENTE', 'No se pudo leer un PDF individual requerido para reanudar el lote.', 409, { loteId, alumnoId });
    }
    const pdfPrevioValidado = await validarPdfIndividualLoteAplicacion({
      pdfBytes: bytesPrevios,
      paginasMaximas: numeroPaginas,
      preguntasEsperadas: reactivosTotalesLote,
      folio: String(examenPrevio.folio),
      mapaOmr: mapaOmrPrevio as never
    });
    if (paginasPorExamenLote !== null && paginasPorExamenLote !== pdfPrevioValidado.paginas) {
      throw new ErrorAplicacion('LOTE_PAGINACION_INCONSISTENTE', 'Los exámenes previos del lote no tienen el mismo número de páginas.', 409, { loteId });
    }
    paginasPorExamenLote = pdfPrevioValidado.paginas;
    examenPrevioPorAlumno.set(alumnoId, examenPrevio);
    pdfPrevioPorAlumno.set(alumnoId, bytesPrevios);
    manifiestoPrevioPorAlumno.set(alumnoId, manifiestoPrevio as ReturnType<typeof construirRecoveryManifest>);
  }

  if (examenesPrevios.length > 0) {
    await prisma.examenGenerado.updateMany({
      where: { docenteId: docId, loteId },
      data: { estado: 'generando' }
    });
  }

  const firmasVariantesLote = new Set<string>();
  for (const examenPrevio of examenesPrevios) {
    const mapaVariantePrevio = parsearJsonPersistido<Parameters<typeof construirFirmaVariante>[0]>(examenPrevio.mapaVariante);
    if (mapaVariantePrevio) firmasVariantesLote.add(construirFirmaVariante(mapaVariantePrevio));
  }
  const maxIntentosVarianteUnica = Math.min(36, Math.max(10, totalAlumnos * 2));

  const crearExamenSinAlumno = async (alumno: { id: string; nombreCompleto?: unknown; nombres?: unknown; apellidos?: unknown; grupo?: unknown }) => {
    for (let intento = 0; intento < maxIntentosVarianteUnica; intento += 1) {
      const preguntasCandidatas = esExtraordinarioArchivado
        ? preguntasBaseLote
        : ordenarPreguntasAleatorio(preguntasBaseLote);
      const mapaVariante = esExtraordinarioArchivado && previewArchivado
        ? previewArchivado.mapaVariante
        : generarVariante(preguntasCandidatas);
      const esUltimoIntentoVariante = intento + 1 >= maxIntentosVarianteUnica;
      const folio = randomUUID().split('-')[0].toUpperCase();
      try {
        const examenGeneradoId = randomUUID();
        const { pdfBytes, paginas, metricasPaginas, mapaOmr, preguntasRestantes } = await generarPdfExamen({
          titulo: esExtraordinarioArchivado ? 'Examen Extraordinario' : plantilla.titulo,
          folio,
          loteId,
          examId: examenGeneradoId,
          preguntas: preguntasCandidatas,
          mapaVariante,
          tipoExamen: tipoExamen as import('../../shared/tiposPdf.js').TipoExamen,
          totalPaginas: numeroPaginas,
          margenMm: plantilla.configuracionPdf?.margenMm ?? 8,
          templateVersion: templateVersionOmr,
          omrTemplateId,
          bookletConfig: { ...bookletConfig, distribuirEnPaginasObjetivo: esExtraordinarioArchivado },
          encabezado: construirEncabezadoPdf({
            periodo,
            docenteDb,
            instrucciones: esExtraordinarioArchivado ? INSTRUCCIONES_OMR_EXTRAORDINARIO : plantilla.instrucciones,
            incluirPrefijosDocente: true,
            alumno
          })
        });

        const usadosSet = extraerPreguntasUsadasMapaOmr(mapaOmr as never);
        const mapaVarianteUsada = construirMapaVarianteUsadaDesdeOmr(mapaVariante, mapaOmr);
        const snapshotVersiones = construirSnapshotVersionesBlueprint({
          plantilla: plantillaParaGeneracion,
          preguntaIds: mapaVarianteUsada.ordenPreguntas
        });
        const reactivosUsados = Array.isArray(mapaVarianteUsada.ordenPreguntas) ? mapaVarianteUsada.ordenPreguntas.length : 0;
        if ((preguntasRestantes ?? 0) > 0 || reactivosUsados !== reactivosTotalesLote) {
          throw new ErrorAplicacion(
            'LOTE_VARIANTE_INCONSISTENTE',
            `No se pudo mantener un lote consistente de ${reactivosTotalesLote} reactivos en ${numeroPaginas} pagina(s).`,
            409,
            { preguntasRestantes, reactivosUsados, reactivosTotalesLote, numeroPaginas }
          );
        }

        const resumenIndividual = await validarPdfIndividualLoteAplicacion({
          pdfBytes,
          paginasMaximas: numeroPaginas,
          preguntasEsperadas: reactivosTotalesLote,
          folio,
          mapaOmr
        });

        if (paginasPorExamenLote !== null && paginasPorExamenLote !== resumenIndividual.paginas) {
          if (!esUltimoIntentoVariante) continue;
          throw new ErrorAplicacion('LOTE_PAGINACION_INCONSISTENTE', 'No se pudo generar el mismo número de páginas para cada examen del lote.', 409, {
            loteId,
            paginasPrevias: paginasPorExamenLote,
            paginasGeneradas: resumenIndividual.paginas
          });
        }

        const firmaVariante = construirFirmaVariante(mapaVarianteUsada);
        const ultima = (Array.isArray(metricasPaginas) ? metricasPaginas : []).find((item) => item.numero === numeroPaginas);
        const fraccionVaciaUltimaPagina = Number(ultima?.fraccionVacia ?? 0);
        const consumioTodas = usadosSet.size >= reactivosTotalesLote;
        if (!esTest && consumioTodas && fraccionVaciaUltimaPagina > 0.5) {
          throw new ErrorAplicacion(
            'PAGINAS_INSUFICIENTES',
            `No hay suficientes preguntas para llenar ${numeroPaginas} pagina(s). La ultima pagina queda ${(fraccionVaciaUltimaPagina * 100).toFixed(0)}% vacia.`,
            409,
            { fraccionVaciaUltimaPagina, numeroPaginas }
          );
        }
        if (firmasVariantesLote.has(firmaVariante) && !esUltimoIntentoVariante) continue;

        const nombreArchivo = construirNombrePdfExamen({
          folio,
          loteId,
          materiaNombre: String((periodo as { nombre?: unknown } | null)?.nombre ?? ''),
          temas,
          plantillaTitulo: String(plantilla.titulo ?? '')
        });
        const recoveryManifest = construirRecoveryManifest({
          examId: examenGeneradoId,
          docenteId: docId,
          periodoId: plantilla.periodoId ? String(plantilla.periodoId) : undefined,
          plantillaId: String(plantilla.id),
          loteId,
          folio,
          templateVersion: templateVersionOmr,
          preguntas: preguntasCandidatas,
          mapaVariante: mapaVarianteUsada,
          mapaOmr,
          paginas,
          pdfBytes,
          layoutVersion: 4
        });
        const rutaPdf = await guardarPdfExamen(nombreArchivo, pdfBytes);
        let raw: Awaited<ReturnType<typeof prisma.examenGenerado.create>>;
        try {
          raw = await prisma.$transaction(async (tx) => {
            const examen = await tx.examenGenerado.create({
              data: {
                id: examenGeneradoId,
                docenteId: docId,
                periodoId: plantilla.periodoId ? String(plantilla.periodoId) : null,
                plantillaId: String(plantilla.id),
                tipoExamen,
                cohorteLoteHash,
                alumnoId: String(alumno.id),
                loteId,
                origenGeneracion: 'lote',
                folio,
                estado: 'generando',
                mapaVariante: JSON.stringify(mapaVarianteUsada),
                paginas: JSON.stringify(paginas),
                mapaOmr: JSON.stringify(mapaOmr),
                questionMap: JSON.stringify(snapshotVersiones.questionMap),
                versionSet: JSON.stringify(snapshotVersiones.versionSet),
                previewFingerprint: snapshotVersiones.previewFingerprint,
                rutaPdf,
                retentionStatus: 'active',
                recoveryKeyId: recoveryManifest.keyId,
                recoveryManifestHash: recoveryManifest.manifestHash,
                recoveryManifest: JSON.stringify(recoveryManifest)
              }
            });
            await tx.examenRecoveryManifest.create({
              data: {
                docenteId: docId,
                manifestHash: recoveryManifest.manifestHash,
                nombre: `manifest-${folio}`,
                metadata: JSON.stringify(recoveryManifest)
              }
            });
            return examen;
          });
        } catch (error) {
          await eliminarArchivoExamen(rutaPdf);
          throw error;
        }

        if (paginasPorExamenLote === null) paginasPorExamenLote = resumenIndividual.paginas;
        firmasVariantesLote.add(firmaVariante);

        return { examenGenerado: raw, pdfBytes, recoveryManifest };
      } catch (error) {
        const msg = String((error as { message?: unknown }).message ?? '');
        if (msg.includes('E11000') && msg.toLowerCase().includes('folio')) {
          continue;
        }
        throw error;
      }
    }
    throw new ErrorAplicacion('FOLIO_COLISION', 'No se pudo generar un folio unico', 500);
  };

  const examenesGenerados: Array<{ _id: string; folio: string; generadoEn: Date }> = [];
  const pdfsLote: Uint8Array[] = [];
  const recoveryManifests: Array<ReturnType<typeof construirRecoveryManifest>> = [];
  try {
    for (let indice = 0; indice < totalAlumnos; indice += 1) {
      const alumno = alumnos[indice] as { id: string; nombreCompleto?: unknown; nombres?: unknown; apellidos?: unknown; grupo?: unknown };
      const alumnoId = String(alumno.id);
      const examenExistente = examenPrevioPorAlumno.get(alumnoId);
      const resultado = examenExistente
        ? {
            examenGenerado: examenExistente,
            pdfBytes: pdfPrevioPorAlumno.get(alumnoId),
            recoveryManifest: manifiestoPrevioPorAlumno.get(alumnoId)
          }
        : await crearExamenSinAlumno(alumno);
      if (!resultado.pdfBytes || !resultado.recoveryManifest) {
        throw new ErrorAplicacion('LOTE_ARTEFACTO_INCOMPLETO', 'Falta un PDF o manifiesto requerido para consolidar el lote.', 409, { loteId, alumnoId });
      }
      examenPrevioPorAlumno.set(alumnoId, resultado.examenGenerado);
      pdfPrevioPorAlumno.set(alumnoId, resultado.pdfBytes);
      manifiestoPrevioPorAlumno.set(alumnoId, resultado.recoveryManifest);
      examenesGenerados.push({
        _id: String(resultado.examenGenerado.id),
        folio: String(resultado.examenGenerado.folio),
        generadoEn: resultado.examenGenerado.generadoEn
      });
      pdfsLote.push(resultado.pdfBytes);
      recoveryManifests.push(resultado.recoveryManifest);
    }
    if (examenPrevioPorAlumno.size !== totalAlumnos) {
      throw new ErrorAplicacion('LOTE_COHORTE_INCOMPLETA', 'El lote no contiene exactamente un examen por alumno activo.', 409, { loteId, totalAlumnos });
    }
    if (paginasPorExamenLote === null || pdfsLote.length !== totalAlumnos) {
      throw new ErrorAplicacion('LOTE_PAGINACION_NO_VERIFICABLE', 'No se pudo establecer una paginación uniforme para cada examen.', 409, { loteId, totalAlumnos });
    }
  } catch (error) {
    await prisma.examenGenerado.updateMany({
      where: { docenteId: docId, loteId, estado: 'generando' },
      data: { estado: 'fallido' }
    }).catch(() => undefined);
    throw error;
  }

  try {
  if (recoveryManifests.length > 0) {
    const recoveryBundle = construirRecoveryBundle({
      loteId,
      docenteId: docId,
      periodoId: plantilla.periodoId ? String(plantilla.periodoId) : undefined,
      plantillaId: String(plantilla.id),
      templateVersion: templateVersionOmr,
      manifests: recoveryManifests
    });
    const bundleExistente = await prisma.examenRecoveryBundle.findUnique({ where: { bundleHash: recoveryBundle.bundleHash } });
    const bundlePersistido = bundleExistente ?? await prisma.examenRecoveryBundle.create({
      data: {
        docenteId: docId,
        bundleHash: recoveryBundle.bundleHash,
        nombre: `bundle-${loteId}`,
        metadata: JSON.stringify(recoveryBundle)
      }
    });
    await prisma.examenGenerado.updateMany({
      where: { docenteId: docId, loteId },
      data: {
        recoveryBundleId: bundlePersistido.id,
        recoveryBundleHash: recoveryBundle.bundleHash
      }
    });
  }

  let lotePdfUrl: string | undefined;
  if (pdfsLote.length > 0) {
    const lotePdf = await PDFDocument.create();
    for (const bytes of pdfsLote) {
      const src = await PDFDocument.load(bytes);
      const pages = await lotePdf.copyPages(src, src.getPageIndices());
      pages.forEach((page) => lotePdf.addPage(page));
    }
    const loteBytes = Buffer.from(await lotePdf.save());
    const paginasTotalesLote = totalAlumnos * paginasPorExamenLote!;
    const resumenPdf = await validarPdfConsolidadoLoteAplicacion(loteBytes, paginasTotalesLote);
    const loteSafe = normalizarParaNombreArchivo(loteId, { maxLen: 16 }) || loteId;
    const nombreArchivo = construirNombrePdfLote({
      loteId: loteSafe,
      materiaNombre: String((periodo as { nombre?: unknown } | null)?.nombre ?? ''),
      plantillaTitulo: String(plantilla.titulo ?? ''),
      totalExamenes: totalAlumnos
    });
    await guardarPdfExamen(nombreArchivo, loteBytes);
    await prisma.$executeRaw`
      INSERT INTO examen_lote_artefactos_pdf
        (id, docenteId, loteId, plantillaId, archivoNombre, sha256, totalPaginas, totalExamenes, createdAt, updatedAt)
      VALUES
        (${randomUUID()}, ${docId}, ${loteId}, ${String(plantilla.id)}, ${nombreArchivo}, ${resumenPdf.sha256}, ${resumenPdf.paginas}, ${totalAlumnos}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(docenteId, loteId) DO UPDATE SET
        plantillaId = excluded.plantillaId,
        archivoNombre = excluded.archivoNombre,
        sha256 = excluded.sha256,
        totalPaginas = excluded.totalPaginas,
        totalExamenes = excluded.totalExamenes,
        updatedAt = CURRENT_TIMESTAMP
    `;
    await prisma.examenGenerado.updateMany({
      where: { docenteId: docId, loteId },
      data: { estado: 'generado' }
    });
    lotePdfUrl = `/examenes/generados/lote/${encodeURIComponent(loteSafe)}/pdf`;
    return {
      loteId,
      totalAlumnos,
      examenesGenerados,
      lotePdfUrl,
      pdfSha256: resumenPdf.sha256,
      totalPaginas: resumenPdf.paginas,
      paginasPorExamen: paginasPorExamenLote
    };
  }

  throw new ErrorAplicacion('LOTE_PDF_VACIO', 'No se generaron PDFs individuales para consolidar.', 409, { loteId });
  } catch (error) {
    await prisma.examenGenerado.updateMany({
      where: { docenteId: docId, loteId, estado: 'generando' },
      data: { estado: 'fallido' }
    }).catch(() => undefined);
    throw error;
  }
}

export async function obtenerProgresoGeneracionLoteUseCase(params: {
  docenteId: unknown;
  loteId: string;
  plantillaId?: string;
}) {
  const docId = String(params.docenteId);
  const lote = normalizarLoteId(params.loteId);
  if (!lote) {
    throw new ErrorAplicacion('LOTE_INVALIDO', 'Lote invalido', 400);
  }

  const artefactoLote = await prisma.examenLoteArtefactoPdf.findFirst({
    where: { docenteId: docId, loteId: lote },
    select: { archivadoEn: true }
  });
  if (artefactoLote?.archivadoEn) {
    return {
      loteId: lote,
      totalEsperado: 0,
      generados: 0,
      fallidos: 0,
      porcentaje: 100,
      completado: true,
      estado: 'archivado' as const,
      archivadoEn: artefactoLote.archivadoEn.toISOString()
    };
  }

  let totalEsperado = 0;
  if (params.plantillaId) {
    const raw = await prisma.examenPlantilla.findFirst({
      where: { id: params.plantillaId, docenteId: docId }
    });
    if (raw && raw.periodoId) {
      totalEsperado = await prisma.alumno.count({
        where: { periodoId: raw.periodoId, activo: true }
      });
    }
  }

  const [generados, listos, fallidos] = await Promise.all([
    prisma.examenGenerado.count({ where: { docenteId: docId, loteId: lote, archivadoEn: null } }),
    prisma.examenGenerado.count({ where: { docenteId: docId, loteId: lote, archivadoEn: null, estado: 'generado' } }),
    prisma.examenGenerado.count({ where: { docenteId: docId, loteId: lote, archivadoEn: null, estado: 'fallido' } })
  ]);
  const porcentajeBase = totalEsperado > 0 ? Math.round((generados / totalEsperado) * 100) : 0;
  const porcentaje = Math.max(0, Math.min(100, porcentajeBase));
  const completado = totalEsperado > 0 && listos >= totalEsperado && generados >= totalEsperado;
  const estado = fallidos > 0 ? 'fallido' : completado ? 'completado' : generados > 0 ? 'generando' : 'iniciando';

  return {
    loteId: lote,
    totalEsperado,
    generados,
    fallidos,
    porcentaje,
    completado,
    estado
  };
}

export async function descargarPdfLoteUseCase(params: {
  docenteId: unknown;
  loteId: string;
}) {
  const docId = String(params.docenteId);
  const lote = normalizarLoteId(params.loteId);
  if (!lote) {
    throw new ErrorAplicacion('LOTE_INVALIDO', 'Lote invalido', 400);
  }

  const artefactoArchivado = await prisma.examenLoteArtefactoPdf.findFirst({
    where: { docenteId: docId, loteId: lote },
    select: { archivadoEn: true }
  });
  if (artefactoArchivado?.archivadoEn) {
    throw new ErrorAplicacion('LOTE_ARCHIVADO', 'El PDF consolidado está archivado; restáuralo antes de descargar.', 410, { loteId: lote });
  }

  const examenesDelLote = await prisma.examenGenerado.findMany({
    where: { docenteId: docId, loteId: lote },
    orderBy: { generadoEn: 'asc' }
  });
  if (examenesDelLote.length === 0) {
    throw new ErrorAplicacion('LOTE_NO_ENCONTRADO', 'No se encontraron exámenes para este lote.', 404, { loteId: lote });
  }
  if (examenesDelLote.some((examen) => examen.estado !== 'generado')) {
    throw new ErrorAplicacion('LOTE_NO_COMPLETO', 'El paquete no está listo: la generación o validación del lote sigue incompleta.', 409, {
      loteId: lote,
      examenesListos: examenesDelLote.filter((examen) => examen.estado === 'generado').length,
      examenesEsperados: examenesDelLote.length
    });
  }

  const examenLote = await prisma.examenGenerado.findFirst({
    where: { docenteId: docId, loteId: lote },
    orderBy: { generadoEn: 'desc' }
  });
  if (examenLote) {
    const retention = construirMetadataRetencion(examenLote);
    if (retention.retentionStatus === 'artifacts_purged') {
      throw new ErrorAplicacion(
        'EXAMEN_ARTIFACTOS_EXPURGADOS',
        'Los artefactos de este lote fueron expurgados por política de retención.',
        410,
        retention
      );
    }
  }

  const plantillaId = examenLote?.plantillaId || undefined;
  const periodoId = examenLote?.periodoId || undefined;

  const [plantilla, periodo, totalExamenes, docenteDb] = await Promise.all([
    plantillaId
      ? prisma.examenPlantilla.findUnique({ where: { id: plantillaId } })
      : Promise.resolve(null),
    periodoId
      ? prisma.periodo.findUnique({ where: { id: periodoId } })
      : Promise.resolve(null),
    prisma.examenGenerado.count({ where: { docenteId: docId, loteId: lote } }),
    resolverDocentePdf(docId)
  ]);

  const artefactos = await prisma.$queryRaw<Array<{ archivoNombre: string; sha256: string; totalPaginas: number; totalExamenes: number }>>`
    SELECT archivoNombre, sha256, totalPaginas, totalExamenes
    FROM examen_lote_artefactos_pdf
    WHERE docenteId = ${docId} AND loteId = ${lote}
    LIMIT 1
  `;
  const artefactoPersistido = artefactos[0];
  const fileNameCalculado = construirNombrePdfLote({
    loteId: lote,
    materiaNombre: String(periodo?.nombre ?? ''),
    plantillaTitulo: String(plantilla?.titulo ?? ''),
    totalExamenes: Number(totalExamenes ?? 0)
  });
  const fileName = artefactoPersistido?.archivoNombre || fileNameCalculado;
  const ruta = resolverRutaPdfExamen(fileName);
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(ruta);
  } catch {
    throw new ErrorAplicacion('PDF_NO_DISPONIBLE', 'PDF de lote no disponible', 404, { docenteId: docId });
  }
  const plantillaArchivada = Boolean((plantilla as { archivadoEn?: unknown } | null)?.archivadoEn);
  const paginasMaximasPorExamen = plantillaArchivada && examenesDelLote.every((examen) => String(examen.tipoExamen ?? '') === 'extraordinario')
    ? resolverPaginasObjetivoPreferidas(docenteDb, 'extraordinario')
    : resolverNumeroPaginasPlantilla(plantilla as { numeroPaginas?: unknown } | null);
  let paginasPorExamen: number;
  if (artefactoPersistido) {
    const paginasValidas = Number(artefactoPersistido.totalPaginas);
    const examenesValidos = Number(artefactoPersistido.totalExamenes);
    if (examenesValidos !== examenesDelLote.length || !Number.isInteger(paginasValidas) || paginasValidas % examenesValidos !== 0) {
      throw new ErrorAplicacion('LOTE_PDF_INTEGRIDAD_INVALIDA', 'El manifiesto del paquete tiene conteos incompatibles con el lote.', 409, { loteId: lote });
    }
    paginasPorExamen = paginasValidas / examenesValidos;
  } else {
    const conteosPorExamen = examenesDelLote.map((examen) => {
      const mapa = parsearJsonPersistido<{ paginas?: unknown[] }>(examen.mapaOmr);
      return Array.isArray(mapa?.paginas) ? mapa.paginas.length : 0;
    });
    paginasPorExamen = conteosPorExamen[0] ?? 0;
    if (!Number.isInteger(paginasPorExamen) || paginasPorExamen < 1 || conteosPorExamen.some((conteo) => conteo !== paginasPorExamen)) {
      throw new ErrorAplicacion('LOTE_PAGINACION_NO_VERIFICABLE', 'El historial no permite comprobar que todos los exámenes tengan la misma paginación.', 409, { loteId: lote });
    }
  }
  if (paginasPorExamen < 1 || paginasPorExamen > paginasMaximasPorExamen) {
    throw new ErrorAplicacion('LOTE_PDF_INTEGRIDAD_INVALIDA', 'La paginación guardada excede el máximo de la plantilla.', 409, { loteId: lote, paginasPorExamen, paginasMaximasPorExamen });
  }
  const resumenPdf = await validarPdfConsolidadoLoteAplicacion(buffer, examenesDelLote.length * paginasPorExamen);
  if (artefactoPersistido && (
    artefactoPersistido.sha256 !== resumenPdf.sha256 ||
    Number(artefactoPersistido.totalPaginas) !== resumenPdf.paginas ||
    Number(artefactoPersistido.totalExamenes) !== examenesDelLote.length
  )) {
    throw new ErrorAplicacion('LOTE_PDF_INTEGRIDAD_INVALIDA', 'El archivo del paquete no coincide con la huella o el conteo persistido.', 409, {
      loteId: lote,
      huellaCoincide: artefactoPersistido.sha256 === resumenPdf.sha256,
      paginasArchivo: resumenPdf.paginas,
      paginasRegistradas: artefactoPersistido.totalPaginas,
      examenesArchivo: examenesDelLote.length,
      examenesRegistrados: artefactoPersistido.totalExamenes
    });
  }
  return { buffer, fileName, pdfSha256: artefactoPersistido?.sha256 ?? resumenPdf.sha256, totalPaginas: resumenPdf.paginas };
}
