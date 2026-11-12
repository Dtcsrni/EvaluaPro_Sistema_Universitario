/**
 * Tokens JWT para sesiones de docente.
 *
 * - Firma con `configuracion.jwtSecreto`.
 * - Expira segun `configuracion.jwtExpiraHoras`.
 * - Por defecto (secret string) jsonwebtoken usa HS256.
 */
import jwt from 'jsonwebtoken';
import { configuracion } from '../../configuracion.js';

export type TokenDocentePayload = {
  docenteId: string;
  roles?: string[];
  apiCredentialId?: string;
};

/**
 * Crea un JWT para el docente autenticado.
 */
export function crearTokenDocente(payload: TokenDocentePayload) {
  return jwt.sign(payload, configuracion.jwtSecreto, {
    expiresIn: `${configuracion.jwtExpiraHoras}h`
  });
}

/** Token de acceso delegado, limitado por una credencial revocable y una vida de 15 minutos. */
export function crearTokenApiDelegado(payload: TokenDocentePayload & { apiCredentialId: string }) {
  return jwt.sign(payload, configuracion.jwtSecreto, { expiresIn: '15m' });
}

/**
 * Verifica el JWT y devuelve el payload tipado.
 * Lanza error si el token es invalido o expiro.
 */
export function verificarTokenDocente(token: string): TokenDocentePayload {
  return jwt.verify(token, configuracion.jwtSecreto) as TokenDocentePayload;
}
