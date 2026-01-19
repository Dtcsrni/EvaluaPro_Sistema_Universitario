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

const router = Router();

router.get('/', listarSincronizaciones);
router.post('/publicar', validarCuerpo(esquemaPublicarResultados, { strict: true }), publicarResultados);
router.post('/codigo-acceso', validarCuerpo(esquemaGenerarCodigoAcceso, { strict: true }), generarCodigoAcceso);

// Sincronizacion entre computadoras (paquete export/import)
router.post('/paquete/exportar', validarCuerpo(esquemaExportarPaquete, { strict: true }), exportarPaquete);
router.post('/paquete/importar', validarCuerpo(esquemaImportarPaquete, { strict: true }), importarPaquete);

// Sincronizacion asincrona (push/pull) con servidor intermedio.
router.post('/push', validarCuerpo(esquemaEnviarPaqueteServidor, { strict: true }), enviarPaqueteServidor);
router.post('/pull', validarCuerpo(esquemaTraerPaquetesServidor, { strict: true }), traerPaquetesServidor);

export default router;
