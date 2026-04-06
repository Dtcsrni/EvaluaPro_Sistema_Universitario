import { Schema, model, models } from 'mongoose';

const ExamenRecoveryManifestSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente' },
    periodoId: { type: Schema.Types.ObjectId, ref: 'Periodo' },
    plantillaId: { type: Schema.Types.ObjectId, ref: 'ExamenPlantilla' },
    examId: { type: String, required: true, index: true },
    folio: { type: String, required: true, index: true },
    loteId: { type: String, index: true },
    keyId: { type: String, required: true },
    manifestHash: { type: String, required: true, unique: true },
    manifest: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: true, collection: 'examenesRecoveryManifests' }
);

ExamenRecoveryManifestSchema.index({ docenteId: 1, loteId: 1, folio: 1 });

export const ExamenRecoveryManifest =
  models.ExamenRecoveryManifest ?? model('ExamenRecoveryManifest', ExamenRecoveryManifestSchema);
