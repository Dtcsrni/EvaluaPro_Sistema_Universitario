/**
 * esquemas
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Esquemas Zod reutilizables (contratos HTTP).
import { z } from 'zod';

// ObjectId de Mongo en formato hexadecimal (24 chars).
export const esquemaObjectId = z.string().trim().regex(/^[0-9a-fA-F]{24}$/);
