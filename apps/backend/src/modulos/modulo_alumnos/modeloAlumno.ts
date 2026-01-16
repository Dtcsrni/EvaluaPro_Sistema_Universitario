/**
 * Modelo Alumno.
 */
import { Schema, model, models } from 'mongoose';
import { aTituloPropio, normalizarMatricula } from '../../compartido/utilidades/texto';

const AlumnoSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    periodoId: { type: Schema.Types.ObjectId, ref: 'Periodo', required: true },
    matricula: { type: String, required: true },
    nombres: { type: String },
    apellidos: { type: String },
    nombreCompleto: { type: String, required: true },
    correo: { type: String },
    grupo: { type: String },
    activo: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'alumnos' }
);

AlumnoSchema.index({ docenteId: 1, periodoId: 1, matricula: 1 }, { unique: true });

AlumnoSchema.pre('validate', function () {
  const get = (this as unknown as { get: (k: string) => unknown }).get.bind(this);
  const set = (this as unknown as { set: (k: string, v: unknown) => void }).set.bind(this);

  const matricula = normalizarMatricula(String(get('matricula') ?? ''));
  set('matricula', matricula);

  const nombres = aTituloPropio(String(get('nombres') ?? ''));
  const apellidos = aTituloPropio(String(get('apellidos') ?? ''));
  const nombreCompletoActual = aTituloPropio(String(get('nombreCompleto') ?? ''));
  const nombreCompleto = nombreCompletoActual || `${nombres} ${apellidos}`.trim();

  if (nombres) set('nombres', nombres);
  if (apellidos) set('apellidos', apellidos);
  if (nombreCompleto) set('nombreCompleto', nombreCompleto);

  const correo = String(get('correo') ?? '').trim();
  if (!correo) set('correo', `${matricula}@cuh.mx`);
});

export const Alumno = models.Alumno ?? model('Alumno', AlumnoSchema);
