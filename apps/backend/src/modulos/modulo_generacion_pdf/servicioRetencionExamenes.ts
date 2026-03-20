/**
 * Servicio de retención/expurgo para artefactos de exámenes generados.
 *
 * Objetivo:
 * - eliminar archivos persistidos vencidos sin perder metadata mínima,
 * - responder de forma consistente cuando un examen ya no es descargable,
 * - unificar la política entre generación clásica y assessments OMR.
 */
import type { UpdateQuery } from 'mongoose';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ExamenGenerado } from './modeloExamenGenerado';
import { eliminarArchivoExamen, resolverRutaPdfExamen } from '../../infraestructura/archivos/almacenLocal';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';

type ArtifactRef = { path?: unknown };

export type PurgeScope = 'ttl' | 'all';
export type PurgeReason = 'ttl' | 'manual_initial_cleanup' | 'manual';

type ExamenGeneradoLean = {
  _id?: unknown;
  docenteId?: unknown;
  loteId?: unknown;
  folio?: unknown;
  rutaPdf?: unknown;
  bookletArtifact?: ArtifactRef | null;
  omrSheetArtifact?: ArtifactRef | null;
  studentPacketArtifacts?: Array<ArtifactRef | null> | null;
  studentPacketZipArtifact?: ArtifactRef | null;
  manifestArtifact?: ArtifactRef | null;
  answerKeyArtifact?: ArtifactRef | null;
  generadoEn?: unknown;
  retentionStatus?: unknown;
  artifactsPurgedAt?: unknown;
};

export type PurgeSummary = {
  dryRun: boolean;
  scope: PurgeScope;
  olderThanDays: number;
  fechaCorte: string;
  candidatos: number;
  documentosActualizados: number;
  archivosEliminados: number;
  archivosFaltantes: number;
  detalles: Array<{
    examenId: string;
    folio: string;
    loteId?: string;
    archivosEliminados: number;
    archivosFaltantes: number;
    retentionStatus: 'active' | 'artifacts_purged';
  }>;
};

function toText(value: unknown) {
  return String(value ?? '').trim();
}

export function examenTieneArtefactosDisponibles(examen: Record<string, unknown> | null | undefined) {
  if (!examen || typeof examen !== 'object') return false;
  const status = toText((examen as { retentionStatus?: unknown }).retentionStatus) || 'active';
  if (status === 'artifacts_purged') return false;
  const paths = collectArtifactPaths(examen as ExamenGeneradoLean);
  return paths.length > 0;
}

export function construirMetadataRetencion(examen: Record<string, unknown> | null | undefined) {
  const retentionStatus = toText((examen as { retentionStatus?: unknown } | undefined)?.retentionStatus) || 'active';
  const artifactsPurgedAt = (examen as { artifactsPurgedAt?: unknown } | undefined)?.artifactsPurgedAt ?? null;
  return {
    retentionStatus,
    artifactsPurgedAt,
    downloadAvailable: retentionStatus !== 'artifacts_purged' && examenTieneArtefactosDisponibles(examen)
  };
}

export function asegurarExamenDescargable(
  examen: Record<string, unknown> | null | undefined,
  codigoNoDisponible: string,
  mensaje: string
) {
  if (!examen) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }
  const retentionStatus = toText((examen as { retentionStatus?: unknown }).retentionStatus) || 'active';
  if (retentionStatus === 'artifacts_purged') {
    throw new ErrorAplicacion(
      'EXAMEN_ARTIFACTOS_EXPURGADOS',
      'Los artefactos de este examen fueron expurgados por política de retención.',
      410,
      {
        codigoDescarga: codigoNoDisponible,
        retentionStatus,
        artifactsPurgedAt: (examen as { artifactsPurgedAt?: unknown }).artifactsPurgedAt ?? null
      }
    );
  }
  if (!examenTieneArtefactosDisponibles(examen)) {
    throw new ErrorAplicacion(codigoNoDisponible, mensaje, 404);
  }
}

