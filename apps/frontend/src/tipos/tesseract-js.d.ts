/**
 * tesseract-js
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
declare module 'tesseract.js' {
  export type RecognizeResult = {
    data?: {
      text?: string;
    };
  };

  export function recognize(
    image: string | Blob | HTMLCanvasElement | HTMLImageElement,
    languages?: string
  ): Promise<RecognizeResult>;
}
