/**
 * Validaciones de examenes (plantillas y generados).
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';

const normalizarTexto = (valor: string) => valor.trim().replace(/\s+/g, ' ');
const esquemaTitulo = z.string().trim().min(3).max(120).transform(normalizarTexto);
const esquemaInstrucciones = z.string().trim().max(2000).transform(normalizarTexto);
const esquemaTema = z.string().trim().min(1).max(80).transform(normalizarTexto);

function validarIdsUnicos(ids: string[], ctx: z.RefinementCtx, etiqueta: string) {
  const vistos = new Set<string>();
  for (const id of ids) {
    if (vistos.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `No repitas ${etiqueta}`
      });
      return;
    }
    vistos.add(id);
  }
}

function validarTextosUnicos(valores: string[], ctx: z.RefinementCtx, etiqueta: string) {
  const vistos = new Set<string>();
  for (const valor of valores) {
    const clave = normalizarTexto(valor).toLowerCase();
    if (vistos.has(clave)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `No repitas ${etiqueta}`
      });
      return;
    }
    vistos.add(clave);
  }
}

export const esquemaCrearPlantilla = z
  .object({
    periodoId: esquemaObjectId.optional(),
    tipo: z.enum(['parcial', 'global']),
    titulo: esquemaTitulo,
    instrucciones: esquemaInstrucciones.optional(),
    numeroPaginas: z.number().int().positive().max(50),
    // Legacy (deprecado): se acepta para compatibilidad, pero ya no se usa.
    totalReactivos: z.number().int().positive().optional(),
    preguntasIds: z.array(esquemaObjectId).optional(),
    temas: z.array(esquemaTema).max(50).optional(),
    configuracionPdf: z
      .object({
        margenMm: z.number().positive().max(40).optional(),
        layout: z.string().trim().min(1).max(40).optional()
      })
      .strict()
      .optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    const preguntasIds = Array.isArray(data.preguntasIds) ? data.preguntasIds : [];
    const temas = Array.isArray(data.temas) ? data.temas : [];
    if (preguntasIds.length === 0 && temas.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La plantilla debe incluir preguntasIds o temas'
      });
    }
    if (temas.length > 0 && !data.periodoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'periodoId es obligatorio cuando se usan temas'
      });
    }
    if (preguntasIds.length > 0) {
      validarIdsUnicos(preguntasIds, ctx, 'preguntasIds');
    }
    if (temas.length > 0) {
      validarTextosUnicos(temas, ctx, 'temas');
    }
  });

export const esquemaGenerarExamen = z.object({
  plantillaId: esquemaObjectId,
  alumnoId: esquemaObjectId.optional()
});

export const esquemaGenerarExamenesLote = z.object({
  plantillaId: esquemaObjectId,
  confirmarMasivo: z.boolean().optional()
});

export const esquemaRegenerarExamenGenerado = z
  .object({
    // Si el examen ya fue descargado, se requiere confirmación explícita.
    forzar: z.boolean().optional()
  })
  .strict();

export const esquemaActualizarPlantilla = z
  .object({
    periodoId: esquemaObjectId.optional(),
    tipo: z.enum(['parcial', 'global']).optional(),
    titulo: esquemaTitulo.optional(),
    instrucciones: esquemaInstrucciones.optional(),
    numeroPaginas: z.number().int().positive().max(50).optional(),
    // Legacy (deprecado)
    totalReactivos: z.number().int().positive().optional(),
    preguntasIds: z.array(esquemaObjectId).optional(),
    temas: z.array(esquemaTema).max(50).optional(),
    configuracionPdf: z
      .object({
        margenMm: z.number().positive().max(40).optional(),
        layout: z.string().trim().min(1).max(40).optional()
      })
      .strict()
      .optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    if (Array.isArray(data.preguntasIds) && data.preguntasIds.length > 0) {
      validarIdsUnicos(data.preguntasIds, ctx, 'preguntasIds');
    }
    if (Array.isArray(data.temas) && data.temas.length > 0) {
      validarTextosUnicos(data.temas, ctx, 'temas');
    }
  });

export const esquemaBodyVacioOpcional = z.object({}).strict().optional();
