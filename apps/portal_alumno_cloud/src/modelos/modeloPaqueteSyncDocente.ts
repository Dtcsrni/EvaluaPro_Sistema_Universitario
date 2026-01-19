/**
 * Paquetes de sincronizacion asincrona entre equipos (docente).
 */
import { Schema, model, models } from 'mongoose';

const PaqueteSyncDocenteSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, required: true, index: true },
    paqueteBase64: { type: String, required: true },
    checksumSha256: { type: String },
    schemaVersion: { type: Number, default: 1 },
    exportadoEn: { type: Date },
    desde: { type: Date },
    periodoId: { type: Schema.Types.ObjectId },
    conteos: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'paquetesSyncDocente' }
);

PaqueteSyncDocenteSchema.index({ docenteId: 1, createdAt: -1 });

export const PaqueteSyncDocente =
  models.PaqueteSyncDocente ?? model('PaqueteSyncDocente', PaqueteSyncDocenteSchema);
