/**
 * Tests de robustez para endpoints v2
 * Ola 3 - Fase 2: Endpoints Robustos
 * Valida error handling, retry logic, circuit breaker y validaciones
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ErrorOperacional,
  procesarErrorZod
} from '../src/compartido/robustez/manejadorErrores';
import { ErrorCategoria } from '../src/compartido/robustez/tiposRobustez';
import { conRetry, normalizarError } from '../src/compartido/robustez/soporteRetry';
import { CircuitBreaker, obtenerCircuitBreaker } from '../src/compartido/robustez/circuitBreaker';
import { z } from 'zod';

describe('Robustez Endpoints V2 - Ola 3 Fase 2', () => {
  // ============= TESTS DE ERROR HANDLING =============

  describe('Manejo de Errores Robusto', () => {
    it('categoriza errores correctamente', () => {
      const errorValidacion = new ErrorOperacional(
        'Campo inválido',
        ErrorCategoria.VALIDACION,
        400
      );

      expect(errorValidacion.categoria).toBe(ErrorCategoria.VALIDACION);
      expect(errorValidacion.statusHttp).toBe(400);
      expect(errorValidacion.reintentable).toBe(false);
    });

    it('marca errores transitorios como reintentables', () => {
      const errorTimeout = new ErrorOperacional(
        'Timeout en BD',
        ErrorCategoria.TIMEOUT,
        504,
        '',
        true
      );

      expect(errorTimeout.reintentable).toBe(true);
      expect(errorTimeout.categoria).toBe(ErrorCategoria.TIMEOUT);
    });

    it('procesa errores Zod en ErrorOperacional', () => {
      const schema = z.object({ email: z.string().email() });
      const validacion = schema.safeParse({ email: 'invalido' });

      if (!validacion.success) {
        const error = procesarErrorZod(validacion.error, 'trace-123');
        expect(error.categoria).toBe(ErrorCategoria.VALIDACION);
        expect(error.statusHttp).toBe(400);
        expect(error.traceId).toBe('trace-123');
      }
    });

    it('normaliza errores de red como reintentables', () => {
      const errorRed = new Error('ECONNREFUSED: Connection refused');
      const normalizado = normalizarError(errorRed);

      expect(normalizado.reintentable).toBe(true);
      expect(normalizado.categoria).toBe(ErrorCategoria.INDISPONIBLE);
    });
  });

  // ============= TESTS DE RETRY =============

  describe('Sistema de Retry', () => {
    it('ejecuta operación exitosa sin reintentos', async () => {
      const spy = vi.fn().mockResolvedValue('exito');

      const resultado = await conRetry(
        spy,
        'test-exitoso'
      );

      expect(resultado.exito).toBe(true);
      expect(resultado.datos).toBe('exito');
      expect(resultado.intentos).toBe(1);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('reintenta operaciones que fallan transitorialmente', async () => {
      let intento = 0;
      const spy = vi.fn(async () => {
        intento++;
        if (intento < 3) {
          throw new ErrorOperacional(
            'Timeout',
            ErrorCategoria.TIMEOUT,
            504,
            '',
            true
          );
        }
        return 'exito_intento_3';
      });

      const resultado = await conRetry(
        spy,
        'test-retry',
        { maxIntentos: 3, delayMs: 10, jitterMs: 0 }
      );

      expect(resultado.exito).toBe(true);
      expect(resultado.datos).toBe('exito_intento_3');
      expect(resultado.intentos).toBe(3);
      expect(spy).toHaveBeenCalledTimes(3);
    });

    it('no reintenta errores no-reintentables', async () => {
      const spy = vi
        .fn()
        .mockRejectedValue(
          new ErrorOperacional(
            'Invalido',
            ErrorCategoria.VALIDACION,
            400,
            '',
            false
          )
        );

      const resultado = await conRetry(
        spy,
        'test-no-retry',
        { maxIntentos: 3, delayMs: 10 }
      );

      expect(resultado.exito).toBe(false);
      expect(resultado.intentos).toBe(1);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('aplica backoff exponencial', async () => {
      const tiempos: number[] = [];
      let intento = 0;

      const spy = vi.fn(async () => {
        tiempos.push(Date.now());
        intento++;
        if (intento < 4) {
          throw new ErrorOperacional(
            'Error',
            ErrorCategoria.TIMEOUT,
            504,
            '',
            true
          );
        }
        return 'ok';
      });

      const inicio = Date.now();
      await conRetry(
        spy,
        'test-backoff',
        {
          maxIntentos: 4,
          delayMs: 20,
          delayMultiplicador: 2,
          jitterMs: 0
        }
      );
      const total = Date.now() - inicio;

      // Esperado: 0ms + 20ms + 40ms + 80ms = ~140ms
      // En CI puede haber jitter/scheduling adicional.
      expect(total).toBeGreaterThanOrEqual(120);
      expect(total).toBeLessThan(320);
    });

    it('respeta categorías configuradas para retry', async () => {
      const spy = vi.fn(async () => {
        throw new ErrorOperacional(
          'Recurso agotado',
          ErrorCategoria.RECURSO_AGOTADO,
          429,
          '',
          true
        );
      });

      const resultado = await conRetry(
        spy,
        'test-categoria',
        {
          maxIntentos: 2,
          delayMs: 10,
          categoriaIntentar: [ErrorCategoria.TIMEOUT] // Solo reintenta timeout
        }
      );

      expect(resultado.exito).toBe(false);
      expect(resultado.intentos).toBe(1); // No reintentó
    });
  });

  // ============= TESTS DE CIRCUIT BREAKER =============

  describe('Circuit Breaker', () => {
    let cb: CircuitBreaker;

    beforeEach(() => {
      cb = new CircuitBreaker('test-cb', {
        umbralErrores: 3,
        ventanaMs: 60000,
        timeoutSemiluza: 30000,
        recuperacionMs: 100
      });
    });

    afterEach(() => {
      cb.reset();
    });

    it('permanece cerrado con operaciones exitosas', async () => {
      for (let i = 0; i < 5; i++) {
        const resultado = await cb.ejecutar(async () => 'exito');
        expect(resultado).toBe('exito');
      }

      const estado = cb.obtenerEstado();
      expect(estado.estado).toBe('cerrado');
      expect(estado.metricas.intentosTotales).toBe(5);
      expect(estado.metricas.intentosExitosos).toBe(5);
    });

    it('se abre después de alcanzar umbral de errores', async () => {
      const operacionFalla = async () => {
        throw new Error('Fallo');
      };

      for (let i = 0; i < 3; i++) {
        try {
          await cb.ejecutar(operacionFalla);
        } catch {
          // Esperado
        }
      }

      const estado = cb.obtenerEstado();
      expect(estado.estado).toBe('abierto');
      expect(estado.metricas.intentosFallidos).toBe(3);
      expect(estado.metricas.erroresCircuitBreaker).toBe(0);
    });

    it('rechaza operaciones cuando está abierto', async () => {
      // Provocar apertura
      for (let i = 0; i < 3; i++) {
        try {
          await cb.ejecutar(async () => {
            throw new Error('Fallo');
          });
        } catch {
          // Esperado
        }
      }

      // Intentar operación con CB abierto
      await expect(cb.ejecutar(async () => 'exito')).rejects.toThrow('Circuit breaker abierto');

      const estado = cb.obtenerEstado();
      expect(estado.metricas.erroresCircuitBreaker).toBe(1);
    });

    it('transiciona a semiluza después de recuperación', async () => {
      // Abrir
      for (let i = 0; i < 3; i++) {
        try {
          await cb.ejecutar(async () => {
            throw new Error('Fallo');
          });
        } catch {
          // Esperado
        }
      }

      let estado = cb.obtenerEstado();
      expect(estado.estado).toBe('abierto');

      // Esperar recuperación
      await new Promise((r) => setTimeout(r, 120));

      // Intentar operación exitosa
      const res = await cb.ejecutar(async () => 'exito');
      expect(res).toBe('exito');

      estado = cb.obtenerEstado();
      expect(estado.estado).toBe('cerrado');
    });

    it('calcula percentiles de latencia', async () => {
      for (let i = 0; i < 10; i++) {
        await cb.ejecutar(async () => {
          await new Promise((r) => setTimeout(r, 5 + Math.random() * 10));
          return 'ok';
        });
      }

      const estado = cb.obtenerEstado();
      expect(estado.metricas.tiempoPromedio).toBeGreaterThan(0);
      expect(estado.metricas.p95).toBeGreaterThanOrEqual(estado.metricas.tiempoPromedio);
      expect(estado.metricas.p99).toBeGreaterThanOrEqual(estado.metricas.p95);
    });

    it('resetea estado correctamente', async () => {
      try {
        await cb.ejecutar(async () => {
          throw new Error('Fallo');
        });
      } catch {
        // Esperado
      }

      cb.reset();
      const estado = cb.obtenerEstado();

      expect(estado.estado).toBe('cerrado');
      expect(estado.metricas.intentosTotales).toBe(0);
      expect(estado.metricas.intentosExitosos).toBe(0);
    });
  });

  // ============= TESTS DE VALIDACIÓN ZOD MEJORADA =============

  describe('Validaciones V2 Mejoradas', () => {
    it('valida base64 de imagen correctamente', async () => {
      const base64Valido = Buffer.from('datos-de-imagen-binaria-aqui-' + 'x'.repeat(1000)).toString(
        'base64'
      );

      const { esquemaAnalizarOmrV2 } = await import(
        '../src/compartido/validaciones/validacionesV2'
      );

      const resultado = esquemaAnalizarOmrV2.safeParse({
        imagenBase64: base64Valido
      });

      expect(resultado.success).toBe(true);
    });

    it('rechaza base64 muy pequeno', async () => {
      const { esquemaAnalizarOmrV2 } = await import(
        '../src/compartido/validaciones/validacionesV2'
      );

      const resultado = esquemaAnalizarOmrV2.safeParse({
        imagenBase64: 'YWJjZA==' // "abcd"
      });

      expect(resultado.success).toBe(false);
    });

    it('valida folio con formato correcto', async () => {
      const { esquemaFolio } = await import('../src/compartido/validaciones/validacionesV2');

      const resultadoValido = esquemaFolio.safeParse('EXA-2026-001');
      expect(resultadoValido.success).toBe(true);

      const resultadoInvalido = esquemaFolio.safeParse('exa-2026-001'); // Minusculas
      expect(resultadoInvalido.success).toBe(false);
    });

    it('valida límites de lote', async () => {
      const { esquemaAnalizarOmrLoteV2 } = await import(
        '../src/compartido/validaciones/validacionesV2'
      );

      const base64 = Buffer.from('x'.repeat(10000)).toString('base64');

      // Lote vacío
      let resultado = esquemaAnalizarOmrLoteV2.safeParse({
        capturas: []
      });
      expect(resultado.success).toBe(false);

      // Lote con muchas capturas
      const muchasCapturas = Array(201).fill({ imagenBase64: base64 });
      resultado = esquemaAnalizarOmrLoteV2.safeParse({
        capturas: muchasCapturas
      });
      expect(resultado.success).toBe(false);

      // Lote válido
      const capturasBuenas = Array(50).fill({ imagenBase64: base64 });
      resultado = esquemaAnalizarOmrLoteV2.safeParse({
        capturas: capturasBuenas
      });
      expect(resultado.success).toBe(true);
    });
  });

  // ============= TESTS DE INTEGRACIÓN =============

  describe('Integración Retry + Circuit Breaker', () => {
    it('circuit breaker abierto después de fallos continuos con retry', async () => {
      const cb = obtenerCircuitBreaker('test-integrado', {
        umbralErrores: 2,
        recuperacionMs: 100
      });

      let intentoLocal = 0;
      const operacion = async () => {
        intentoLocal++;
        throw new Error('Fallos continuos');
      };

      // Provocar 2 fallos completos
      for (let i = 0; i < 2; i++) {
        const resultado = await conRetry(
          () => cb.ejecutar(operacion),
          'test-integrado',
          { maxIntentos: 1 }
        );
        expect(resultado.exito).toBe(false);
      }

      // Circuit abierto hace que falle sin reintentos
      const resultado = await conRetry(
        () => cb.ejecutar(operacion),
        'test-integrado',
        { maxIntentos: 3 }
      );

      expect(resultado.exito).toBe(false);
      expect(intentoLocal).toBeLessThan(6); // No reintentó todo

      cb.reset();
    });
  });
});
