/**
 * Modelo Docente para autenticacion y ownership de datos.
 */
import { Schema, model, models } from 'mongoose';
import { aTituloPropio } from '../../compartido/utilidades/texto';

const DocenteSchema = new Schema(
  {
    nombres: { type: String },
    apellidos: { type: String },
    nombreCompleto: { type: String, required: true },
    correo: { type: String, required: true, unique: true, lowercase: true },
    hashContrasena: { type: String },
    googleSub: { type: String },
    roles: { type: [String], default: [] },
    activo: { type: Boolean, default: true },
    ultimoAcceso: { type: Date }
  },
  { timestamps: true, collection: 'docentes' }
);

DocenteSchema.pre('validate', function () {
  const get = (this as unknown as { get: (k: string) => unknown }).get.bind(this);
  const set = (this as unknown as { set: (k: string, v: unknown) => void }).set.bind(this);

  const nombres = aTituloPropio(String(get('nombres') ?? ''));
  const apellidos = aTituloPropio(String(get('apellidos') ?? ''));
  const nombreCompleto = aTituloPropio(String(get('nombreCompleto') ?? ''));

  if (nombres) set('nombres', nombres);
  if (apellidos) set('apellidos', apellidos);
  if (nombreCompleto) set('nombreCompleto', nombreCompleto);
});

export const Docente = models.Docente ?? model('Docente', DocenteSchema);
