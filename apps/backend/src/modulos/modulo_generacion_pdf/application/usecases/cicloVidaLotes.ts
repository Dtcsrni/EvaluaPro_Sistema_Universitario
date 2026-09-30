import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { prisma } from '../../../../infraestructura/baseDatos/sqlite.js';
import { ErrorAplicacion } from '../../../../compartido/errores/errorAplicacion.js';
import { resolverRutaPdfExamen } from '../../../../infraestructura/archivos/almacenLocal.js';
import { validarPdfConsolidadoLote } from '../../domain/validacionLotePdf.js';
import { normalizarLoteId } from '../../shared/controladorGeneracionPdfShared.js';

type CambiarEstadoLoteParams = {
  docenteId: unknown;
  loteId: string;
  clientRequestId: string;
  archivado: boolean;
};

function serializarCursor(evento: { id: string; createdAt: Date }) {
  return Buffer.from(JSON.stringify({ id: evento.id, createdAt: evento.createdAt.toISOString() }), 'utf8').toString('base64url');
}

function leerCursor(value: string | undefined) {
  if (!value) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { id?: unknown; createdAt?: unknown };
    const createdAt = new Date(String(decoded.createdAt ?? ''));
    if (
      typeof decoded.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded.id) ||
      !Number.isFinite(createdAt.getTime())
    ) throw new Error('invalid cursor');
    return { id: decoded.id, createdAt };
  } catch {
    throw new ErrorAplicacion('LOTE_AUDITORIA_CURSOR_INVALIDO', 'El cursor de auditoría de lote no es válido', 400);
  }
}

async function verificarArtefactoPdfLote(params: {
  archivoNombre: string;
  sha256: string;
  totalPaginas: number;
  totalExamenes: number;
}) {
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(resolverRutaPdfExamen(params.archivoNombre));
  } catch {
    throw new ErrorAplicacion('LOTE_PDF_NO_DISPONIBLE', 'No se puede restaurar el lote porque falta el PDF consolidado.', 409);
  }
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  if (sha256 !== params.sha256) {
    throw new ErrorAplicacion('LOTE_PDF_INTEGRIDAD_INVALIDA', 'No se puede restaurar el lote: el hash del PDF no coincide con el registro.', 409);
  }
  try {
    await validarPdfConsolidadoLote(buffer, params.totalPaginas);
  } catch (error) {
    const validacion = error as Error & { code?: string };
    throw new ErrorAplicacion(
      validacion.code ?? 'LOTE_PDF_INTEGRIDAD_INVALIDA',
      'No se puede restaurar el lote: el PDF consolidado no pasó la validación de integridad.',
      409
    );
  }
}

function resolverEventoRepetido(evento: {
  loteId: string;
  archivadoResultante: boolean;
  createdAt: Date;
}, loteId: string, archivado: boolean) {
  if (evento.loteId !== loteId || evento.archivadoResultante !== archivado) {
    throw new ErrorAplicacion('LOTE_REQUEST_ID_REUTILIZADO', 'clientRequestId ya fue utilizado para otra operación de ciclo de vida.', 409);
  }
  return {
    ok: true,
    loteId,
    archivado: evento.archivadoResultante,
    archivadoEn: evento.archivadoResultante ? evento.createdAt.toISOString() : null,
    repetida: true
  };
}

