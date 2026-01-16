/**
 * Modelo Periodo academico.
 */
import { Schema, model, models } from 'mongoose';
import { aTituloPropio, normalizarEspacios } from '../../compartido/utilidades/texto';

export function normalizarNombrePeriodo(nombre: string): string {
  return normalizarEspacios(nombre).toLowerCase();
}

const PeriodoSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    nombre: { type: String, required: true, trim: true },
    nombreNormalizado: { type: String, required: true },
    fechaInicio: { type: Date, required: true },
    fechaFin: { type: Date, required: true },
    grupos: [{ type: String }],
    activo: { type: Boolean, default: true },
    archivadoEn: { type: Date },
    resumenArchivado: {
      alumnos: { type: Number },
      bancoPreguntas: { type: Number },
      plantillas: { type: Number },
      examenesGenerados: { type: Number },
      calificaciones: { type: Number },
      codigosAcceso: { type: Number }
    }
  },
  { timestamps: true, collection: 'periodos' }
);

PeriodoSchema.index({ docenteId: 1, nombreNormalizado: 1 });
PeriodoSchema.index({ docenteId: 1, activo: 1, createdAt: -1 });

PeriodoSchema.pre('validate', function () {
  const nombreTitulo = aTituloPropio(String((this as unknown as { get: (k: string) => unknown }).get('nombre') ?? ''));
  (this as unknown as { set: (k: string, v: unknown) => void }).set('nombre', nombreTitulo);
  (this as unknown as { set: (k: string, v: unknown) => void }).set('nombreNormalizado', normalizarNombrePeriodo(nombreTitulo));
});

export const Periodo = models.Periodo ?? model('Periodo', PeriodoSchema);
