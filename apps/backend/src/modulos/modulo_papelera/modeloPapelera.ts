/**
 * Modelo de papelera (borrado suave) con expiracion automatica.
 */
import { Schema, model, models } from 'mongoose';

const PapeleraSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    tipo: { type: String, enum: ['periodo', 'alumno', 'plantilla'], required: true },
    entidadId: { type: Schema.Types.ObjectId, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    eliminadoEn: { type: Date, default: Date.now },
    expiraEn: { type: Date, required: true }
  },
  { timestamps: true, collection: 'papelera' }
);

// TTL: elimina automaticamente al vencer expiraEn.
PapeleraSchema.index({ expiraEn: 1 }, { expireAfterSeconds: 0 });

export const Papelera = models.Papelera ?? model('Papelera', PapeleraSchema);
