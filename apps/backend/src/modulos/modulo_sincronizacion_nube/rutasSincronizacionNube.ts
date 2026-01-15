/**
 * Rutas de sincronizacion a nube.
 *
 * Seguridad:
 * - Este router se monta despues de `requerirDocente` (ver `src/rutas.ts`).
 * - Por lo tanto, todas las operaciones aqui requieren JWT de docente.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { generarCodigoAcceso, listarSincronizaciones, publicarResultados } from './controladorSincronizacion';
import { esquemaGenerarCodigoAcceso, esquemaPublicarResultados } from './validacionesSincronizacion';

const router = Router();

router.get('/', listarSincronizaciones);
router.post('/publicar', validarCuerpo(esquemaPublicarResultados, { strict: true }), publicarResultados);
router.post('/codigo-acceso', validarCuerpo(esquemaGenerarCodigoAcceso, { strict: true }), generarCodigoAcceso);

export default router;
