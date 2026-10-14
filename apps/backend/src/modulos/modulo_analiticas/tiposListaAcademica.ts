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
  tareasYEjerciciosPrimerParcial: string;
  practicaPrimerParcial: string;
  examenPrimerParcialAutomatico: string;
  examenPrimerParcialLista: string;
  examenPrimerParcialListaVersion: number | null;
  continuaPrimerParcialLista: string;
  calificacionPrimerParcialLista: string;
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
  ponderacionTercerParcialLista: string;
  subtotalPrimerSegundoParcialLista: string;
  ponderacionPrimerSegundoParcialesLista: string;
  calificacionFinalLibroLista: string;
  calificacionFinalBase10Lista: string;
  bonoExtracurricular: string;
  bonoExtracurricularSolicitado: string;
  bonoExtracurricularVersion: number | null;
  bonoDistribucion?: AsignacionBonoExtracurricular;
  calificacionFinalCurso: string;
  calificacionFinalCursoActa: string;
  extraDisponible: boolean;
  solicitaExtra: boolean;
  solicitudExtraVersion: number | null;
  resultadosExtraordinarios: Array<{
    claseRegistro: 'interno' | 'externo';
    examenGeneradoId?: string;
    loteId?: string | null;
    folio: string;
    calificacionSobre5: string;
    calificacionSobre10: string;
    estadoAprobatorio: 'Aprobatoria' | 'No aprobatoria';
    origen: string;
    fuenteArchivo?: string;
    documentoSha256?: string;
  }>;
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
  'tareasYEjerciciosPrimerParcial',
  'practicaPrimerParcial',
  'examenPrimerParcialAutomatico',
  'examenPrimerParcialLista',
  'continuaPrimerParcialLista',
  'calificacionPrimerParcialLista',
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
  'ponderacionTercerParcialLista',
  'subtotalPrimerSegundoParcialLista',
  'ponderacionPrimerSegundoParcialesLista',
  'calificacionFinalLibroLista',
  'calificacionFinalBase10Lista',
  'bonoExtracurricular',
  'global',
  'final',
  'observaciones',
  'conformidadAlumno'
];
