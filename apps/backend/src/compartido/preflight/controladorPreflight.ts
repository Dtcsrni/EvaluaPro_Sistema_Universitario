/** Preflight autenticado y de solo lectura para clientes del API docente. */
import type { Response } from 'express';
import { obtenerVersionInfo } from '../salud/rutasSalud.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { permisosComoLista } from '../../infraestructura/seguridad/rbac.js';
import type { SolicitudDocente } from '../../modulos/modulo_autenticacion/middlewareAutenticacion.js';
import { obtenerDocenteId } from '../../modulos/modulo_autenticacion/middlewareAutenticacion.js';
import { obtenerEstadoLease } from '../../modulos/modulo_sincronizacion_nube/domain/leaseSincronizacion.js';
import { obtenerConfiguracionSincronizacion } from '../../modulos/modulo_sincronizacion_nube/domain/preferenciasSincronizacion.js';
import { configuracion } from '../../configuracion.js';

const EQUIPO_ID_VALIDO = /^[A-Za-z0-9._:-]{8,128}$/;

export async function obtenerPreflight(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const roles = req.docenteRoles ?? [];
  const equipoId = String(req.header('X-EvaluaPro-Equipo') || '').trim();

  const [periodosActivos, integracionClassroom, syncConfig] = await Promise.all([
    prisma.periodo.count({ where: { docenteId, activo: true } }),
    prisma.integracionClassroom.findUnique({
      where: { docenteId },
      select: { activo: true, refreshToken: true, tokenExpiraEn: true }
    }),
    obtenerConfiguracionSincronizacion(docenteId)
  ]);

  const estadoLease = syncConfig.configurado && EQUIPO_ID_VALIDO.test(equipoId)
    ? await obtenerEstadoLease(docenteId, equipoId)
    : undefined;
  const classroomHabilitado = Boolean(configuracion.classroomEnabled);
  const classroomVinculado = Boolean(
    integracionClassroom?.activo && integracionClassroom.refreshToken?.trim()
  );
  const infoVersion = obtenerVersionInfo();

  res.json({
    protocol: 'v2',
    app: {
      name: infoVersion.app.name,
      version: infoVersion.app.version,
      displayVersion: infoVersion.app.displayVersion
    },
    omr: infoVersion.omr,
    session: {
      authenticated: true,
      roles,
      permissions: permisosComoLista(roles)
    },
    periods: {
      activeAvailable: periodosActivos > 0,
      activeCount: periodosActivos
    },
    classroom: {
      enabled: classroomHabilitado,
      linkedLocally: classroomVinculado,
      state: !classroomHabilitado ? 'disabled' : classroomVinculado ? 'linked' : 'not_linked',
      remoteConnectivity: 'not_checked'
    },
    writeLease: {
      configured: syncConfig.configurado,
      ...(estadoLease ? {
        mode: estadoLease.modo,
        ownLeaseActive: estadoLease.modo === 'escritura'
      } : syncConfig.configurado ? {
        mode: 'unknown',
        ownLeaseActive: null,
        requiresValidTeamId: true
      } : { mode: 'not_configured', ownLeaseActive: null })
    }
  });
}
