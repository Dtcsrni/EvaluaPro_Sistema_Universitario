/**
 * Rutas de vinculacion de entregas.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { deshacerEntregaPorFolio, vincularEntrega, vincularEntregaPorFolio } from './controladorVinculacionEntrega';
import {
  esquemaDeshacerEntregaPorFolio,
  esquemaVincularEntrega,
  esquemaVincularEntregaPorFolio
} from './validacionesVinculacion';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';

const router = Router();

router.post(
  '/vincular',
  requerirPermiso('entregas:gestionar'),
  validarCuerpo(esquemaVincularEntrega, { strict: true }),
  vincularEntrega
);
router.post(
  '/vincular-folio',
  requerirPermiso('entregas:gestionar'),
  validarCuerpo(esquemaVincularEntregaPorFolio, { strict: true }),
  vincularEntregaPorFolio
);
router.post(
  '/deshacer-folio',
  requerirPermiso('entregas:gestionar'),
  validarCuerpo(esquemaDeshacerEntregaPorFolio, { strict: true }),
  deshacerEntregaPorFolio
);


export default router;
