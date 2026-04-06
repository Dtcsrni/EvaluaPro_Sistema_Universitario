import { Schema, model, models } from 'mongoose';
import { CODIGOS_POLITICA } from './modeloPoliticaCalificacion';

const ResumenEvaluacionAlumnoSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    periodoId: { type: Schema.Types.ObjectId, ref: 'Periodo', required: true },
    alumnoId: { type: Schema.Types.ObjectId, ref: 'Alumno', required: true },
    politicaCodigo: { type: String, enum: CODIGOS_POLITICA, required: true },
    politicaVersion: { type: Number, required: true, min: 1 },
    continuaPorCorte: {
      c1: { type: Number, min: 0, max: 10, default: 0 },
      c2: { type: Number, min: 0, max: 10, default: 0 },
      c3: { type: Number, min: 0, max: 10, default: 0 }
    },
    examenesPorCorte: {
      parcial1: { type: Number, min: 0, max: 10, default: 0 },
      parcial2: { type: Number, min: 0, max: 10, default: 0 },
      global: { type: Number, min: 0, max: 10, default: 0 }
    },
    bloqueContinuaDecimal: { type: Number, min: 0, max: 10, required: true },
    bloqueExamenesDecimal: { type: Number, min: 0, max: 10, required: true },
    finalDecimal: { type: Number, min: 0, max: 10, required: true },
    finalRedondeada: { type: Number, min: 0, max: 10, required: true },
    estado: { type: String, enum: ['completo', 'incompleto'], default: 'incompleto' },
    faltantes: [{ type: String }],
    auditoria: { type: Schema.Types.Mixed },
    calculadoEn: { type: Date, default: Date.now }
  },
  { timestamps: true, collection: 'resumenesEvaluacionAlumno' }
);

ResumenEvaluacionAlumnoSchema.index({ docenteId: 1, periodoId: 1, alumnoId: 1 }, { unique: true });

export const ResumenEvaluacionAlumno =
  models.ResumenEvaluacionAlumno ?? model('ResumenEvaluacionAlumno', ResumenEvaluacionAlumnoSchema);
