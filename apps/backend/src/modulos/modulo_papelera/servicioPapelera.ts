/**
 * servicioPapelera
 *
 * Responsabilidad: Servicio de dominio/aplicacion con reglas de negocio reutilizables.
 * Limites: Mantener invariantes del dominio y errores controlados.
 */
import { Papelera } from './modeloPapelera';

const DIAS_RETENCION = 45;

function calcularExpiraEn(base: Date = new Date()): Date {
  const expira = new Date(base.getTime());
  expira.setDate(expira.getDate() + DIAS_RETENCION);
  return expira;
}

export async function guardarEnPapelera(params: {
  docenteId: string;
  tipo: 'periodo' | 'alumno' | 'plantilla';
  entidadId: string;
  payload: Record<string, unknown>;
}) {
  const eliminadoEn = new Date();
  const expiraEn = calcularExpiraEn(eliminadoEn);
  return Papelera.create({ ...params, eliminadoEn, expiraEn });
}
