/**
 * Rutas del módulo de temarios.
 *
 * Prefijo montado en: /temarios
 * Subida de PDF: multipart/form-data (campo: "archivo", max 10MB)
 */
import { Router } from 'express';
import multer from 'multer';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';
import {
  listarTemarios,
  crearTemarioManual,
  crearTemarioDesdePdf,
  obtenerNodosTemario,
  actualizarEstadoNodo,
  eliminarTemario
} from './controladorTemarios';
import {
  esquemaCrearTemarioManual,
  esquemaCrearTemarioPdf,
  esquemaActualizarEstadoNodo,
  esquemaBodyVacioOpcional
} from './validacionesTemarios';

const router = Router();

// Multer: solo en memoria, max 10MB, solo PDF
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se aceptan archivos PDF'));
    }
  }
});

// ─── Temarios ─────────────────────────────────────────────────────────────────
router.get('/', requerirPermiso('temarios:leer'), listarTemarios);

router.post(
  '/manual',
  requerirPermiso('temarios:gestionar'),
  validarCuerpo(esquemaCrearTemarioManual, { strict: true }),
  crearTemarioManual
);

router.post(
  '/desde-pdf',
  requerirPermiso('temarios:gestionar'),
  upload.single('archivo'),
  validarCuerpo(esquemaCrearTemarioPdf, { strict: true }),
  crearTemarioDesdePdf
);

router.post(
  '/:temarioId/eliminar',
  requerirPermiso('temarios:gestionar'),
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  eliminarTemario
);

// ─── Nodos ────────────────────────────────────────────────────────────────────
router.get(
  '/:temarioId/nodos',
  requerirPermiso('temarios:leer'),
  obtenerNodosTemario
);

router.post(
  '/nodos/:nodoId/estado',
  requerirPermiso('temarios:gestionar'),
  validarCuerpo(esquemaActualizarEstadoNodo, { strict: true }),
  actualizarEstadoNodo
);

export default router;
