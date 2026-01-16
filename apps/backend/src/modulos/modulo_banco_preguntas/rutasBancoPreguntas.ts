/**
 * Rutas de banco de preguntas.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import {
	asignarMateriaPregunta,
	actualizarPregunta,
	crearPregunta,
	eliminarPregunta,
	listarBancoPreguntas
} from './controladorBancoPreguntas';
import {
	esquemaActualizarPregunta,
	esquemaAsignarMateriaPregunta,
	esquemaCrearPregunta
} from './validacionesBancoPreguntas';

const router = Router();

router.get('/', listarBancoPreguntas);
router.post('/', validarCuerpo(esquemaCrearPregunta, { strict: true }), crearPregunta);
router.post('/:preguntaId/asignar-materia', validarCuerpo(esquemaAsignarMateriaPregunta, { strict: true }), asignarMateriaPregunta);
router.post('/:preguntaId/actualizar', validarCuerpo(esquemaActualizarPregunta, { strict: true }), actualizarPregunta);
router.delete('/:preguntaId', eliminarPregunta);

export default router;
