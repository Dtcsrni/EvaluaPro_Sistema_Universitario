/**
 * gestionPlantillas
 *
 * Responsabilidad: concentrar reglas de CRUD de plantillas sin depender de
 * Express, preservando validaciones multi-tenant y consistencia de dominio.
 */
import { ErrorAplicacion } from '../../../../compartido/errores/errorAplicacion';
import { BanderaRevision } from '../../../modulo_analiticas/modeloBanderaRevision';
import { Calificacion } from '../../../modulo_calificacion/modeloCalificacion';
import { Entrega } from '../../../modulo_vinculacion_entrega/modeloEntrega';
import { guardarEnPapelera } from '../../../modulo_papelera/servicioPapelera';
import { ExamenGenerado } from '../../modeloExamenGenerado';
import { ExamenPlantilla, normalizarTituloPlantilla } from '../../modeloExamenPlantilla';
import {
  asegurarPlantillaActiva,
  normalizarTemas,
  obtenerPlantillaDocente,
  validarPeriodoDocenteActivo,
  validarTituloPlantillaDisponible
} from '../../shared/controladorGeneracionPdfShared';

export async function listarPlantillasUseCase(params: {
  docenteId: unknown;
  periodoId?: unknown;
  archivado?: unknown;
  limite?: unknown;
}) {
  const filtro: Record<string, unknown> = { docenteId: params.docenteId };
  if (params.periodoId) filtro.periodoId = String(params.periodoId);

  const queryArchivado = String(params.archivado ?? '').trim().toLowerCase();
  const filtrarArchivadas = queryArchivado === '1' || queryArchivado === 'true' || queryArchivado === 'si' || queryArchivado === 's';
  filtro.archivadoEn = filtrarArchivadas ? { $exists: true } : { $exists: false };

  const limite = Number(params.limite ?? 0);
  const consulta = ExamenPlantilla.find(filtro);
  const plantillas = await (limite > 0 ? consulta.limit(limite) : consulta).lean();
  return { plantillas };
}

export async function crearPlantillaUseCase(params: {
  docenteId: unknown;
  body: Record<string, unknown>;
}) {
  const titulo = String(params.body.titulo ?? '').trim();
  const periodoId = params.body.periodoId;

  if (periodoId) {
    await validarPeriodoDocenteActivo(params.docenteId, periodoId);
  }

  const temas = normalizarTemas(params.body.temas);
  await validarTituloPlantillaDisponible({ docenteId: params.docenteId, titulo });

  const plantilla = await ExamenPlantilla.create({
    ...params.body,
    titulo,
    tituloNormalizado: normalizarTituloPlantilla(titulo),
    temas,
    reactivosObjetivo: Number(params.body.reactivosObjetivo ?? 20) || 20,
    defaultVersionCount: Number(params.body.defaultVersionCount ?? 1) || 1,
    answerKeyMode: String(params.body.answerKeyMode ?? 'digital'),
    bookletConfig: {
      targetPages: Number((params.body.bookletConfig as { targetPages?: unknown } | undefined)?.targetPages ?? params.body.numeroPaginas ?? 2) || 2,
      densityMode: String((params.body.bookletConfig as { densityMode?: unknown } | undefined)?.densityMode ?? 'balanced'),
      allowImages: (params.body.bookletConfig as { allowImages?: unknown } | undefined)?.allowImages !== false,
      imageBudgetPolicy: String((params.body.bookletConfig as { imageBudgetPolicy?: unknown } | undefined)?.imageBudgetPolicy ?? 'balanced'),
      headerStyle: String((params.body.bookletConfig as { headerStyle?: unknown } | undefined)?.headerStyle ?? 'institutional'),
      fontScale: Number((params.body.bookletConfig as { fontScale?: unknown } | undefined)?.fontScale ?? 1) || 1,
      lineSpacing: Number((params.body.bookletConfig as { lineSpacing?: unknown } | undefined)?.lineSpacing ?? 1.1) || 1.1,
      separateCoverPage: Boolean((params.body.bookletConfig as { separateCoverPage?: unknown } | undefined)?.separateCoverPage)
    },
    omrConfig: {
      sheetFamilyCode: String((params.body.omrConfig as { sheetFamilyCode?: unknown } | undefined)?.sheetFamilyCode ?? 'S50_5A_ID5_VR6'),
      sheetRevisionId: (params.body.omrConfig as { sheetRevisionId?: unknown } | undefined)?.sheetRevisionId,
      prefillMode: String((params.body.omrConfig as { prefillMode?: unknown } | undefined)?.prefillMode ?? 'none'),
      identityMode: 'qr_plus_bubbled_id',
      allowBlankGenericSheets: (params.body.omrConfig as { allowBlankGenericSheets?: unknown } | undefined)?.allowBlankGenericSheets !== false,
      versionMode: String((params.body.omrConfig as { versionMode?: unknown } | undefined)?.versionMode ?? 'single'),
      ignoreUnusedTrailingQuestions: (params.body.omrConfig as { ignoreUnusedTrailingQuestions?: unknown } | undefined)?.ignoreUnusedTrailingQuestions !== false,
      captureMode: 'pdf_and_mobile'
    },
    docenteId: params.docenteId
  });

  return { plantilla };
}

