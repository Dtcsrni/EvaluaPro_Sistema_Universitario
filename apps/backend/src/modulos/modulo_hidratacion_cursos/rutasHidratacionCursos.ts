/**
 * Rutas del modulo de hidratacion de cursos iniciados.
 *
 * Prefijo montado en: /hidratacion-cursos
 * Subida multipart/form-data: campo "archivos", max 20MB por archivo.
 */
import { Router } from 'express';
import multer from 'multer';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';
import { importarHidratacion, previsualizarHidratacion } from './controladorHidratacionCursos';
import { esquemaHidratacionMultipart } from './validacionesHidratacionCursos';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    const nombre = String(file.originalname ?? '').toLowerCase();
    const soportado =
      nombre.endsWith('.xlsx') ||
      nombre.endsWith('.docx') ||
      file.mimetype.includes('spreadsheet') ||
      file.mimetype.includes('wordprocessingml');
    if (soportado) cb(null, true);
    else cb(new Error('Solo se aceptan archivos XLSX o DOCX'));
  }
});

router.post(
  '/preview',
  requerirPermiso('evaluaciones:gestionar'),
  upload.array('archivos', 8),
  validarCuerpo(esquemaHidratacionMultipart, { strict: true }),
  previsualizarHidratacion
);

router.post(
  '/importar',
  requerirPermiso('evaluaciones:gestionar'),
  upload.array('archivos', 8),
  validarCuerpo(esquemaHidratacionMultipart, { strict: true }),
  importarHidratacion
);

export default router;
