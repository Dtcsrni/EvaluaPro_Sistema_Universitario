/**
 * mensajeInline
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import type { TipoMensaje } from '../../ui/ux/componentes/InlineMensaje';

/**
 * Clasifica mensajes cortos mostrados debajo de formularios.
 *
 * Regla general:
 * - `error`: fallos accionables (credenciales invalidas, validaciones, etc.)
 * - `ok`: confirmaciones positivas (cambios guardados, etc.)
 * - `info`: estados neutrales/guia (pasos siguientes, invitacion a registrar, etc.)
 */
export function tipoMensajeInline(texto: string): TipoMensaje {
  const textoEnMinusculas = String(texto || '').trim().toLowerCase();
  if (!textoEnMinusculas) return 'info';

  // Casos informativos que no deben pintarse como OK.
  if (textoEnMinusculas.includes('no existe una cuenta')) return 'info';
  if (textoEnMinusculas.includes('completa tus datos')) return 'info';
  if (textoEnMinusculas.includes('reautentica') || textoEnMinusculas.includes('reautentica')) return 'info';
  if (textoEnMinusculas.includes('google listo')) return 'info';

  // Errores comunes.
  if (textoEnMinusculas.includes('incorrect')) return 'error';
  if (textoEnMinusculas.includes('no se pudo')) return 'error';
  if (textoEnMinusculas.includes('no se recibio') || textoEnMinusculas.includes('no se recibió')) return 'error';
  if (textoEnMinusculas.includes('no permitido') || textoEnMinusculas.includes('no se permite')) return 'error';
  if (textoEnMinusculas.includes('falta')) return 'error';
  if (textoEnMinusculas.includes('inval') || textoEnMinusculas.includes('invál')) return 'error';
  if (textoEnMinusculas.includes('error')) return 'error';

  // Confirmaciones positivas.
  if (textoEnMinusculas.includes('actualizada') || textoEnMinusculas.includes('actualizado')) return 'ok';
  if (textoEnMinusculas.includes('guardada') || textoEnMinusculas.includes('guardado')) return 'ok';
  if (textoEnMinusculas.includes('sesion iniciada') || textoEnMinusculas.includes('sesión iniciada')) return 'ok';
  if (textoEnMinusculas.includes('cuenta creada')) return 'ok';

  // Por defecto, preferimos info para evitar falsos "éxito".
  return 'info';
}
