/**
 * Error estándar para respuestas controladas del API.
 *
 * Se usa para construir el "envelope" de error consistente:
 * `{ error: { codigo, mensaje, detalles? } }`.
 *
 * Notas:
 * - `codigo` debe ser estable (orientado a máquina) para que el frontend pueda
 *   mapearlo a mensajes amigables.
 * - `detalles` se usa principalmente para errores de validación (p. ej. `zod.flatten()`).
 */
export class ErrorAplicacion extends Error {
  codigo: string;
  estadoHttp: number;
  detalles?: unknown;

  constructor(codigo: string, mensaje: string, estadoHttp = 400, detalles?: unknown) {
    super(mensaje);
    this.codigo = codigo;
    this.estadoHttp = estadoHttp;
    this.detalles = detalles;
  }
}
