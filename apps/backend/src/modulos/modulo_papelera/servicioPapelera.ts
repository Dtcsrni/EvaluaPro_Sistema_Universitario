/**
 * servicioPapelera
 *
 * Responsabilidad: Servicio de dominio/aplicacion con reglas de negocio reutilizables.
 * Limites: Mantener invariantes del dominio y errores controlados.
 */
import { prisma } from '../../infraestructura/baseDatos/sqlite';

export async function guardarEnPapelera(params: {
  docenteId: string;
  tipo: 'periodo' | 'alumno' | 'plantilla';
  entidadId: string;
  payload: Record<string, unknown>;
}) {
  return prisma.papeleraItem.create({
    data: {
      docenteId: params.docenteId,
      tipo: params.tipo,
      itemId: params.entidadId,
      datosJson: JSON.stringify(params.payload),
    },
  });
}

