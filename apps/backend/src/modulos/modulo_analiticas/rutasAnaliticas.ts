/**
 * Rutas de analiticas y banderas.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { crearBandera, exportarCsv, exportarCsvCalificaciones, listarBanderas, registrarEventosUso } from './controladorAnaliticas';
import { esquemaCrearBandera, esquemaExportarCsv } from './validacionesAnaliticas';
import { esquemaRegistrarEventosUso } from './validacionesEventosUso';

const router = Router();

router.get('/banderas', listarBanderas);
router.post('/banderas', validarCuerpo(esquemaCrearBandera, { strict: true }), crearBandera);
router.post('/eventos-uso', validarCuerpo(esquemaRegistrarEventosUso, { strict: true }), registrarEventosUso);
router.post('/exportar-csv', validarCuerpo(esquemaExportarCsv, { strict: true }), exportarCsv);
router.get('/calificaciones-csv', exportarCsvCalificaciones);

export default router;
