import { Schema, model, models } from 'mongoose';

const OmrSheetRevisionSchema = new Schema(
  {
    familyId: { type: Schema.Types.ObjectId, ref: 'OmrSheetFamily', required: true },
    revision: { type: Number, required: true, min: 1 },
    geometry: { type: Schema.Types.Mixed, required: true },
    qualityThresholds: { type: Schema.Types.Mixed, default: {} },
    renderTemplateVersion: { type: Number, default: 1 },
    recognitionEngineVersion: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'omrSheetRevisions' }
);

OmrSheetRevisionSchema.index({ familyId: 1, revision: 1 }, { unique: true });

export const OmrSheetRevision = models.OmrSheetRevision ?? model('OmrSheetRevision', OmrSheetRevisionSchema);
