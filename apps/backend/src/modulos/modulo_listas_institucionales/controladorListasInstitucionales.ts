/**
 * Controlador de listas institucionales por plantilla.
 */
import type { Response } from 'express';
import type { SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import {
  generarListaInstitucionalPdf,
  generarListaInstitucionalXlsx,
  listarPlantillasInstitucionales,
  type FormatoListaInstitucional
} from './servicioListasInstitucionales';

export function listarPlantillas(_req: SolicitudDocente, res: Response) {
  res.json({ plantillas: listarPlantillasInstitucionales() });
}

export async function generarListaInstitucional(req: SolicitudDocente, res: Response) {
  const docenteId = String(req.docenteId ?? '');
  const periodoId = String(req.query.periodoId ?? '').trim();
  const templateId = String(req.query.templateId ?? '').trim();
  const formato = String(req.query.formato ?? 'xlsx').trim() as FormatoListaInstitucional;

  if (!periodoId) return res.status(400).json({ error: 'periodoId es requerido' });
  if (!templateId) return res.status(400).json({ error: 'templateId es requerido' });
  if (formato !== 'xlsx' && formato !== 'pdf') return res.status(400).json({ error: 'formato invalido' });

  if (formato === 'pdf') {
    const buffer = await generarListaInstitucionalPdf({ docenteId, periodoId, templateId });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="lista-institucional-cuh.pdf"');
    res.send(buffer);
    return;
  }

  const buffer = await generarListaInstitucionalXlsx({ docenteId, periodoId, templateId });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="lista-institucional-cuh.xlsx"');
  res.send(buffer);
}
