/**
 * Rutas de banco de preguntas.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { asignarMateriaPregunta, crearPregunta, listarBancoPreguntas } from './controladorBancoPreguntas';
import { esquemaAsignarMateriaPregunta, esquemaCrearPregunta } from './validacionesBancoPreguntas';

const router = Router();

router.get('/', listarBancoPreguntas);
router.post('/', validarCuerpo(esquemaCrearPregunta, { strict: true }), crearPregunta);
router.post('/:preguntaId/asignar-materia', validarCuerpo(esquemaAsignarMateriaPregunta, { strict: true }), asignarMateriaPregunta);

export default router;
