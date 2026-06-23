/**
 * modeloReconstruccionExamen
 *
 * MIGRADO A PRISMA — Mongoose eliminado.
 *
 * La tabla `reconstrucciones_examenes` es gestionada exclusivamente por Prisma ORM.
 * Modelo Prisma: ReconstruccionExamen {
 *   id, tipo, estado,
 *   docenteSolicitanteId, docenteDestinoId,
 *   bundleHash, manifestHash, loteId, examId, folio,
 *   signatureValid, recoverable,
 *   causes            (JSON string — String[]),
 *   reconstructedQuestionBankIds (JSON string — String[]),
 *   reconstructedExamIds         (JSON string — String[]),
 *   conflicts         (JSON string — Record<string,unknown>[]),
 *   metadata          (JSON string — Record<string,unknown> | null),
 *   createdAt, updatedAt
 * }
 *
 * Responsabilidad: Stub de compatibilidad. La lógica de persistencia vive en
 *   servicioRecuperacionExamenes.ts → persistExecutionLog()
 *
 * Campos JSON: se serializan con JSON.stringify() en escritura y
 *   JSON.parse() en lectura. Ver servicioRecuperacionExamenes.ts.
 *
 * Limites: No importar ni instanciar Mongoose en este módulo.
 */

// Este archivo se conserva como marcador de módulo.
// No exporta ningún modelo Mongoose; Prisma gestiona la tabla directamente.
export {};
