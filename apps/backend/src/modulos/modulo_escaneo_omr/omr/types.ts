export type EtapaOmr = 'deteccion' | 'scoring' | 'calidad' | 'qr' | 'debug';

export type MetricaEtapaOmr = {
  etapa: EtapaOmr;
  duracionMs: number;
  exito: boolean;
  requestId?: string;
};

export type ContextoPipelineOmr = {
  imagenBase64: string;
  mapaPagina: unknown;
  qrEsperado?: string | string[];
  margenMm: number;
  debugInfo?: {
    folio?: string;
    numeroPagina?: number;
    templateVersionDetectada?: 1 | 3 | 4;
  };
  requestId?: string;
  qrTexto?: string;
  resultado?: unknown;
};

export type ResultadoPipelineOmr<TResultado> = {
  requestId?: string;
  exito: boolean;
  resultado: TResultado;
  etapas: Array<{
    etapa: EtapaOmr;
    duracionMs: number;
    exito: boolean;
  }>;
};
