/**
 * Agenda y eventos cronológicos para el alumno.
 */
import { Schema, model, models } from 'mongoose';

const AgendaAlumnoSchema = new Schema(
  {
    periodoId: { type: Schema.Types.ObjectId, required: true, index: true },
    alumnoId: { type: Schema.Types.ObjectId, required: true, index: true },
    agendaId: { type: String, required: true },
    titulo: { type: String, required: true },
    descripcion: { type: String },
    fecha: { type: Date, required: true },
    tipo: { type: String, default: 'evento' },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'agendaAlumno' }
);

AgendaAlumnoSchema.index({ periodoId: 1, alumnoId: 1, agendaId: 1 }, { unique: true });
AgendaAlumnoSchema.index({ periodoId: 1, alumnoId: 1, fecha: -1 });

export const AgendaAlumno = models.AgendaAlumno ?? model('AgendaAlumno', AgendaAlumnoSchema);
