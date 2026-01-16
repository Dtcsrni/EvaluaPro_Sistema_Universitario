/**
 * Rutas de autenticacion.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { configuracion } from '../../configuracion';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import {
	definirContrasenaDocente,
	actualizarPreferenciasPdfDocente,
	ingresarDocente,
	ingresarDocenteGoogle,
	perfilDocente,
	recuperarContrasenaGoogle,
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
	esquemaRegistrarDocente,
	esquemaRegistrarDocenteGoogle
} from './validacionesAutenticacion';

const router = Router();

const esTest = process.env.NODE_ENV === 'test';

const limiterCredenciales = rateLimit({
	windowMs: configuracion.rateLimitWindowMs,
	limit: esTest ? 10_000 : 40,
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
});

const limiterRefresco = rateLimit({
	windowMs: configuracion.rateLimitWindowMs,
	limit: esTest ? 10_000 : 240,
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
});

router.post('/registrar', limiterCredenciales, validarCuerpo(esquemaRegistrarDocente, { strict: true }), registrarDocente);
router.post('/registrar-google', limiterCredenciales, validarCuerpo(esquemaRegistrarDocenteGoogle, { strict: true }), registrarDocenteGoogle);
router.post('/ingresar', limiterCredenciales, validarCuerpo(esquemaIngresarDocente, { strict: true }), ingresarDocente);
router.post('/google', limiterCredenciales, validarCuerpo(esquemaIngresarDocenteGoogle, { strict: true }), ingresarDocenteGoogle);
router.post(
	'/recuperar-contrasena-google',
	limiterCredenciales,
	validarCuerpo(esquemaRecuperarContrasenaGoogle, { strict: true }),
	recuperarContrasenaGoogle
);
router.post('/refrescar', limiterRefresco, validarCuerpo(esquemaBodyVacioOpcional, { strict: true }), refrescarDocente);
router.post('/salir', validarCuerpo(esquemaBodyVacioOpcional, { strict: true }), salirDocente);
router.post(
	'/definir-contrasena',
	limiterCredenciales,
	requerirDocente,
	validarCuerpo(esquemaDefinirContrasenaDocente, { strict: true }),
	definirContrasenaDocente
);
router.get('/perfil', requerirDocente, perfilDocente);

router.post(
	'/preferencias/pdf',
	requerirDocente,
	validarCuerpo(esquemaActualizarPreferenciasPdf, { strict: true }),
	actualizarPreferenciasPdfDocente
);

export default router;
