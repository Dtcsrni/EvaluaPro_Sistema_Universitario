/**
 * Rutas de papelera (dev/admin).
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar.js';
import { esquemaBodyVacioOpcional } from '../../compartido/validaciones/esquemasComunes.js';
import { requerirPermiso } from '../modulo_autenticacion/index.js';
import { listarPapelera, restaurarPapelera } from './controladorPapelera.js';

const router = Router();

router.get('/', requerirPermiso('docentes:administrar'), listarPapelera);
router.post(
  '/:id/restaurar',
  requerirPermiso('docentes:administrar'),
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  restaurarPapelera
);

export default router;
