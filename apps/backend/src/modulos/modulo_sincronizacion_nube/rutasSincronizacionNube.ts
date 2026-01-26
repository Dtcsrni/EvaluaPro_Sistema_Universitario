/**
 * Rutas de sincronizacion a nube.
 *
 * Seguridad:
 * - Este router se monta despues de `requerirDocente` (ver `src/rutas.ts`).
 * - Por lo tanto, todas las operaciones aqui requieren JWT de docente.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import {
	enviarPaqueteServidor,
	exportarPaquete,
	generarCodigoAcceso,
	importarPaquete,
	listarSincronizaciones,
	publicarResultados,
	traerPaquetesServidor
} from './controladorSincronizacion';
import {
	esquemaEnviarPaqueteServidor,
	esquemaExportarPaquete,
	esquemaGenerarCodigoAcceso,
	esquemaImportarPaquete,
	esquemaPublicarResultados,
	esquemaTraerPaquetesServidor
} from './validacionesSincronizacion';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';

const router = Router();

router.get('/', requerirPermiso('sincronizacion:listar'), listarSincronizaciones);
router.post('/publicar', requerirPermiso('calificaciones:publicar'), validarCuerpo(esquemaPublicarResultados, { strict: true }), publicarResultados);
router.post('/codigo-acceso', requerirPermiso('calificaciones:publicar'), validarCuerpo(esquemaGenerarCodigoAcceso, { strict: true }), generarCodigoAcceso);

// Sincronizacion entre computadoras (paquete export/import)
router.post('/paquete/exportar', requerirPermiso('sincronizacion:exportar'), validarCuerpo(esquemaExportarPaquete, { strict: true }), exportarPaquete);
router.post('/paquete/importar', requerirPermiso('sincronizacion:importar'), validarCuerpo(esquemaImportarPaquete, { strict: true }), importarPaquete);

// Sincronizacion asincrona (push/pull) con servidor intermedio.
router.post('/push', requerirPermiso('sincronizacion:push'), validarCuerpo(esquemaEnviarPaqueteServidor, { strict: true }), enviarPaqueteServidor);
router.post('/pull', requerirPermiso('sincronizacion:pull'), validarCuerpo(esquemaTraerPaquetesServidor, { strict: true }), traerPaquetesServidor);

export default router;
