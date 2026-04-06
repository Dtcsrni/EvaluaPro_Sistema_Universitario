import { Schema, model, models } from 'mongoose';

const AuditoriaComercialSchema = new Schema(
  {
    actorDocenteId: { type: Schema.Types.ObjectId, ref: 'Docente' },
    tenantId: { type: String, trim: true, lowercase: true },
    accion: { type: String, required: true, trim: true },
    recurso: { type: String, required: true, trim: true },
    recursoId: { type: String, trim: true },
    origen: { type: String, default: 'panel_admin_negocio' },
    ip: { type: String },
    diff: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'comercialAuditoria' }
);

AuditoriaComercialSchema.index({ createdAt: -1, accion: 1 });
AuditoriaComercialSchema.index({ tenantId: 1, createdAt: -1 });

export const AuditoriaComercial =
  models.AuditoriaComercial ?? model('AuditoriaComercial', AuditoriaComercialSchema);
