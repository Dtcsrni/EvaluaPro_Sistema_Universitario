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

export type RespuestaSalud = {
  estado: 'ok' | 'degradado';
  tiempoActivo: number;
};

export type RespuestaLiveness = RespuestaSalud & {
  servicio: string;
  env: string;
};

export type RespuestaReadiness = RespuestaSalud & {
  dependencies?: {
    mongodb: {
      status: 'ok' | 'fail';
      ready: boolean;
      state: number;
      description: string;
    };
  };
  dependencias: {
    db: {
      estado: number;
      descripcion: string;
      lista: boolean;
    };
  };
};

export type MetricaEtapaOmr = {
  etapa: 'deteccion' | 'scoring' | 'calidad' | 'qr' | 'debug';
  duracionMs: number;
  exito: boolean;
  requestId?: string;
};

export type ResultadoPipelineOmr = {
  requestId?: string;
  exito: boolean;
  etapas: Array<{
    etapa: MetricaEtapaOmr['etapa'];
    duracionMs: number;
    exito: boolean;
  }>;
};
