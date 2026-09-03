/**
 * clienteApi.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas del cliente API docente.
import { describe, expect, it, vi } from 'vitest';
import {
  crearClienteApi,
  guardarTokenDocente,
  limpiarTokenDocente,
  obtenerTokenDocente
} from '../src/servicios_api/clienteApi';
import { mensajeUsuarioDeError } from '../src/servicios_api/clienteComun';

describe('clienteApi', () => {
  it('administra tokens persistentes y elimina el token de pestaña', () => {
    sessionStorage.setItem('tokenDocente', 'token-anterior');
    expect(guardarTokenDocente('token-prueba')).toBe(true);
    expect(obtenerTokenDocente()).toBe('token-prueba');
    expect(localStorage.getItem('tokenDocente')).toBe('token-prueba');
    expect(sessionStorage.getItem('tokenDocente')).toBeNull();

    limpiarTokenDocente();
    expect(obtenerTokenDocente()).toBeNull();
  });

  it('mantiene una sesión de pestaña como temporal al refrescar el token', async () => {
    expect(guardarTokenDocente('token-temporal', false)).toBe(true);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'token-refrescado' })
    } as unknown as Response);

    const cliente = crearClienteApi();
    await expect(cliente.intentarRefrescarToken()).resolves.toBe('token-refrescado');

    expect(localStorage.getItem('tokenDocente')).toBeNull();
    expect(sessionStorage.getItem('tokenDocente')).toBe('token-refrescado');
  });

  it('incluye Authorization cuando hay token', async () => {
    guardarTokenDocente('token-prueba');
    const cliente = crearClienteApi();

    await cliente.obtener('/salud');

    const llamada = vi.mocked(fetch).mock.calls[0];
    const opciones = llamada[1] as RequestInit;
    expect(String(llamada[0])).toContain('/salud');
    expect(opciones.headers).toMatchObject({ Authorization: 'Bearer token-prueba' });
    expect(opciones.headers).toMatchObject({ 'X-EvaluaPro-Equipo': expect.stringMatching(/^web-/) });
  });

  it('incluye content-type al enviar payload', async () => {
    const cliente = crearClienteApi();

    await cliente.enviar('/autenticacion/ingresar', { correo: 'test', contrasena: '123' });

    const llamada = vi.mocked(fetch).mock.calls[0];
    const opciones = llamada[1] as RequestInit;
    expect(String(llamada[0])).toContain('/autenticacion/ingresar');
    expect(opciones.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('lanza error cuando la API no responde OK', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    const cliente = crearClienteApi();

    await expect(cliente.obtener('/salud')).rejects.toThrow('API no disponible');
  });

  it('muestra el mensaje especifico del backend en 409 (envelope error)', async () => {
    const cliente = crearClienteApi();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: { codigo: 'PLANTILLA_CON_EXAMENES', mensaje: 'No se puede archivar: hay 2 examenes.' } })
    } as unknown as Response);

    try {
      await cliente.enviar('/examenes/plantillas/123/archivar', {});
    } catch (error) {
      const msg = mensajeUsuarioDeError(error, 'No se pudo archivar');
      expect(msg).toContain('No se puede archivar');
      return;
    }
    throw new Error('Se esperaba excepcion');
  });

  it('usa body texto como mensaje cuando no hay JSON valido', async () => {
    const cliente = crearClienteApi();

    const respuesta = {
      ok: false,
      status: 409,
      clone: () => ({
        text: async () => 'No se puede archivar: el examen ya fue vinculado/entregado'
      }),
      text: async () => 'No se puede archivar: el examen ya fue vinculado/entregado',
      json: async () => {
        throw new Error('Invalid JSON');
      }
    } as unknown as Response;

    vi.mocked(fetch).mockResolvedValueOnce(respuesta);

    try {
      await cliente.enviar('/examenes/generados/123/archivar', {});
    } catch (error) {
      const msg = mensajeUsuarioDeError(error, 'No se pudo archivar');
      expect(msg).toContain('No se puede archivar');
      return;
    }
    throw new Error('Se esperaba excepcion');
  });
});
