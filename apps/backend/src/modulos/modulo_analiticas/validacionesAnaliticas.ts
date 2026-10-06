/**
 * Validaciones de banderas de revision.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas.js';

export const esquemaCrearBandera = z
  .object({
    examenGeneradoId: esquemaObjectId,
    alumnoId: esquemaObjectId,
    tipo: z.enum(['similitud', 'patron', 'duplicado', 'otro']),
    severidad: z.enum(['baja', 'media', 'alta']).optional(),
    descripcion: z.string().optional(),
    sugerencia: z.string().optional()
  })
  .strict();

const esquemaValorCsv = z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()]);
const esquemaFilaCsv = z
  .record(z.string(), esquemaValorCsv)
  .refine((fila) => Object.keys(fila).length <= 200, { message: 'Demasiadas columnas en fila' });

export const esquemaExportarCsv = z
  .object({
    columnas: z.array(z.string().trim().min(1).max(50)).min(1).max(50),
    filas: z.array(esquemaFilaCsv).max(5000)
  })
  .strict();

export const esquemaGuardarCalificacionLista = z.object({
  periodoId: esquemaObjectId,
  alumnoId: esquemaObjectId,
  componente: z.enum(['Practica 2do Parcial', 'Exámen 2do Parcial', 'Exámen Global', 'Bono extracurricular', 'Solicitud Extra']),
  calificacion: z.number().finite().min(0).max(10),
  version: z.number().int().positive().optional(),
  clientRequestId: z.string().uuid()
}).strict().superRefine((valor, contexto) => {
  const maximo = valor.componente === 'Bono extracurricular'
    ? 1
    : valor.componente === 'Solicitud Extra'
      ? 1
    : valor.componente === 'Exámen Global'
      ? 5
      : valor.componente === 'Exámen 2do Parcial'
        ? 5.25
        : 10;
  if (valor.calificacion > maximo) {
    contexto.addIssue({ code: 'custom', path: ['calificacion'], message: `La calificación no puede exceder ${maximo}.` });
  }
  if (valor.componente !== 'Bono extracurricular' && valor.calificacion > 10) {
    contexto.addIssue({ code: 'custom', path: ['calificacion'], message: 'La calificación parcial no puede exceder 10.' });
  }
});

export const esquemaPreviewBonoExtracurricular = z.object({
  periodoId: esquemaObjectId,
  alumnoId: esquemaObjectId,
  bono: z.number().finite().min(0).max(1)
}).strict();

export const esquemaRegistrarResultadoExtraExterno = z.object({
  periodoId: esquemaObjectId,
  alumnoId: esquemaObjectId,
  solicitaExtra: z.literal(true),
  folio: z.string().trim().min(4).max(60).transform((valor) => valor.toUpperCase()),
  loteId: z.string().trim().min(1).max(80).transform((valor) => valor.toUpperCase()).nullable().optional(),
  fuenteArchivo: z.string().trim().min(1).max(240),
  documentoSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  aciertos: z.number().int().min(0),
  totalReactivos: z.number().int().positive().max(200),
  criteriosAplicados: z.string().trim().min(12).max(1200),
  clientRequestId: z.string().uuid()
}).strict().superRefine((valor, contexto) => {
  if (valor.aciertos > valor.totalReactivos) {
    contexto.addIssue({ code: 'custom', path: ['aciertos'], message: 'Los aciertos no pueden superar los reactivos evaluables.' });
  }
});
