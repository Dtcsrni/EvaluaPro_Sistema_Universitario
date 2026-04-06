/**
 * Tipos internos del modulo de sincronizacion nube.
 */
import type { PaqueteSincronizacionV2 } from '../sincronizacionInterna';

export type ContextoSyncDocente = {
  docenteId: string;
  docenteCorreo?: string;
};

export type SyncRegistroDetalle = Record<string, unknown>;

export type ResultadoImportacionPaquete = {
  mensaje: string;
  checksumSha256?: string;
  conteos?: Record<string, number>;
  resultados?: Array<Record<string, unknown>>;
  pdfsGuardados?: number;
};

export type ResultadoPushSync = {
  mensaje: string;
  conteos: Record<string, number>;
  exportadoEn: string;
  cursor?: string | null;
};

export type ResultadoPullSync = {
  mensaje: string;
  paquetesRecibidos: number;
  ultimoCursor?: string | null;
  pdfsGuardados?: number;
};

export interface SyncClock {
  now(): Date;
}

export interface SyncAuditRepo {
  listar(docenteId: string, limite?: number): Promise<unknown[]>;
  crear(params: {
    docenteId: string;
    estado: 'pendiente' | 'exitoso' | 'fallido';
    tipo: string;
    detalles?: SyncRegistroDetalle;
    ejecutadoEn: Date;
  }): Promise<unknown>;
  actualizar(registroId: unknown, cambios: SyncRegistroDetalle): Promise<void>;
  obtenerFechaUltimoPush(docenteId: string): Promise<Date | null>;
  obtenerCursorUltimoPull(docenteId: string): Promise<string | null>;
}

export interface SyncDataRepo {
  obtenerCorreoDocente(docenteId: string): Promise<string>;
}

export interface PortalSyncTransport {
  postJson<T>(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; payload: T }>;
}

export interface PaqueteAssembler {
  generar(params: {
    docenteId: string;
    docenteCorreo?: string;
    periodoId?: string;
    desde?: Date | null;
    incluirPdfs: boolean;
  }): Promise<{
    paquete: PaqueteSincronizacionV2;
    paqueteBase64: string;
    checksumSha256: string;
    checksumGzipSha256: string;
    exportadoEn: string;
  }>;
}

export interface PaqueteProcessor {
  procesar(params: {
    docenteId: string;
    paqueteBase64: string;
    checksumEsperado?: string;
    docenteCorreo?: string;
    dryRun: boolean;
    registroId?: unknown;
  }): Promise<ResultadoImportacionPaquete>;
}
