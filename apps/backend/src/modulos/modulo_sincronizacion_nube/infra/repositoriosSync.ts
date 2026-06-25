/**
 * Repositorios de infraestructura para sincronizacion nube.
 */
import { ErrorAplicacion } from '../../../compartido/errores/errorAplicacion';
import { prisma } from '../../../infraestructura/baseDatos/sqlite';
import { Sincronizacion } from '../modeloSincronizacion';
import { normalizarCorreo, parsearFechaIso } from '../sincronizacionInterna';
import type { SyncAuditRepo, SyncClock, SyncDataRepo } from '../shared/tiposSync';

export const syncClock: SyncClock = {
  now: () => new Date()
};

export class MongoSyncDataRepo implements SyncDataRepo {
  async obtenerCorreoDocente(docenteId: string): Promise<string> {
    const docente = await prisma.docente.findUnique({ where: { id: docenteId }, select: { correo: true } });
    const correo = normalizarCorreo((docente as { correo?: unknown })?.correo);
    if (!correo) {
      throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'Docente no encontrado', 404);
    }
    return correo;
  }
}

export class MongoSyncAuditRepo implements SyncAuditRepo {
  async listar(docenteId: string, limite?: number): Promise<unknown[]> {
    const filtro: Record<string, string> = { docenteId };
    const consulta = Sincronizacion.find(filtro);
    const registros = await (limite && limite > 0 ? consulta.limit(limite) : consulta).lean();
    return registros;
  }

  async crear(params: {
    docenteId: string;
    estado: 'pendiente' | 'exitoso' | 'fallido';
    tipo: string;
    detalles?: Record<string, unknown>;
    ejecutadoEn: Date;
  }): Promise<unknown> {
    return Sincronizacion.create(params);
  }

  async actualizar(registroId: unknown, cambios: Record<string, unknown>): Promise<void> {
    await Sincronizacion.updateOne({ _id: registroId }, { $set: cambios });
  }

  async obtenerFechaUltimoPush(docenteId: string): Promise<Date | null> {
    const ultimo = await Sincronizacion.findOne({ docenteId, tipo: 'sync_push', estado: 'exitoso' })
      .sort({ createdAt: -1 })
      .lean();
    if (!ultimo) return null;
    const detalles = (ultimo as { detalles?: Record<string, unknown> })?.detalles;
    const exportadoEn = detalles && typeof detalles.exportadoEn === 'string' ? parsearFechaIso(detalles.exportadoEn) : null;
    if (exportadoEn) return exportadoEn;
    return ultimo.ejecutadoEn ? new Date(ultimo.ejecutadoEn) : null;
  }

  async obtenerCursorUltimoPull(docenteId: string): Promise<string | null> {
    const ultimo = await Sincronizacion.findOne({ docenteId, tipo: 'sync_pull', estado: 'exitoso' })
      .sort({ createdAt: -1 })
      .lean();
    if (!ultimo) return null;
    const detalles = (ultimo as { detalles?: Record<string, unknown> })?.detalles;
    return detalles && typeof detalles.cursor === 'string' ? detalles.cursor : null;
  }
}
