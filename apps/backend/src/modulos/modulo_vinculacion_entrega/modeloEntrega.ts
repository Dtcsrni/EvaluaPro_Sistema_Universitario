/**
 * Modelo de entregas (vinculacion examen-alumno).
 */
import { Schema, model, models } from 'mongoose';

const EntregaSchema = new Schema(
  {
    examenGeneradoId: { type: Schema.Types.ObjectId, ref: 'ExamenGenerado', required: true },
    alumnoId: { type: Schema.Types.ObjectId, ref: 'Alumno', required: true },
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    estado: { type: String, enum: ['pendiente', 'entregado'], default: 'pendiente' },
    fechaEntrega: { type: Date },
    acordeonEntregado: { type: Boolean, default: false },
    bonoAcordeon: { type: Number, min: 0, max: 0.5, default: 0 },
    motivoDeshacer: { type: String }
  },
  { timestamps: true, collection: 'entregas' }
);

export const Entrega = models.Entrega ?? model('Entrega', EntregaSchema);
