/**
 * Resultado publicado para portal alumno.
 */
import { Schema, model, models } from 'mongoose';

const ResultadoAlumnoSchema = new Schema(
  {
    periodoId: { type: Schema.Types.ObjectId, required: true },
    docenteId: { type: Schema.Types.ObjectId, required: true },
    alumnoId: { type: Schema.Types.ObjectId, required: true },
    examenGeneradoId: { type: Schema.Types.ObjectId },
    matricula: { type: String, required: true },
    nombreCompleto: { type: String, required: true },
    grupo: { type: String },
    folio: { type: String, required: true },
    tipoExamen: { type: String, enum: ['parcial', 'global'], required: true },
    totalReactivos: { type: Number },
    aciertos: { type: Number },
    calificacionExamenFinalTexto: { type: String, required: true },
    calificacionParcialTexto: { type: String },
    calificacionGlobalTexto: { type: String },
    evaluacionContinuaTexto: { type: String },
    proyectoTexto: { type: String },
    politicaId: { type: Schema.Types.ObjectId },
    versionPolitica: { type: Number },
    componentesExamen: { type: Schema.Types.Mixed },
    bloqueContinuaDecimal: { type: Number },
    bloqueExamenesDecimal: { type: Number },
    finalDecimal: { type: Number },
    finalRedondeada: { type: Number },
    respuestasDetectadas: { type: [Schema.Types.Mixed], default: [] },
    comparativaRespuestas: { type: [Schema.Types.Mixed], default: [] },
    omrCapturas: { type: [Schema.Types.Mixed], default: [] },
    omrAuditoria: { type: Schema.Types.Mixed },
    banderas: { type: [Schema.Types.Mixed], default: [] },
    pdfComprimidoBase64: { type: String },
    publicadoEn: { type: Date, default: Date.now }
  },
  { timestamps: true, collection: 'resultadosAlumno' }
);

ResultadoAlumnoSchema.index({ folio: 1 }, { unique: true });
ResultadoAlumnoSchema.index({ matricula: 1, periodoId: 1 });

export const ResultadoAlumno = models.ResultadoAlumno ?? model('ResultadoAlumno', ResultadoAlumnoSchema);
