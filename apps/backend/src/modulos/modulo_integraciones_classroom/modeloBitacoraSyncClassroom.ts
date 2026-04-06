import { Schema, model, models } from 'mongoose';

const BitacoraSyncClassroomSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    periodoId: { type: Schema.Types.ObjectId, ref: 'Periodo', required: true },
    tipo: { type: String, enum: ['preview', 'ejecucion'], required: true },
    courseId: { type: String, trim: true },
    courseIds: [{ type: String, trim: true }],
    courseWorkIds: [{ type: String, trim: true }],
    resumen: {
      totalActividades: { type: Number, default: 0 },
      submissionsProcesadas: { type: Number, default: 0 },
      matched: { type: Number, default: 0 },
      unmatched: { type: Number, default: 0 },
      pending: { type: Number, default: 0 },
      graded: { type: Number, default: 0 },
      wouldCreate: { type: Number, default: 0 },
      wouldUpdate: { type: Number, default: 0 },
      importadas: { type: Number, default: 0 },
      actualizadas: { type: Number, default: 0 },
      omitidas: { type: Number, default: 0 }
    },
    actividades: [{ type: Schema.Types.Mixed }],
    errores: [{ type: Schema.Types.Mixed }],
    ejecutadoEn: { type: Date, default: Date.now }
  },
  { timestamps: true, collection: 'bitacoraSyncClassroom' }
);

BitacoraSyncClassroomSchema.index({ docenteId: 1, periodoId: 1, ejecutadoEn: -1 });

export const BitacoraSyncClassroom =
  models.BitacoraSyncClassroom ?? model('BitacoraSyncClassroom', BitacoraSyncClassroomSchema);
