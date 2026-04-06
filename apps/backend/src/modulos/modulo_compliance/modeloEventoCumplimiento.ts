/**
 * Bitacora auditable de eventos de cumplimiento.
 */
import { Schema, model, models } from 'mongoose';

const EventoCumplimientoSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true, index: true },
    accion: { type: String, required: true, trim: true, index: true },
    severidad: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
    detalles: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'eventosCumplimiento' }
);

EventoCumplimientoSchema.index({ docenteId: 1, createdAt: -1 });

export const EventoCumplimiento = models.EventoCumplimiento ?? model('EventoCumplimiento', EventoCumplimientoSchema);
