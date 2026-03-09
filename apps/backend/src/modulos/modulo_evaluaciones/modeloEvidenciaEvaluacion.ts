import { Schema, model, models } from 'mongoose';

const EvidenciaEvaluacionSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    periodoId: { type: Schema.Types.ObjectId, ref: 'Periodo', required: true },
    alumnoId: { type: Schema.Types.ObjectId, ref: 'Alumno', required: true },
    titulo: { type: String, required: true, trim: true },
    descripcion: { type: String, trim: true },
    calificacionDecimal: {
      type: Number,
      min: 0,
      max: 10,
      required: function requiredCalificacion() {
        const fuente = String((this as { fuente?: unknown }).fuente ?? 'manual').trim().toLowerCase();
        const estadoCaptura = String((this as { estadoCaptura?: unknown }).estadoCaptura ?? 'calificada').trim().toLowerCase();
        return !(fuente === 'classroom' && estadoCaptura === 'pendiente');
      }
    },
    ponderacion: { type: Number, required: true, min: 0, default: 1 },
    fechaEvidencia: { type: Date, required: true },
    corte: { type: Number, enum: [1, 2, 3] },
    fuente: { type: String, enum: ['manual', 'classroom'], default: 'manual' },
    estadoCaptura: { type: String, enum: ['pendiente', 'calificada'], default: 'calificada' },
    classroom: {
      courseId: { type: String },
      courseWorkId: { type: String },
      submissionId: { type: String },
      classroomUserId: { type: String },
      pulledAt: { type: Date },
      submissionState: { type: String },
      assignedGrade: { type: Number },
      draftGrade: { type: Number },
      maxPoints: { type: Number },
      updateTime: { type: Date },
      courseName: { type: String },
      courseWorkTitle: { type: String }
    },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'evidenciasEvaluacion' }
);

EvidenciaEvaluacionSchema.index({ docenteId: 1, periodoId: 1, alumnoId: 1, fechaEvidencia: -1 });
EvidenciaEvaluacionSchema.index(
  { docenteId: 1, 'classroom.courseId': 1, 'classroom.courseWorkId': 1, 'classroom.submissionId': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'classroom.submissionId': { $type: 'string' }
    }
  }
);

export const EvidenciaEvaluacion =
  models.EvidenciaEvaluacion ?? model('EvidenciaEvaluacion', EvidenciaEvaluacionSchema);
