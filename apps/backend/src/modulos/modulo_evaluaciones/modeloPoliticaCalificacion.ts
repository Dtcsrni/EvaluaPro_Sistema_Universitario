import { Schema, model, models } from 'mongoose';

export const CODIGOS_POLITICA = ['POLICY_SV_EXCEL_2026', 'POLICY_LISC_ENCUADRE_2026'] as const;
export type CodigoPoliticaCalificacion = (typeof CODIGOS_POLITICA)[number];

const PoliticaCalificacionSchema = new Schema(
  {
    codigo: { type: String, enum: CODIGOS_POLITICA, required: true },
    version: { type: Number, required: true, min: 1 },
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, trim: true },
    activa: { type: Boolean, default: true },
    parametros: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'politicasCalificacion' }
);

PoliticaCalificacionSchema.index({ codigo: 1, version: 1 }, { unique: true });
PoliticaCalificacionSchema.index({ activa: 1, codigo: 1 });

export const PoliticaCalificacion =
  models.PoliticaCalificacion ?? model('PoliticaCalificacion', PoliticaCalificacionSchema);
