/**
 * tiposListaAcademica
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
export type ListaAcademicaFila = {
  alumnoId?: string;
  matricula: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombre: string;
  grupo: string;
  parcial1: string;
  parcial2: string;
  resultadoAutomaticoParcial2: string;
  tareasEjerciciosParcial2: string;
  puntosObtenidosParcial2: number | null;
  puntosPosiblesParcial2: number | null;
  actividadesCalificadasParcial2: number;
  nombresActividadesParcial2: string[];
  actividadesParcial2: Array<{
    courseId: string;
    courseWorkId: string;
    titulo: string;
    puntosPosibles: number | null;
    puntosObtenidos: number | null;
    fechaLimite: string | null;
    estado: 'calificada' | 'faltante' | 'pendiente';
    faltanteConfirmado: boolean;
  }>;
  practicaParcial2: string;
  examenManualParcial2: string;
  bonoGuiaEstudioParcial2: boolean;
  calificacionExamenConBonoParcial2: string;
  evaluacionContinuaParcial2: string;
  calificacionSegundoParcialFisica: string;
  global: string;
  final: string;
  observaciones: string;
  conformidadAlumno: string;
};

export type ManifiestoArchivoIntegridad = {
  nombre: string;
  sha256: string;
  bytes: number;
};

export type ManifiestoIntegridadLista = {
  version: 1;
  periodoId: string;
  generadoEn: string;
  algoritmo: 'sha256';
  archivos: [ManifiestoArchivoIntegridad, ManifiestoArchivoIntegridad];
};

export const COLUMNAS_LISTA_ACADEMICA: Array<keyof ListaAcademicaFila> = [
  'matricula',
  'apellidoPaterno',
  'apellidoMaterno',
  'nombre',
  'grupo',
  'parcial1',
  'parcial2',
  'global',
  'final',
  'observaciones',
  'conformidadAlumno'
];
