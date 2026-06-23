/**
 * rutasIntegracionesClassroom
 *
 * Responsabilidad: Registro de rutas HTTP del dominio y aplicacion de middleware de seguridad/validacion.
 * Limites: No cambiar orden o permisos de rutas sin validar impacto en contratos y tests.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';
import {
  ejecutarPullClassroom,
  iniciarOauthClassroom,
  listarMapeosClassroom,
  mapearClassroomEvidencia
} from './controladorIntegracionesClassroom';
import { esquemaMapearClassroom, esquemaPullClassroom } from './validacionesClassroom';

const router = Router();

router.get('/oauth/iniciar', requerirPermiso('classroom:conectar'), iniciarOauthClassroom);
router.get('/mapear', requerirPermiso('classroom:pull'), listarMapeosClassroom);
router.post(
  '/mapear',
  requerirPermiso('classroom:pull'),
  validarCuerpo(esquemaMapearClassroom, { strict: true }),
  mapearClassroomEvidencia
);
router.post(
  '/pull',
  requerirPermiso('classroom:pull'),
  validarCuerpo(esquemaPullClassroom, { strict: true }),
  ejecutarPullClassroom
);

export default router;
