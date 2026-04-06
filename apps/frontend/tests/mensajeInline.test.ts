/**
 * mensajeInline.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { describe, expect, it } from 'vitest';
import { tipoMensajeInline } from '../src/apps/app_docente/mensajeInline';

describe('tipoMensajeInline', () => {
  it('clasifica credenciales incorrectas como error', () => {
    expect(tipoMensajeInline('Correo o contrasena incorrectos.')).toBe('error');
  });

  it('clasifica invitacion a registrar como info', () => {
    expect(tipoMensajeInline('No existe una cuenta para ese correo. Completa tus datos para registrarte.')).toBe('info');
  });

  it('clasifica confirmaciones como ok', () => {
    expect(tipoMensajeInline('Contrasena actualizada')).toBe('ok');
  });

  it('por defecto usa info', () => {
    expect(tipoMensajeInline('Algo paso.')).toBe('info');
  });
});
