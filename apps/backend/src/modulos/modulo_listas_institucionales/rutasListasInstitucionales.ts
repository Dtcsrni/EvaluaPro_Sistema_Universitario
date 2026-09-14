/**
 * Rutas para listas institucionales por plantilla.
 */
import { Router } from 'express';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos.js';
import { generarListaInstitucional, listarPlantillas } from './controladorListasInstitucionales.js';

const router = Router();

router.get('/plantillas', requerirPermiso('analiticas:leer'), listarPlantillas);
router.get('/generar', requerirPermiso('analiticas:leer'), generarListaInstitucional);

export default router;
