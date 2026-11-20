import { prisma } from '../../infraestructura/baseDatos/sqlite.js';

/** Posición de alta siguiente; una importación en curso la incrementa localmente para conservar filas. */
export async function obtenerSiguienteOrdenLista(periodoId: string): Promise<number> {
  const ultimo = await prisma.alumno.findFirst({
    where: { periodoId },
    orderBy: [{ ordenLista: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    select: { ordenLista: true }
  });
  return Math.max(0, Number(ultimo?.ordenLista ?? 0)) + 1;
}
