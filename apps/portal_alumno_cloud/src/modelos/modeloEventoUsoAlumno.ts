/**
 * Eventos de uso del portal alumno (telemetria ligera).
 */
import { Schema, model } from 'mongoose';

const EventoUsoAlumnoSchema = new Schema(
  {
    periodoId: { type: Schema.Types.ObjectId, required: true },
    alumnoId: { type: Schema.Types.ObjectId, required: true },
    sessionId: { type: String },
    pantalla: { type: String },
    accion: { type: String, required: true },
    exito: { type: Boolean },
    duracionMs: { type: Number },
    meta: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'eventosUsoAlumno' }
);

EventoUsoAlumnoSchema.index({ periodoId: 1, alumnoId: 1, createdAt: -1 });
EventoUsoAlumnoSchema.index({ accion: 1, createdAt: -1 });

export const EventoUsoAlumno = model('EventoUsoAlumno', EventoUsoAlumnoSchema);
