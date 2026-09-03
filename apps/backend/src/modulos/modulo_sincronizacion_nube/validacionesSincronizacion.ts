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
  dryRun: z.boolean().optional(),
  docenteCorreo: z.string().email().optional(),
  backupMeta: z
    .object({
      schemaVersion: z.number().int().positive().optional(),
      createdAt: z.string().datetime().optional(),
      ttlMs: z.number().int().positive().optional(),
      expiresAt: z.string().datetime(),
      businessLogicFingerprint: z.string().min(3).max(128).optional()
    })
    .optional()
});

// Sincronizacion asincrona push/pull con servidor intermedio.
export const esquemaEnviarPaqueteServidor = z.object({
  periodoId: esquemaObjectId.optional(),
  desde: z.string().datetime().optional(),
  incluirPdfs: z.boolean().optional()
});

export const esquemaTraerPaquetesServidor = z.object({
  desde: z.string().datetime().optional(),
  limite: z.number().int().min(1).max(20).optional()
});

// Instantanea local 1:1. La importacion usa un cuerpo binario autocontenido;
// este esquema valida la solicitud pequena de exportacion.
export const esquemaExportarInstantaneaLocal = z.object({
  metodo: z.enum(['contrasena', 'google']),
  credencial: z.string().min(1).max(256).optional()
});

export const esquemaImportarInstantaneaLocal = z.custom<Buffer>(
  (valor) => Buffer.isBuffer(valor) && valor.length >= 4 && valor.length <= 65 * 1024 * 1024,
  { message: 'El archivo de instantánea debe ser un Buffer de hasta 65 MB' }
);

export const esquemaLeaseSincronizacion = z.object({
  equipoId: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/),
  leaseId: z.string().regex(/^[A-Za-z0-9-]{16,128}$/).optional()
});

export const esquemaPublicarInstantaneaNube = z.object({
  equipoId: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/),
  leaseId: z.string().regex(/^[A-Za-z0-9-]{16,128}$/),
  metodo: z.enum(['contrasena', 'google']),
  credencial: z.string().min(1).max(256).optional()
});

export const esquemaImportarInstantaneaNube = esquemaPublicarInstantaneaNube.extend({
  dryRun: z.boolean().optional()
});

export const esquemaConfigurarCarpetaSincronizacion = z.object({
  directorio: z.string().min(1).max(1024)
});
