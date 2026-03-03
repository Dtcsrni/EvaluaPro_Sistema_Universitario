/**
 * Rutas de autenticacion.
 */
import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { configuracion } from '../../configuracion';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import {
	definirContrasenaDocente,
	actualizarPreferenciasPdfDocente,
	capacidadesIntegracionesPublicas,
	ingresarDocente,
	ingresarDocenteGoogle,
	perfilDocente,
	regenerarAccesosDirectosDocente,
	recuperarContrasenaGoogle,
	solicitarRecuperacionContrasena,
	restablecerContrasena,
	refrescarDocente,
	registrarDocente,
	registrarDocenteGoogle,
	salirDocente
} from './controladorAutenticacion';
import { requerirDocente } from './middlewareAutenticacion';
import {
	esquemaBodyVacioOpcional,
	esquemaActualizarPreferenciasPdf,
	esquemaDefinirContrasenaDocente,
	esquemaIngresarDocente,
	esquemaIngresarDocenteGoogle,
	esquemaRecuperarContrasenaGoogle,
	esquemaSolicitarRecuperacionContrasena,
	esquemaRestablecerContrasena,
	esquemaRegistrarDocente,
	esquemaRegistrarDocenteGoogle
} from './validacionesAutenticacion';
import { requerirPermiso } from './middlewarePermisos';

const router = Router();

const esTest = process.env.NODE_ENV === 'test';
const esProduccion = configuracion.entorno === 'production';

const sinRateLimit: RequestHandler = (_req, _res, next) => next();

const limiterCredenciales: RequestHandler = esProduccion
	? rateLimit({
		windowMs: configuracion.rateLimitWindowMs,
		limit: esTest ? 10_000 : configuracion.rateLimitCredencialesLimit,
		standardHeaders: true,
		legacyHeaders: false,
		handler: (_req, res) => {
			res.status(429).json({
				error: {
					codigo: 'RATE_LIMIT',
					mensaje: 'Demasiados intentos, intenta mas tarde'
				}
			});
		}
	})
	: sinRateLimit;

const limiterRefresco: RequestHandler = esProduccion
	? rateLimit({
		windowMs: configuracion.rateLimitWindowMs,
		limit: esTest ? 10_000 : configuracion.rateLimitRefrescoLimit,
		standardHeaders: true,
		legacyHeaders: false,
		handler: (_req, res) => {
			res.status(429).json({
				error: {
					codigo: 'RATE_LIMIT',
					mensaje: 'Demasiados intentos, intenta mas tarde'
				}
			});
		}
	})
	: sinRateLimit;

router.post('/registrar', limiterCredenciales, validarCuerpo(esquemaRegistrarDocente, { strict: true }), registrarDocente);
router.get('/capacidades-integraciones', capacidadesIntegracionesPublicas);
router.post('/registrar-google', limiterCredenciales, validarCuerpo(esquemaRegistrarDocenteGoogle, { strict: true }), registrarDocenteGoogle);
router.post('/ingresar', limiterCredenciales, validarCuerpo(esquemaIngresarDocente, { strict: true }), ingresarDocente);
router.post('/google', limiterCredenciales, validarCuerpo(esquemaIngresarDocenteGoogle, { strict: true }), ingresarDocenteGoogle);
router.post(
	'/recuperar-contrasena-google',
	limiterCredenciales,
	validarCuerpo(esquemaRecuperarContrasenaGoogle, { strict: true }),
	recuperarContrasenaGoogle
);
router.post(
	'/solicitar-recuperacion-contrasena',
	limiterCredenciales,
	validarCuerpo(esquemaSolicitarRecuperacionContrasena, { strict: true }),
	solicitarRecuperacionContrasena
);
router.post(
	'/restablecer-contrasena',
	limiterCredenciales,
	validarCuerpo(esquemaRestablecerContrasena, { strict: true }),
	restablecerContrasena
);
router.post('/refrescar', limiterRefresco, validarCuerpo(esquemaBodyVacioOpcional, { strict: true }), refrescarDocente);
router.post('/salir', validarCuerpo(esquemaBodyVacioOpcional, { strict: true }), salirDocente);
router.post(
	'/definir-contrasena',
	limiterCredenciales,
	requerirDocente,
	requerirPermiso('cuenta:actualizar'),
	validarCuerpo(esquemaDefinirContrasenaDocente, { strict: true }),
	definirContrasenaDocente
);
router.get('/perfil', requerirDocente, requerirPermiso('cuenta:leer'), perfilDocente);

router.post(
	'/preferencias/pdf',
	requerirDocente,
	requerirPermiso('cuenta:actualizar'),
	validarCuerpo(esquemaActualizarPreferenciasPdf, { strict: true }),
	actualizarPreferenciasPdfDocente
);

router.post(
	'/accesos-directos/regenerar',
	requerirDocente,
	requerirPermiso('cuenta:actualizar'),
	validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
	regenerarAccesosDirectosDocente
);

export default router;
