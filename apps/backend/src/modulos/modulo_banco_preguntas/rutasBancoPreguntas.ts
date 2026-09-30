/**
 * Rutas de banco de preguntas.
 */
import { Router } from 'express';
import multer from 'multer';
import { validarCuerpo } from '../../compartido/validaciones/validar.js';
import { validarQueryRobusto } from '../../compartido/robustez/utilitariosControlador.js';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import {
	actualizarTemaBanco,
	archivarTemaBanco,
	archivarPregunta,
	eliminarPregunta,
	crearTemaBanco,
	listarAuditoriaTemaBanco,
	moverPreguntasTemaBanco,
	quitarTemaBanco,
	listarTemasBanco,
	obtenerTemaBanco,
	listarBancoPreguntas
} from './controladorBancoPreguntas.js';
import {
	esquemaActualizarPregunta,
	esquemaActualizarTemaBanco,
	esquemaArchivarTemaBanco,
	esquemaBodyVacioOpcional,
	esquemaCrearTemaBanco,
	esquemaListarAuditoriaTemaBanco,
  esquemaCrearPregunta,
  esquemaConfirmarReactivos,
	esquemaPreviewImportacionReactivos,
	esquemaRegistrarCalibracionReactivo,
	esquemaMoverPreguntasTemaBanco,
	esquemaQuitarTemaBanco
} from './validacionesBancoPreguntas.js';
import {
	confirmarImportacionReactivos,
	descargarPlantillaXlsxReactivos,
	listarVersionesReactivoControlador,
	listarReactivosControlador,
	obtenerReactivoControlador,
	obtenerCalibracionReactivoControlador,
	obtenerEsquemaReactivos,
	obtenerImportacionReactivosControlador,
	listarImportacionesReactivosControlador,
	previsualizarImportacionReactivos,
	publicarReactivoControlador,
	retirarReactivoControlador,
	revisarReactivoControlador,
	registrarCalibracionReactivoControlador
} from './controladorReactivos.js';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos.js';

const router = Router();

const uploadReactivos = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 2 * 1024 * 1024, files: 1 },
	fileFilter: (_req, file, cb) => {
		const nombre = String(file.originalname ?? '').toLowerCase();
		if (nombre.endsWith('.json') || nombre.endsWith('.jsonl') || nombre.endsWith('.xlsx') || file.mimetype === 'application/json' || file.mimetype === 'application/jsonl') {
			cb(null, true);
			return;
		}
		cb(new Error('Solo se aceptan archivos JSON, JSONL o XLSX'));
	}
});

function rechazarEscrituraLegada() {
	throw new ErrorAplicacion(
		'RUTA_ESCRITURA_LEGADA_RETIRADA',
		'La escritura directa al banco legado fue retirada. Usa el flujo de reactivos con validación, preview y confirmación.',
		410
	);
}

router.get('/', requerirPermiso('banco:leer'), listarBancoPreguntas);

router.get('/importaciones/esquema', requerirPermiso('banco:leer'), obtenerEsquemaReactivos);
router.get('/importaciones/plantilla.xlsx', requerirPermiso('banco:leer'), descargarPlantillaXlsxReactivos);
router.post(
	'/importaciones/preview',
	requerirPermiso('banco:ingestar'),
	uploadReactivos.single('archivo'),
	validarCuerpo(esquemaPreviewImportacionReactivos, { strict: true }),
	previsualizarImportacionReactivos
);
router.get('/importaciones', requerirPermiso('banco:leer'), listarImportacionesReactivosControlador);
router.get('/importaciones/:importId', requerirPermiso('banco:leer'), obtenerImportacionReactivosControlador);
router.post(
	'/importaciones/:importId/confirmar',
	requerirPermiso('banco:ingestar'),
	validarCuerpo(esquemaConfirmarReactivos, { strict: true }),
	confirmarImportacionReactivos
);
router.get('/reactivos', requerirPermiso('banco:leer'), listarReactivosControlador);
router.get('/reactivos/:reactivoId', requerirPermiso('banco:leer'), obtenerReactivoControlador);
router.post('/reactivos/:reactivoId/publicar', requerirPermiso('banco:publicar'), validarCuerpo(esquemaBodyVacioOpcional, { strict: true }), publicarReactivoControlador);
router.post('/reactivos/:reactivoId/revisar', requerirPermiso('banco:revisar'), validarCuerpo(esquemaBodyVacioOpcional, { strict: true }), revisarReactivoControlador);
router.post('/reactivos/:reactivoId/retirar', requerirPermiso('banco:publicar'), validarCuerpo(esquemaBodyVacioOpcional, { strict: true }), retirarReactivoControlador);
router.get('/reactivos/:reactivoId/versiones', requerirPermiso('banco:leer'), listarVersionesReactivoControlador);
router.get('/reactivos/:reactivoId/calibracion', requerirPermiso('banco:calibracion:leer'), obtenerCalibracionReactivoControlador);
router.post(
	'/reactivos/:reactivoId/calibracion',
	requerirPermiso('banco:gestionar'),
	validarCuerpo(esquemaRegistrarCalibracionReactivo, { strict: true }),
	registrarCalibracionReactivoControlador
);

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

router.post('/', requerirPermiso('banco:gestionar'), validarCuerpo(esquemaCrearPregunta, { strict: true }), rechazarEscrituraLegada);
router.post(
	'/:preguntaId/actualizar',
	requerirPermiso('banco:gestionar'),
	validarCuerpo(esquemaActualizarPregunta, { strict: true }),
	rechazarEscrituraLegada
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
