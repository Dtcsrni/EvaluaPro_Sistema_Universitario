/**
 * Rutas de sincronizacion a nube.
 *
 * Seguridad:
 * - Este router se monta despues de `requerirDocente` (ver `src/rutas.ts`).
 * - Por lo tanto, todas las operaciones aqui requieren JWT de docente.
 */
import express, { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import {
	enviarPaqueteServidor,
	exportarPaquete,
	exportarInstantaneaLocal,
	generarCodigoAcceso,
	importarPaquete,
	importarInstantaneaLocal,
	adquirirLeaseSincronizacion,
	descargarInstantaneaNubeControlada,
	estadoLeaseSincronizacion,
	importarInstantaneaNubeControlada,
	liberarLeaseSincronizacion,
	publicarInstantaneaNubeControlada,
	renovarLeaseSincronizacion,
	configurarCarpetaSincronizacion,
	obtenerConfiguracionCarpetaSincronizacion,
	listarSincronizaciones,
	publicarResultados,
	traerPaquetesServidor
} from './controladorSincronizacion';
import {
	esquemaEnviarPaqueteServidor,
	esquemaExportarInstantaneaLocal,
	esquemaImportarInstantaneaNube,
	esquemaLeaseSincronizacion,
	esquemaPublicarInstantaneaNube,
	esquemaConfigurarCarpetaSincronizacion,
	esquemaExportarPaquete,
	esquemaGenerarCodigoAcceso,
	esquemaImportarInstantaneaLocal,
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

// Instantanea completa local: el cuerpo es un unico archivo binario con una
// cabecera efimera de solicitud; no se envian credenciales en headers o URL.
router.post('/local/exportar', requerirPermiso('sincronizacion:exportar'), validarCuerpo(esquemaExportarInstantaneaLocal, { strict: true }), exportarInstantaneaLocal);
router.post('/local/importar', requerirPermiso('sincronizacion:importar'), express.raw({ type: 'application/vnd.evaluapro.snapshot', limit: '65mb' }), validarCuerpo(esquemaImportarInstantaneaLocal, { strict: true }), importarInstantaneaLocal);

// Coordinacion entre equipos: la SQLite nunca se coloca en la carpeta nube.
router.get('/local/lease', requerirPermiso('sincronizacion:listar'), estadoLeaseSincronizacion);
router.get('/local/configuracion', requerirPermiso('sincronizacion:listar'), obtenerConfiguracionCarpetaSincronizacion);
router.post('/local/configuracion/carpeta', requerirPermiso('sincronizacion:importar'), validarCuerpo(esquemaConfigurarCarpetaSincronizacion, { strict: true }), configurarCarpetaSincronizacion);
router.post('/local/lease/adquirir', requerirPermiso('sincronizacion:importar'), validarCuerpo(esquemaLeaseSincronizacion.pick({ equipoId: true }), { strict: true }), adquirirLeaseSincronizacion);
router.post('/local/lease/renovar', requerirPermiso('sincronizacion:importar'), validarCuerpo(esquemaLeaseSincronizacion, { strict: true }), renovarLeaseSincronizacion);
router.post('/local/lease/liberar', requerirPermiso('sincronizacion:importar'), validarCuerpo(esquemaLeaseSincronizacion, { strict: true }), liberarLeaseSincronizacion);
router.post('/local/nube/publicar', requerirPermiso('sincronizacion:exportar'), validarCuerpo(esquemaPublicarInstantaneaNube, { strict: true }), publicarInstantaneaNubeControlada);
router.get('/local/nube/descargar', requerirPermiso('sincronizacion:importar'), descargarInstantaneaNubeControlada);
router.post('/local/nube/importar', requerirPermiso('sincronizacion:importar'), validarCuerpo(esquemaImportarInstantaneaNube, { strict: true }), importarInstantaneaNubeControlada);

// Sincronizacion asincrona (push/pull) con servidor intermedio.
router.post('/push', requerirPermiso('sincronizacion:push'), validarCuerpo(esquemaEnviarPaqueteServidor, { strict: true }), enviarPaqueteServidor);
router.post('/pull', requerirPermiso('sincronizacion:pull'), validarCuerpo(esquemaTraerPaquetesServidor, { strict: true }), traerPaquetesServidor);

export default router;
