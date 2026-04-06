/**
 * Rutas de generacion de examenes (plantillas y PDF).
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import {
  actualizarPlantilla,
  archivarPlantilla,
  crearPlantilla,
  eliminarPlantilla,
  generarExamen,
  generarExamenesLote,
  obtenerProgresoGeneracionLote,
  descargarPdfLote,
  listarPlantillas,
  previsualizarPlantilla,
  previsualizarPlantillaPdf
} from './controladorGeneracionPdf';
import {
  esquemaActualizarPlantilla,
  esquemaBodyVacioOpcional,
  esquemaCrearPlantilla,
  esquemaGenerarExamen,
  esquemaGenerarExamenesLote,
  esquemaPurgarExamenesGenerados,
  esquemaRegenerarExamenGenerado
} from './validacionesExamenes';
import {
  archivarExamenGenerado,
  descargarPdf,
  listarExamenesGenerados,
  obtenerExamenPorFolio,
  purgarExamenesGenerados,
  regenerarPdfExamen
} from './controladorListadoGenerados';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';

const router = Router();

router.get('/plantillas', requerirPermiso('plantillas:leer'), listarPlantillas);
router.post('/plantillas', requerirPermiso('plantillas:gestionar'), validarCuerpo(esquemaCrearPlantilla, { strict: true }), crearPlantilla);
router.post('/plantillas/:id', requerirPermiso('plantillas:gestionar'), validarCuerpo(esquemaActualizarPlantilla, { strict: true }), actualizarPlantilla);
router.post(
  '/plantillas/:id/archivar',
  requerirPermiso('plantillas:archivar'),
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  archivarPlantilla
);
router.post(
  '/plantillas/:id/eliminar',
  requerirPermiso('plantillas:archivar'),
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  eliminarPlantilla
);
router.get('/plantillas/:id/previsualizar', requerirPermiso('plantillas:previsualizar'), previsualizarPlantilla);
router.get('/plantillas/:id/previsualizar/pdf', requerirPermiso('plantillas:previsualizar'), previsualizarPlantillaPdf);
router.get('/generados', requerirPermiso('examenes:leer'), listarExamenesGenerados);
router.get('/generados/folio/:folio', requerirPermiso('examenes:leer'), obtenerExamenPorFolio);
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