export async function cambiarEstadoLotePdfUseCase(params: CambiarEstadoLoteParams) {
  const docenteId = String(params.docenteId);
  const loteId = normalizarLoteId(params.loteId);
  if (!loteId) throw new ErrorAplicacion('LOTE_INVALIDO', 'Lote inválido', 400);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.clientRequestId)) {
    throw new ErrorAplicacion('LOTE_REQUEST_ID_INVALIDO', 'clientRequestId debe ser UUID', 400);
  }

  const artefactoPrevio = await prisma.examenLoteArtefactoPdf.findFirst({ where: { docenteId, loteId } });
  if (!artefactoPrevio) throw new ErrorAplicacion('LOTE_NO_ENCONTRADO', 'No se encontró el artefacto PDF del lote', 404);
  const eventoPrevio = await prisma.examenLoteArtefactoPdfAuditoria.findUnique({
    where: { docenteId_clientRequestId: { docenteId, clientRequestId: params.clientRequestId } }
  });
  if (eventoPrevio) return resolverEventoRepetido(eventoPrevio, loteId, params.archivado);
  if (!params.archivado) {
    await verificarArtefactoPdfLote(artefactoPrevio);
  }

  return prisma.$transaction(async (tx) => {
    const eventoPrevio = await tx.examenLoteArtefactoPdfAuditoria.findUnique({
      where: { docenteId_clientRequestId: { docenteId, clientRequestId: params.clientRequestId } }
    });
    if (eventoPrevio) {
      return resolverEventoRepetido(eventoPrevio, loteId, params.archivado);
    }

    const artefacto = await tx.examenLoteArtefactoPdf.findFirst({ where: { id: artefactoPrevio.id, docenteId, loteId } });
    if (!artefacto) throw new ErrorAplicacion('LOTE_NO_ENCONTRADO', 'No se encontró el artefacto PDF del lote', 404);
    const examenes = await tx.examenGenerado.findMany({
      where: { docenteId, loteId },
      select: { id: true }
    });
    if (examenes.length !== artefacto.totalExamenes) {
      throw new ErrorAplicacion('LOTE_HISTORIAL_INCOMPLETO', 'No se cambiará el lote porque sus exámenes ya no coinciden con el manifiesto consolidado.', 409, {
        examenesPersistidos: examenes.length,
        examenesRegistrados: artefacto.totalExamenes
      });
    }

    const archivadoEn = params.archivado ? new Date() : null;
    await tx.examenGenerado.updateMany({ where: { docenteId, loteId }, data: { archivadoEn } });
    const artefactoActualizado = await tx.examenLoteArtefactoPdf.update({
      where: { id: artefacto.id },
      data: { archivadoEn, archivadoPor: params.archivado ? docenteId : null }
    });
    const evento = await tx.examenLoteArtefactoPdfAuditoria.create({
      data: {
        docenteId,
        artefactoId: artefacto.id,
        loteId,
        accion: params.archivado ? 'archivar' : 'restaurar',
        clientRequestId: params.clientRequestId,
        archivadoResultante: params.archivado
      }
    });

    return {
      ok: true,
      loteId,
      archivado: params.archivado,
      archivadoEn: artefactoActualizado.archivadoEn?.toISOString() ?? null,
      eventoId: evento.id,
      repetida: false
    };
  });
}

export async function listarAuditoriaLotePdfUseCase(params: {
  docenteId: unknown;
  loteId: string;
  limite: number;
  cursor?: string;
}) {
  const docenteId = String(params.docenteId);
  const loteId = normalizarLoteId(params.loteId);
  if (!loteId) throw new ErrorAplicacion('LOTE_INVALIDO', 'Lote inválido', 400);
  const artefacto = await prisma.examenLoteArtefactoPdf.findFirst({ where: { docenteId, loteId }, select: { id: true } });
  if (!artefacto) throw new ErrorAplicacion('LOTE_NO_ENCONTRADO', 'No se encontró el artefacto PDF del lote', 404);

  const cursor = leerCursor(params.cursor);
  const eventos = await prisma.examenLoteArtefactoPdfAuditoria.findMany({
    where: {
      docenteId,
      loteId,
      ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {})
    },
    take: params.limite + 1,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, accion: true, clientRequestId: true, archivadoResultante: true, createdAt: true }
  });
  const hayMas = eventos.length > params.limite;
  const pagina = eventos.slice(0, params.limite);
  const ultimo = hayMas ? pagina[pagina.length - 1] : undefined;
  return {
    loteId,
    eventos: pagina.map((evento) => ({
      id: evento.id,
      accion: evento.accion,
      clientRequestId: evento.clientRequestId,
      archivado: evento.archivadoResultante,
      actorDocenteId: docenteId,
      createdAt: evento.createdAt.toISOString()
    })),
    nextCursor: ultimo ? serializarCursor(ultimo) : null
  };
}
