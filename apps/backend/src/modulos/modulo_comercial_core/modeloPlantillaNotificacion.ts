import { Schema, model, models } from 'mongoose';

const PlantillaNotificacionSchema = new Schema(
  {
    clave: { type: String, required: true, unique: true, trim: true, lowercase: true },
    evento: {
      type: String,
      enum: ['cobranza_recordatorio', 'cobranza_suspension_parcial', 'cobranza_suspension_total'],
      required: true
    },
    canal: { type: String, enum: ['email', 'whatsapp', 'crm'], required: true },
    idioma: { type: String, default: 'es-MX', trim: true },
    asunto: { type: String, required: true, trim: true },
    contenido: { type: String, required: true, trim: true },
    activo: { type: Boolean, default: true },
    variables: { type: [String], default: [] }
  },
  { timestamps: true, collection: 'comercialPlantillasNotificacion' }
);

PlantillaNotificacionSchema.index({ evento: 1, canal: 1, idioma: 1, activo: 1 });

export const PlantillaNotificacion =
  models.PlantillaNotificacion ?? model('PlantillaNotificacion', PlantillaNotificacionSchema);
