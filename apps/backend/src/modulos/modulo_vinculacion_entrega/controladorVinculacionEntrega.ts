/**
 * Controlador de vinculacion al recibir examenes.
 *
 * Objetivo: asociar un `ExamenGenerado` con un alumno cuando se entrega/identifica.
 *
 * Contrato de seguridad:
 * - La vinculacion siempre se restringe al `docenteId` autenticado.
 * - Se registra una `Entrega` como bitacora de la operacion.
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { ExamenGenerado } from '../modulo_generacion_pdf/modeloExamenGenerado';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { Entrega } from './modeloEntrega';

/**
 * Vincula un examen por id.
 *
 * Reglas:
 * - El examen debe existir y pertenecer al docente autenticado.
 * - Marca el examen como `entregado`.
 */
export async function vincularEntrega(req: SolicitudDocente, res: Response) {
  const { examenGeneradoId, alumnoId } = req.body;
  const docenteId = obtenerDocenteId(req);

  const examen = await ExamenGenerado.findById(examenGeneradoId);
  if (!examen) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }
  if (String(examen.docenteId) !== String(docenteId)) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a este examen', 403);
  }

  examen.alumnoId = alumnoId;
  examen.estado = 'entregado';
  examen.entregadoEn = new Date();
  await examen.save();

  const entrega = await Entrega.create({
    examenGeneradoId,
    alumnoId,
    docenteId,
    estado: 'entregado',
    fechaEntrega: new Date()
  });

  res.status(201).json({ entrega });
}

/**
 * Vincula un examen por folio.
 *
 * Nota: aqui la autorizacion por objeto se implementa filtrando directamente
 * por `{ folio, docenteId }`.
 */
export async function vincularEntregaPorFolio(req: SolicitudDocente, res: Response) {
  const folio = String(req.body.folio || '').toUpperCase();
  const { alumnoId } = req.body;
  const docenteId = obtenerDocenteId(req);

  const examen = await ExamenGenerado.findOne({ folio, docenteId });
  if (!examen) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }

  examen.alumnoId = alumnoId;
  examen.estado = 'entregado';
  examen.entregadoEn = new Date();
  await examen.save();

  const entrega = await Entrega.create({
    examenGeneradoId: examen._id,
    alumnoId,
    docenteId,
    estado: 'entregado',
    fechaEntrega: new Date()
  });

  res.status(201).json({ entrega });
}

/**
 * Deshace la vinculacion/entrega por folio.
 *
 * Reglas:
 * - El examen debe existir y pertenecer al docente autenticado.
 * - Regresa el examen a estado "generado", limpiando alumno y fecha de entrega.
 * - Actualiza la ultima entrega registrada a estado "pendiente".
 */
export async function deshacerEntregaPorFolio(req: SolicitudDocente, res: Response) {
  const folio = String(req.body.folio || '').toUpperCase();
  const motivo = String(req.body.motivo || '').trim();
  const docenteId = obtenerDocenteId(req);

  const examen = await ExamenGenerado.findOne({ folio, docenteId });
  if (!examen) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }

  const estadoActual = String(examen.estado ?? '').toLowerCase();
  if (estadoActual === 'calificado') {
    throw new ErrorAplicacion('ENTREGA_NO_REVERSIBLE', 'No se puede deshacer una entrega calificada', 409);
  }
  if (estadoActual !== 'entregado' && estadoActual !== 'calificado') {
    return res.status(200).json({ actualizado: false, estado: examen.estado });
  }

  examen.alumnoId = null;
  examen.estado = 'generado';
  examen.entregadoEn = undefined;
  await examen.save();

  const entrega = await Entrega.findOne({ examenGeneradoId: examen._id, docenteId }).sort({ createdAt: -1 });
  if (entrega) {
    entrega.estado = 'pendiente';
    entrega.fechaEntrega = undefined;
    entrega.motivoDeshacer = motivo ? motivo : undefined;
    await entrega.save();
  }

  res.status(200).json({ actualizado: true, estado: examen.estado });
}
