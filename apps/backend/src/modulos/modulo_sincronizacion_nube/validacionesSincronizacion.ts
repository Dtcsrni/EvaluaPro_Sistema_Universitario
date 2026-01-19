/**
 * Validaciones de sincronización a nube.
 *
 * Nota:
 * - Se valida lo mínimo necesario para mantener contract tests estables.
 * - La autorización por objeto (docenteId) se aplica vía middleware JWT y
 *   filtros en queries (ver `controladorSincronizacion.ts`).
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';

export const esquemaPublicarResultados = z.object({
  periodoId: esquemaObjectId
});

export const esquemaGenerarCodigoAcceso = z.object({
  periodoId: esquemaObjectId
});

// Paquete de sincronización (entre computadoras). Permite export/import manual (USB/Drive).
export const esquemaExportarPaquete = z.object({
  periodoId: esquemaObjectId.optional(),
  desde: z.string().datetime().optional(),
  incluirPdfs: z.boolean().optional()
});

export const esquemaImportarPaquete = z.object({
  paqueteBase64: z.string().min(40),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  dryRun: z.boolean().optional()
});
