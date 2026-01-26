/**
 * Rutas de escaneo OMR.
 */
import { Router } from 'express';
import { analizarImagen } from './controladorEscaneoOmr';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { esquemaAnalizarOmr } from './validacionesOmr';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';

const router = Router();

router.post('/analizar', requerirPermiso('omr:analizar'), validarCuerpo(esquemaAnalizarOmr, { strict: true }), analizarImagen);

export default router;
