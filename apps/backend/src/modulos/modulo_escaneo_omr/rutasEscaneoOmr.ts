/**
 * Rutas de escaneo OMR.
 */
import { Router } from 'express';
import { analizarImagen, prevalidarLoteCapturas } from './controladorEscaneoOmr.js';
import { crearJobOmr, finalizarJobOmr, resolverHojaOmr } from './controladorJobsOmr.js';
import { validarCuerpo } from '../../compartido/validaciones/validar.js';
import { esquemaAnalizarOmr, esquemaCrearJobOmr, esquemaPrevalidarLoteOmr, esquemaResolverJobOmr } from './validacionesOmr.js';
import { esquemaBodyVacioOpcional } from '../modulo_generacion_pdf/validacionesExamenes.js';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos.js';

const router = Router();

router.post('/analizar', requerirPermiso('omr:analizar'), validarCuerpo(esquemaAnalizarOmr, { strict: true }), analizarImagen);
router.post(
  '/prevalidar-lote',
  requerirPermiso('omr:analizar'),
  validarCuerpo(esquemaPrevalidarLoteOmr, { strict: true }),
  prevalidarLoteCapturas
);
router.post('/jobs', requerirPermiso('omr:analizar'), validarCuerpo(esquemaCrearJobOmr, { strict: true }), crearJobOmr);
router.post(
  '/jobs/:jobId/exceptions/:sheetSerial/resolve',
  requerirPermiso('omr:analizar'),
  validarCuerpo(esquemaResolverJobOmr, { strict: true }),
  resolverHojaOmr
);
router.post(
  '/jobs/:jobId/finalize',
  requerirPermiso('omr:analizar'),
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  finalizarJobOmr
);

export default router;
