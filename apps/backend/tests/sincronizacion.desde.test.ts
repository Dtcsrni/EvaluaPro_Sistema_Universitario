/**
 * sincronizacion.desde.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { describe, expect, it } from 'vitest';
import { ErrorAplicacion } from '../src/compartido/errores/errorAplicacion';
import { resolverDesdeSincronizacion } from '../src/modulos/modulo_sincronizacion_nube/domain/paqueteSincronizacion';

describe('resolverDesdeSincronizacion', () => {
  it('acepta vacío y devuelve null', () => {
    const resultado = resolverDesdeSincronizacion(undefined);
    expect(resultado.desdeRawStr).toBe('');
    expect(resultado.desde).toBeNull();
  });

  it('acepta fecha ISO válida', () => {
    const resultado = resolverDesdeSincronizacion('2026-02-16T10:00:00.000Z');
    expect(resultado.desdeRawStr).toBe('2026-02-16T10:00:00.000Z');
    expect(resultado.desde?.toISOString()).toBe('2026-02-16T10:00:00.000Z');
  });

  it('rechaza fecha inválida con contrato SYNC_DESDE_INVALIDO', () => {
    expect(() => resolverDesdeSincronizacion('fecha-invalida')).toThrowError(ErrorAplicacion);
    try {
      resolverDesdeSincronizacion('fecha-invalida');
    } catch (error) {
      const e = error as ErrorAplicacion;
      expect(e.codigo).toBe('SYNC_DESDE_INVALIDO');
      expect(e.estadoHttp).toBe(400);
    }
  });
});