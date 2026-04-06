import { Schema, model, models } from 'mongoose';

const CampanaSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    segmento: {
      lineaPersona: { type: String, enum: ['docente', 'coordinacion', 'institucional', 'socio_canal'] },
      paises: { type: [String], default: [] },
      estadoEmbudo: { type: String, enum: ['lead', 'trial', 'past_due', 'activo'] }
    },
    oferta: {
      planObjetivo: { type: String },
      cuponCodigo: { type: String },
      mensaje: { type: String }
    },
    canal: { type: String, enum: ['email', 'whatsapp', 'llamada', 'in_app'], required: true },
    presupuestoMxn: { type: Number, default: 0, min: 0 },
    fechaInicio: { type: Date, required: true },
    fechaFin: { type: Date, required: true },
    estado: { type: String, enum: ['borrador', 'activa', 'pausada', 'cerrada'], default: 'borrador' },
    kpiObjetivo: {
      cplMax: { type: Number, min: 0 },
      conversionMin: { type: Number, min: 0, max: 1 },
      paybackMesesMax: { type: Number, min: 0 }
    }
  },
  { timestamps: true, collection: 'comercialCampanas' }
);

CampanaSchema.index({ estado: 1, fechaInicio: 1, fechaFin: 1 });

export const Campana = models.Campana ?? model('Campana', CampanaSchema);
