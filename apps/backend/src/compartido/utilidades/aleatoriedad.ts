/**
 * Utilidades de aleatorizacion para ordenes de examen.
 */
import { randomInt } from 'node:crypto';

export function barajar<T>(items: T[]) {
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    // randomInt usa rechazo para evitar sesgo de modulo en el rango acotado.
    const j = randomInt(i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
