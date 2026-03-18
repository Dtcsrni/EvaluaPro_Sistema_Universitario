import { Schema, model, models } from 'mongoose';

const MapeoClassroomAlumnoCursoSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    periodoId: { type: Schema.Types.ObjectId, ref: 'Periodo', required: true },
    courseId: { type: String, required: true, trim: true },
    classroomUserId: { type: String, required: true, trim: true },
    alumnoId: { type: Schema.Types.ObjectId, ref: 'Alumno', required: true },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'mapeosClassroomAlumnoCurso' }
);

MapeoClassroomAlumnoCursoSchema.index(
  { docenteId: 1, periodoId: 1, courseId: 1, classroomUserId: 1 },
  { unique: true }
);

export const MapeoClassroomAlumnoCurso =
  models.MapeoClassroomAlumnoCurso ?? model('MapeoClassroomAlumnoCurso', MapeoClassroomAlumnoCursoSchema);
