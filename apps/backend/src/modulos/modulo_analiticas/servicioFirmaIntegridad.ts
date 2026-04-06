/**
 * servicioFirmaIntegridad
 *
 * Responsabilidad: Servicio de dominio/aplicacion con reglas de negocio reutilizables.
 * Limites: Mantener invariantes del dominio y errores controlados.
 */
import { createHash } from 'node:crypto';
import type { ManifiestoIntegridadLista } from './tiposListaAcademica';

function hashSha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function construirManifiestoIntegridadLista(
  periodoId: string,
  csvData: Buffer,
  docxData: Buffer
): ManifiestoIntegridadLista {
  return {
    version: 1,
    periodoId,
    generadoEn: new Date().toISOString(),
    algoritmo: 'sha256',
    archivos: [
      {
        nombre: 'lista-academica.csv',
        sha256: hashSha256(csvData),
        bytes: csvData.byteLength
      },
      {
        nombre: 'lista-academica.docx',
        sha256: hashSha256(docxData),
        bytes: docxData.byteLength
      }
    ]
  };
}

export function serializarManifiestoEstable(manifiesto: ManifiestoIntegridadLista): string {
  return JSON.stringify(
    {
      version: manifiesto.version,
      periodoId: manifiesto.periodoId,
      generadoEn: manifiesto.generadoEn,
      algoritmo: manifiesto.algoritmo,
      archivos: manifiesto.archivos.map((archivo) => ({
        nombre: archivo.nombre,
        sha256: archivo.sha256,
        bytes: archivo.bytes
      }))
    },
    null,
    2
  );
}
