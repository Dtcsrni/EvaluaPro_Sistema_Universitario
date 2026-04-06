/**
 * Perfil académico visible del alumno en portal.
 */
import { Schema, model, models } from 'mongoose';

const PerfilAlumnoSchema = new Schema(
  {
    periodoId: { type: Schema.Types.ObjectId, required: true, index: true },
    alumnoId: { type: Schema.Types.ObjectId, required: true, index: true },
    matricula: { type: String, required: true },
    nombreCompleto: { type: String, required: true },
    grupo: { type: String },
    docenteId: { type: Schema.Types.ObjectId },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'perfilAlumno' }
);

PerfilAlumnoSchema.index({ periodoId: 1, alumnoId: 1 }, { unique: true });

export const PerfilAlumno = models.PerfilAlumno ?? model('PerfilAlumno', PerfilAlumnoSchema);
