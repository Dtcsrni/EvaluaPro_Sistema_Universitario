import { Schema, model, models } from 'mongoose';

const ConsentimientoComercialSchema = new Schema(
  {
    tenantId: { type: String, required: true, trim: true, lowercase: true },
    canal: { type: String, enum: ['web', 'contrato', 'api'], default: 'web' },
    finalidades: {
      producto: { type: Boolean, default: false },
      ventas: { type: Boolean, default: false },
      marketing: { type: Boolean, default: false }
    },
    versionAviso: { type: String, required: true },
    optOut: {
      ventas: { type: Boolean, default: false },
      marketing: { type: Boolean, default: false }
    },
    otorgadoEn: { type: Date, default: Date.now }
  },
  { timestamps: true, collection: 'comercialConsentimientos' }
);

ConsentimientoComercialSchema.index({ tenantId: 1, createdAt: -1 });

export const ConsentimientoComercial =
  models.ConsentimientoComercial ?? model('ConsentimientoComercial', ConsentimientoComercialSchema);
