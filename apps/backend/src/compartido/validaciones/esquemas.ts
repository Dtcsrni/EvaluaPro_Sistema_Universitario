/**
 * esquemas
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Esquemas Zod reutilizables (contratos HTTP).
import { z } from 'zod';

// ObjectId de Mongo en formato hexadecimal (24 chars) o UUID de SQLite (36 chars).
export const esquemaObjectId = z.string().trim().refine(
  (val) => /^[0-9a-fA-F]{24}$/.test(val) || /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val),
  { message: 'ID invalido. Debe ser un ObjectId de 24 hex o un UUID.' }
);
