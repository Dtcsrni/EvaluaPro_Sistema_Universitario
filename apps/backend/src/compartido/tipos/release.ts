/**
 * release
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
export type PasoGateProduccionId =
  | 'autenticacion'
  | 'periodo'
  | 'alumno'
  | 'reactivos_plantilla'
  | 'generacion_examen'
  | 'vinculacion_entrega'
  | 'calificacion'
  | 'exportacion_csv_docx_firma'
  | 'integridad_sha256'
  | 'metricas_exportacion';

export type PasoGateProduccion = {
  id: PasoGateProduccionId;
  nombre: string;
  resultado: 'ok' | 'fallo';
  fuente: 'manual' | 'automatica';
  requestId?: string;
  detalle?: string;
  duracionMs?: number;
};

export type ResultadoGateHumanoProduccion = {
  version: string;
  ejecutadoEn: string;
  entorno: 'production';
  docenteIdHash: string;
  periodoId: string;
  resultado: 'ok' | 'fallo';
  duracionMs: number;
  pasos: PasoGateProduccion[];
};

export type EvidenciaReleaseEstable = {
  version: string;
  commit: string;
  ciConsecutivoVerde: number;
  gateHumanoProduccion: ResultadoGateHumanoProduccion;
  artefactos: {
    timeline: string;
    metricas: string;
    integridad: string;
  };
};
