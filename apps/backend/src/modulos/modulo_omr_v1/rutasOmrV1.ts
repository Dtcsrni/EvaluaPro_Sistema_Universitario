/**
 * rutasOmrV1
 *
 * Responsabilidad: Registro de rutas HTTP del dominio y aplicacion de middleware de seguridad/validacion.
 * Limites: No cambiar orden o permisos de rutas sin validar impacto en contratos y tests.
 */
import { Router } from 'express';
import { middlewaresOmrV1 } from './controladorOmrV1';

const router = Router();

router.get('/families', ...middlewaresOmrV1.listarFamilias);
router.post('/families', ...middlewaresOmrV1.crearFamilia);
router.get('/families/:id', ...middlewaresOmrV1.obtenerFamilia);
router.post('/families/:id/revisions', ...middlewaresOmrV1.crearRevisionFamilia);
router.post('/jobs', ...middlewaresOmrV1.createJob);
router.get('/jobs/:id', ...middlewaresOmrV1.getJob);
router.get('/jobs/:id/pages', ...middlewaresOmrV1.getPages);
router.get('/jobs/:id/exceptions', ...middlewaresOmrV1.getExceptions);
router.post('/jobs/:id/exceptions/:sheetSerial/resolve', ...middlewaresOmrV1.resolveException);
router.post('/jobs/:id/finalize', ...middlewaresOmrV1.finalizeJob);

export default router;
