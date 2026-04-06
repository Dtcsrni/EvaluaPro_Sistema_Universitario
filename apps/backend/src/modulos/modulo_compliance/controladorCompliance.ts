/**
 * Controlador de cumplimiento y privacidad (ARCO/retencion/auditoria).
 */
import type { Response } from 'express';
import { configuracion } from '../../configuracion';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { EventoCumplimiento } from './modeloEventoCumplimiento';
import { SolicitudDsr } from './modeloSolicitudDsr';
import type { ComplianceStatus, DsrStatus } from './shared/tiposCompliance';

function toObjectIdOrThrow(id: string): string {
  if (!id || typeof id !== 'string') {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sesion requerida', 401);
  }
  return id;
}

export async function obtenerEstadoCompliance(req: SolicitudDocente, res: Response) {
  const docenteId = toObjectIdOrThrow(obtenerDocenteId(req));
  const pendingDsr = await SolicitudDsr.countDocuments({ docenteId, status: { $in: ['pendiente', 'en_proceso'] } });

  const status: ComplianceStatus = {
    encryptionAtRest: true,
    encryptionInTransit: true,
    retentionJobs: Boolean(configuracion.dataPurgeCron),
    pendingDsr,
    policyVersion: configuracion.legalNoticeVersion,
    complianceMode: configuracion.complianceMode
  };

  res.json({ ok: true, data: status });
}

export async function crearSolicitudDsr(req: SolicitudDocente, res: Response) {
  const docenteId = toObjectIdOrThrow(obtenerDocenteId(req));
  const body = req.body as {
    tipo: 'acceso' | 'rectificacion' | 'cancelacion' | 'oposicion';
    titularRef: string;
    scope: string;
    status?: DsrStatus;
    resolutionNote?: string;
  };

  const now = new Date();
  const status: DsrStatus = body.status ?? 'pendiente';

  const solicitud = await SolicitudDsr.create({
    docenteId,
    tipo: body.tipo,
    titularRef: body.titularRef,
    scope: body.scope,
    status,
    requestedAt: now,
    resolvedAt: status === 'resuelto' || status === 'rechazado' ? now : null,
    resolutionNote: body.resolutionNote ?? ''
  });

  await EventoCumplimiento.create({
    docenteId,
    accion: 'dsr.crear',
    severidad: 'info',
    detalles: {
      solicitudId: String(solicitud._id),
      tipo: body.tipo,
      status
    }
  });

  res.status(201).json({ ok: true, data: { id: String(solicitud._id), status } });
}

export async function purgarCompliance(req: SolicitudDocente, res: Response) {
  const docenteId = toObjectIdOrThrow(obtenerDocenteId(req));
  const dryRun = Boolean((req.body as { dryRun?: boolean })?.dryRun ?? false);
  const olderThanDays = Number((req.body as { olderThanDays?: number })?.olderThanDays ?? configuracion.dataRetentionDefaultDays);

  const fechaCorte = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const filtroDsr = {
    docenteId,
    status: { $in: ['resuelto', 'rechazado'] },
    resolvedAt: { $lte: fechaCorte }
  };
  const filtroEventos = {
    docenteId,
    createdAt: { $lte: fechaCorte }
  };

  const [dsrCandidatos, eventosCandidatos] = await Promise.all([
    SolicitudDsr.countDocuments(filtroDsr),
    EventoCumplimiento.countDocuments(filtroEventos)
  ]);

  let dsrEliminados = 0;
  let eventosEliminados = 0;
  if (!dryRun) {
    const [r1, r2] = await Promise.all([SolicitudDsr.deleteMany(filtroDsr), EventoCumplimiento.deleteMany(filtroEventos)]);
    dsrEliminados = r1.deletedCount ?? 0;
    eventosEliminados = r2.deletedCount ?? 0;

    await EventoCumplimiento.create({
      docenteId,
      accion: 'compliance.purge',
      severidad: 'warn',
      detalles: {
        fechaCorte: fechaCorte.toISOString(),
        olderThanDays,
        dsrEliminados,
        eventosEliminados
      }
    });
  }

  res.json({
    ok: true,
    data: {
      dryRun,
      olderThanDays,
      fechaCorte: fechaCorte.toISOString(),
      dsrCandidatos,
      eventosCandidatos,
      dsrEliminados,
      eventosEliminados
    }
  });
}

export async function listarAuditoriaCompliance(req: SolicitudDocente, res: Response) {
  const docenteId = toObjectIdOrThrow(obtenerDocenteId(req));
  const limiteRaw = Number(req.query.limite ?? 100);
  const limite = Number.isFinite(limiteRaw) ? Math.max(1, Math.min(500, Math.trunc(limiteRaw))) : 100;

  const eventos = await EventoCumplimiento.find({ docenteId }).sort({ createdAt: -1 }).limit(limite).lean();
  res.json({ ok: true, data: { eventos } });
}
