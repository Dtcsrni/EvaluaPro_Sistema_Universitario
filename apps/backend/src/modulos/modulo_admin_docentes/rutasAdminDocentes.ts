/**
 * Rutas admin para gestion de docentes.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar.js';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos.js';
import { actualizarDocenteAdmin, listarDocentes } from './controladorAdminDocentes.js';
import { esquemaActualizarDocenteAdmin } from './validacionesAdminDocentes.js';

const router = Router();

router.get('/docentes', requerirPermiso('docentes:administrar'), listarDocentes);
router.post(
  '/docentes/:docenteId',
  requerirPermiso('docentes:administrar'),
  validarCuerpo(esquemaActualizarDocenteAdmin, { strict: true }),
  actualizarDocenteAdmin
);

export default router;

