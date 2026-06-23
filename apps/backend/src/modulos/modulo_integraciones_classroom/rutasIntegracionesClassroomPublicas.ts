/**
 * rutasIntegracionesClassroomPublicas
 *
 * Responsabilidad: Registro de rutas HTTP del dominio y aplicacion de middleware de seguridad/validacion.
 * Limites: No cambiar orden o permisos de rutas sin validar impacto en contratos y tests.
 */
import { Router } from 'express';
import { callbackOauthClassroom } from './controladorIntegracionesClassroom';

const router = Router();

router.get('/oauth/callback', callbackOauthClassroom);

export default router;
