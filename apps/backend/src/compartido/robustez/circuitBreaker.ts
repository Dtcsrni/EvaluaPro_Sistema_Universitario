/**
 * Circuit Breaker para proteger endpoints v2 contra cascadas de fallos
 * Ola 3 - Fase 2: Endpoints Robustos
 */

import {
  ConfiguracionCircuitBreaker,
  EstadoCircuitBreaker,
  MetricasRobustez,
  ErrorCategoria
} from './tiposRobustez';
import { ErrorOperacional } from './manejadorErrores';

const CONFIGURACION_DEFECTO: ConfiguracionCircuitBreaker = {
  umbralErrores: 5,
  ventanaMs: 60000, // 1 minuto
  timeoutSemiluza: 30000, // 30 segundos
  recuperacionMs: 120000 // 2 minutos
};

export class CircuitBreaker {
  private estado: EstadoCircuitBreaker = EstadoCircuitBreaker.CERRADO;
  private conteoPuertoMs: number = 0;
  private ultZonaAberturaMs: number = 0;
  private metricas: MetricasRobustez = {
    intentosTotales: 0,
    intentosExitosos: 0,
    intentosFallidos: 0,
    erroresCircuitBreaker: 0,
    tiempoPromedio: 0,
    p95: 0,
    p99: 0
  };
  private tiemposPeticion: number[] = [];

  constructor(
    private nombre: string,
    private config: ConfiguracionCircuitBreaker = CONFIGURACION_DEFECTO
  ) {}

  /**
   * Ejecuta una operacion a través del circuit breaker
   */
  async ejecutar<T>(operacion: () => Promise<T>): Promise<T> {
    const tiempoInicio = Date.now();
    this.metricas.intentosTotales++;

    // Si está abierto, rechazar inmediatamente
    if (this.estado === EstadoCircuitBreaker.ABIERTO) {
      if (Date.now() - this.ultZonaAberturaMs > this.config.recuperacionMs) {
        this.estado = EstadoCircuitBreaker.SEMILUZA;
        console.info('[CIRCUIT_BREAKER]', {
          nombre: this.nombre,
          evento: 'transicion_semiluza',
          duracionAberturaMs: Date.now() - this.ultZonaAberturaMs
        });
      } else {
        this.metricas.erroresCircuitBreaker++;
        throw new ErrorOperacional(
          `Circuit breaker abierto para ${this.nombre}`,
          ErrorCategoria.INDISPONIBLE,
          503,
          `Estado: ${this.estado}`,
          true
        );
      }
    }

    try {
      const resultado = await operacion();
      this.registrarExito(Date.now() - tiempoInicio);
      return resultado;
    } catch (err) {
      this.registrarFallo();
      throw err;
    }
  }

  /**
   * Registra un éxito
   */
  private registrarExito(duracionMs: number): void {
    this.metricas.intentosExitosos++;
    this.conteoPuertoMs = 0; // Reset de contador de errores

    // Si estaba en semiluza, pasar a cerrado
    if (this.estado === EstadoCircuitBreaker.SEMILUZA) {
      this.estado = EstadoCircuitBreaker.CERRADO;
      console.info('[CIRCUIT_BREAKER]', {
        nombre: this.nombre,
        evento: 'recuperado_cerrado'
      });
    }

    // Actualizar percentiles
    this.tiemposPeticion.push(duracionMs);
    if (this.tiemposPeticion.length > 100) {
      this.tiemposPeticion.shift();
    }
    this.actualizarPercentiles();
  }

  /**
   * Registra un fallo
   */
  private registrarFallo(): void {
    this.metricas.intentosFallidos++;
    this.conteoPuertoMs++;

    // Si se alcanzo el umbral de errores, abrir el circuit
    if (this.conteoPuertoMs >= this.config.umbralErrores) {
      this.estado = EstadoCircuitBreaker.ABIERTO;
      this.ultZonaAberturaMs = Date.now();
      console.error('[CIRCUIT_BREAKER]', {
        nombre: this.nombre,
        evento: 'abierto',
        umbral: this.config.umbralErrores,
        conteo: this.conteoPuertoMs,
        duracionMs: this.config.recuperacionMs
      });
    }
  }

  /**
   * Calcula percentiles de tiempo
   */
  private actualizarPercentiles(): void {
    if (this.tiemposPeticion.length === 0) return;

    const sorted = [...this.tiemposPeticion].sort((a, b) => a - b);
    const len = sorted.length;

    // p95
    const p95Idx = Math.ceil((95 / 100) * len) - 1;
    this.metricas.p95 = sorted[Math.max(0, p95Idx)];

    // p99
    const p99Idx = Math.ceil((99 / 100) * len) - 1;
    this.metricas.p99 = sorted[Math.max(0, p99Idx)];

    // Promedio
    this.metricas.tiempoPromedio =
      this.tiemposPeticion.reduce((a, b) => a + b, 0) / this.tiemposPeticion.length;
  }

  /**
   * Obtiene estado actual
   */
  obtenerEstado(): {
    nombre: string;
    estado: EstadoCircuitBreaker;
    metricas: MetricasRobustez;
  } {
    return {
      nombre: this.nombre,
      estado: this.estado,
      metricas: { ...this.metricas }
    };
  }

  /**
   * Reset manual (útil para testing)
   */
  reset(): void {
    this.estado = EstadoCircuitBreaker.CERRADO;
    this.conteoPuertoMs = 0;
    this.ultZonaAberturaMs = 0;
    this.tiemposPeticion = [];
    this.metricas = {
      intentosTotales: 0,
      intentosExitosos: 0,
      intentosFallidos: 0,
      erroresCircuitBreaker: 0,
      tiempoPromedio: 0,
      p95: 0,
      p99: 0
    };
  }
}

/**
 * Registro de circuit breakers (un por módulo/endpoint crítico)
 */
export const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Obtiene o crea un circuit breaker
 */
export function obtenerCircuitBreaker(
  nombre: string,
  config?: Partial<ConfiguracionCircuitBreaker>
): CircuitBreaker {
  if (!circuitBreakers.has(nombre)) {
    const cb = new CircuitBreaker(nombre, {
      ...CONFIGURACION_DEFECTO,
      ...config
    });
    circuitBreakers.set(nombre, cb);
  }
  return circuitBreakers.get(nombre)!;
}

/**
 * Exporta estado de todos los circuit breakers para métricas
 */
export function exportarEstadosCircuitBreaker(): Record<string, {
  nombre: string;
  estado: EstadoCircuitBreaker;
  metricas: MetricasRobustez;
}> {
  const estados: Record<string, {
    nombre: string;
    estado: EstadoCircuitBreaker;
    metricas: MetricasRobustez;
  }> = {};
  circuitBreakers.forEach((cb, nombre) => {
    estados[nombre] = cb.obtenerEstado();
  });
  return estados;
}
