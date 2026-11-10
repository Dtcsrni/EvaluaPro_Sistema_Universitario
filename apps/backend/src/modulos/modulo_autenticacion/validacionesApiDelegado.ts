import { z } from 'zod';
import { PERMISOS_API_DELEGABLES } from './servicioApiDelegado.js';

const esquemaPermisosApi = z.array(z.enum(PERMISOS_API_DELEGABLES)).min(1).max(PERMISOS_API_DELEGABLES.length);

export const esquemaCrearSolicitudApiLocal = z.object({
  codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  nombreCliente: z.string().trim().min(2).max(60),
  permisos: esquemaPermisosApi
}).strict();

export const esquemaInspeccionarSolicitudApiLocal = z.object({
  codigo: z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/i)
}).strict();

export const esquemaResolverSolicitudApiLocal = z.object({
  codigo: z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/i),
  permitir: z.boolean(),
  permisos: esquemaPermisosApi.optional()
}).strict().superRefine((data, ctx) => {
  if (data.permitir && !data.permisos?.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['permisos'], message: 'La aprobación requiere permisos seleccionados.' });
  }
  if (!data.permitir && data.permisos) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['permisos'], message: 'La denegación no debe incluir permisos.' });
  }
});

export const esquemaIntercambiarSolicitudApiLocal = z.object({
  solicitudId: z.string().uuid(),
  codeVerifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/)
}).strict();

export const esquemaRefrescarCredencialApi = z.object({
  refreshToken: z.string().regex(/^epr_[A-Za-z0-9_-]{43}$/)
}).strict();
