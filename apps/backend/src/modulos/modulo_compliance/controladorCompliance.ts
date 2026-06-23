/**
 * Controlador de cumplimiento y privacidad (ARCO/retencion/auditoria).
 */
import type { Response } from 'express';
import { configuracion } from '../../configuracion';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { prisma } from '../../infraestructura/baseDatos/sqlite';
import type { ComplianceStatus, DsrStatus } from './shared/tiposCompliance';

function toObjectIdOrThrow(id: string): string {
  if (!id || typeof id !== 'string') {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sesion requerida', 401);
  }
  return id;
}

export async function obtenerEstadoCompliance(req: SolicitudDocente, res: Response) {
  const docenteId = toObjectIdOrThrow(obtenerDocenteId(req));
  const pendingDsr = await prisma.solicitudDsr.count({
    where: {
      docenteId,
      status: { in: ['pendiente', 'en_proceso'] }
    }
  });

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

  const solicitud = await prisma.solicitudDsr.create({
    data: {
      docenteId,
      tipo: body.tipo,
      titularRef: body.titularRef,
      scope: body.scope,
      status,
      requestedAt: now,
      resolvedAt: status === 'resuelto' || status === 'rechazado' ? now : null,
      resolutionNote: body.resolutionNote ?? ''
    }
  });

  await prisma.eventoCumplimiento.create({
    data: {
      docenteId,
      accion: 'dsr.crear',
      severidad: 'info',
      detalles: JSON.stringify({
        solicitudId: solicitud.id,
        tipo: body.tipo,
        status
      })
    }
  });

  res.status(201).json({ ok: true, data: { id: solicitud.id, status } });
}

export async function purgarCompliance(req: SolicitudDocente, res: Response) {
  const docenteId = toObjectIdOrThrow(obtenerDocenteId(req));
  const dryRun = Boolean((req.body as { dryRun?: boolean })?.dryRun ?? false);
  const olderThanDays = Number((req.body as { olderThanDays?: number })?.olderThanDays ?? configuracion.dataRetentionDefaultDays);

  const fechaCorte = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const filtroDsr = {
    docenteId,
    status: { in: ['resuelto', 'rechazado'] },
    resolvedAt: { lte: fechaCorte }
  };
  const filtroEventos = {
    docenteId,
    createdAt: { lte: fechaCorte }
  };

  const [dsrCandidatos, eventosCandidatos] = await Promise.all([
    prisma.solicitudDsr.count({ where: filtroDsr }),
    prisma.eventoCumplimiento.count({ where: filtroEventos })
  ]);

  let dsrEliminados = 0;
  let eventosEliminados = 0;
  if (!dryRun) {
    const [r1, r2] = await Promise.all([
      prisma.solicitudDsr.deleteMany({ where: filtroDsr }),
      prisma.eventoCumplimiento.deleteMany({ where: filtroEventos })
    ]);
    dsrEliminados = r1.count;
    eventosEliminados = r2.count;

    await prisma.eventoCumplimiento.create({
      data: {
        docenteId,
        accion: 'compliance.purge',
        severidad: 'warn',
        detalles: JSON.stringify({
          fechaCorte: fechaCorte.toISOString(),
          olderThanDays,
          dsrEliminados,
          eventosEliminados
        })
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

  const eventosRaw = await prisma.eventoCumplimiento.findMany({
    where: { docenteId },
    orderBy: { createdAt: 'desc' },
    take: limite
  });

  const eventos = eventosRaw.map(ev => ({
    ...ev,
    _id: ev.id,
    detalles: ev.detalles ? JSON.parse(ev.detalles) : null
  }));

  res.json({ ok: true, data: { eventos } });
}
