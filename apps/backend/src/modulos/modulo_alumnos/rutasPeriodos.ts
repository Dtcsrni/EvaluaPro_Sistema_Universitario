/**
 * Rutas de periodos.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { validarCuerpo } from '../../compartido/validaciones/validar.js';
import { actualizarPeriodo, archivarPeriodo, crearPeriodo, eliminarPeriodoDev, listarPeriodos } from './controladorPeriodos.js';
import { esquemaActualizarPeriodo, esquemaBodyVacioOpcional, esquemaCrearPeriodo } from './validacionesPeriodos.js';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos.js';
import { eliminarPortadaPeriodo, guardarPortadaPeriodo, obtenerPortadaPeriodo, LIMITE_PORTADA_BYTES } from './controladorPortadasPeriodos.js';

const router = Router();
const formatosPortada = new Set(['image/jpeg', 'image/png', 'image/webp']);
const uploadPortada = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITE_PORTADA_BYTES, files: 1, fields: 0 },
  fileFilter: (_req, file, callback) => {
    if (formatosPortada.has(file.mimetype.toLowerCase())) {
      callback(null, true);
      return;
    }
    callback(new ErrorAplicacion('FORMATO_PORTADA_INVALIDO', 'Usa una imagen JPG/JPEG, PNG o WebP válida', 415));
  }
});

function mapearErrorCargaPortada(error: unknown, _req: Request, _res: Response, next: NextFunction) {
  if (!(error instanceof multer.MulterError)) {
    next(error);
    return;
  }
  if (error.code === 'LIMIT_FILE_SIZE') {
    next(new ErrorAplicacion('PORTADA_DEMASIADO_GRANDE', 'La imagen no debe superar 20 MiB', 413));
    return;
  }
  next(new ErrorAplicacion('CARGA_PORTADA_INVALIDA', 'Envía un solo archivo en el campo "archivo"', 400));
}

router.get('/', requerirPermiso('periodos:leer'), listarPeriodos);
router.get('/:periodoId/portada', requerirPermiso('periodos:leer'), obtenerPortadaPeriodo);
router.put(
  '/:periodoId/portada',
  requerirPermiso('periodos:gestionar'),
  uploadPortada.single('archivo'),
  mapearErrorCargaPortada,
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  guardarPortadaPeriodo
);
router.delete('/:periodoId/portada', requerirPermiso('periodos:gestionar'), eliminarPortadaPeriodo);
router.post('/', requerirPermiso('periodos:gestionar'), validarCuerpo(esquemaCrearPeriodo, { strict: true }), crearPeriodo);
router.post(
  '/:periodoId/actualizar',
  requerirPermiso('periodos:gestionar'),
  validarCuerpo(esquemaActualizarPeriodo, { strict: true }),
  actualizarPeriodo
);
router.post(
  '/:periodoId/archivar',
  requerirPermiso('periodos:archivar'),
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  archivarPeriodo
);
router.post(
  '/:periodoId/eliminar',
  requerirPermiso('periodos:eliminar_dev'),
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  eliminarPeriodoDev
);

export default router;
