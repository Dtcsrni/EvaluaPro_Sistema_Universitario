/**
 * Tokens de sesion para portal alumno.
 *
 * - Se genera un token aleatorio para el cliente.
 * - Se calcula un hash (SHA-256) para persistencia/lookup.
 * - Nunca se guarda el token en texto plano.
 */
import { createHash, randomBytes } from 'crypto';

/**
 * Genera un token (hex) y su hash.
 */
export function generarTokenSesion() {
  const token = randomBytes(24).toString('hex');
  const hash = createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

/**
 * Hash deterministico para comparar tokens sin persistirlos.
 */
export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
