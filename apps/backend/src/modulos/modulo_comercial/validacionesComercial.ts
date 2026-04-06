import { z } from 'zod';

const esquemaPersona = z.enum(['docente', 'coordinacion', 'institucional', 'socio_canal']);

export const esquemaRecomendacionMonetizacion = z
  .object({
    persona: esquemaPersona.optional(),
    perfilCliente: z.string().trim().min(1).max(120).optional(),
    volumenDocentes: z.number().int().nonnegative().max(100000).optional(),
    volumenAlumnos: z.number().int().nonnegative().max(10000000).optional(),
    incidenciasSoporteMes: z.number().int().nonnegative().max(100000).optional(),
    requiereCumplimiento: z.boolean().optional(),
    requiereIntegraciones: z.boolean().optional(),
    multipSede: z.boolean().optional(),
    presupuestoMensualMxn: z.number().nonnegative().max(1000000000).optional(),
    usaEdicionComunitaria: z.boolean().optional()
  })
  .strict();

