/**
 * generarCodigoAcceso
 *
 * Responsabilidad: emitir un acceso recuperable sin duplicar escrituras al reintentar.
 */
import { configuracion } from '../../../../configuracion.js';
import { ErrorAplicacion } from '../../../../compartido/errores/errorAplicacion.js';
import { prisma } from '../../../../infraestructura/baseDatos/sqlite.js';
import { generarCodigoSimple } from '../../sincronizacionInterna.js';
import { syncClock } from '../../infra/repositoriosSync.js';

type GenerarCodigoAccesoParams = { docenteId: string; periodoId: string; clientRequestId?: string };

function conflictoIdempotencia(): ErrorAplicacion {
  return new ErrorAplicacion('IDEMPOTENCY_KEY_REUSE', 'clientRequestId ya fue utilizado para otra solicitud', 409);
}

function respuestaCodigo(registro: { id: string; codigo: string; expiraEn: Date }) {
  return { codigoAccesoId: registro.id, codigo: registro.codigo, expiraEn: registro.expiraEn };
}

export async function generarCodigoAccesoUseCase(params: GenerarCodigoAccesoParams) {
  const { docenteId, periodoId, clientRequestId } = params;
  const periodo = await prisma.periodo.findFirst({ where: { id: periodoId, docenteId }, select: { id: true } });
  if (!periodo) throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Periodo no encontrado', 404);

  if (clientRequestId) {
    const existente = await prisma.codigoAcceso.findUnique({ where: { id: clientRequestId } });
    if (existente) {
      if (existente.docenteId !== docenteId || existente.periodoId !== periodoId) throw conflictoIdempotencia();
      return respuestaCodigo(existente);
    }
  }

  let codigo = generarCodigoSimple();
  let intentos = 0;
  while (intentos < 5) {
    const existe = await prisma.codigoAcceso.findUnique({ where: { codigo }, select: { id: true } });
    if (!existe) break;
    codigo = generarCodigoSimple();
    intentos += 1;
  }

  const expiraEn = new Date(syncClock.now().getTime() + configuracion.codigoAccesoHoras * 60 * 60 * 1000);
  try {
    const registro = await prisma.codigoAcceso.create({
      data: { ...(clientRequestId ? { id: clientRequestId } : {}), docenteId, periodoId, codigo, expiraEn, usado: false }
    });
    return respuestaCodigo(registro);
  } catch (error) {
    if (clientRequestId) {
      const existente = await prisma.codigoAcceso.findUnique({ where: { id: clientRequestId } });
      if (existente) {
        if (existente.docenteId !== docenteId || existente.periodoId !== periodoId) throw conflictoIdempotencia();
        return respuestaCodigo(existente);
      }
    }
    throw error;
  }
}
