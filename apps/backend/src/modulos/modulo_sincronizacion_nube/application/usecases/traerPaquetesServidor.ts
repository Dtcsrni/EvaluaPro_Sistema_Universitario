/**
 * traerPaquetesServidor
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { DefaultPaqueteProcessor, resolverDesdeSincronizacion, validarTamanoPaqueteBase64 } from '../../domain/paqueteSincronizacion';
import { normalizarErrorServidorSincronizacion } from '../../domain/erroresSincronizacion';
import { crearClientePortal } from '../../infra/portalSyncClient';
import { MongoSyncAuditRepo, syncClock } from '../../infra/repositoriosSync';
import { obtenerId } from '../../sincronizacionInterna';
import { ErrorAplicacion } from '../../../../compartido/errores/errorAplicacion';

const processor = new DefaultPaqueteProcessor();
const auditRepo = new MongoSyncAuditRepo();

export async function traerPaquetesServidorUseCase(params: {
  docenteId: string;
  desdeRaw?: unknown;
  limiteRaw?: unknown;
}) {
  const { docenteId, desdeRaw, limiteRaw } = params;
  const portal = crearClientePortal('SYNC_SERVIDOR_NO_CONFIG');

  const { desdeRawStr } = resolverDesdeSincronizacion(desdeRaw);
  const limite = Math.min(20, Math.max(1, Number(limiteRaw) || 6));
  const cursorDesde = desdeRawStr || (await auditRepo.obtenerCursorUltimoPull(String(docenteId))) || undefined;

  const registro = await auditRepo.crear({
    docenteId,
    estado: 'pendiente',
    tipo: 'sync_pull',
    detalles: { desde: cursorDesde || null, limite },
    ejecutadoEn: syncClock.now()
  });
  const registroId = obtenerId(registro);

  try {
    const respuesta = await portal.postJson<{
      paquetes?: Array<{ paqueteBase64?: string; checksumSha256?: string; cursor?: string }>;
      ultimoCursor?: string | null;
      error?: { mensaje?: string };
    }>('/api/portal/sincronizacion-docente/pull', {
      docenteId: String(docenteId),
      ...(cursorDesde ? { desde: cursorDesde } : {}),
      limite
    });

    if (!respuesta.ok) {
      throw new ErrorAplicacion('SYNC_PULL_FALLIDO', respuesta.payload?.error?.mensaje || 'No se pudieron obtener paquetes', 502);
    }

    const paquetes = Array.isArray(respuesta.payload.paquetes) ? respuesta.payload.paquetes : [];
    if (paquetes.length === 0) {
      if (registroId) {
        await auditRepo.actualizar(registroId, {
          estado: 'exitoso',
          detalles: { desde: cursorDesde || null, limite, sinCambios: true, cursor: respuesta.payload?.ultimoCursor || null }
        });
      }
      return { mensaje: 'Sin cambios', paquetesRecibidos: 0, ultimoCursor: respuesta.payload?.ultimoCursor || null };
    }

    let pdfsGuardados = 0;
    let ultimoCursor = respuesta.payload?.ultimoCursor || null;

    for (const paquete of paquetes) {
      const paqueteBase64 = String(paquete?.paqueteBase64 ?? '').trim();
      if (!paqueteBase64) continue;
      validarTamanoPaqueteBase64(paqueteBase64);

      const resultado = await processor.procesar({
        docenteId: String(docenteId),
        paqueteBase64,
        checksumEsperado: paquete.checksumSha256 ? String(paquete.checksumSha256) : undefined,
        dryRun: false,
        registroId: undefined
      });

      if (typeof resultado.pdfsGuardados === 'number') {
        pdfsGuardados += resultado.pdfsGuardados;
      }
      if (paquete.cursor) {
        ultimoCursor = paquete.cursor;
      }
    }

    if (registroId) {
      await auditRepo.actualizar(registroId, {
        estado: 'exitoso',
        detalles: {
          desde: cursorDesde || null,
          limite,
          cursor: ultimoCursor,
          paquetesRecibidos: paquetes.length,
          pdfsGuardados
        }
      });
    }

    return {
      mensaje: 'Paquetes aplicados',
      paquetesRecibidos: paquetes.length,
      ultimoCursor,
      pdfsGuardados
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (registroId) {
      await auditRepo.actualizar(registroId, { estado: 'fallido', detalles: { error: errorMsg } });
    }
    throw normalizarErrorServidorSincronizacion(error);
  }
}
