/**
 * Validaciones de periodos.
 */
import { z } from 'zod';

const patronNombrePeriodo = /^[\p{L}\p{N}][\p{L}\p{N}\s\-_.()#&/]*$/u;
const normalizarTexto = (valor: string) => valor.trim().replace(/\s+/g, ' ');

const esquemaNombrePeriodo = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .refine((valor) => patronNombrePeriodo.test(valor), {
    message: 'Nombre invalido'
  });

const esquemaGrupo = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .transform(normalizarTexto);

export const esquemaCrearPeriodo = z
  .object({
    nombre: esquemaNombrePeriodo,
    fechaInicio: z.coerce.date(),
    fechaFin: z.coerce.date(),
    grupos: z
      .array(esquemaGrupo)
      .max(50)
      .superRefine((grupos, ctx) => {
        const vistos = new Set<string>();
        for (const grupo of grupos) {
          const clave = normalizarTexto(grupo).toLowerCase();
          if (vistos.has(clave)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Los grupos no deben repetirse'
            });
            return;
          }
          vistos.add(clave);
        }
      })
      .optional(),
    activo: z.boolean().optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.fechaFin < data.fechaInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fechaFin debe ser mayor o igual a fechaInicio'
      });
    }
  });

export const esquemaActualizarPeriodo = z
  .object({
    nombre: esquemaNombrePeriodo.optional(),
    fechaInicio: z.coerce.date().optional(),
    fechaFin: z.coerce.date().optional(),
    grupos: z
      .array(esquemaGrupo)
      .max(50)
      .superRefine((grupos, ctx) => {
        const vistos = new Set<string>();
        for (const grupo of grupos) {
          const clave = normalizarTexto(grupo).toLowerCase();
          if (vistos.has(clave)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Los grupos no deben repetirse'
            });
            return;
          }
          vistos.add(clave);
        }
      })
      .optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    const hayCambios = data.nombre !== undefined || data.fechaInicio !== undefined || data.fechaFin !== undefined || data.grupos !== undefined;
    if (!hayCambios) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debes enviar al menos un campo a actualizar'
      });
      return;
    }
    if (data.fechaInicio && data.fechaFin && data.fechaFin < data.fechaInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fechaFin debe ser mayor o igual a fechaInicio'
      });
    }
  });

export const esquemaBodyVacioOpcional = z.object({}).strict().optional();
