import { Schema, model, models } from 'mongoose';

const IntegracionClassroomSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    correoGoogle: { type: String, trim: true, lowercase: true },
    googleUserId: { type: String, trim: true },
    refreshTokenCifrado: { type: String, required: true },
    scope: { type: String, trim: true },
    accessTokenUltimoCifrado: { type: String },
    accessTokenExpiraEn: { type: Date },
    ultimaSincronizacionEn: { type: Date },
    ultimoError: { type: String, trim: true },
    activo: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'integracionesClassroom' }
);

IntegracionClassroomSchema.index({ docenteId: 1 }, { unique: true });
IntegracionClassroomSchema.index({ googleUserId: 1 }, { sparse: true });

export const IntegracionClassroom =
  models.IntegracionClassroom ?? model('IntegracionClassroom', IntegracionClassroomSchema);
