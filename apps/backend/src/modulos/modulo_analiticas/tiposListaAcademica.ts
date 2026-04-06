/**
 * tiposListaAcademica
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
export type ListaAcademicaFila = {
  matricula: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombre: string;
  grupo: string;
  parcial1: string;
  parcial2: string;
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
