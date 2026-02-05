import { describe, expect, it } from 'vitest';
import { ErrorRemoto, mensajeUsuarioDeErrorConSugerencia } from '../src/servicios_api/clienteComun';

describe('mensajeUsuarioDeErrorConSugerencia', () => {
  it('evita repetir una sugerencia equivalente al mensaje base', () => {
    const error = new ErrorRemoto('API no disponible', { status: 500 });
    const mensaje = mensajeUsuarioDeErrorConSugerencia(error, 'Fallo');
    expect(mensaje).toBe('El servicio tuvo un problema. Intenta mas tarde.');
  });

  it('muestra mensaje especifico para servidor de sincronizacion no configurado', () => {
    const error = new ErrorRemoto('API no disponible', { status: 503, codigo: 'SYNC_SERVIDOR_NO_CONFIG' });
    const mensaje = mensajeUsuarioDeErrorConSugerencia(error, 'Fallo');
    expect(mensaje).toContain('Servidor de sincronizacion no configurado');
    expect(mensaje).toContain('PORTAL_ALUMNO_URL');
  });
});
