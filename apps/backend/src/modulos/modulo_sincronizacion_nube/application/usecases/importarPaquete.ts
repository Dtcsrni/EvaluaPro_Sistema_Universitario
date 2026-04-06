import { DefaultPaqueteProcessor, validarBackupMetaImportacion, validarTamanoPaqueteBase64 } from '../../domain/paqueteSincronizacion';
import { normalizarCorreo, obtenerId } from '../../sincronizacionInterna';
import { Sincronizacion } from '../../modeloSincronizacion';
import { syncClock } from '../../infra/repositoriosSync';

const processor = new DefaultPaqueteProcessor();

export async function importarPaqueteUseCase(params: {
  docenteId: string;
  paqueteBase64Raw?: unknown;
  checksumSha256Raw?: unknown;
  docenteCorreoRaw?: unknown;
  dryRunRaw?: unknown;
  backupMetaRaw?: unknown;
}) {
  const { docenteId, paqueteBase64Raw, checksumSha256Raw, docenteCorreoRaw, dryRunRaw, backupMetaRaw } = params;

  const paqueteBase64 = String(paqueteBase64Raw ?? '').trim();
  validarTamanoPaqueteBase64(paqueteBase64);
  validarBackupMetaImportacion(backupMetaRaw);

  const checksumEsperado = String(checksumSha256Raw ?? '').trim();
  const docenteCorreo = normalizarCorreo(docenteCorreoRaw);
  const dryRun = Boolean(dryRunRaw);

  const registro = await Sincronizacion.create({
    docenteId,
    estado: 'pendiente',
    tipo: 'paquete_import',
    detalles: { bytesBase64: paqueteBase64.length },
    ejecutadoEn: syncClock.now()
  });
  const registroId = obtenerId(registro);

  try {
    return await processor.procesar({
      docenteId: String(docenteId),
      paqueteBase64,
      checksumEsperado: checksumEsperado || undefined,
      docenteCorreo: docenteCorreo || undefined,
      dryRun,
      registroId
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (registroId) {
      await Sincronizacion.updateOne({ _id: registroId }, { $set: { estado: 'fallido', detalles: { error: errorMsg } } });
    }
    throw error;
  }
}
