/**
 * observabilidad
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
export type NivelLogEstandar = 'debug' | 'info' | 'warn' | 'error';

export type ContextoLog = {
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  userId?: string;
  errorCode?: string;
  [k: string]: unknown;
};

export type RespuestaLiveness = {
  estado: 'ok' | 'degradado';
  tiempoActivo: number;
  servicio: string;
  env: string;
};

export type RespuestaReadiness = {
  estado: 'ok' | 'degradado';
  tiempoActivo: number;
  dependencias: {
    db: {
      estado: number;
      descripcion?: string;
      lista: boolean;
    };
  };
};
