import { Schema, model, models } from 'mongoose';

const CobranzaSchema = new Schema(
  {
    tenantId: { type: String, required: true, trim: true, lowercase: true },
    suscripcionId: { type: Schema.Types.ObjectId, ref: 'Suscripcion' },
    pasarela: { type: String, enum: ['mercadopago', 'manual'], required: true },
    estado: { type: String, enum: ['pendiente', 'aprobado', 'rechazado', 'cancelado'], default: 'pendiente' },
    monto: { type: Number, required: true, min: 0 },
    moneda: { type: String, default: 'MXN', trim: true, uppercase: true },
    referenciaExterna: { type: String },
    webhookEventId: { type: String },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'comercialCobranza' }
);

CobranzaSchema.index({ tenantId: 1, createdAt: -1 });
CobranzaSchema.index({ webhookEventId: 1 }, { unique: true, sparse: true });
CobranzaSchema.index({ referenciaExterna: 1, pasarela: 1 });

export const Cobranza = models.Cobranza ?? model('Cobranza', CobranzaSchema);
