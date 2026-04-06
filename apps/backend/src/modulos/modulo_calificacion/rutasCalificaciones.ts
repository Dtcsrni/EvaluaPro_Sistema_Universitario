/**
 * Rutas de calificaciones.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import {
  calificarExamen,
  listarSolicitudesRevision,
  obtenerCalificacionPorExamen,
  resolverSolicitudRevision,
  sincronizarSolicitudesRevision
} from './controladorCalificacion';
import {
  esquemaCalificarExamen,
  esquemaResolverSolicitudRevision,
  esquemaSincronizarSolicitudesRevision
} from './validacionesCalificacion';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';

const router = Router();

router.post('/calificar', requerirPermiso('calificaciones:calificar'), validarCuerpo(esquemaCalificarExamen, { strict: true }), calificarExamen);
router.get('/examen/:examenGeneradoId', requerirPermiso('calificaciones:calificar'), obtenerCalificacionPorExamen);
router.get('/revision/solicitudes', requerirPermiso('calificaciones:calificar'), listarSolicitudesRevision);
router.post(
  '/revision/solicitudes/sincronizar',
  requerirPermiso('calificaciones:calificar'),
  validarCuerpo(esquemaSincronizarSolicitudesRevision, { strict: true }),
  sincronizarSolicitudesRevision
);
router.post(
  '/revision/solicitudes/:id/resolver',
  requerirPermiso('calificaciones:calificar'),
  validarCuerpo(esquemaResolverSolicitudRevision, { strict: true }),
  resolverSolicitudRevision
);

export default router;
