/**
 * Controlador HTTP para hidratacion de cursos iniciados.
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import {
  importarHidratacionCurso,
  previsualizarHidratacionCurso,
  type ArchivoHidratacion
} from './servicioHidratacionCursos';

function obtenerPeriodoId(req: SolicitudDocente) {
  const periodoId = String(req.body?.periodoId ?? '').trim();
  if (!periodoId) {
    throw new ErrorAplicacion('PERIODO_REQUERIDO', 'periodoId es requerido', 400);
  }
  return periodoId;
}

function obtenerArchivos(req: SolicitudDocente): ArchivoHidratacion[] {
  const files = Array.isArray(req.files) ? req.files : [];
  return files.map((file) => ({
    originalname: file.originalname,
    mimetype: file.mimetype,
    buffer: file.buffer,
    size: file.size
  }));
}

export async function previsualizarHidratacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = obtenerPeriodoId(req);
  const archivos = obtenerArchivos(req);
  const preview = await previsualizarHidratacionCurso({ docenteId, periodoId, archivos });
  res.json(preview);
}

export async function importarHidratacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = obtenerPeriodoId(req);
  const archivos = obtenerArchivos(req);
  const resultado = await importarHidratacionCurso({ docenteId, periodoId, archivos });
  res.status(201).json(resultado);
}
