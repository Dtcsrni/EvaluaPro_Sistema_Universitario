/**
 * Rutas de periodos.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { actualizarPeriodo, archivarPeriodo, crearPeriodo, eliminarPeriodoDev, listarPeriodos } from './controladorPeriodos';
import { esquemaActualizarPeriodo, esquemaBodyVacioOpcional, esquemaCrearPeriodo } from './validacionesPeriodos';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';

const router = Router();

router.get('/', requerirPermiso('periodos:leer'), listarPeriodos);
router.post('/', requerirPermiso('periodos:gestionar'), validarCuerpo(esquemaCrearPeriodo, { strict: true }), crearPeriodo);
router.post(
  '/:periodoId/actualizar',
  requerirPermiso('periodos:gestionar'),
  validarCuerpo(esquemaActualizarPeriodo, { strict: true }),
  actualizarPeriodo
);
router.post(
  '/:periodoId/archivar',
  requerirPermiso('periodos:archivar'),
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  archivarPeriodo
);
router.post(
  '/:periodoId/eliminar',
  requerirPermiso('periodos:eliminar_dev'),
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  eliminarPeriodoDev
);

export default router;