export async function actualizarPlantillaUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
  body: Record<string, unknown>;
}) {
  const actual = await obtenerPlantillaDocente(params.docenteId, params.plantillaId);

  const temas = normalizarTemas(params.body.temas);
  const patch: Record<string, unknown> = { ...params.body, ...(temas !== undefined ? { temas } : {}) };
  if (Array.isArray(params.body.temas) && (temas === undefined || temas.length === 0)) {
    patch.temas = [];
  }

  if (patch.periodoId) {
    await validarPeriodoDocenteActivo(params.docenteId, patch.periodoId);
  }

  const merged = {
    periodoId: patch.periodoId ?? actual.periodoId,
    tipo: patch.tipo ?? actual.tipo,
    titulo: patch.titulo ?? actual.titulo,
    instrucciones: patch.instrucciones ?? actual.instrucciones,
    numeroPaginas: patch.numeroPaginas ?? (actual as { numeroPaginas?: unknown }).numeroPaginas,
    reactivosObjetivo: patch.reactivosObjetivo ?? (actual as { reactivosObjetivo?: unknown }).reactivosObjetivo,
    defaultVersionCount: patch.defaultVersionCount ?? (actual as { defaultVersionCount?: unknown }).defaultVersionCount,
    answerKeyMode: patch.answerKeyMode ?? (actual as { answerKeyMode?: unknown }).answerKeyMode,
    preguntasIds: patch.preguntasIds ?? actual.preguntasIds,
    temas: patch.temas ?? (actual as { temas?: unknown }).temas,
    bookletConfig: patch.bookletConfig ?? (actual as { bookletConfig?: unknown }).bookletConfig,
    omrConfig: patch.omrConfig ?? (actual as { omrConfig?: unknown }).omrConfig,
    configuracionPdf: patch.configuracionPdf ?? actual.configuracionPdf
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
    docenteId: params.docenteId,
    titulo: merged.titulo,
    excluirPlantillaId: params.plantillaId
  });

  const plantilla = await ExamenPlantilla.findOneAndUpdate(
    { _id: params.plantillaId, docenteId: params.docenteId },
    {
      $set: {
        ...patch,
        titulo: String(merged.titulo ?? '').trim(),
        tituloNormalizado: normalizarTituloPlantilla(String(merged.titulo ?? ''))
      }
    },
    { returnDocument: 'after' }
  ).lean();

  return { plantilla };
}

export async function archivarPlantillaUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
}) {
  const plantilla = await obtenerPlantillaDocente(params.docenteId, params.plantillaId);
  if ((plantilla as { archivadoEn?: unknown }).archivadoEn) {
    return { ok: true, plantilla };
  }

  const actualizada = await ExamenPlantilla.findOneAndUpdate(
    { _id: params.plantillaId, docenteId: params.docenteId },
    { $set: { archivadoEn: new Date() } },
    { returnDocument: 'after' }
  ).lean();

  return { ok: true, plantilla: actualizada };
}

export async function eliminarPlantillaUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
}) {
  const plantilla = await obtenerPlantillaDocente(params.docenteId, params.plantillaId);
  asegurarPlantillaActiva(plantilla as { archivadoEn?: unknown });

  const examenes = await ExamenGenerado.find({ docenteId: params.docenteId, plantillaId: params.plantillaId }).select('_id').lean();
  const examenesIds = examenes.map((examen) => String(examen._id));

  const [entregasDocs, calificacionesDocs, banderasDocs] = examenesIds.length
    ? await Promise.all([
        Entrega.find({ docenteId: params.docenteId, examenGeneradoId: { $in: examenesIds } }).lean(),
        Calificacion.find({ docenteId: params.docenteId, examenGeneradoId: { $in: examenesIds } }).lean(),
        BanderaRevision.find({ docenteId: params.docenteId, examenGeneradoId: { $in: examenesIds } }).lean()
      ])
    : [[], [], []];

  await guardarEnPapelera({
    docenteId: String(params.docenteId),
    tipo: 'plantilla',
    entidadId: params.plantillaId,
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
        Entrega.deleteMany({ docenteId: params.docenteId, examenGeneradoId: { $in: examenesIds } }),
        Calificacion.deleteMany({ docenteId: params.docenteId, examenGeneradoId: { $in: examenesIds } }),
        BanderaRevision.deleteMany({ docenteId: params.docenteId, examenGeneradoId: { $in: examenesIds } })
      ])
    : [{ deletedCount: 0 }, { deletedCount: 0 }, { deletedCount: 0 }];

  const examenesResp = examenesIds.length
    ? await ExamenGenerado.deleteMany({ docenteId: params.docenteId, _id: { $in: examenesIds } })
    : { deletedCount: 0 };

  const plantillaResp = await ExamenPlantilla.deleteOne({ _id: params.plantillaId, docenteId: params.docenteId });

  return {
    ok: true,
    eliminados: {
      plantillas: plantillaResp.deletedCount ?? 0,
      examenes: examenesResp.deletedCount ?? 0,
      entregas: (entregasResp as { deletedCount?: number }).deletedCount ?? 0,
      calificaciones: (calificacionesResp as { deletedCount?: number }).deletedCount ?? 0,
      banderas: (banderasResp as { deletedCount?: number }).deletedCount ?? 0
    }
  };
}
