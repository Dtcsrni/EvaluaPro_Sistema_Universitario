import { Schema, model, models } from 'mongoose';
import { CODIGOS_POLITICA } from './modeloPoliticaCalificacion';

const ConfiguracionPeriodoEvaluacionSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    periodoId: { type: Schema.Types.ObjectId, ref: 'Periodo', required: true },
    politicaCodigo: { type: String, enum: CODIGOS_POLITICA, required: true },
    politicaVersion: { type: Number, required: true, min: 1, default: 1 },
    cortes: [
      {
        numero: { type: Number, enum: [1, 2, 3], required: true },
        nombre: { type: String, trim: true },
        fechaCorte: { type: Date, required: true },
        pesoContinua: { type: Number, required: true, min: 0, max: 1, default: 0.5 },
        pesoExamen: { type: Number, required: true, min: 0, max: 1, default: 0.5 },
        pesoBloqueExamenes: { type: Number, required: true, min: 0, max: 1, default: 0 }
      }
    ],
    pesosGlobales: {
      continua: { type: Number, required: true, min: 0, max: 1, default: 0.5 },
      examenes: { type: Number, required: true, min: 0, max: 1, default: 0.5 }
    },
    pesosExamenes: {
      parcial1: { type: Number, required: true, min: 0, max: 1, default: 0.2 },
      parcial2: { type: Number, required: true, min: 0, max: 1, default: 0.2 },
      global: { type: Number, required: true, min: 0, max: 1, default: 0.6 }
    },
    reglasCierre: {
      requiereTeorico: { type: Boolean, default: true },
      requierePractica: { type: Boolean, default: true },
      requiereContinuaMinima: { type: Boolean, default: false },
      continuaMinima: { type: Number, min: 0, max: 10, default: 0 }
    },
    activo: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'configuracionesPeriodoEvaluacion' }
);

ConfiguracionPeriodoEvaluacionSchema.index({ docenteId: 1, periodoId: 1 }, { unique: true });

export const ConfiguracionPeriodoEvaluacion =
  models.ConfiguracionPeriodoEvaluacion ??
  model('ConfiguracionPeriodoEvaluacion', ConfiguracionPeriodoEvaluacionSchema);
