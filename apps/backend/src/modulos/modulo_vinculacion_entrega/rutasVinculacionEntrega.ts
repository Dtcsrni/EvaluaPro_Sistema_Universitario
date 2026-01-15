/**
 * Rutas de vinculacion de entregas.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { vincularEntrega, vincularEntregaPorFolio } from './controladorVinculacionEntrega';
import { esquemaVincularEntrega, esquemaVincularEntregaPorFolio } from './validacionesVinculacion';

const router = Router();

router.post('/vincular', validarCuerpo(esquemaVincularEntrega, { strict: true }), vincularEntrega);
router.post('/vincular-folio', validarCuerpo(esquemaVincularEntregaPorFolio, { strict: true }), vincularEntregaPorFolio);


export default router;
