import { Schema, model, models } from 'mongoose';

const TenantSchema = new Schema(
  {
    tenantId: { type: String, required: true, unique: true, trim: true, lowercase: true },
    nombre: { type: String, required: true, trim: true },
    tipoTenant: { type: String, enum: ['smb', 'enterprise', 'partner'], default: 'smb' },
    modalidad: { type: String, enum: ['saas', 'onprem'], required: true },
    estado: { type: String, enum: ['lead', 'trial', 'activo', 'past_due', 'suspendido', 'cancelado'], default: 'lead' },
    pais: { type: String, default: 'MX', trim: true, uppercase: true },
    moneda: { type: String, default: 'MXN', trim: true, uppercase: true },
    ownerDocenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    contacto: {
      correo: { type: String, trim: true, lowercase: true },
      telefono: { type: String, trim: true },
      nombre: { type: String, trim: true }
    },
    configAislamiento: {
      estrategia: { type: String, enum: ['shared', 'dedicated'], default: 'shared' },
      databaseUri: { type: String },
      databaseName: { type: String }
    },
    tags: { type: [String], default: [] }
  },
  { timestamps: true, collection: 'comercialTenants' }
);

TenantSchema.index({ estado: 1, modalidad: 1 });
TenantSchema.index({ ownerDocenteId: 1, createdAt: -1 });

export const Tenant = models.Tenant ?? model('Tenant', TenantSchema);
