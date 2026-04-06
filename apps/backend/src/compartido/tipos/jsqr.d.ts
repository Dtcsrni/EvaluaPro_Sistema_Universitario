/**
 * jsqr
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Tipos minimos para el modulo jsqr usado en OMR.
declare module 'jsqr' {
  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: {
      inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst';
    }
  ): { data: string } | null;
}
