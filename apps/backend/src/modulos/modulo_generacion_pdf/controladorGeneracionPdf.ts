/**
 * controladorGeneracionPdf
 *
 * Responsabilidad: actuar como fachada HTTP del módulo PDF.
 *
 * Limites:
 * - Lee parámetros del request.
 * - Delegar toda la lógica de negocio a use cases.
 * - Serializa respuestas HTTP sin modificar contratos públicos existentes.
 */
import type { Response } from 'express';
import { obtenerDocenteId } from '../modulo_autenticacion/middlewareAutenticacion';
import type { SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import {
  archivarPlantillaUseCase,
  actualizarPlantillaUseCase,
  crearPlantillaUseCase,
  eliminarPlantillaUseCase,
  listarPlantillasUseCase
} from './application/usecases/gestionPlantillas';
import {
  descargarPdfLoteUseCase,
  generarExamenesLoteUseCase,
  generarExamenUseCase,
  obtenerProgresoGeneracionLoteUseCase
} from './application/usecases/generacionPlantillas';
import {
  previsualizarPlantillaPdfUseCase,
  previsualizarPlantillaUseCase
} from './application/usecases/previsualizacionPlantillas';

export async function listarPlantillas(req: SolicitudDocente, res: Response) {
  const payload = await listarPlantillasUseCase({
    docenteId: obtenerDocenteId(req),
    periodoId: req.query.periodoId,
    archivado: req.query.archivado,
    limite: req.query.limite
  });
  res.json(payload);
}

export async function crearPlantilla(req: SolicitudDocente, res: Response) {
  const payload = await crearPlantillaUseCase({
    docenteId: obtenerDocenteId(req),
    body: req.body as Record<string, unknown>
  });
  res.status(201).json(payload);
}

export async function actualizarPlantilla(req: SolicitudDocente, res: Response) {
  const payload = await actualizarPlantillaUseCase({
    docenteId: obtenerDocenteId(req),
    plantillaId: String(req.params.id || '').trim(),
    body: req.body as Record<string, unknown>
  });
  res.json(payload);
}

export async function archivarPlantilla(req: SolicitudDocente, res: Response) {
  const payload = await archivarPlantillaUseCase({
    docenteId: obtenerDocenteId(req),
    plantillaId: String(req.params.id || '').trim()
  });
  res.json(payload);
}

export async function eliminarPlantilla(req: SolicitudDocente, res: Response) {
  const payload = await eliminarPlantillaUseCase({
    docenteId: obtenerDocenteId(req),
    plantillaId: String(req.params.id || '').trim()
  });
  res.json(payload);
}

export async function previsualizarPlantilla(req: SolicitudDocente, res: Response) {
  const payload = await previsualizarPlantillaUseCase({
    docenteId: obtenerDocenteId(req),
    plantillaId: String(req.params.id || '').trim()
  });
  res.json(payload);
}

export async function previsualizarPlantillaPdf(req: SolicitudDocente, res: Response) {
  const payload = await previsualizarPlantillaPdfUseCase({
    docenteId: obtenerDocenteId(req),
    plantillaId: String(req.params.id || '').trim()
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${payload.fileName}"`);
  res.send(payload.buffer);
}

export async function generarExamen(req: SolicitudDocente, res: Response) {
  const payload = await generarExamenUseCase({
    docenteId: obtenerDocenteId(req),
    plantillaId: String((req.body as { plantillaId?: unknown }).plantillaId ?? '').trim()
  });
  res.status(201).json(payload);
}

export async function generarExamenesLote(req: SolicitudDocente, res: Response) {
  const body = req.body as {
    plantillaId?: unknown;
    confirmarMasivo?: unknown;
    loteId?: unknown;
  };
  const payload = await generarExamenesLoteUseCase({
    docenteId: obtenerDocenteId(req),
    plantillaId: String(body.plantillaId ?? '').trim(),
    confirmarMasivo: Boolean(body.confirmarMasivo),
    loteId: String(body.loteId ?? '').trim()
  });
  res.status(201).json(payload);
}

export async function obtenerProgresoGeneracionLote(req: SolicitudDocente, res: Response) {
  const payload = await obtenerProgresoGeneracionLoteUseCase({
    docenteId: obtenerDocenteId(req),
    loteId: String(req.params.loteId || '').trim(),
    plantillaId: String(req.query.plantillaId || '').trim() || undefined
  });
  res.json(payload);
}

export async function descargarPdfLote(req: SolicitudDocente, res: Response) {
  const payload = await descargarPdfLoteUseCase({
    docenteId: obtenerDocenteId(req),
    loteId: String(req.params.loteId || '').trim()
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
  res.send(payload.buffer);
}
