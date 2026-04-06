import { Schema, model, models } from 'mongoose';

const LicenciaSchema = new Schema(
  {
    tenantId: { type: String, required: true, trim: true, lowercase: true },
    tipo: { type: String, enum: ['saas', 'onprem'], required: true },
    tokenLicencia: { type: String, required: true, unique: true },
    tokenLicenciaHash: { type: String, required: true, unique: true },
    codigoActivacion: { type: String, required: true, unique: true },
    expiraEn: { type: Date, required: true },
    graciaOfflineDias: { type: Number, default: 7, min: 1, max: 30 },
    estado: { type: String, enum: ['generada', 'activa', 'revocada', 'expirada'], default: 'generada' },
    activadaEn: { type: Date },
    ultimoHeartbeatEn: { type: Date },
    ultimoCanalRelease: { type: String, enum: ['stable', 'beta'], default: 'stable' },
    dispositivoVinculadoHash: { type: String },
    nonceUltimo: { type: String },
    contadorHeartbeat: { type: Number, default: 0, min: 0 },
    intentosFallidos: { type: Number, default: 0, min: 0 },
    puntajeAnomalia: { type: Number, default: 0, min: 0 },
    revocadaRazon: { type: String },
    metaDispositivo: {
      huella: { type: String },
      host: { type: String },
      versionInstalada: { type: String }
    }
  },
  { timestamps: true, collection: 'comercialLicencias' }
);

LicenciaSchema.index({ tenantId: 1, estado: 1 });
LicenciaSchema.index({ expiraEn: 1, estado: 1 });
LicenciaSchema.index({ tenantId: 1, dispositivoVinculadoHash: 1 });

export const Licencia = models.Licencia ?? model('Licencia', LicenciaSchema);
