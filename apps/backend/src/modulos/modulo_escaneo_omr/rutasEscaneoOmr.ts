/**
 * Rutas de escaneo OMR.
 */
import { Router } from 'express';
import { analizarImagen, prevalidarLoteCapturas } from './controladorEscaneoOmr';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { esquemaAnalizarOmr, esquemaPrevalidarLoteOmr } from './validacionesOmr';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';

const router = Router();

router.post('/analizar', requerirPermiso('omr:analizar'), validarCuerpo(esquemaAnalizarOmr, { strict: true }), analizarImagen);
router.post(
  '/prevalidar-lote',
  requerirPermiso('omr:analizar'),
  validarCuerpo(esquemaPrevalidarLoteOmr, { strict: true }),
  prevalidarLoteCapturas
);

export default router;
