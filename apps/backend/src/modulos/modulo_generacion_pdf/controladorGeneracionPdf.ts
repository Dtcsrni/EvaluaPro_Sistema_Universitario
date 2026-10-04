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
import { obtenerDocenteId } from '../modulo_autenticacion/middlewareAutenticacion.js';
import type { SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion.js';
import {
  archivarPlantillaUseCase,
  actualizarPlantillaUseCase,
  crearPlantillaUseCase,
  eliminarPlantillaUseCase,
  listarPlantillasUseCase,
  listarAuditoriaPlantillaUseCase,
  obtenerPlantillaUseCase
} from './application/usecases/gestionPlantillas.js';
import {
  descargarPdfLoteUseCase,
  generarExamenesLoteUseCase,
  generarExamenUseCase,
  obtenerProgresoGeneracionLoteUseCase
} from './application/usecases/generacionPlantillas.js';
import {
  previsualizarPlantillaPdfUseCase,
  previsualizarPlantillaPdfVisualUseCase,
  previsualizarPlantillaUseCase
} from './application/usecases/previsualizacionPlantillas.js';
import { cambiarEstadoLotePdfUseCase, listarAuditoriaLotePdfUseCase } from './application/usecases/cicloVidaLotes.js';
import { esquemaListarAuditoriaLotePdf, esquemaListarAuditoriaPlantilla } from './validacionesExamenes.js';

export async function listarPlantillas(req: SolicitudDocente, res: Response) {
  const payload = await listarPlantillasUseCase({
    docenteId: obtenerDocenteId(req),
    periodoId: req.query.periodoId,
    archivado: req.query.archivado,
    limite: req.query.limite
  });
  res.json(payload);
}

export async function obtenerPlantilla(req: SolicitudDocente, res: Response) {
  const payload = await obtenerPlantillaUseCase({ docenteId: obtenerDocenteId(req), plantillaId: String(req.params.id ?? '').trim() });
  res.json(payload);
}

export async function listarAuditoriaPlantilla(req: SolicitudDocente, res: Response) {
  const query = esquemaListarAuditoriaPlantilla.parse(res.locals.validatedQuery ?? req.query);
  const payload = await listarAuditoriaPlantillaUseCase({
    docenteId: obtenerDocenteId(req),
    plantillaId: String(req.params.id ?? '').trim(),
    limite: query.limite,
    cursor: query.cursor
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
    plantillaId: String(req.params.id || '').trim(),
    clientRequestId: (req.body as { clientRequestId?: unknown } | undefined)?.clientRequestId
  });
  res.json(payload);
}

export async function eliminarPlantilla(req: SolicitudDocente, res: Response) {
  const payload = await eliminarPlantillaUseCase({
    docenteId: obtenerDocenteId(req),
    plantillaId: String(req.params.id || '').trim(),
    clientRequestId: (req.body as { clientRequestId?: unknown } | undefined)?.clientRequestId
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
    plantillaId: String(req.params.id || '').trim(),
    forzarRegeneracion: ['1', 'true', 'yes', 'si'].includes(String(req.query.refresh ?? '').trim().toLowerCase())
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${payload.fileName}"`);
  res.send(payload.buffer);
}

export async function previsualizarPlantillaPdfVisual(req: SolicitudDocente, res: Response) {
  const payload = await previsualizarPlantillaPdfVisualUseCase({
    docenteId: obtenerDocenteId(req),
    plantillaId: String(req.params.id || '').trim(),
    forzarRegeneracion: ['1', 'true', 'yes', 'si'].includes(String(req.query.refresh ?? '').trim().toLowerCase())
  });
  res.json(payload);
}

export async function generarExamen(req: SolicitudDocente, res: Response) {
  const body = req.body as { plantillaId?: unknown; clientRequestId?: unknown };
  const payload = await generarExamenUseCase({
    docenteId: obtenerDocenteId(req),
    plantillaId: String(body.plantillaId ?? '').trim(),
    clientRequestId: typeof body.clientRequestId === 'string' ? body.clientRequestId : undefined
  });
  res.status(201).json(payload);
}

export async function generarExamenesLote(req: SolicitudDocente, res: Response) {
  const body = req.body as {
    plantillaId?: unknown;
    confirmarMasivo?: unknown;
    loteId?: unknown;
    tipoExamen?: unknown;
    alumnoIds?: unknown;
  };
  const payload = await generarExamenesLoteUseCase({
    docenteId: obtenerDocenteId(req),
    plantillaId: String(body.plantillaId ?? '').trim(),
    confirmarMasivo: Boolean(body.confirmarMasivo),
    loteId: String(body.loteId ?? '').trim(),
    tipoExamen: body.tipoExamen === 'extraordinario' ? 'extraordinario' : undefined,
    alumnoIds: Array.isArray(body.alumnoIds) ? body.alumnoIds.map((id) => String(id)) : undefined
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
  res.setHeader('X-EvaluaPro-PDF-SHA256', payload.pdfSha256);
  res.setHeader('X-EvaluaPro-PDF-Pages', String(payload.totalPaginas));
  res.send(payload.buffer);
}

export async function cambiarEstadoLotePdf(req: SolicitudDocente, res: Response) {
  const payload = await cambiarEstadoLotePdfUseCase({
    docenteId: obtenerDocenteId(req),
    loteId: String(req.params.loteId ?? '').trim(),
    clientRequestId: String((req.body as { clientRequestId?: unknown })?.clientRequestId ?? ''),
    archivado: String(req.path ?? '').endsWith('/archivar')
  });
  res.json(payload);
}

export async function listarAuditoriaLotePdf(req: SolicitudDocente, res: Response) {
  const query = esquemaListarAuditoriaLotePdf.parse(res.locals.validatedQuery ?? req.query);
  const payload = await listarAuditoriaLotePdfUseCase({
    docenteId: obtenerDocenteId(req),
    loteId: String(req.params.loteId ?? '').trim(),
    limite: query.limite,
    cursor: query.cursor
  });
  res.json(payload);
}
