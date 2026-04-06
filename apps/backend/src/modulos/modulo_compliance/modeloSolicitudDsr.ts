/**
 * Modelo para solicitudes ARCO/DSR.
 */
import { Schema, model, models } from 'mongoose';

const SolicitudDsrSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true, index: true },
    tipo: {
      type: String,
      enum: ['acceso', 'rectificacion', 'cancelacion', 'oposicion'],
      required: true,
      index: true
    },
    titularRef: { type: String, required: true, trim: true },
    scope: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pendiente', 'en_proceso', 'resuelto', 'rechazado'],
      default: 'pendiente',
      index: true
    },
    requestedAt: { type: Date, required: true },
    resolvedAt: { type: Date },
    resolutionNote: { type: String, trim: true, default: '' }
  },
  { timestamps: true, collection: 'solicitudesDsr' }
);

SolicitudDsrSchema.index({ docenteId: 1, status: 1, requestedAt: -1 });

export const SolicitudDsr = models.SolicitudDsr ?? model('SolicitudDsr', SolicitudDsrSchema);
