/**
 * Modelo de examenes plantilla (parcial/global).
 */
import { Schema, model, models } from 'mongoose';

export function normalizarTituloPlantilla(titulo: string): string {
  return String(titulo ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const ExamenPlantillaSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    periodoId: { type: Schema.Types.ObjectId, ref: 'Periodo' },
    tipo: { type: String, enum: ['parcial', 'global'], required: true },
    titulo: { type: String, required: true },
    tituloNormalizado: { type: String, required: true },
    instrucciones: { type: String },
    // El tamaño del examen se define por páginas.
    numeroPaginas: { type: Number, required: true, default: 1 },
    reactivosObjetivo: { type: Number, min: 1, max: 200, default: 20 },
    defaultVersionCount: { type: Number, min: 1, max: 12, default: 1 },
    answerKeyMode: { type: String, enum: ['digital', 'scan_sheet'], default: 'digital' },
    preguntasIds: [{ type: Schema.Types.ObjectId, ref: 'BancoPregunta' }],
    temas: [{ type: String }],
    archivadoEn: { type: Date },
    bookletConfig: {
      targetPages: { type: Number, min: 1, max: 50, default: 2 },
      densityMode: { type: String, enum: ['balanced', 'compact', 'relaxed'], default: 'balanced' },
      allowImages: { type: Boolean, default: true },
      imageBudgetPolicy: { type: String, enum: ['strict', 'balanced'], default: 'balanced' },
      headerStyle: { type: String, enum: ['institutional', 'compact'], default: 'institutional' },
      fontScale: { type: Number, min: 0.8, max: 1.3, default: 1 },
      lineSpacing: { type: Number, min: 0.9, max: 1.6, default: 1.1 },
      separateCoverPage: { type: Boolean, default: false }
    },
    omrConfig: {
      sheetFamilyCode: { type: String, default: 'S50_5A_ID5_VR6' },
      sheetRevisionId: { type: String },
      prefillMode: { type: String, enum: ['none', 'roster', 'per-student'], default: 'none' },
      identityMode: { type: String, enum: ['qr_plus_bubbled_id'], default: 'qr_plus_bubbled_id' },
      allowBlankGenericSheets: { type: Boolean, default: true },
      versionMode: { type: String, enum: ['single', 'multi_version'], default: 'single' },
      ignoreUnusedTrailingQuestions: { type: Boolean, default: true },
      captureMode: { type: String, enum: ['pdf_and_mobile'], default: 'pdf_and_mobile' }
    },
    configuracionPdf: {
      margenMm: { type: Number, default: 10 },
      layout: { type: String, default: 'parcial' }
    }
  },
  { timestamps: true, collection: 'examenesPlantilla' }
);

ExamenPlantillaSchema.pre('validate', function () {
  const self = this as unknown as { titulo?: unknown; tituloNormalizado?: string };
  self.tituloNormalizado = normalizarTituloPlantilla(String(self.titulo ?? ''));
});

export const ExamenPlantilla = models.ExamenPlantilla ?? model('ExamenPlantilla', ExamenPlantillaSchema);
