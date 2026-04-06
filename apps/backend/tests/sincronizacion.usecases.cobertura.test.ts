import { describe, expect, it } from 'vitest';
import { enviarPaqueteServidorUseCase } from '../src/modulos/modulo_sincronizacion_nube/application/usecases/enviarPaqueteServidor';
import { traerPaquetesServidorUseCase } from '../src/modulos/modulo_sincronizacion_nube/application/usecases/traerPaquetesServidor';

describe('sincronizacion usecases cobertura minima', () => {
  it('expone usecases de push/pull como funciones', () => {
    expect(typeof enviarPaqueteServidorUseCase).toBe('function');
    expect(typeof traerPaquetesServidorUseCase).toBe('function');
  });
});
