/**
 * Rutas de cumplimiento y privacidad.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar.js';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos.js';
import {
  crearSolicitudDsr,
  listarAuditoriaCompliance,
  obtenerEstadoCompliance,
  purgarCompliance
} from './controladorCompliance.js';
import { esquemaCrearDsr, esquemaPurgeCompliance } from './validacionesCompliance.js';

const router = Router();

router.get('/status', requerirPermiso('compliance:leer'), obtenerEstadoCompliance);
router.get('/audit-log', requerirPermiso('compliance:leer'), listarAuditoriaCompliance);
router.post('/dsr', requerirPermiso('compliance:gestionar'), validarCuerpo(esquemaCrearDsr, { strict: true }), crearSolicitudDsr);
router.post(
  '/purge',
  requerirPermiso('compliance:expurgar'),
  validarCuerpo(esquemaPurgeCompliance, { strict: true }),
  purgarCompliance
);

export default router;
