/**
 * listarSincronizaciones
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { MongoSyncAuditRepo } from '../../infra/repositoriosSync.js';

const auditRepo = new MongoSyncAuditRepo();

export async function listarSincronizacionesUseCase(params: { docenteId: string; limite?: number }) {
  const { docenteId, limite } = params;
  const sincronizaciones = await auditRepo.listar(docenteId, limite);
  return { sincronizaciones };
}
