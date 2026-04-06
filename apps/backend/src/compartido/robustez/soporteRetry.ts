/**
 * Sistema de retry inteligente con backoff exponencial y jitter
 * Ola 3 - Fase 2: Endpoints Robustos
 */

import {
  ConfiguracionRetry,
  ErrorRobusto,
  ErrorCategoria,
  ResultadoOperacion
} from './tiposRobustez';
import { ErrorOperacional } from './manejadorErrores';

declare global {
  interface Error {
    categoria?: ErrorCategoria;
    reintentable?: boolean;
  }
}

const CONFIGURACION_RETRY_DEFECTO: ConfiguracionRetry = {
  maxIntentos: 3,
  delayMs: 100,
  delayMultiplicador: 2,
  jitterMs: 50,
  categoriaIntentar: [
    ErrorCategoria.TIMEOUT,
    ErrorCategoria.INDISPONIBLE,
    ErrorCategoria.RECURSO_AGOTADO,
    ErrorCategoria.LIMITE_TASA
  ]
};

/**
 * Ejecuta una operacion con retry automático
 */
export async function conRetry<T>(
  operacion: () => Promise<T>,
  nombre: string = 'operacion',
  configRetry?: Partial<ConfiguracionRetry>
): Promise<ResultadoOperacion<T>> {
  const config = { ...CONFIGURACION_RETRY_DEFECTO, ...configRetry };
  const tiempoInicio = Date.now();
  let ultimoError: ErrorRobusto | undefined;
  let intento = 0;

  for (intento = 1; intento <= config.maxIntentos; intento++) {
    try {
      const datos = await operacion();
      return {
        exito: true,
        datos,
        intentos: intento,
        duracionMs: Date.now() - tiempoInicio,
        ciruitBreakerActivo: false
      };
    } catch (err) {
      ultimoError = normalizarError(err);

      // Verificar si el error es reintentable
      const esReintentable =
        ultimoError.reintentable &&
        (config.categoriaIntentar?.includes(ultimoError.categoria) ?? true);

      if (!esReintentable || intento === config.maxIntentos) {
        return {
          exito: false,
          error: ultimoError,
          intentos: intento,
          duracionMs: Date.now() - tiempoInicio,
          ciruitBreakerActivo: false
        };
      }

      // Calcular delay con backoff exponencial y jitter
      const delayBase = config.delayMs * Math.pow(config.delayMultiplicador, intento - 1);
      const jitter = Math.random() * config.jitterMs;
      const delayFinal = Math.min(delayBase + jitter, 30000); // Max 30s

      console.warn('[RETRY]', {
        nombre,
        intento,
        maxIntentos: config.maxIntentos,
        categoriaError: ultimoError.categoria,
        delayMs: Math.round(delayFinal),
        mensajeError: ultimoError.message
      });

      // Esperar antes de reintentar
      await esperar(Math.round(delayFinal));
    }
  }

  // Si llegamos aquí, todos los intentos fallaron
  return {
    exito: false,
    error: ultimoError,
    intentos: intento,
    duracionMs: Date.now() - tiempoInicio,
    ciruitBreakerActivo: false
  };
}

/**
 * Normaliza cualquier error a ErrorRobusto
 */
export function normalizarError(err: unknown): ErrorRobusto {
  if (err instanceof ErrorOperacional) {
    return err;
  }

  if (err instanceof Error) {
    let categoria = ErrorCategoria.INTERNO;
    let reintentable = false;

    if (err.message.includes('timeout')) {
      categoria = ErrorCategoria.TIMEOUT;
      reintentable = true;
    } else if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
      categoria = ErrorCategoria.INDISPONIBLE;
      reintentable = true;
    } else if (err.message.includes('429')) {
      categoria = ErrorCategoria.LIMITE_TASA;
      reintentable = true;
    } else if (err.message.includes('503') || err.message.includes('502')) {
      categoria = ErrorCategoria.INDISPONIBLE;
      reintentable = true;
    }

    return new ErrorOperacional(
      err.message,
      categoria,
      500,
      err.stack || '',
      reintentable
    );
  }

  return new ErrorOperacional(
    'Error desconocido en retry',
    ErrorCategoria.INTERNO,
    500,
    JSON.stringify(err),
    false
  );
}

/**
 * Utilidad para esperar
 */
function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Decorator para TypeScript - aplicar retry a métodos
 */
export function Reintentar(configRetry?: Partial<ConfiguracionRetry>) {
  return function (
    target: { constructor: { name: string } },
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const metodoOriginal = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]) {
      const resultado = await conRetry(
        () => metodoOriginal.apply(this, args),
        `${target.constructor.name}.${propertyKey}`,
        configRetry
      );

      if (!resultado.exito) {
        throw resultado.error;
      }

      return resultado.datos;
    };

    return descriptor;
  };
}
