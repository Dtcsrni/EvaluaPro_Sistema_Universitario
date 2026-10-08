/**
 * Servicio de calificacion basado en fraccion exacta.
 */
import { Decimal } from 'decimal.js';
import {
  calcularCalificacionExacta,
  calcularCalificacionGlobal,
  calcularCalificacionParcial
} from '../../compartido/utilidades/calculoCalificacion.js';

export function presentarCalificacionExtraordinaria(calificacionSobre5Texto: string | number) {
  const sobre10 = new Decimal(calificacionSobre5Texto || 0).mul(2);
  return {
    calificacionEquivalenteSobre10Texto: sobre10.toFixed(2),
    estadoAprobatorio: sobre10.gt(6) ? 'Aprobatoria' : 'No aprobatoria'
  } as const;
}

export function calcularCalificacion(
  aciertos: number,
  totalReactivos: number,
  bonoSolicitado = 0,
  evaluacionContinua = 0,
  proyecto = 0,
  tipoExamen: 'parcial' | 'global' | 'extraordinario' = 'parcial'
) {
  const base = calcularCalificacionExacta(aciertos, totalReactivos, bonoSolicitado);
  const parcial = calcularCalificacionParcial(base.calificacionFinalTexto, evaluacionContinua);
  const global = calcularCalificacionGlobal(base.calificacionFinalTexto, proyecto);

  return {
    ...base,
    evaluacionContinuaTexto: tipoExamen === 'parcial' ? parcial.evaluacionContinuaTexto : undefined,
    proyectoTexto: tipoExamen === 'global' ? global.proyectoTexto : undefined,
    calificacionParcialTexto: tipoExamen === 'parcial' ? parcial.calificacionParcialTexto : undefined,
    calificacionGlobalTexto: tipoExamen === 'global' ? global.calificacionGlobalTexto : undefined
  };
}
