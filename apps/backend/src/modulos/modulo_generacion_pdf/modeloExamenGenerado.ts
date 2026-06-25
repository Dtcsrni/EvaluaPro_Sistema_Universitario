/**
 * modeloExamenGenerado
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const ExamenGenerado = buildCompatModel('examenGenerado', {
  jsonFields: [
    'mapaVariante',
    'mapaOmr',
    'paginas',
    'bookletArtifact',
    'omrSheetArtifact',
    'studentPacketArtifacts',
    'studentPacketZipArtifact',
    'manifestArtifact',
    'answerKeyArtifact',
    'recoveryManifest',
    'reconstructedFrom',
    'questionMap',
    'answerKeySet',
    'versionSet',
    'sheetInstances',
    'statisticsSummary'
  ],
  columns: [
    'id',
    'docenteId',
    'periodoId',
    'plantillaId',
    'alumnoId',
    'loteId',
    'origenGeneracion',
    'folio',
    'estado',
    'entregadoEn',
    'mapaVariante',
    'mapaOmr',
    'paginas',
    'rutaPdf',
    'bookletArtifact',
    'omrSheetArtifact',
    'studentPacketArtifacts',
    'studentPacketZipArtifact',
    'manifestArtifact',
    'answerKeyArtifact',
    'recoveryKeyId',
    'recoveryManifestHash',
    'recoveryManifest',
    'recoveryBundleId',
    'recoveryBundleHash',
    'reconstructedFrom',
    'questionMap',
    'answerKeySet',
    'versionSet',
    'sheetInstances',
    'generationSeed',
    'previewFingerprint',
    'statisticsSummary',
    'omrRuntimeVersion',
    'retentionStatus',
    'artifactsPurgedAt',
    'artifactsPurgeReason',
    'generadoEn',
    'descargadoEn',
    'archivadoEn',
    'createdAt',
    'updatedAt'
  ]
});
