// Pruebas del cliente API docente.
import { describe, expect, it, vi } from 'vitest';
import {
  crearClienteApi,
  guardarTokenDocente,
  limpiarTokenDocente,
  obtenerTokenDocente
} from '../src/servicios_api/clienteApi';

describe('clienteApi', () => {
  it('administra tokens en localStorage', () => {
    guardarTokenDocente('token-prueba');
    expect(obtenerTokenDocente()).toBe('token-prueba');

    limpiarTokenDocente();
    expect(obtenerTokenDocente()).toBeNull();
  });

  it('incluye Authorization cuando hay token', async () => {
    guardarTokenDocente('token-prueba');
    const cliente = crearClienteApi();

    await cliente.obtener('/salud');

    const llamada = vi.mocked(fetch).mock.calls[0];
    const opciones = llamada[1] as RequestInit;
    expect(String(llamada[0])).toContain('/salud');
    expect(opciones.headers).toEqual({ Authorization: 'Bearer token-prueba' });
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
});
