/**
 * Tipos compartidos del módulo de asistencias.
 */

export type ResumenAsistenciaAlumno = {
  alumnoId: string;
  matricula: string;
  nombreCompleto: string;
  grupo: string;
  presentes: number;
  faltas: number;
  retardos: number;
  /** Faltas reales + faltas equivalentes de retardos (si la regla lo habilita) */
  faltasEfectivas: number;
  justificadas: number;
  totalSesiones: number;
  porcentajeAsistencia: number;
  superaLimiteFaltas: boolean;
  tieneExcepcion: boolean;
  bloqueadoExamen: boolean;
};

export type ResultadoDerechoExamen = {
  tieneDerecho: boolean;
  faltas?: number;
  retardos?: number;
  /** Faltas reales + faltas equivalentes de retardos (si la regla lo habilita) */
  faltasEfectivas?: number;
  maxFaltas?: number;
  contarRetardos?: boolean;
  retardosEquivalenFalta?: number;
  superaLimite?: boolean;
  tieneExcepcion?: boolean;
  accion?: 'bloquear_examen' | 'advertir';
  motivo:
    | 'sin_regla_configurada'
    | 'dentro_del_limite'
    | 'supera_limite_advertencia'
    | 'bloqueado_por_faltas'
    | 'excepcion_autorizada';
};

