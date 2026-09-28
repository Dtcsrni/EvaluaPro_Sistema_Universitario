/**
 * rutasIntegracionesClassroom
 *
 * Responsabilidad: Registro de rutas HTTP del dominio y aplicacion de middleware de seguridad/validacion.
 * Limites: No cambiar orden o permisos de rutas sin validar impacto en contratos y tests.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar.js';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos.js';
import {
  ejecutarPullClassroom,
  actualizarInclusionPromedioClassroom,
  iniciarOauthClassroom,
  listarMapeosClassroom,
  mapearClassroomEvidencia
} from './controladorIntegracionesClassroom.js';
import { esquemaInclusionPromedioClassroom, esquemaMapearClassroom, esquemaPullClassroom } from './validacionesClassroom.js';

const router = Router();

router.get('/oauth/iniciar', requerirPermiso('classroom:conectar'), iniciarOauthClassroom);
router.get('/mapear', requerirPermiso('classroom:pull'), listarMapeosClassroom);
router.put(
  '/promedio-tareas',
  requerirPermiso('classroom:pull'),
  validarCuerpo(esquemaInclusionPromedioClassroom, { strict: true }),
  actualizarInclusionPromedioClassroom
);
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
