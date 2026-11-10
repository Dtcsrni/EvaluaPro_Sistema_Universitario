/**
 * Rutas de autenticacion.
 */
import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { configuracion } from '../../configuracion.js';
import { validarCuerpo } from '../../compartido/validaciones/validar.js';
import {
	definirContrasenaDocente,
	actualizarPreferenciasPdfDocente,
	actualizarPreferenciaRetencionParciales,
	capacidadesIntegracionesPublicas,
	iniciarLoginGoogleDesktop,
	obtenerResultadoLoginGoogleDesktop,
	confirmarLoginGoogleDesktop,
	cancelarLoginGoogleDesktop,
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
} from './controladorAutenticacion.js';
import { requerirDocente } from './middlewareAutenticacion.js';
import {
	esquemaBodyVacioOpcional,
	esquemaActualizarPreferenciasPdf,
	esquemaActualizarRetencionParciales,
	esquemaDefinirContrasenaDocente,
	esquemaIngresarDocente,
	esquemaIngresarDocenteGoogle,
	esquemaFlujoGoogleDesktop,
	esquemaRecuperarContrasenaGoogle,
	esquemaSolicitarRecuperacionContrasena,
	esquemaRestablecerContrasena,
	esquemaRegistrarDocente,
	esquemaRegistrarDocenteGoogle
} from './validacionesAutenticacion.js';
import { requerirPermiso } from './middlewarePermisos.js';
import {
	crearSolicitudApiLocalControlador,
	inspeccionarSolicitudApiLocalControlador,
	intercambiarSolicitudApiLocalControlador,
	listarCredencialesApiDocenteControlador,
	refrescarTokenApiDelegadoControlador,
	resolverSolicitudApiLocalControlador,
	revocarCredencialApiDocenteControlador
} from './controladorApiDelegado.js';
import {
	esquemaCrearSolicitudApiLocal,
	esquemaInspeccionarSolicitudApiLocal,
	esquemaIntercambiarSolicitudApiLocal,
	esquemaRefrescarCredencialApi,
	esquemaResolverSolicitudApiLocal
} from './validacionesApiDelegado.js';

const router = Router();

const requerirOrigenAutorizado: RequestHandler = (req, res, next) => {
	const origin = req.get('origin');
	if (!origin || !configuracion.corsOrigenes.includes(origin)) {
		res.status(403).json({ error: { codigo: 'ORIGEN_NO_AUTORIZADO', mensaje: 'Origen de aplicación no autorizado.' } });
		return;
	}
	next();
};

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

// El cliente consulta este endpoint cada segundo mientras Google completa el
// callback. No debe consumir el presupuesto de intentos de credenciales.
const limiterResultadoGoogleDesktop: RequestHandler = esProduccion
	? rateLimit({
		windowMs: configuracion.rateLimitWindowMs,
		limit: Math.max(configuracion.rateLimitCredencialesLimit, 1_000),
		standardHeaders: true,
		legacyHeaders: false,
		handler: (_req, res) => {
			res.status(429).json({
				error: {
					codigo: 'RATE_LIMIT',
					mensaje: 'Demasiadas consultas de estado de Google, intenta mas tarde'
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
router.post('/google-desktop/iniciar', requerirOrigenAutorizado, limiterCredenciales, validarCuerpo(esquemaBodyVacioOpcional, { strict: true }), iniciarLoginGoogleDesktop);
router.post('/google-desktop/resultado', requerirOrigenAutorizado, limiterResultadoGoogleDesktop, validarCuerpo(esquemaFlujoGoogleDesktop, { strict: true }), obtenerResultadoLoginGoogleDesktop);
router.post('/google-desktop/confirmar', requerirOrigenAutorizado, limiterCredenciales, validarCuerpo(esquemaFlujoGoogleDesktop, { strict: true }), confirmarLoginGoogleDesktop);
router.post('/google-desktop/cancelar', requerirOrigenAutorizado, limiterCredenciales, validarCuerpo(esquemaFlujoGoogleDesktop, { strict: true }), cancelarLoginGoogleDesktop);
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
// Bootstrap PKCE sin bearer; la aprobación de permisos ocurre en la cuenta docente.
router.post('/api-clientes/solicitudes', limiterCredenciales, validarCuerpo(esquemaCrearSolicitudApiLocal, { strict: true }), crearSolicitudApiLocalControlador);
router.post('/api-clientes/solicitudes/intercambiar', limiterRefresco, validarCuerpo(esquemaIntercambiarSolicitudApiLocal, { strict: true }), intercambiarSolicitudApiLocalControlador);
router.post('/api-clientes/refrescar', limiterRefresco, validarCuerpo(esquemaRefrescarCredencialApi, { strict: true }), refrescarTokenApiDelegadoControlador);
router.post('/api-clientes/solicitudes/inspeccionar', limiterCredenciales, requerirDocente, requerirPermiso('cuenta:actualizar'), validarCuerpo(esquemaInspeccionarSolicitudApiLocal, { strict: true }), inspeccionarSolicitudApiLocalControlador);
router.post('/api-clientes/solicitudes/resolver', limiterCredenciales, requerirDocente, requerirPermiso('cuenta:actualizar'), validarCuerpo(esquemaResolverSolicitudApiLocal, { strict: true }), resolverSolicitudApiLocalControlador);
router.get('/api-clientes/credenciales', requerirDocente, requerirPermiso('cuenta:leer'), listarCredencialesApiDocenteControlador);
router.post('/api-clientes/mia/revocar', requerirDocente, validarCuerpo(esquemaBodyVacioOpcional, { strict: true }), revocarCredencialApiDocenteControlador);
router.post('/api-clientes/credenciales/:credencialId/revocar', requerirDocente, requerirPermiso('cuenta:actualizar'), validarCuerpo(esquemaBodyVacioOpcional, { strict: true }), revocarCredencialApiDocenteControlador);
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
	'/preferencias/retencion-parciales',
	requerirDocente,
	requerirPermiso('cuenta:actualizar'),
	validarCuerpo(esquemaActualizarRetencionParciales, { strict: true }),
	actualizarPreferenciaRetencionParciales
);

router.post(
	'/accesos-directos/regenerar',
	requerirDocente,
	requerirPermiso('cuenta:actualizar'),
	validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
	regenerarAccesosDirectosDocente
);

export default router;
