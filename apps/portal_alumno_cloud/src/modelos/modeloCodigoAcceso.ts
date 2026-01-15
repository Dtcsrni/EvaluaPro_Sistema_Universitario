/**
 * Codigo de acceso para portal alumno (cloud).
 */
import { Schema, model, models } from 'mongoose';

const CodigoAccesoSchema = new Schema(
  {
    periodoId: { type: Schema.Types.ObjectId, required: true },
    codigo: { type: String, required: true },
    expiraEn: { type: Date, required: true },
    usado: { type: Boolean, default: false }
  },
  { timestamps: true, collection: 'codigosAcceso' }
);

CodigoAccesoSchema.index({ codigo: 1 }, { unique: true });

export const CodigoAcceso = models.CodigoAcceso ?? model('CodigoAcceso', CodigoAccesoSchema);
