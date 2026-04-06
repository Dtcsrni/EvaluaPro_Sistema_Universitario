import Decimal from 'decimal.js';
import { type CodigoPoliticaCalificacion } from './modeloPoliticaCalificacion';

type VectorCortes = {
  c1?: number;
  c2?: number;
  c3?: number;
};

type VectorExamenes = {
  parcial1?: number;
  parcial2?: number;
  global?: number;
};

export type ResultadoPoliticaLisc = {
  continuaPorCorte: Required<VectorCortes>;
  examenesPorCorte: Required<VectorExamenes>;
  bloqueContinuaDecimal: number;
  bloqueExamenesDecimal: number;
  finalDecimal: number;
  finalRedondeada: number;
};

function clamp0a10(value: number): Decimal {
  const decimal = new Decimal(Number.isFinite(value) ? value : 0);
  return Decimal.max(0, Decimal.min(10, decimal));
}

export function promedioSimple(valores: number[]): number {
  const limpios = (Array.isArray(valores) ? valores : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (limpios.length === 0) return 0;
  const total = limpios.reduce((sum, value) => sum + value, 0);
  return total / limpios.length;
}

export function promedioPonderado(valores: Array<{ valor: number; peso?: number }>): number {
  const limpios = (Array.isArray(valores) ? valores : [])
    .map((item) => ({
      valor: Number(item?.valor),
      peso: Number(item?.peso ?? 1)
    }))
    .filter((item) => Number.isFinite(item.valor) && Number.isFinite(item.peso) && item.peso > 0);

  if (limpios.length === 0) return 0;
  const sumaPesos = limpios.reduce((sum, item) => sum + item.peso, 0);
  if (!Number.isFinite(sumaPesos) || sumaPesos <= 0) return 0;
  const acumulado = limpios.reduce((sum, item) => sum + item.valor * item.peso, 0);
  return acumulado / sumaPesos;
}

export function calcularExamenCorte(teoricoDecimal: number, practicas: number[]): number {
  const teorico = clamp0a10(teoricoDecimal);
  const practico = clamp0a10(promedioSimple(practicas));
  return teorico.mul(0.5).add(practico.mul(0.5)).toDecimalPlaces(4).toNumber();
}

export function redondearFinalInstitucional(finalDecimal: number): number {
  const valor = clamp0a10(finalDecimal);
  if (valor.lessThan(6)) {
    return valor.floor().toNumber();
  }
  return valor.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function calcularPoliticaLisc(params: {
  continuaPorCorte: VectorCortes;
  examenesPorCorte: VectorExamenes;
  pesosGlobales?: { continua?: number; examenes?: number };
  pesosExamenes?: { parcial1?: number; parcial2?: number; global?: number };
}): ResultadoPoliticaLisc {
  const continuaPorCorte: Required<VectorCortes> = {
    c1: clamp0a10(params.continuaPorCorte.c1 ?? 0).toNumber(),
    c2: clamp0a10(params.continuaPorCorte.c2 ?? 0).toNumber(),
    c3: clamp0a10(params.continuaPorCorte.c3 ?? 0).toNumber()
  };

  const examenesPorCorte: Required<VectorExamenes> = {
    parcial1: clamp0a10(params.examenesPorCorte.parcial1 ?? 0).toNumber(),
    parcial2: clamp0a10(params.examenesPorCorte.parcial2 ?? 0).toNumber(),
    global: clamp0a10(params.examenesPorCorte.global ?? 0).toNumber()
  };

  const pesoContinua = new Decimal(Number(params.pesosGlobales?.continua ?? 0.5));
  const pesoExamenes = new Decimal(Number(params.pesosGlobales?.examenes ?? 0.5));

  const pesoParcial1 = new Decimal(Number(params.pesosExamenes?.parcial1 ?? 0.2));
  const pesoParcial2 = new Decimal(Number(params.pesosExamenes?.parcial2 ?? 0.2));
  const pesoGlobal = new Decimal(Number(params.pesosExamenes?.global ?? 0.6));

  const bloqueContinuaDecimal = clamp0a10(
    new Decimal(continuaPorCorte.c1)
      .mul(0.2)
      .add(new Decimal(continuaPorCorte.c2).mul(0.2))
      .add(new Decimal(continuaPorCorte.c3).mul(0.6))
      .toNumber()
  );

  const bloqueExamenesDecimal = clamp0a10(
    new Decimal(examenesPorCorte.parcial1)
      .mul(pesoParcial1)
      .add(new Decimal(examenesPorCorte.parcial2).mul(pesoParcial2))
      .add(new Decimal(examenesPorCorte.global).mul(pesoGlobal))
      .toNumber()
  );

  const finalDecimal = clamp0a10(
    bloqueContinuaDecimal.mul(pesoContinua).add(bloqueExamenesDecimal.mul(pesoExamenes)).toNumber()
  );

  const finalRedondeada = redondearFinalInstitucional(finalDecimal.toNumber());

  return {
    continuaPorCorte,
    examenesPorCorte,
    bloqueContinuaDecimal: bloqueContinuaDecimal.toDecimalPlaces(4).toNumber(),
    bloqueExamenesDecimal: bloqueExamenesDecimal.toDecimalPlaces(4).toNumber(),
    finalDecimal: finalDecimal.toDecimalPlaces(4).toNumber(),
    finalRedondeada
  };
}

export function esPoliticaLisc(codigo: string): boolean {
  return codigo === 'POLICY_LISC_ENCUADRE_2026';
}

export function esPoliticaSv(codigo: string): boolean {
  return codigo === 'POLICY_SV_EXCEL_2026';
}

export function validarPoliticaSoportada(codigo: string): asserts codigo is CodigoPoliticaCalificacion {
  if (!esPoliticaLisc(codigo) && !esPoliticaSv(codigo)) {
    throw new Error(`Politica no soportada: ${codigo}`);
  }
}
