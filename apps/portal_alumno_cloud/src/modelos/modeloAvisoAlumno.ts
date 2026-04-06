/**
 * Avisos comunicados al alumno desde docente/sistema.
 */
import { Schema, model, models } from 'mongoose';

const AvisoAlumnoSchema = new Schema(
  {
    periodoId: { type: Schema.Types.ObjectId, required: true, index: true },
    alumnoId: { type: Schema.Types.ObjectId, required: true, index: true },
    avisoId: { type: String, required: true },
    titulo: { type: String, required: true },
    mensaje: { type: String, required: true },
    severidad: { type: String, default: 'info' },
    publicadoEn: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'avisosAlumno' }
);

AvisoAlumnoSchema.index({ periodoId: 1, alumnoId: 1, avisoId: 1 }, { unique: true });
AvisoAlumnoSchema.index({ periodoId: 1, alumnoId: 1, publicadoEn: -1 });

export const AvisoAlumno = models.AvisoAlumno ?? model('AvisoAlumno', AvisoAlumnoSchema);
