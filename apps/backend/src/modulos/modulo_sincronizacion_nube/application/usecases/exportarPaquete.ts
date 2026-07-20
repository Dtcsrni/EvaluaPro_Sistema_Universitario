/**
 * exportarPaquete
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { DefaultPaqueteAssembler, resolverDesdeSincronizacion } from '../../domain/paqueteSincronizacion';
import { MongoSyncDataRepo, syncClock } from '../../infra/repositoriosSync';
import { Sincronizacion } from '../../modeloSincronizacion';

const assembler = new DefaultPaqueteAssembler();
const dataRepo = new MongoSyncDataRepo();

export async function exportarPaqueteUseCase(params: {
  docenteId: string;
  periodoIdRaw?: unknown;
  desdeRaw?: unknown;
  incluirPdfsRaw?: unknown;
}) {
  const { docenteId, periodoIdRaw, desdeRaw, incluirPdfsRaw } = params;
  const docenteCorreo = await dataRepo.obtenerCorreoDocente(String(docenteId));
  const periodoId = String(periodoIdRaw ?? '').trim();
  const incluirPdfs = incluirPdfsRaw !== false;

  const { desde } = resolverDesdeSincronizacion(desdeRaw);

  const { paquete, paqueteBase64, checksumSha256, checksumGzipSha256, cifrado, exportadoEn } = await assembler.generar({
    docenteId: String(docenteId),
    docenteCorreo,
    periodoId: periodoId || undefined,
    desde: desde || undefined,
    incluirPdfs
  });

  await Sincronizacion.create({
    docenteId,
    estado: 'exitoso',
    tipo: 'paquete_export',
    detalles: { periodoId: periodoId || null, desde: desde?.toISOString() || null, conteos: paquete.conteos },
    ejecutadoEn: syncClock.now()
  });

  return {
    paqueteBase64,
    checksumSha256,
    checksumGzipSha256,
    cifrado,
    exportadoEn,
    conteos: paquete.conteos
  };
}
