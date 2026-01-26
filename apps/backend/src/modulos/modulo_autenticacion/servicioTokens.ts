/**
 * Tokens JWT para sesiones de docente.
 *
 * - Firma con `configuracion.jwtSecreto`.
 * - Expira segun `configuracion.jwtExpiraHoras`.
 * - Por defecto (secret string) jsonwebtoken usa HS256.
 */
import jwt from 'jsonwebtoken';
import { configuracion } from '../../configuracion';

export type TokenDocentePayload = {
  docenteId: string;
  roles?: string[];
};

/**
 * Crea un JWT para el docente autenticado.
 */
export function crearTokenDocente(payload: TokenDocentePayload) {
  return jwt.sign(payload, configuracion.jwtSecreto, {
    expiresIn: `${configuracion.jwtExpiraHoras}h`
  });
}

/**
 * Verifica el JWT y devuelve el payload tipado.
 * Lanza error si el token es invalido o expiro.
 */
export function verificarTokenDocente(token: string): TokenDocentePayload {
  return jwt.verify(token, configuracion.jwtSecreto) as TokenDocentePayload;
}
