/**
 * Modelo de calificaciones con fraccion exacta.
 */
import { Schema, model, models } from 'mongoose';

const CalificacionSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    periodoId: { type: Schema.Types.ObjectId, ref: 'Periodo' },
    examenGeneradoId: { type: Schema.Types.ObjectId, ref: 'ExamenGenerado', required: true },
    alumnoId: { type: Schema.Types.ObjectId, ref: 'Alumno', required: true },
    tipoExamen: { type: String, enum: ['parcial', 'global'], required: true },
    totalReactivos: { type: Number, required: true },
    aciertos: { type: Number, required: true },
    fraccion: {
      numerador: { type: String, required: true },
      denominador: { type: String, required: true }
    },
    calificacionExamenTexto: { type: String, required: true },
    bonoTexto: { type: String, required: true },
    calificacionExamenFinalTexto: { type: String, required: true },
    evaluacionContinuaTexto: { type: String },
    proyectoTexto: { type: String },
    calificacionParcialTexto: { type: String },
    calificacionGlobalTexto: { type: String },
    retroalimentacion: { type: String },
    respuestasDetectadas: { type: Schema.Types.Mixed },
    omrAuditoria: { type: Schema.Types.Mixed },
    politicaId: { type: Schema.Types.ObjectId, ref: 'PoliticaCalificacion' },
    versionPolitica: { type: Number, min: 1 },
    componentesExamen: { type: Schema.Types.Mixed },
    bloqueContinuaDecimal: { type: Number, min: 0, max: 10 },
    bloqueExamenesDecimal: { type: Number, min: 0, max: 10 },
    finalDecimal: { type: Number, min: 0, max: 10 },
    finalRedondeada: { type: Number, min: 0, max: 10 }
  },
  { timestamps: true, collection: 'calificaciones' }
);

export const Calificacion = models.Calificacion ?? model('Calificacion', CalificacionSchema);
