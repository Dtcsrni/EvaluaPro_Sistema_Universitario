/**
 * Rutas de autenticacion.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { ingresarDocente, perfilDocente, registrarDocente } from './controladorAutenticacion';
import { requerirDocente } from './middlewareAutenticacion';
import { esquemaIngresarDocente, esquemaRegistrarDocente } from './validacionesAutenticacion';

const router = Router();

router.post('/registrar', validarCuerpo(esquemaRegistrarDocente, { strict: true }), registrarDocente);
router.post('/ingresar', validarCuerpo(esquemaIngresarDocente, { strict: true }), ingresarDocente);
router.get('/perfil', requerirDocente, perfilDocente);

export default router;
