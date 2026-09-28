/**
 * Rutas de vinculacion de entregas.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar.js';
import { validarQueryRobusto } from '../../compartido/robustez/utilitariosControlador.js';
import { deshacerEntregaPorFolio, listarEntregas, obtenerEntrega, vincularEntrega, vincularEntregaPorFolio } from './controladorVinculacionEntrega.js';
import {
  esquemaDeshacerEntregaPorFolio,
  esquemaListarEntregas,
  esquemaVincularEntrega,
  esquemaVincularEntregaPorFolio
} from './validacionesVinculacion.js';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos.js';

const router = Router();

router.get('/', requerirPermiso('entregas:gestionar'), validarQueryRobusto(esquemaListarEntregas), listarEntregas);
router.get('/:entregaId', requerirPermiso('entregas:gestionar'), obtenerEntrega);

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
