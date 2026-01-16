/**
 * Rutas de periodos.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { archivarPeriodo, borrarPeriodo, crearPeriodo, listarPeriodos } from './controladorPeriodos';
import { esquemaBodyVacioOpcional, esquemaCrearPeriodo } from './validacionesPeriodos';

const router = Router();

router.get('/', listarPeriodos);
router.post('/', validarCuerpo(esquemaCrearPeriodo, { strict: true }), crearPeriodo);
router.post('/:periodoId/archivar', validarCuerpo(esquemaBodyVacioOpcional, { strict: true }), archivarPeriodo);
router.delete('/:periodoId', borrarPeriodo);

export default router;
