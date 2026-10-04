/**
 * tesseract-js
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
declare module 'tesseract.js' {
  export type Worker = {
    recognize(image: string | Blob | HTMLCanvasElement | HTMLImageElement): Promise<{
      data?: { text?: string };
    }>;
    terminate(): Promise<unknown>;
  };

  export function createWorker(languages?: string): Promise<Worker>;
}
