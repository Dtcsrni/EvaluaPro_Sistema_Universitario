import { MongoSyncAuditRepo } from '../../infra/repositoriosSync';

const auditRepo = new MongoSyncAuditRepo();

export async function listarSincronizacionesUseCase(params: { docenteId: string; limite?: number }) {
  const { docenteId, limite } = params;
  const sincronizaciones = await auditRepo.listar(docenteId, limite);
  return { sincronizaciones };
}
