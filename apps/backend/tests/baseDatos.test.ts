/**
 * baseDatos.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
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
    const previousSilentLogs = process.env.EVALUAPRO_LOG_SILENT;
    delete process.env.EVALUAPRO_LOG_SILENT;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const connectSpy = vi.spyOn(mongoose, 'connect');
    const { conectarBaseDatos } = await import('../src/infraestructura/baseDatos/mongoose');

    await conectarBaseDatos();

    expect(connectSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    process.env.EVALUAPRO_LOG_SILENT = previousSilentLogs;
    warnSpy.mockRestore();
    connectSpy.mockRestore();
  });
});
