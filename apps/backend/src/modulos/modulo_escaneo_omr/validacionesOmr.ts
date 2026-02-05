/**
 * Validaciones de escaneo OMR.
 */
import { z } from 'zod';
import { configuracion } from '../../configuracion';

export const esquemaAnalizarOmr = z.object({
  folio: z.string().optional(),
  numeroPagina: z.number().int().min(0).optional(),
  imagenBase64: z.string().min(10).max(configuracion.omrImagenBase64MaxChars)
});
