export { descargarPdfLoteUseCase } from './application/usecases/generacionPlantillas.js';
export { extraerResumenQrExamen, type ResumenQrExamen } from './domain/qrExamen.js';
export { resolverOmrTemplateId } from './domain/templateCanonico.js';
export { type RecoveryBundle, type RecoveryManifest, type RecoveryQuestionSnapshot, verificarRecoveryBundle, verificarRecoveryManifest } from './domain/recoveryManifest.js';
export { rasterizarPdfParaPreview } from './infra/rasterizadorPdfPreview.js';
export { ExamenGenerado } from './modeloExamenGenerado.js';
export { ExamenPlantilla, normalizarTituloPlantilla } from './modeloExamenPlantilla.js';
export { generarPdfExamen } from './servicioGeneracionPdf.js';
export { type MapaVariante, type PreguntaBase } from './servicioVariantes.js';
export { type OmrTemplateId, type TemplateVersion } from './shared/tiposPdf.js';
export { ALTO_CARTA, ANCHO_CARTA, MM_A_PUNTOS } from './shared/tiposPdf.js';
export { esquemaBodyVacioOpcional } from './validacionesExamenes.js';
export {
  OMR_CANONICAL_CONTRACT_ID,
  OMR_CANONICAL_DISPLAY_LABEL,
  OMR_LAYOUT_RELEASE_VERSION,
  TEMPLATE_VERSION_CANONICA
} from './domain/templateCanonico.js';
