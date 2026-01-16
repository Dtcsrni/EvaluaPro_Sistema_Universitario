/**
 * Rutas de generacion de examenes (plantillas y PDF).
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import {
  crearPlantilla,
  generarExamen,
  generarExamenesLote,
  listarPlantillas
} from './controladorGeneracionPdf';
import { esquemaCrearPlantilla, esquemaGenerarExamen, esquemaGenerarExamenesLote } from './validacionesExamenes';
import { descargarPdf, listarExamenesGenerados, obtenerExamenPorFolio } from './controladorListadoGenerados';

const router = Router();

router.get('/plantillas', listarPlantillas);
router.post('/plantillas', validarCuerpo(esquemaCrearPlantilla, { strict: true }), crearPlantilla);
router.get('/generados', listarExamenesGenerados);
router.get('/generados/folio/:folio', obtenerExamenPorFolio);
router.get('/generados/:id/pdf', descargarPdf);
router.post('/generados', validarCuerpo(esquemaGenerarExamen, { strict: true }), generarExamen);
router.post('/generados/lote', validarCuerpo(esquemaGenerarExamenesLote, { strict: true }), generarExamenesLote);

export default router;
