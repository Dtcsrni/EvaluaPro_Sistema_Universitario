/**
 * Historial académico resumido del alumno.
 */
import { Schema, model, models } from 'mongoose';

const HistorialAlumnoSchema = new Schema(
  {
    periodoId: { type: Schema.Types.ObjectId, required: true, index: true },
    alumnoId: { type: Schema.Types.ObjectId, required: true, index: true },
    historialId: { type: String, required: true },
    folio: { type: String },
    tipoExamen: { type: String },
    calificacionTexto: { type: String },
    aciertos: { type: Number },
    totalReactivos: { type: Number },
    fecha: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'historialAlumno' }
);

HistorialAlumnoSchema.index({ periodoId: 1, alumnoId: 1, historialId: 1 }, { unique: true });
HistorialAlumnoSchema.index({ periodoId: 1, alumnoId: 1, fecha: -1 });

export const HistorialAlumno = models.HistorialAlumno ?? model('HistorialAlumno', HistorialAlumnoSchema);
