/**
 * enviarPaqueteServidor
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { DefaultPaqueteAssembler, resolverDesdeSincronizacion } from '../../domain/paqueteSincronizacion';
import { normalizarErrorServidorSincronizacion } from '../../domain/erroresSincronizacion';
import { crearClientePortal } from '../../infra/portalSyncClient';
import { MongoSyncAuditRepo, syncClock } from '../../infra/repositoriosSync';
import { obtenerId } from '../../sincronizacionInterna';
import { ErrorAplicacion } from '../../../../compartido/errores/errorAplicacion';

const assembler = new DefaultPaqueteAssembler();
const auditRepo = new MongoSyncAuditRepo();

export async function enviarPaqueteServidorUseCase(params: {
  docenteId: string;
  periodoIdRaw?: unknown;
  desdeRaw?: unknown;
  incluirPdfsRaw?: unknown;
}) {
  const { docenteId, periodoIdRaw, desdeRaw, incluirPdfsRaw } = params;
  const portal = crearClientePortal('SYNC_SERVIDOR_NO_CONFIG');

  const periodoId = String(periodoIdRaw ?? '').trim();
  const { desdeRawStr, desde: desdeParseado } = resolverDesdeSincronizacion(desdeRaw);
  const incluirPdfs = incluirPdfsRaw !== false;

  const desde = desdeRawStr ? desdeParseado : await auditRepo.obtenerFechaUltimoPush(String(docenteId));

  const registro = await auditRepo.crear({
    docenteId,
    estado: 'pendiente',
    tipo: 'sync_push',
    detalles: { periodoId: periodoId || null, desde: desde?.toISOString() || null },
    ejecutadoEn: syncClock.now()
  });
  const registroId = obtenerId(registro);

  try {
    const { paquete, paqueteBase64, checksumSha256, exportadoEn } = await assembler.generar({
      docenteId: String(docenteId),
      periodoId: periodoId || undefined,
      desde: desde || undefined,
      incluirPdfs
    });

    const totalRegistros = Object.values(paquete.conteos).reduce((acc, valor) => acc + (Number(valor) || 0), 0);
    if (totalRegistros === 0) {
      if (registroId) {
        await auditRepo.actualizar(registroId, {
          estado: 'exitoso',
          detalles: { periodoId: periodoId || null, desde: desde?.toISOString() || null, sinCambios: true, exportadoEn }
        });
      }
      return { mensaje: 'Sin cambios para enviar', conteos: paquete.conteos, exportadoEn };
    }

    const respuesta = await portal.postJson<{ cursor?: string; error?: { mensaje?: string } }>(
      '/api/portal/sincronizacion-docente/push',
      {
        docenteId: String(docenteId),
        paqueteBase64,
        checksumSha256,
        schemaVersion: 2,
        exportadoEn,
        ...(desde ? { desde: desde.toISOString() } : {}),
        ...(periodoId ? { periodoId } : {}),
        conteos: paquete.conteos
      }
    );

    if (!respuesta.ok) {
      throw new ErrorAplicacion('SYNC_PUSH_FALLIDO', respuesta.payload?.error?.mensaje || 'No se pudo enviar el paquete', 502);
    }

    if (registroId) {
      await auditRepo.actualizar(registroId, {
        estado: 'exitoso',
        detalles: {
          periodoId: periodoId || null,
          desde: desde?.toISOString() || null,
          exportadoEn,
          conteos: paquete.conteos,
          cursor: respuesta.payload?.cursor || null
        }
      });
    }

    return {
      mensaje: 'Paquete enviado',
      conteos: paquete.conteos,
      exportadoEn,
      cursor: respuesta.payload?.cursor || null
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (registroId) {
      await auditRepo.actualizar(registroId, { estado: 'fallido', detalles: { error: errorMsg } });
    }
    throw normalizarErrorServidorSincronizacion(error);
  }
}
