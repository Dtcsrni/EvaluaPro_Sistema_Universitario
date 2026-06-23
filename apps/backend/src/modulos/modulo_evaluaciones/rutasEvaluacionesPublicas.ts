/**
 * rutasEvaluacionesPublicas
 *
 * Responsabilidad: Exponer endpoints públicos para el proceso de firma digital del encuadre.
 * Limites: No requieren autenticación con Bearer token.
 */
import { Router } from 'express';
import {
  obtenerDetallesFirmaEncuadrePublico,
  descargarPdfEncuadrePublico,
  firmarEncuadrePublico
} from './controladorEncuadre';

const router = Router();

router.get('/encuadre/firmar/:token', obtenerDetallesFirmaEncuadrePublico);
router.post('/encuadre/firmar/:token', firmarEncuadrePublico);
router.get('/encuadre/pdf/:token', descargarPdfEncuadrePublico);

export default router;
