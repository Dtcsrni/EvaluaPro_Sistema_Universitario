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

const router = Router();

router.post('/vincular', validarCuerpo(esquemaVincularEntrega, { strict: true }), vincularEntrega);
router.post('/vincular-folio', validarCuerpo(esquemaVincularEntregaPorFolio, { strict: true }), vincularEntregaPorFolio);
router.post('/deshacer-folio', validarCuerpo(esquemaDeshacerEntregaPorFolio, { strict: true }), deshacerEntregaPorFolio);


export default router;
