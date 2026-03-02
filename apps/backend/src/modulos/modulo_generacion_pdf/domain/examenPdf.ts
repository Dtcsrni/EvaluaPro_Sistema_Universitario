/**
 * Entidad de dominio ExamenPdf.
 * 
 * Representa un examen en su forma PDF con todas las metadata necesarias
 * para su generacion, renderizado y escaneo OMR posterior.
 */
import type {
  EncabezadoExamen,
  MapaVariante,
  PreguntaBase,
  TemplateVersion,
  TipoExamen
} from '../shared/tiposPdf';

export interface LayoutExamenConfig {
  margenMm: number;
  templateVersion: TemplateVersion;
  totalPaginas: number;
}

export class ExamenPdf {
  constructor(
    public readonly titulo: string,
    public readonly folio: string,
    public readonly examId: string | undefined,
    public readonly preguntas: PreguntaBase[],
    public readonly mapaVariante: MapaVariante,
    public readonly tipoExamen: TipoExamen,
    public readonly layout: LayoutExamenConfig,
    public readonly encabezado?: EncabezadoExamen
  ) {
    // Validaciones de negocio
    if (!folio || folio.trim().length === 0) {
      throw new Error('El folio del examen es obligatorio');
    }
    if (preguntas.length === 0) {
      throw new Error('El examen debe contener al menos una pregunta');
    }
    if (layout.totalPaginas < 1) {
      throw new Error('El examen debe tener al menos una pagina');
    }
  }

  get totalPreguntas(): number {
    return this.preguntas.length;
  }

  get folioNormalizado(): string {
    return this.folio.trim().toUpperCase();
  }

  get examIdNormalizado(): string {
    return String(this.examId ?? '').trim().toUpperCase();
  }

  /**
   * Genera el texto QR para una pagina especifica.
   */
  generarTextoQrPagina(numeroPagina: number): string {
    const base = `EXAMEN:${this.folioNormalizado}:P${numeroPagina}:TV${this.layout.templateVersion}`;
    return this.examIdNormalizado ? `${base}:ID:${this.examIdNormalizado}` : base;
  }
}
