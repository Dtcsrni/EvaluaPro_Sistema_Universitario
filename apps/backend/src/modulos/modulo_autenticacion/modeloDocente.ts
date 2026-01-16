/**
 * Modelo Docente para autenticacion y ownership de datos.
 */
import { Schema, model, models } from 'mongoose';

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

export const Docente = models.Docente ?? model('Docente', DocenteSchema);
