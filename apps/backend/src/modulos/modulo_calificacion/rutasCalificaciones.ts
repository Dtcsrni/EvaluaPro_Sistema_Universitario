/**
 * Rutas de calificaciones.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { calificarExamen } from './controladorCalificacion';
import { esquemaCalificarExamen } from './validacionesCalificacion';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';

const router = Router();

router.post('/calificar', requerirPermiso('calificaciones:calificar'), validarCuerpo(esquemaCalificarExamen, { strict: true }), calificarExamen);

export default router;
