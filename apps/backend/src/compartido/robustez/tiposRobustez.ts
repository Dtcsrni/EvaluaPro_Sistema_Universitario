/**
 * Tipos y enumerados para manejo robusto de errores, retry y circuit breaker
 * Ola 3 - Fase 2: Endpoints Robustos
 */

export enum ErrorCategoria {
  VALIDACION = 'validacion',
  AUTENTICACION = 'autenticacion',
  AUTORIZACION = 'autorizacion',
  NO_ENCONTRADO = 'no_encontrado',
  CONFLICTO = 'conflicto',
  LIMITE_TASA = 'limite_tasa',
  INTERNO = 'interno',
  TIMEOUT = 'timeout',
  RECURSO_AGOTADO = 'recurso_agotado',
  INDISPONIBLE = 'indisponible'
}

export enum EstadoCircuitBreaker {
  CERRADO = 'cerrado',
  ABIERTO = 'abierto',
  SEMILUZA = 'semiluza'
}

export interface ErrorRobusto extends Error {
  categoria: ErrorCategoria;
  statusHttp: number;
  auditoria: string;
  reintentable: boolean;
  duracionMs: number;
  traceId?: string;
}

export interface ConfiguracionRetry {
  maxIntentos: number;
  delayMs: number;
  delayMultiplicador: number;
  jitterMs: number;
  categoriaIntentar?: ErrorCategoria[];
}

export interface ConfiguracionCircuitBreaker {
  umbralErrores: number;
  ventanaMs: number;
  timeoutSemiluza: number;
  recuperacionMs: number;
}

export interface MetricasRobustez {
  intentosTotales: number;
  intentosExitosos: number;
  intentosFallidos: number;
  erroresCircuitBreaker: number;
  tiempoPromedio: number;
  p95: number;
  p99: number;
}

export interface ResultadoOperacion<T> {
  exito: boolean;
  datos?: T;
  error?: ErrorRobusto;
  intentos: number;
  duracionMs: number;
  ciruitBreakerActivo: boolean;
}
