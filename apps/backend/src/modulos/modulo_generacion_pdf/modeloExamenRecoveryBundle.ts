import { Schema, model, models } from 'mongoose';

const ExamenRecoveryBundleSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente' },
    periodoId: { type: Schema.Types.ObjectId, ref: 'Periodo' },
    plantillaId: { type: Schema.Types.ObjectId, ref: 'ExamenPlantilla' },
    loteId: { type: String, required: true, index: true },
    keyId: { type: String, required: true },
    bundleHash: { type: String, required: true },
    bundle: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: true, collection: 'examenesRecoveryBundles' }
);

ExamenRecoveryBundleSchema.index({ docenteId: 1, loteId: 1 }, { unique: true });

export const ExamenRecoveryBundle =
  models.ExamenRecoveryBundle ?? model('ExamenRecoveryBundle', ExamenRecoveryBundleSchema);
