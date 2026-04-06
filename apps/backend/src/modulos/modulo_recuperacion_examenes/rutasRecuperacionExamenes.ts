import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';
import {
  listarBundles,
  reconstruirBundle,
  reconstruirManifest,
  verificarRecuperacion
} from './controladorRecuperacionExamenes';
import {
  esquemaBodyVacioOpcional,
  esquemaReconstruirBundle,
  esquemaReconstruirManifest,
  esquemaVerificarRecuperacion
} from './validacionesRecuperacionExamenes';

const router = Router();

router.get('/bundles', requerirPermiso('recuperacion:leer'), listarBundles);
router.post(
  '/verificar',
  requerirPermiso('recuperacion:leer'),
  validarCuerpo(esquemaVerificarRecuperacion, { strict: true }),
  verificarRecuperacion
);
router.post(
  '/manifest/reconstruir',
  requerirPermiso('recuperacion:reconstruir'),
  validarCuerpo(esquemaReconstruirManifest, { strict: true }),
  reconstruirManifest
);
router.post(
  '/bundle/reconstruir',
  requerirPermiso('recuperacion:reconstruir'),
  validarCuerpo(esquemaReconstruirBundle, { strict: true }),
  reconstruirBundle
);
router.post('/noop', requerirPermiso('recuperacion:leer'), validarCuerpo(esquemaBodyVacioOpcional, { strict: true }), (_req, res) =>
  res.json({ ok: true })
);

export default router;
