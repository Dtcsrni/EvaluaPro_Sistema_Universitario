import { Schema, model, models } from 'mongoose';

const ReconstruccionExamenSchema = new Schema(
  {
    tipo: { type: String, enum: ['manifest', 'bundle'], required: true },
    estado: {
      type: String,
      enum: ['pendiente', 'verificada', 'reconstruida', 'conflicto', 'fallida'],
      required: true,
      default: 'pendiente'
    },
    docenteSolicitanteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    docenteDestinoId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    bundleHash: { type: String, index: true },
    manifestHash: { type: String, index: true },
    loteId: { type: String, index: true },
    examId: { type: String, index: true },
    folio: { type: String, index: true },
    signatureValid: { type: Boolean },
    recoverable: { type: Boolean },
    causes: { type: [String], default: [] },
    reconstructedQuestionBankIds: { type: [Schema.Types.ObjectId], ref: 'BancoPregunta', default: [] },
    reconstructedExamIds: { type: [Schema.Types.ObjectId], ref: 'ExamenGenerado', default: [] },
    conflicts: { type: [Schema.Types.Mixed], default: [] },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'reconstruccionesExamenes' }
);

ReconstruccionExamenSchema.index(
  { tipo: 1, docenteDestinoId: 1, bundleHash: 1, manifestHash: 1 },
  { unique: true, sparse: true }
);

export const ReconstruccionExamen =
  models.ReconstruccionExamen ?? model('ReconstruccionExamen', ReconstruccionExamenSchema);
