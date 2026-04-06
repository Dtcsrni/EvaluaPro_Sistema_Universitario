/**
 * Solicitudes de revision iniciadas por alumno desde el portal cloud.
 *
 * Este read-model local permite que el docente revise solicitudes por pregunta
 * aun cuando no este conectado permanentemente al portal.
 */
import { Schema, model, models } from 'mongoose';

const SolicitudRevisionAlumnoSchema = new Schema(
  {
    externoId: { type: String, required: true, unique: true },
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true, index: true },
    periodoId: { type: Schema.Types.ObjectId, ref: 'Periodo' },
    alumnoId: { type: Schema.Types.ObjectId, ref: 'Alumno' },
    examenGeneradoId: { type: Schema.Types.ObjectId, ref: 'ExamenGenerado' },
    folio: { type: String, required: true, index: true },
    numeroPregunta: { type: Number, required: true },
    comentario: { type: String },
    estado: { type: String, enum: ['pendiente', 'atendida', 'rechazada'], default: 'pendiente', index: true },
    solicitadoEn: { type: Date, required: true },
    atendidoEn: { type: Date },
    respuestaDocente: { type: String },
    firmaDocente: { type: String },
    firmadoEn: { type: Date },
    cerradoEn: { type: Date },
    alumnoNombreCompleto: { type: String },
    conformidadAlumno: { type: Boolean, default: false },
    conformidadActualizadaEn: { type: Date },
    origen: { type: String, default: 'portal' }
  },
  { timestamps: true, collection: 'solicitudesRevisionAlumno' }
);

SolicitudRevisionAlumnoSchema.index({ docenteId: 1, estado: 1, solicitadoEn: -1 });
SolicitudRevisionAlumnoSchema.index({ docenteId: 1, folio: 1, numeroPregunta: 1 });

export const SolicitudRevisionAlumno =
  models.SolicitudRevisionAlumno ?? model('SolicitudRevisionAlumno', SolicitudRevisionAlumnoSchema);
