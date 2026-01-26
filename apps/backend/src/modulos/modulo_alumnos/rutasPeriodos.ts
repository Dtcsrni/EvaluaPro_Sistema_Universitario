/**
 * Rutas de periodos.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { archivarPeriodo, crearPeriodo, listarPeriodos } from './controladorPeriodos';
import { esquemaBodyVacioOpcional, esquemaCrearPeriodo } from './validacionesPeriodos';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';

const router = Router();

router.get('/', requerirPermiso('periodos:leer'), listarPeriodos);
router.post('/', requerirPermiso('periodos:gestionar'), validarCuerpo(esquemaCrearPeriodo, { strict: true }), crearPeriodo);
router.post(
  '/:periodoId/archivar',
  requerirPermiso('periodos:archivar'),
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  archivarPeriodo
);

export default router;
