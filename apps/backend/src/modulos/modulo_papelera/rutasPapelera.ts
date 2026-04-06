/**
 * Rutas de papelera (dev/admin).
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { esquemaBodyVacioOpcional } from '../modulo_alumnos/validacionesPeriodos';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';
import { listarPapelera, restaurarPapelera } from './controladorPapelera';

const router = Router();

router.get('/', requerirPermiso('docentes:administrar'), listarPapelera);
router.post(
  '/:id/restaurar',
  requerirPermiso('docentes:administrar'),
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  restaurarPapelera
);

export default router;