function collectArtifactPaths(examen: ExamenGeneradoLean) {
  const candidates = [
    toText(examen.rutaPdf),
    toText(examen.bookletArtifact?.path),
    toText(examen.omrSheetArtifact?.path),
    toText(examen.studentPacketZipArtifact?.path),
    toText(examen.manifestArtifact?.path),
    toText(examen.answerKeyArtifact?.path),
    ...(Array.isArray(examen.studentPacketArtifacts) ? examen.studentPacketArtifacts.map((item) => toText(item?.path)) : [])
  ].filter(Boolean);
  return Array.from(new Set(candidates));
}

async function collectDerivedBatchPaths(examen: ExamenGeneradoLean) {
  const loteId = toText(examen.loteId);
  if (!loteId) return [] as string[];
  const dataDir = path.dirname(resolverRutaPdfExamen('placeholder.pdf'));
  try {
    const archivos = await fs.readdir(dataDir);
    return archivos
      .filter((archivo) => new RegExp(`lote-${loteId}\\.pdf$`, 'i').test(archivo))
      .map((archivo) => path.join(dataDir, archivo));
  } catch {
    return [];
  }
}

function buildPurgeUpdate(reason: PurgeReason): UpdateQuery<ExamenGeneradoLean> {
  return {
    $set: {
      retentionStatus: 'artifacts_purged',
      artifactsPurgedAt: new Date(),
      artifactsPurgeReason: reason,
      rutaPdf: null,
      bookletArtifact: null,
      omrSheetArtifact: null,
      studentPacketArtifacts: [],
      studentPacketZipArtifact: null,
      manifestArtifact: null,
      answerKeyArtifact: null
    }
  };
}

async function purgeSingleExamArtifacts(examen: ExamenGeneradoLean, reason: PurgeReason, dryRun: boolean) {
  const paths = Array.from(new Set([...(await collectDerivedBatchPaths(examen)), ...collectArtifactPaths(examen)]));
  let archivosEliminados = 0;
  let archivosFaltantes = 0;

  if (!dryRun) {
    for (const ruta of paths) {
      const eliminado = await eliminarArchivoExamen(ruta);
      if (eliminado) archivosEliminados += 1;
      else archivosFaltantes += 1;
    }
    await ExamenGenerado.updateOne({ _id: examen._id }, buildPurgeUpdate(reason));
  }

  return {
    examenId: toText(examen._id),
    folio: toText(examen.folio),
    loteId: toText(examen.loteId) || undefined,
    archivosEliminados: dryRun ? 0 : archivosEliminados,
    archivosFaltantes: dryRun ? 0 : archivosFaltantes,
    retentionStatus: dryRun ? (toText(examen.retentionStatus) || 'active') as 'active' | 'artifacts_purged' : 'artifacts_purged'
  };
}

export async function ejecutarPurgeExamenesGenerados(params: {
  docenteId?: string;
  olderThanDays: number;
  dryRun?: boolean;
  scope?: PurgeScope;
  reason?: PurgeReason;
}) {
  const olderThanDays = Math.max(1, Math.trunc(Number(params.olderThanDays) || 0));
  const dryRun = Boolean(params.dryRun);
  const scope = params.scope ?? 'ttl';
  const reason = params.reason ?? (scope === 'all' ? 'manual_initial_cleanup' : 'ttl');
  const fechaCorte = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const filtro: Record<string, unknown> = {
    retentionStatus: { $ne: 'artifacts_purged' }
  };
  if (params.docenteId) filtro.docenteId = params.docenteId;
  if (scope === 'ttl') filtro.generadoEn = { $lte: fechaCorte };

  const candidatos = await ExamenGenerado.find(filtro).lean();
  const detalles: PurgeSummary['detalles'] = [];
  let documentosActualizados = 0;
  let archivosEliminados = 0;
  let archivosFaltantes = 0;

  for (const examen of candidatos as unknown as ExamenGeneradoLean[]) {
    const detalle = await purgeSingleExamArtifacts(examen, reason, dryRun);
    detalles.push(detalle);
    archivosEliminados += detalle.archivosEliminados;
    archivosFaltantes += detalle.archivosFaltantes;
    if (!dryRun) documentosActualizados += 1;
  }

  return {
    dryRun,
    scope,
    olderThanDays,
    fechaCorte: fechaCorte.toISOString(),
    candidatos: candidatos.length,
    documentosActualizados,
    archivosEliminados,
    archivosFaltantes,
    detalles
  } satisfies PurgeSummary;
}
