import { Schema, model, models } from 'mongoose';

const CuponSchema = new Schema(
  {
    codigo: { type: String, required: true, unique: true, trim: true, uppercase: true },
    tipoDescuento: { type: String, enum: ['porcentaje', 'monto_fijo'], required: true },
    valorDescuento: { type: Number, required: true, min: 0 },
    moneda: { type: String, default: 'MXN', trim: true, uppercase: true },
    vigenciaInicio: { type: Date, required: true },
    vigenciaFin: { type: Date, required: true },
    usoMaximo: { type: Number, default: 1, min: 1 },
    usosActuales: { type: Number, default: 0, min: 0 },
    activo: { type: Boolean, default: true },
    restricciones: {
      planesPermitidos: { type: [String], default: [] },
      personasPermitidas: { type: [String], default: [] },
      nuevosClientesSolo: { type: Boolean, default: false }
    }
  },
  { timestamps: true, collection: 'comercialCupones' }
);

CuponSchema.index({ activo: 1, vigenciaInicio: 1, vigenciaFin: 1 });

export const Cupon = models.Cupon ?? model('Cupon', CuponSchema);
