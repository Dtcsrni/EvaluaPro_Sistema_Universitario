// Pruebas de conexion a base de datos.
import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/configuracion', () => ({
  configuracion: {
    mongoUri: ''
  }
}));

describe('conectarBaseDatos', () => {
  it('omite conexion cuando no hay URI', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const connectSpy = vi.spyOn(mongoose, 'connect');
    const { conectarBaseDatos } = await import('../src/infraestructura/baseDatos/mongoose');

    await conectarBaseDatos();

    expect(connectSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
    connectSpy.mockRestore();
  });
});
