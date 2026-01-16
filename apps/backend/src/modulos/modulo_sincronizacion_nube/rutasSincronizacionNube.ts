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
	exportarPaquete,
	generarCodigoAcceso,
	importarPaquete,
	listarSincronizaciones,
	publicarResultados
} from './controladorSincronizacion';
import {
	esquemaExportarPaquete,
	esquemaGenerarCodigoAcceso,
	esquemaImportarPaquete,
	esquemaPublicarResultados
} from './validacionesSincronizacion';

const router = Router();

router.get('/', listarSincronizaciones);
router.post('/publicar', validarCuerpo(esquemaPublicarResultados, { strict: true }), publicarResultados);
router.post('/codigo-acceso', validarCuerpo(esquemaGenerarCodigoAcceso, { strict: true }), generarCodigoAcceso);

// Sincronizacion entre computadoras (paquete export/import)
router.post('/paquete/exportar', validarCuerpo(esquemaExportarPaquete, { strict: true }), exportarPaquete);
router.post('/paquete/importar', validarCuerpo(esquemaImportarPaquete, { strict: true }), importarPaquete);

export default router;
