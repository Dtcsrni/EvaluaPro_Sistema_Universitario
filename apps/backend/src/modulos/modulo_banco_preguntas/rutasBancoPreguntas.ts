/**
 * Rutas de banco de preguntas.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import {
	actualizarTemaBanco,
	actualizarPregunta,
	crearTemaBanco,
	crearPregunta,
	eliminarTemaBanco,
	eliminarPregunta,
	listarTemasBanco,
	listarBancoPreguntas
} from './controladorBancoPreguntas';
import {
	esquemaActualizarPregunta,
	esquemaActualizarTemaBanco,
	esquemaCrearTemaBanco,
	esquemaCrearPregunta
} from './validacionesBancoPreguntas';

const router = Router();

router.get('/', listarBancoPreguntas);

router.get('/temas', listarTemasBanco);
router.post('/temas', validarCuerpo(esquemaCrearTemaBanco, { strict: true }), crearTemaBanco);
router.post('/temas/:temaId/actualizar', validarCuerpo(esquemaActualizarTemaBanco, { strict: true }), actualizarTemaBanco);
router.delete('/temas/:temaId', eliminarTemaBanco);

router.post('/', validarCuerpo(esquemaCrearPregunta, { strict: true }), crearPregunta);
router.post('/:preguntaId/actualizar', validarCuerpo(esquemaActualizarPregunta, { strict: true }), actualizarPregunta);
router.delete('/:preguntaId', eliminarPregunta);

export default router;
