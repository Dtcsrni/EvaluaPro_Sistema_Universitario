import { Schema, model, models } from 'mongoose';

const PlanComercialSchema = new Schema(
  {
    planId: { type: String, required: true, unique: true, trim: true, lowercase: true },
    nombre: { type: String, required: true, trim: true },
    lineaPersona: { type: String, enum: ['docente', 'coordinacion', 'institucional', 'socio_canal'], required: true },
    nivel: { type: Number, required: true, min: 1, max: 4 },
    moneda: { type: String, default: 'MXN', trim: true, uppercase: true },
    precioMensual: { type: Number, required: true, min: 0 },
    precioAnual: { type: Number, required: true, min: 0 },
    costoMensualEstimado: { type: Number, required: true, min: 0 },
    margenObjetivoMinimo: { type: Number, default: 0.6, min: 0, max: 0.99 },
    limites: {
      maxDocentes: { type: Number, min: 0 },
      maxAlumnos: { type: Number, min: 0 },
      maxSedes: { type: Number, min: 0 },
      maxIntegraciones: { type: Number, min: 0 }
    },
    slaHoras: { type: Number, min: 1 },
    activo: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'comercialPlanes' }
);

PlanComercialSchema.index({ lineaPersona: 1, nivel: 1, activo: 1 });

export const PlanComercial = models.PlanComercial ?? model('PlanComercial', PlanComercialSchema);
