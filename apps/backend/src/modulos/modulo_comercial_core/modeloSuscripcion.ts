import { Schema, model, models } from 'mongoose';

const SuscripcionSchema = new Schema(
  {
    tenantId: { type: String, required: true, trim: true, lowercase: true },
    planId: { type: String, required: true, trim: true, lowercase: true },
    ciclo: { type: String, enum: ['mensual', 'anual'], required: true },
    estado: { type: String, enum: ['trial', 'activo', 'past_due', 'suspendido', 'cancelado'], default: 'trial' },
    trial: {
      activo: { type: Boolean, default: false },
      iniciaEn: { type: Date },
      terminaEn: { type: Date }
    },
    fechaRenovacion: { type: Date },
    pasarela: { type: String, enum: ['mercadopago', 'manual'], default: 'manual' },
    precioAplicado: { type: Number, min: 0 },
    descuentoAplicado: { type: Number, min: 0, max: 1, default: 0 }
  },
  { timestamps: true, collection: 'comercialSuscripciones' }
);

SuscripcionSchema.index({ tenantId: 1, estado: 1 });
SuscripcionSchema.index({ fechaRenovacion: 1, estado: 1 });

export const Suscripcion = models.Suscripcion ?? model('Suscripcion', SuscripcionSchema);
