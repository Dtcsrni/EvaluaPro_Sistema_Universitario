/**
 * Tipos de evidencia QA para gates bloqueantes preproduccion.
 *
 * Estos contratos permiten serializar resultados de pruebas automatizadas
 * y publicarlos como artefactos verificables por humanos.
 */
export type ResultadoPasoFlujo = {
  paso: string;
  estado: 'ok' | 'error';
  detalle?: string;
  requestId?: string;
};

export type ResultadoFlujoDocenteAlumnoE2E = {
  version: string;
  ejecutadoEn: string;
  estado: 'ok' | 'error';
  pasos: ResultadoPasoFlujo[];
  resumen: {
    periodoId: string;
    examenId: string;
    folio: string;
    alumnoId: string;
  };
};

export type ResultadoVerificacionPdfImpresion = {
  version: string;
  ejecutadoEn: string;
  archivo: string;
  contentDisposition: string;
  paginaTamanoCartaOk: boolean;
  qrFolioEnTodasLasPaginas: boolean;
  reglasTintaOk: boolean;
  hashSha256: string;
  bytes: number;
};

export type ResultadoUxVisualRegression = {
  version: string;
  ejecutadoEn: string;
  suite: string;
  snapshots: Array<{
    id: string;
    estado: 'ok' | 'error';
    detalle?: string;
  }>;
};
