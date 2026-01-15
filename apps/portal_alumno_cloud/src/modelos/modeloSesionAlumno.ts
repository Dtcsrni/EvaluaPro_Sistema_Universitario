/**
 * Sesiones de alumnos para el portal cloud.
 */
import { Schema, model, models } from 'mongoose';

const SesionAlumnoSchema = new Schema(
  {
    periodoId: { type: Schema.Types.ObjectId, required: true },
    alumnoId: { type: Schema.Types.ObjectId, required: true },
    tokenHash: { type: String, required: true },
    expiraEn: { type: Date, required: true }
  },
  { timestamps: true, collection: 'sesionesAlumno' }
);

SesionAlumnoSchema.index({ tokenHash: 1 }, { unique: true });

export const SesionAlumno = models.SesionAlumno ?? model('SesionAlumno', SesionAlumnoSchema);
