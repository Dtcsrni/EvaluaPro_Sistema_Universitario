/**
 * Rutas de generacion de examenes (plantillas y PDF).
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar.js';
import { validarQueryRobusto } from '../../compartido/robustez/utilitariosControlador.js';
import {
  actualizarPlantilla,
  archivarPlantilla,
  crearPlantilla,
  cambiarEstadoLotePdf,
  eliminarPlantilla,
  generarExamen,
  generarExamenesLote,
  listarAuditoriaLotePdf,
  listarAuditoriaPlantilla,
  obtenerPlantilla,
  obtenerProgresoGeneracionLote,
  descargarPdfLote,
  listarPlantillas,
  previsualizarPlantilla,
  previsualizarPlantillaPdf,
  previsualizarPlantillaPdfVisual
} from './controladorGeneracionPdf.js';
import {
  esquemaActualizarPlantilla,
  esquemaBodyVacioOpcional,
  esquemaCambiarEstadoPlantilla,
  esquemaCambiarEstadoLotePdf,
  esquemaCrearPlantilla,
  esquemaGenerarExamen,
  esquemaGenerarExamenesLote,
  esquemaListarExamenesGenerados,
  esquemaListarLotesExamenes,
  esquemaListarAuditoriaLotePdf,
  esquemaListarAuditoriaPlantilla,
  esquemaPurgarExamenesGenerados,
  esquemaRegenerarExamenGenerado
} from './validacionesExamenes.js';
import {
  archivarExamenGenerado,
  descargarPdf,
  listarExamenesGenerados,
  listarLotesExamenesGenerados,
  obtenerExamenGeneradoPorId,
  obtenerExamenPorFolio,
  purgarExamenesGenerados,
  regenerarPdfExamen
} from './controladorListadoGenerados.js';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos.js';

const router = Router();

router.get('/plantillas', requerirPermiso('plantillas:leer'), listarPlantillas);
router.get('/plantillas/:id', requerirPermiso('plantillas:leer'), obtenerPlantilla);
router.get('/plantillas/:id/auditoria', requerirPermiso('plantillas:leer'), validarQueryRobusto(esquemaListarAuditoriaPlantilla), listarAuditoriaPlantilla);
router.post('/plantillas', requerirPermiso('plantillas:gestionar'), validarCuerpo(esquemaCrearPlantilla, { strict: true }), crearPlantilla);
router.post('/plantillas/:id', requerirPermiso('plantillas:gestionar'), validarCuerpo(esquemaActualizarPlantilla, { strict: true }), actualizarPlantilla);
router.post(
  '/plantillas/:id/archivar',
  requerirPermiso('plantillas:archivar'),
  validarCuerpo(esquemaCambiarEstadoPlantilla, { strict: true }),
  archivarPlantilla
);
router.post(
  '/plantillas/:id/eliminar',
  requerirPermiso('plantillas:archivar'),
  validarCuerpo(esquemaCambiarEstadoPlantilla, { strict: true }),
  eliminarPlantilla
);
router.get('/plantillas/:id/previsualizar', requerirPermiso('plantillas:previsualizar'), previsualizarPlantilla);
router.get('/plantillas/:id/previsualizar/pdf', requerirPermiso('plantillas:previsualizar'), previsualizarPlantillaPdf);
router.get('/plantillas/:id/previsualizar/pdf/visual', requerirPermiso('plantillas:previsualizar'), previsualizarPlantillaPdfVisual);
router.get('/generados', requerirPermiso('examenes:leer'), validarQueryRobusto(esquemaListarExamenesGenerados), listarExamenesGenerados);
router.get('/generados/lotes', requerirPermiso('examenes:leer'), validarQueryRobusto(esquemaListarLotesExamenes), listarLotesExamenesGenerados);
router.get('/generados/lote/:loteId/auditoria', requerirPermiso('examenes:leer'), validarQueryRobusto(esquemaListarAuditoriaLotePdf), listarAuditoriaLotePdf);
router.post('/generados/lote/:loteId/archivar', requerirPermiso('examenes:archivar'), validarCuerpo(esquemaCambiarEstadoLotePdf, { strict: true }), cambiarEstadoLotePdf);
router.post('/generados/lote/:loteId/restaurar', requerirPermiso('examenes:archivar'), validarCuerpo(esquemaCambiarEstadoLotePdf, { strict: true }), cambiarEstadoLotePdf);
router.get('/generados/folio/:folio', requerirPermiso('examenes:leer'), obtenerExamenPorFolio);
router.get('/generados/:id', requerirPermiso('examenes:leer'), obtenerExamenGeneradoPorId);
router.get('/generados/:id/pdf', requerirPermiso('examenes:descargar'), descargarPdf);
router.get('/generados/lote/:loteId/pdf', requerirPermiso('examenes:descargar'), descargarPdfLote);
router.get('/generados/lote/:loteId/progreso', requerirPermiso('examenes:leer'), obtenerProgresoGeneracionLote);
router.post(
  '/generados/purge',
  requerirPermiso('examenes:archivar'),
  validarCuerpo(esquemaPurgarExamenesGenerados, { strict: true }),
  purgarExamenesGenerados
);
router.post(
  '/generados/:id/regenerar',
  requerirPermiso('examenes:regenerar'),
  validarCuerpo(esquemaRegenerarExamenGenerado, { strict: true }),
  regenerarPdfExamen
);
router.post(
  '/generados/:id/archivar',
  requerirPermiso('examenes:archivar'),
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  archivarExamenGenerado
);
router.post('/generados', requerirPermiso('examenes:generar'), validarCuerpo(esquemaGenerarExamen, { strict: true }), generarExamen);
router.post(
  '/generados/lote',
  requerirPermiso('examenes:generar'),
  validarCuerpo(esquemaGenerarExamenesLote, { strict: true }),
  generarExamenesLote
);

export default router;
