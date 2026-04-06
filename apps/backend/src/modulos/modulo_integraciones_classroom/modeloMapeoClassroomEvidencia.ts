import { Schema, model, models } from 'mongoose';

const MapeoClassroomEvidenciaSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    periodoId: { type: Schema.Types.ObjectId, ref: 'Periodo', required: true },
    courseId: { type: String, required: true, trim: true },
    courseWorkId: { type: String, required: true, trim: true },
    tituloEvidencia: { type: String, trim: true },
    descripcionEvidencia: { type: String, trim: true },
    ponderacion: { type: Number, min: 0, default: 1 },
    corte: { type: Number, enum: [1, 2, 3] },
    activo: { type: Boolean, default: true },
    asignacionesAlumnos: [
      {
        classroomUserId: { type: String, required: true, trim: true },
        alumnoId: { type: Schema.Types.ObjectId, ref: 'Alumno', required: true }
      }
    ],
    metadata: { type: Schema.Types.Mixed },
    ultimaEjecucionPull: { type: Date }
  },
  { timestamps: true, collection: 'mapeosClassroomEvidencia' }
);

MapeoClassroomEvidenciaSchema.index(
  { docenteId: 1, periodoId: 1, courseId: 1, courseWorkId: 1 },
  { unique: true }
);

export const MapeoClassroomEvidencia =
  models.MapeoClassroomEvidencia ?? model('MapeoClassroomEvidencia', MapeoClassroomEvidenciaSchema);
