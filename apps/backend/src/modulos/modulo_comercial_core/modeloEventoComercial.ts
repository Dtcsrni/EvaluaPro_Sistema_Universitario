import { Schema, model, models } from 'mongoose';

const EventoComercialSchema = new Schema(
  {
    tenantId: { type: String, required: true, trim: true, lowercase: true },
    actorDocenteId: { type: Schema.Types.ObjectId, ref: 'Docente' },
    evento: { type: String, required: true, trim: true },
    origen: { type: String, enum: ['panel', 'api_publica', 'sistema'], default: 'sistema' },
    meta: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'comercialEventos' }
);

EventoComercialSchema.index({ tenantId: 1, createdAt: -1 });
EventoComercialSchema.index({ evento: 1, createdAt: -1 });

export const EventoComercial = models.EventoComercial ?? model('EventoComercial', EventoComercialSchema);
