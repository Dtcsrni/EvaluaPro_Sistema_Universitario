/**
 * Tipos compartidos para contratos de cumplimiento y privacidad.
 */
export type DataClassification = 'publico' | 'interno' | 'personal' | 'sensible';

export type DsrTipo = 'acceso' | 'rectificacion' | 'cancelacion' | 'oposicion';
export type DsrStatus = 'pendiente' | 'en_proceso' | 'resuelto' | 'rechazado';

export type RetentionPolicy = {
  dataset: string;
  ttlDays: number;
  legalBasis: string;
  purgeMode: 'ttl' | 'manual' | 'mixto';
};

export type ComplianceStatus = {
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
  retentionJobs: boolean;
  pendingDsr: number;
  policyVersion: string;
  complianceMode: 'private' | 'public-hidalgo';
};
