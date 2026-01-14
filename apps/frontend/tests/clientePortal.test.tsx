// Pruebas del cliente API del portal alumno.
import { describe, expect, it, vi } from 'vitest';
import {
  crearClientePortal,
  guardarTokenAlumno,
  limpiarTokenAlumno,
  obtenerTokenAlumno
} from '../src/servicios_api/clientePortal';

describe('clientePortal', () => {
  it('administra tokens de alumno en localStorage', () => {
    guardarTokenAlumno('token-alumno');
    expect(obtenerTokenAlumno()).toBe('token-alumno');

    limpiarTokenAlumno();
    expect(obtenerTokenAlumno()).toBeNull();
  });

  it('incluye Authorization al consultar con token', async () => {
    guardarTokenAlumno('token-alumno');
    const cliente = crearClientePortal();

    await cliente.obtener('/resultados');

    const llamada = vi.mocked(fetch).mock.calls[0];
    const opciones = llamada[1] as RequestInit;
    expect(String(llamada[0])).toContain('/resultados');
    expect(opciones.headers).toEqual({ Authorization: 'Bearer token-alumno' });
  });

  it('envia JSON con content-type al publicar', async () => {
    const cliente = crearClientePortal();

    await cliente.enviar('/ingresar', { codigo: 'ABC123', matricula: '2025-01' });

    const llamada = vi.mocked(fetch).mock.calls[0];
    const opciones = llamada[1] as RequestInit;
    expect(String(llamada[0])).toContain('/ingresar');
    expect(opciones.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('lanza error cuando el portal no responde OK', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    const cliente = crearClientePortal();

    await expect(cliente.enviar('/ingresar', { codigo: 'A', matricula: 'B' })).rejects.toThrow(
      'Portal no disponible'
    );
  });
});
