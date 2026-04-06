import { Schema, model, models, Types } from 'mongoose';

const RecuperacionContrasenaSchema = new Schema(
  {
    docenteId: { type: Types.ObjectId, ref: 'Docente', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiraEn: { type: Date, required: true },
    solicitadoIp: { type: String },
    usadoEn: { type: Date },
    usadoIp: { type: String }
  },
  { timestamps: true, collection: 'recuperacionContrasenaDocente' }
);

RecuperacionContrasenaSchema.index({ expiraEn: 1 }, { expireAfterSeconds: 0 });

export const RecuperacionContrasenaDocente =
  models.RecuperacionContrasenaDocente ?? model('RecuperacionContrasenaDocente', RecuperacionContrasenaSchema);
