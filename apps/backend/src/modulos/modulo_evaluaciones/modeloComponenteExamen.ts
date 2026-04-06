import { Schema, model, models } from 'mongoose';

const ComponenteExamenSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    periodoId: { type: Schema.Types.ObjectId, ref: 'Periodo', required: true },
    alumnoId: { type: Schema.Types.ObjectId, ref: 'Alumno', required: true },
    corte: { type: String, enum: ['parcial1', 'parcial2', 'global'], required: true },
    teoricoDecimal: { type: Number, min: 0, max: 10, required: true },
    practicas: [{ type: Number, min: 0, max: 10 }],
    practicaPromedioDecimal: { type: Number, min: 0, max: 10, required: true },
    examenCorteDecimal: { type: Number, min: 0, max: 10, required: true },
    origen: { type: String, enum: ['manual', 'omr'], default: 'manual' },
    examenGeneradoId: { type: Schema.Types.ObjectId, ref: 'ExamenGenerado' },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'componentesExamen' }
);

ComponenteExamenSchema.index({ docenteId: 1, periodoId: 1, alumnoId: 1, corte: 1 }, { unique: true });

export const ComponenteExamen = models.ComponenteExamen ?? model('ComponenteExamen', ComponenteExamenSchema);
