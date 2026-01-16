/**
 * Validaciones de sincronizacion a nube.
 *
 * Nota:
 * - Se valida lo minimo necesario para mantener contract tests estables.
 * - La autorizacion por objeto (docenteId) se aplica via middleware JWT y
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

// Paquete de sincronizacion (entre computadoras). Permite export/import manual (USB/Drive).
export const esquemaExportarPaquete = z.object({
  periodoId: esquemaObjectId.optional(),
  desde: z.string().datetime().optional(),
  incluirPdfs: z.boolean().optional()
});

export const esquemaImportarPaquete = z.object({
  paqueteBase64: z.string().min(40)
});
