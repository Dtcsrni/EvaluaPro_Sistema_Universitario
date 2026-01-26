/**
 * Rutas admin para gestion de docentes.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';
import { actualizarDocenteAdmin, listarDocentes } from './controladorAdminDocentes';
import { esquemaActualizarDocenteAdmin } from './validacionesAdminDocentes';

const router = Router();

router.get('/docentes', requerirPermiso('docentes:administrar'), listarDocentes);
router.post(
  '/docentes/:docenteId',
  requerirPermiso('docentes:administrar'),
  validarCuerpo(esquemaActualizarDocenteAdmin, { strict: true }),
  actualizarDocenteAdmin
);

export default router;

