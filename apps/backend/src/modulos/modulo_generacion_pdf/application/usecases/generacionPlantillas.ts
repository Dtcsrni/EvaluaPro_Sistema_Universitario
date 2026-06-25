/**
 * generacionPlantillas
 *
 * Responsabilidad: encapsular la generación individual y masiva de exámenes,
 * así como las consultas operativas de lotes, sin acoplar la lógica a HTTP.
 */
import { randomUUID } from 'crypto';
import fs from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { prisma } from '../../../../infraestructura/baseDatos/sqlite';
import { ErrorAplicacion } from '../../../../compartido/errores/errorAplicacion';
import { guardarPdfExamen, resolverRutaPdfExamen } from '../../../../infraestructura/archivos/almacenLocal';
import { normalizarParaNombreArchivo } from '../../../../compartido/utilidades/texto';
import { construirMetadataRetencion } from '../../servicioRetencionExamenes';
import { generarPdfExamen } from '../../servicioGeneracionPdf';
import { generarVariante } from '../../servicioVariantes';
import { construirRecoveryBundle, construirRecoveryManifest } from '../../domain/recoveryManifest';
import { resolverNumeroPaginasPlantilla } from '../../domain/resolverNumeroPaginasPlantilla';
import { extraerPreguntasUsadasMapaOmr } from '../../domain/tv4Compat';
import {
  construirEncabezadoPdf,
  construirFirmaVariante,
  construirMapaVarianteUsadaDesdeOmr,
  construirNombrePdfExamen,
  construirNombrePdfLote,
  construirNombrePdfLoteAnterior,
  esEntornoTest,
  generarVarianteDeterminista,
  hash32,
  mapearPreguntasBase,
  normalizarLoteId,
  obtenerPlantillaDocente,
  ordenarPreguntasAleatorio,
  ordenarPreguntasDeterminista,
  resolverDocentePdf,
  resolverPeriodoPlantillaActivo,
  resolverPreguntasPlantilla,
  resolverTemplateVersionOmr
} from '../../shared/controladorGeneracionPdfShared';


