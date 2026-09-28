/**
 * Rutas de banco de preguntas.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar.js';
import { validarQueryRobusto } from '../../compartido/robustez/utilitariosControlador.js';
import {
	actualizarTemaBanco,
	actualizarPregunta,
	archivarTemaBanco,
	archivarPregunta,
	eliminarPregunta,
	crearTemaBanco,
	crearPregunta,
	obtenerTemaBanco,
	listarAuditoriaTemaBanco,
	moverPreguntasTemaBanco,
	quitarTemaBanco,
	listarTemasBanco,
	listarBancoPreguntas
} from './controladorBancoPreguntas.js';
import {
	esquemaActualizarPregunta,
	esquemaActualizarTemaBanco,
	esquemaBodyVacioOpcional,
	esquemaCrearTemaBanco,
	esquemaCrearPregunta,
	esquemaArchivarTemaBanco,
	esquemaListarAuditoriaTemaBanco,
	esquemaMoverPreguntasTemaBanco,
	esquemaQuitarTemaBanco
} from './validacionesBancoPreguntas.js';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos.js';

const router = Router();

router.get('/', requerirPermiso('banco:leer'), listarBancoPreguntas);

router.get('/temas', requerirPermiso('banco:leer'), listarTemasBanco);
router.get('/temas/:temaId', requerirPermiso('banco:leer'), obtenerTemaBanco);
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
	validarCuerpo(esquemaArchivarTemaBanco, { strict: true }),
	archivarTemaBanco
);
router.get(
	'/temas/:temaId/auditoria',
	requerirPermiso('banco:leer'),
	validarQueryRobusto(esquemaListarAuditoriaTemaBanco),
	listarAuditoriaTemaBanco
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
router.post(
	'/:preguntaId/eliminar',
	requerirPermiso('banco:archivar'),
	validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
	eliminarPregunta
);

export default router;
