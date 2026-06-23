import { Router } from 'express';
import { z } from 'zod';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import {
  obtenerDetallesFirmaEncuadrePublico,
  descargarPdfEncuadrePublico,
  firmarEncuadrePublico
} from './controladorEncuadre';

const router = Router();
const esquemaVacio = z.object({}).strict();

router.get('/encuadre/firmar/:token', obtenerDetallesFirmaEncuadrePublico);
router.post(
  '/encuadre/firmar/:token',
  validarCuerpo(esquemaVacio, { strict: true }),
  firmarEncuadrePublico
);
router.get('/encuadre/pdf/:token', descargarPdfEncuadrePublico);

export default router;
