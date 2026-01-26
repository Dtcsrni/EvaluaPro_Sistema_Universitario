/**
 * Validaciones para administracion de docentes.
 */
import { z } from 'zod';
import { ROLES } from '../../infraestructura/seguridad/rbac';

const esquemaRoles = z.array(z.enum(ROLES)).min(1);

export const esquemaActualizarDocenteAdmin = z
  .object({
    roles: esquemaRoles.optional(),
    activo: z.boolean().optional()
  })
  .refine((data) => typeof data.roles !== 'undefined' || typeof data.activo !== 'undefined', {
    message: 'Se requiere roles o activo'
  });

