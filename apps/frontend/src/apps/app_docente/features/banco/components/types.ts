/**
 * types
 *
 * Responsabilidad: Componente de UI del dominio docente (presentacion y eventos de vista).
 * Limites: Evitar acoplar IO directo; preferir hooks/services del feature.
 */
export type Periodo = { _id: string; nombre: string };
export type TemaBancoFormState = { _id: string; nombre: string; periodoId: string; createdAt?: string };
