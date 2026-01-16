/**
 * Controlador para listado de examenes generados.
 *
 * Seguridad:
 * - Todas las consultas se filtran por `docenteId` para evitar acceso entre docentes.
 * - `descargarPdf` solo sirve PDFs cuyo path proviene del propio documento del examen.
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { ExamenGenerado } from './modeloExamenGenerado';
import { promises as fs } from 'fs';

/**
 * Lista examenes generados del docente, con filtros opcionales (periodo, alumno, folio).
 */
export async function listarExamenesGenerados(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtro: Record<string, string> = { docenteId };
  if (req.query.periodoId) filtro.periodoId = String(req.query.periodoId).trim();
  if (req.query.alumnoId) filtro.alumnoId = String(req.query.alumnoId).trim();
  if (req.query.plantillaId) filtro.plantillaId = String(req.query.plantillaId).trim();
  if (req.query.folio) filtro.folio = String(req.query.folio).trim().toUpperCase();

  const limite = Number(req.query.limite ?? 0);
  const consulta = ExamenGenerado.find(filtro).sort({ generadoEn: -1, _id: -1 });
  const examenes = await (limite > 0 ? consulta.limit(limite) : consulta).lean();
  res.json({ examenes });
}

/**
 * Obtiene un examen por folio (multi-tenant por docente).
 */
export async function obtenerExamenPorFolio(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const folio = String(req.params.folio || '').trim().toUpperCase();
  const examen = await ExamenGenerado.findOne({ folio, docenteId }).lean();
  if (!examen) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }
  res.json({ examen });
}

/**
 * Descarga el PDF asociado a un examen.
 *
 * Nota: este endpoint hace IO a disco (almacen local). Si el archivo desaparecio,
 * se responde con error 500 para indicar inconsistencia de almacenamiento.
 */
export async function descargarPdf(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const examenId = String(req.params.id || '');
  const examen = await ExamenGenerado.findOne({ _id: examenId, docenteId }).lean();
  if (!examen || !examen.rutaPdf) {
    throw new ErrorAplicacion('PDF_NO_DISPONIBLE', 'PDF no disponible', 404);
  }

  try {
    const buffer = await fs.readFile(examen.rutaPdf);

    // Best-effort: marca el momento de descarga (se actualiza aunque el PDF ya se haya descargado antes).
    // Si la actualizacion falla, no se bloquea la descarga.
    void ExamenGenerado.updateOne({ _id: examenId, docenteId }, { $set: { descargadoEn: new Date() } }).catch(() => {
      // no-op
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="examen_${String(examen.folio ?? 'examen')}.pdf"`);
    res.send(buffer);
  } catch {
    throw new ErrorAplicacion('PDF_INVALIDO', 'No se pudo leer el PDF', 500);
  }
}
