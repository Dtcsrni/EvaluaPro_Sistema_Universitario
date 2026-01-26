/**
 * Rutas de banco de preguntas.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import {
	actualizarTemaBanco,
	actualizarPregunta,
	archivarTemaBanco,
	archivarPregunta,
	crearTemaBanco,
	crearPregunta,
	moverPreguntasTemaBanco,
	quitarTemaBanco,
	listarTemasBanco,
	listarBancoPreguntas
} from './controladorBancoPreguntas';
import {
	esquemaActualizarPregunta,
	esquemaActualizarTemaBanco,
	esquemaBodyVacioOpcional,
	esquemaCrearTemaBanco,
	esquemaCrearPregunta,
	esquemaMoverPreguntasTemaBanco,
	esquemaQuitarTemaBanco
} from './validacionesBancoPreguntas';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';

const router = Router();

router.get('/', requerirPermiso('banco:leer'), listarBancoPreguntas);

router.get('/temas', requerirPermiso('banco:leer'), listarTemasBanco);
router.post('/temas', requerirPermiso('banco:gestionar'), validarCuerpo(esquemaCrearTemaBanco, { strict: true }), crearTemaBanco);
router.post(
	'/temas/:temaId/actualizar',
	requerirPermiso('banco:gestionar'),
	validarCuerpo(esquemaActualizarTemaBanco, { strict: true }),
	actualizarTemaBanco
);
router.post(
	'/temas/:temaId/archivar',
	requerirPermiso('banco:archivar'),
	validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
	archivarTemaBanco
);

router.post('/', requerirPermiso('banco:gestionar'), validarCuerpo(esquemaCrearPregunta, { strict: true }), crearPregunta);
router.post(
	'/:preguntaId/actualizar',
	requerirPermiso('banco:gestionar'),
	validarCuerpo(esquemaActualizarPregunta, { strict: true }),
	actualizarPregunta
);
router.post('/mover-tema', requerirPermiso('banco:gestionar'), validarCuerpo(esquemaMoverPreguntasTemaBanco, { strict: true }), moverPreguntasTemaBanco);
router.post('/quitar-tema', requerirPermiso('banco:gestionar'), validarCuerpo(esquemaQuitarTemaBanco, { strict: true }), quitarTemaBanco);
router.post(
	'/:preguntaId/archivar',
	requerirPermiso('banco:archivar'),
	validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
	archivarPregunta
);

export default router;
