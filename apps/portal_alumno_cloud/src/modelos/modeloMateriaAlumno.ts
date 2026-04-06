/**
 * Materias activas/publicadas para el alumno.
 */
import { Schema, model, models } from 'mongoose';

const MateriaAlumnoSchema = new Schema(
  {
    periodoId: { type: Schema.Types.ObjectId, required: true, index: true },
    alumnoId: { type: Schema.Types.ObjectId, required: true, index: true },
    materiaId: { type: String, required: true },
    nombre: { type: String, required: true },
    docente: { type: String },
    estado: { type: String, default: 'activa' },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'materiasAlumno' }
);

MateriaAlumnoSchema.index({ periodoId: 1, alumnoId: 1, materiaId: 1 }, { unique: true });

export const MateriaAlumno = models.MateriaAlumno ?? model('MateriaAlumno', MateriaAlumnoSchema);
