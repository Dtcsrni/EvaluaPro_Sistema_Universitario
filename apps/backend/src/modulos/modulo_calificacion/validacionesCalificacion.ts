/**
 * Validaciones de calificacion.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';

const esquemaScorePorOpcion = z
  .object({
    opcion: z.enum(['A', 'B', 'C', 'D', 'E']),
    score: z.number().finite(),
    fillRatioCore: z.number().min(0).max(1),
    fillRatioRing: z.number().min(0).max(1),
    centerDarknessDelta: z.number().min(0).max(1),
    strokeLeakPenalty: z.number().min(0).max(1),
    shapeCompactness: z.number().min(0).max(1),
    markConfidence: z.number().min(0).max(1)
  })
  .strict();

const esquemaRespuestaDetectada = z
  .object({
    numeroPregunta: z.number().int().positive(),
    opcion: z.enum(['A', 'B', 'C', 'D', 'E']).nullable(),
    confianza: z.number().min(0).max(1).optional(),
    scoresPorOpcion: z.array(esquemaScorePorOpcion).max(5).optional(),
    flags: z.array(z.enum(['doble_marca', 'bajo_contraste', 'fuera_roi'])).max(3).optional()
  })
  .strict();

const esquemaAnalisisOmr = z
  .object({
    estadoAnalisis: z.enum(['ok', 'rechazado_calidad', 'requiere_revision']),
    calidadPagina: z.number().min(0).max(1),
    confianzaPromedioPagina: z.number().min(0).max(1).optional(),
    ratioAmbiguas: z.number().min(0).max(1).optional(),
    templateVersionDetectada: z.union([z.literal(3), z.literal(4)]).optional(),
    motivosRevision: z.array(z.string().min(1).max(200)).max(50).optional(),
    revisionConfirmada: z.boolean().optional(),
    usuarioRevisor: z.string().trim().min(3).max(120).optional(),
    revisionTimestamp: z.string().trim().datetime().optional(),
    motivoRevisionManual: z.string().trim().min(8).max(300).optional(),
    engineVersion: z.string().trim().min(3).max(40).optional(),
    geomQuality: z.number().min(0).max(1).optional(),
    photoQuality: z.number().min(0).max(1).optional(),
    decisionPolicy: z.string().trim().min(3).max(80).optional(),
    qrTexto: z.string().trim().min(8).max(600).optional()
  })
  .strict();

const esquemaPaginaOmrCalificacion = z
  .object({
    numeroPagina: z.number().int().positive(),
    imagenBase64: z.string().trim().min(1),
    estadoAnalisis: z.enum(['ok', 'rechazado_calidad', 'requiere_revision']).optional(),
    templateVersionDetectada: z.union([z.literal(3), z.literal(4)]).optional()
  })
  .strict();

export const esquemaCalificarExamen = z
  .object({
    examenGeneradoId: esquemaObjectId,
    folio: z.string().trim().min(4).max(60).optional(),
    alumnoId: esquemaObjectId.optional(),
    aciertos: z.number().int().min(0).optional(),
    totalReactivos: z.number().int().positive().optional(),
    bonoSolicitado: z.number().min(0).optional(),
    evaluacionContinua: z.number().min(0).optional(),
    proyecto: z.number().min(0).optional(),
    retroalimentacion: z.string().optional(),
    respuestasDetectadas: z.array(esquemaRespuestaDetectada).max(500).optional(),
    omrAnalisis: esquemaAnalisisOmr.optional(),
    paginasOmr: z.array(esquemaPaginaOmrCalificacion).max(100).optional(),
    soloPreview: z.boolean().optional(),
    politicaId: esquemaObjectId.optional(),
    versionPolitica: z.number().int().min(1).optional(),
    componentesExamen: z.unknown().optional(),
    bloqueContinuaDecimal: z.number().min(0).max(10).optional(),
    bloqueExamenesDecimal: z.number().min(0).max(10).optional(),
    finalDecimal: z.number().min(0).max(10).optional(),
    finalRedondeada: z.number().min(0).max(10).optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    const respuestas = Array.isArray(data.respuestasDetectadas) ? data.respuestasDetectadas : [];
    const paginasOmr = Array.isArray(data.paginasOmr) ? data.paginasOmr : [];
    const requiereAuditoriaOmr = respuestas.length > 0 || paginasOmr.length > 0;

    if (requiereAuditoriaOmr && !data.omrAnalisis) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Se requiere omrAnalisis cuando se envian respuestasDetectadas o paginasOmr',
        path: ['omrAnalisis']
      });
      return;
    }
    if (!data.omrAnalisis) return;

    const faltantes = [
      data.omrAnalisis.confianzaPromedioPagina === undefined ? 'confianzaPromedioPagina' : null,
      data.omrAnalisis.ratioAmbiguas === undefined ? 'ratioAmbiguas' : null,
      data.omrAnalisis.templateVersionDetectada === undefined ? 'templateVersionDetectada' : null,
      data.omrAnalisis.engineVersion === undefined ? 'engineVersion' : null,
      data.omrAnalisis.geomQuality === undefined ? 'geomQuality' : null,
      data.omrAnalisis.photoQuality === undefined ? 'photoQuality' : null,
      data.omrAnalisis.decisionPolicy === undefined ? 'decisionPolicy' : null,
      data.omrAnalisis.motivosRevision === undefined ? 'motivosRevision' : null,
      data.omrAnalisis.qrTexto === undefined ? 'qrTexto' : null
    ].filter((item): item is string => Boolean(item));

    if (faltantes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `omrAnalisis incompleto: faltan campos requeridos (${faltantes.join(', ')})`,
        path: ['omrAnalisis']
      });
    }

  });

export const esquemaResolverSolicitudRevision = z
  .object({
    estado: z.enum(['atendida', 'rechazada']),
    respuestaDocente: z.string().trim().min(8).max(500)
  })
  .strict();

export const esquemaSincronizarSolicitudesRevision = z
  .object({
    desde: z.string().trim().datetime().optional(),
    limite: z.number().int().min(1).max(200).optional()
  })
  .strict();
