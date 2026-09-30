/**
 * tiposListaAcademica
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import type { AsignacionBonoExtracurricular } from './servicioBonoExtracurricular.js';

export type ListaAcademicaFila = {
  alumnoId?: string;
  matricula: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombre: string;
  grupo: string;
  parcial1: string;
  examenPrimerParcialLista: string;
  continuaPrimerParcialLista: string;
  parcial2: string;
  tareasYEjercicios2doParcial: string;
  practica2doParcial: string;
  evaluacionContinua2doParcial: string;
  examen2doParcial: string;
  examen2doParcialAutomatico: string;
  calificacionSegundoParcial: string;
  examenGlobalComponente: string;
  examenGlobalLista: string;
  examenGlobalListaVersion: number | null;
  continuaTercerParcialLista: string;
  calificacionTercerParcial: string;
  bonoExtracurricular: string;
  bonoExtracurricularSolicitado: string;
  bonoExtracurricularVersion: number | null;
  bonoDistribucion?: AsignacionBonoExtracurricular;
  calificacionFinalCurso: string;
  practica2doParcialVersion: number | null;
  examen2doParcialVersion: number | null;
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
  'tareasYEjercicios2doParcial',
  'practica2doParcial',
  'evaluacionContinua2doParcial',
  'examen2doParcial',
  'examen2doParcialAutomatico',
  'calificacionSegundoParcial',
  'examenGlobalComponente',
  'examenGlobalLista',
  'continuaTercerParcialLista',
  'calificacionTercerParcial',
  'bonoExtracurricular',
  'global',
  'final',
  'observaciones',
  'conformidadAlumno'
];
