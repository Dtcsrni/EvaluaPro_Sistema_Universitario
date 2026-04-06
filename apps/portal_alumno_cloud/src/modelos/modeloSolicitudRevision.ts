/**
 * Solicitudes de revision creadas por alumnos desde el portal.
 *
 * Se almacenan en el portal para:
 * - Persistir el estado visible para alumno.
 * - Sincronizar con el backend docente por lotes.
 */
import { Schema, model, models } from 'mongoose';

const SolicitudRevisionSchema = new Schema(
  {
    externoId: { type: String, required: true, unique: true },
    periodoId: { type: Schema.Types.ObjectId, required: true, index: true },
    docenteId: { type: Schema.Types.ObjectId, required: true, index: true },
    alumnoId: { type: Schema.Types.ObjectId, required: true, index: true },
    examenGeneradoId: { type: Schema.Types.ObjectId },
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
    conformidadAlumno: { type: Boolean, default: false },
    conformidadActualizadaEn: { type: Date },
    origen: { type: String, default: 'portal' }
  },
  { timestamps: true, collection: 'solicitudesRevisionPortal' }
);

SolicitudRevisionSchema.index({ docenteId: 1, estado: 1, updatedAt: -1 });
SolicitudRevisionSchema.index({ alumnoId: 1, folio: 1, numeroPregunta: 1 });

export const SolicitudRevision = models.SolicitudRevision ?? model('SolicitudRevision', SolicitudRevisionSchema);