export async function generarExamenUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
}) {
  const docId = String(params.docenteId);
  const plantilla = await obtenerPlantillaDocente(docId, params.plantillaId);
  if (plantilla.archivadoEn) {
    throw new ErrorAplicacion('PLANTILLA_ARCHIVADA', 'La plantilla esta archivada', 409);
  }

  const periodo = await resolverPeriodoPlantillaActivo(plantilla as { periodoId?: unknown });
  const docenteDb = await resolverDocentePdf(docId);
  const { preguntasDb, temas } = await resolverPreguntasPlantilla({
    docenteId: docId,
    plantilla: plantilla as any
  });

  const numeroPaginas = resolverNumeroPaginasPlantilla(plantilla as { numeroPaginas?: unknown });
  const preguntasBase = mapearPreguntasBase(preguntasDb);
  const preguntasCandidatas = ordenarPreguntasAleatorio(preguntasBase);
  const mapaVariante = generarVariante(preguntasCandidatas);
  const loteId = randomUUID().split('-')[0].toUpperCase();
  const folio = randomUUID().split('-')[0].toUpperCase();
  const examenGeneradoId = randomUUID();
  const templateVersionOmr = resolverTemplateVersionOmr({
    docenteId: docId,
    periodoId: plantilla.periodoId,
    plantillaId: plantilla.id
  });

  const resultadoPdf = await generarPdfExamen({
    titulo: plantilla.titulo,
    folio,
    examId: examenGeneradoId,
    preguntas: preguntasCandidatas,
    mapaVariante,
    tipoExamen: plantilla.tipo as 'parcial' | 'global',
    totalPaginas: numeroPaginas,
    margenMm: plantilla.configuracionPdf?.margenMm ?? 10,
    templateVersion: templateVersionOmr,
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
    paginas
  });

  const raw = await prisma.examenGenerado.create({
    data: {
      id: examenGeneradoId,
      docenteId: docId,
      periodoId: plantilla.periodoId ? String(plantilla.periodoId) : null,
      plantillaId: String(plantilla.id),
      loteId,
      origenGeneracion: 'individual',
      folio,
      estado: 'generado',
      mapaVariante: JSON.stringify(mapaVarianteUsada),
      paginas: JSON.stringify(paginas),
      mapaOmr: JSON.stringify(mapaOmr),
      rutaPdf,
      retentionStatus: 'active',
      recoveryKeyId: recoveryManifest.keyId,
      recoveryManifestHash: recoveryManifest.manifestHash,
      recoveryManifest: JSON.stringify(recoveryManifest)
    }
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

  // Convert to Mongoose-like output structure to preserve API compatibility
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

export async function generarExamenesLoteUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
  confirmarMasivo?: boolean;
  loteId?: string;
}) {
  const docId = String(params.docenteId);
  const plantilla = await obtenerPlantillaDocente(docId, params.plantillaId);
  if (plantilla.archivadoEn) {
    throw new ErrorAplicacion('PLANTILLA_ARCHIVADA', 'La plantilla esta archivada', 409);
  }
  if (!plantilla.periodoId) {
    throw new ErrorAplicacion('PLANTILLA_INVALIDA', 'La plantilla requiere materia (periodoId) para generar en lote', 400);
  }

  const loteIdNormalizado = normalizarLoteId(params.loteId);
  let loteId = loteIdNormalizado || randomUUID().split('-')[0].toUpperCase();
  if (loteIdNormalizado) {
    const loteExistente = await prisma.examenGenerado.findFirst({
      where: { docenteId: docId, loteId }
    });
    if (loteExistente) {
      loteId = randomUUID().split('-')[0].toUpperCase();
    }
  }

  const periodo = await resolverPeriodoPlantillaActivo(plantilla as { periodoId?: unknown });
  const docenteDb = await resolverDocentePdf(docId);
  const alumnos = await prisma.alumno.findMany({
    where: { periodoId: String(plantilla.periodoId), activo: true }
  });
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

  const { preguntasDb, temas } = await resolverPreguntasPlantilla({
    docenteId: docId,
    plantilla: plantilla as any
  });
  const numeroPaginas = resolverNumeroPaginasPlantilla(plantilla as { numeroPaginas?: unknown });
  const preguntasBase = mapearPreguntasBase(preguntasDb);
  const templateVersionOmr = resolverTemplateVersionOmr({
    docenteId: docId,
    periodoId: plantilla.periodoId,
    plantillaId: plantilla.id
  });

  let preguntasBaseLote: ReturnType<typeof mapearPreguntasBase> = [];
  let reactivosTotalesLote = 0;
  {
    const preguntasCandidatas = ordenarPreguntasDeterminista(preguntasBase, hash32(`${String(plantilla.id)}:${loteId}:lote-base`));
    const mapaVariante = generarVarianteDeterminista(preguntasCandidatas, `plantilla:${plantilla.id}:lote-base:${loteId}`);
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
        instrucciones: plantilla.instrucciones,
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
    preguntasBaseLote = idsPreguntasLote
      .map((id) => preguntasPorId.get(id))
      .filter((pregunta): pregunta is NonNullable<typeof pregunta> => Boolean(pregunta));
    reactivosTotalesLote = preguntasBaseLote.length;
    if (reactivosTotalesLote !== idsPreguntasLote.length) {
      throw new ErrorAplicacion('PREGUNTAS_NO_DISPONIBLES', 'No se pudieron resolver todas las preguntas seleccionadas para el lote.', 409);
    }

    const usadosSet = new Set(idsPreguntasLote);
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
  }

  const firmasVariantesLote = new Set<string>();
  const maxIntentosVarianteUnica = Math.min(36, Math.max(10, totalAlumnos * 2));

  const crearExamenSinAlumno = async () => {
    for (let intento = 0; intento < maxIntentosVarianteUnica; intento += 1) {
      const preguntasCandidatas = ordenarPreguntasAleatorio(preguntasBaseLote);
      const mapaVariante = generarVariante(preguntasCandidatas);
      const esUltimoIntentoVariante = intento + 1 >= maxIntentosVarianteUnica;
      let folio = randomUUID().split('-')[0].toUpperCase();
      try {
        const examenGeneradoId = randomUUID();
        const { pdfBytes, paginas, metricasPaginas, mapaOmr, preguntasRestantes } = await generarPdfExamen({
          titulo: plantilla.titulo,
          folio,
          examId: examenGeneradoId,
          preguntas: preguntasCandidatas,
          mapaVariante,
          tipoExamen: plantilla.tipo as 'parcial' | 'global',
          totalPaginas: numeroPaginas,
          margenMm: plantilla.configuracionPdf?.margenMm ?? 10,
          templateVersion: templateVersionOmr,
          encabezado: construirEncabezadoPdf({
            periodo,
            docenteDb,
            instrucciones: plantilla.instrucciones,
            incluirPrefijosDocente: true
          })
        });

        const usadosSet = extraerPreguntasUsadasMapaOmr(mapaOmr as never);
        const mapaVarianteUsada = construirMapaVarianteUsadaDesdeOmr(mapaVariante, mapaOmr);
        const reactivosUsados = Array.isArray(mapaVarianteUsada.ordenPreguntas) ? mapaVarianteUsada.ordenPreguntas.length : 0;
        if ((preguntasRestantes ?? 0) > 0 || reactivosUsados !== reactivosTotalesLote) {
          if (!esUltimoIntentoVariante) continue;
          throw new ErrorAplicacion(
            'LOTE_VARIANTE_INCONSISTENTE',
            `No se pudo mantener un lote consistente de ${reactivosTotalesLote} reactivos en ${numeroPaginas} pagina(s).`,
            409,
            { preguntasRestantes, reactivosUsados, reactivosTotalesLote, numeroPaginas }
          );
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
          paginas
        });

        const raw = await prisma.examenGenerado.create({
          data: {
            id: examenGeneradoId,
            docenteId: docId,
            periodoId: plantilla.periodoId ? String(plantilla.periodoId) : null,
            plantillaId: String(plantilla.id),
            loteId,
            origenGeneracion: 'lote',
            folio,
            estado: 'generado',
            mapaVariante: JSON.stringify(mapaVarianteUsada),
            paginas: JSON.stringify(paginas),
            mapaOmr: JSON.stringify(mapaOmr),
            rutaPdf,
            retentionStatus: 'active',
            recoveryKeyId: recoveryManifest.keyId,
            recoveryManifestHash: recoveryManifest.manifestHash,
            recoveryManifest: JSON.stringify(recoveryManifest)
          }
        });

        await prisma.examenRecoveryManifest.create({
          data: {
            docenteId: docId,
            manifestHash: recoveryManifest.manifestHash,
            nombre: `manifest-${folio}`,
            metadata: JSON.stringify(recoveryManifest)
          }
        });

        firmasVariantesLote.add(firmaVariante);

        const formatted = {
          ...raw,
          _id: raw.id,
          mapaVariante: mapaVarianteUsada,
          paginas,
          mapaOmr
        };
        return { examenGenerado: formatted, pdfBytes, recoveryManifest };
      } catch (error) {
        const msg = String((error as { message?: unknown }).message ?? '');
        if (msg.includes('E11000') && msg.toLowerCase().includes('folio')) {
          folio = randomUUID().split('-')[0].toUpperCase();
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
  for (let indice = 0; indice < totalAlumnos; indice += 1) {
    const { examenGenerado, pdfBytes, recoveryManifest } = await crearExamenSinAlumno();
    examenesGenerados.push({
      _id: String(examenGenerado.id),
      folio: examenGenerado.folio,
      generadoEn: examenGenerado.generadoEn
    });
    if (pdfBytes) pdfsLote.push(pdfBytes);
    recoveryManifests.push(recoveryManifest);
  }

  if (recoveryManifests.length > 0) {
    const recoveryBundle = construirRecoveryBundle({
      loteId,
      docenteId: docId,
      periodoId: plantilla.periodoId ? String(plantilla.periodoId) : undefined,
      plantillaId: String(plantilla.id),
      templateVersion: templateVersionOmr,
      manifests: recoveryManifests
    });
    const bundlePersistido = await prisma.examenRecoveryBundle.create({
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
    const loteSafe = normalizarParaNombreArchivo(loteId, { maxLen: 16 }) || loteId;
    const nombreArchivo = construirNombrePdfLote({
      loteId: loteSafe,
      materiaNombre: String((periodo as { nombre?: unknown } | null)?.nombre ?? ''),
      plantillaTitulo: String(plantilla.titulo ?? ''),
      totalExamenes: totalAlumnos
    });
    await guardarPdfExamen(nombreArchivo, loteBytes);
    lotePdfUrl = `/examenes/generados/lote/${encodeURIComponent(loteSafe)}/pdf`;
  }

  return { loteId, totalAlumnos, examenesGenerados, lotePdfUrl };
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

  const generados = await prisma.examenGenerado.count({
    where: {
      docenteId: docId,
      loteId: lote,
      archivadoEn: null
    }
  });
  const porcentajeBase = totalEsperado > 0 ? Math.round((generados / totalEsperado) * 100) : 0;
  const porcentaje = Math.max(0, Math.min(100, porcentajeBase));
  const completado = totalEsperado > 0 ? generados >= totalEsperado : false;
  const estado = completado ? 'completado' : generados > 0 ? 'generando' : 'iniciando';

  return {
    loteId: lote,
    totalEsperado,
    generados,
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

  const [plantilla, periodo, totalExamenes] = await Promise.all([
    plantillaId
      ? prisma.examenPlantilla.findUnique({ where: { id: plantillaId } })
      : Promise.resolve(null),
    periodoId
      ? prisma.periodo.findUnique({ where: { id: periodoId } })
      : Promise.resolve(null),
    prisma.examenGenerado.count({ where: { docenteId: docId, loteId: lote } })
  ]);

  const fileName = construirNombrePdfLote({
    loteId: lote,
    materiaNombre: String(periodo?.nombre ?? ''),
    plantillaTitulo: String(plantilla?.titulo ?? ''),
    totalExamenes: Number(totalExamenes ?? 0)
  });
  const nombreArchivoAnterior = construirNombrePdfLoteAnterior({
    loteId: lote,
    materiaNombre: String(periodo?.nombre ?? ''),
    plantillaTitulo: String(plantilla?.titulo ?? '')
  });

  const ruta = resolverRutaPdfExamen(fileName);
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
    return { buffer, fileName };
  } catch {
    throw new ErrorAplicacion('PDF_NO_DISPONIBLE', 'PDF de lote no disponible', 404, { docenteId: docId });
  }
}
