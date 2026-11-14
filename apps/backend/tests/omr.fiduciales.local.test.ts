import { describe, expect, it } from 'vitest';
import {
  ajustarFiducialesAfinRobusto,
  ajustarFiducialesEscalaTraslacion,
  type ParFiducialLocal
} from '../src/modulos/modulo_escaneo_omr/ajusteFiducialesLocal.js';

const mapear = (p: { x: number; y: number }) => ({
  x: 1.025 * p.x + 0.035 * p.y + 11,
  y: -0.02 * p.x + 0.98 * p.y + 7
});

const base: ParFiducialLocal[] = [
  { esperado: { x: 20, y: 20 }, detectado: mapear({ x: 20, y: 20 }) },
  { esperado: { x: 180, y: 20 }, detectado: mapear({ x: 180, y: 20 }) },
  { esperado: { x: 20, y: 190 }, detectado: mapear({ x: 20, y: 190 }) },
  { esperado: { x: 180, y: 190 }, detectado: mapear({ x: 180, y: 190 }) }
];

describe('ajuste local por fiduciales parciales', () => {
  it.each([0, 1, 2, 3])('recupera una transformación afín si falta el punto %i', (ausente) => {
    const pares = base.filter((_, indice) => indice !== ausente);
    const ajuste = ajustarFiducialesAfinRobusto(pares, 1.2);
    expect(ajuste?.inliers).toBe(3);
    const real = mapear({ x: 90, y: 105 });
    expect(ajuste?.transformar({ x: 90, y: 105 }).x).toBeCloseTo(real.x, 6);
    expect(ajuste?.transformar({ x: 90, y: 105 }).y).toBeCloseTo(real.y, 6);
  });

  it('rechaza el marcador deformado y ajusta con los otros tres', () => {
    const pares = [...base.slice(0, 3), {
      esperado: base[3]!.esperado,
      detectado: { x: base[3]!.detectado.x + 16, y: base[3]!.detectado.y - 11 }
    }];
    const ajuste = ajustarFiducialesAfinRobusto(pares, 1.5);
    expect(ajuste?.inliers).toBe(3);
    expect(ajuste?.errorPx).toBeLessThan(1e-6);
  });

  it('permite solo escala y traslación con dos anclas del mismo borde', () => {
    const transformarSimple = (p: { x: number; y: number }) => ({ x: 1.03 * p.x + 9, y: 0.98 * p.y + 6 });
    const pares = [base[1]!, base[3]!].map((par) => ({
      esperado: par.esperado,
      detectado: transformarSimple(par.esperado)
    }));
    const ajuste = ajustarFiducialesEscalaTraslacion(pares, 1.2);
    expect(ajuste?.modelo).toBe('escala_traslacion');
    const real = transformarSimple({ x: 180, y: 100 });
    expect(ajuste?.transformar({ x: 180, y: 100 }).y).toBeCloseTo(real.y, 6);
  });

  it('rechaza puntos insuficientes, afines colineales y escalas fuera de rango', () => {
    expect(ajustarFiducialesAfinRobusto(base.slice(0, 2), 2)).toBeNull();
    const colineales = base.slice(0, 3).map((par) => ({
      ...par,
      esperado: { x: par.esperado.x, y: 2 * par.esperado.x },
      detectado: { x: par.detectado.x, y: 2 * par.detectado.x }
    }));
    expect(ajustarFiducialesAfinRobusto(colineales, 2)).toBeNull();
    const extremos = base.slice(0, 2).map((par) => ({
      esperado: par.esperado,
      detectado: { x: 1.5 * par.esperado.x, y: par.esperado.y }
    }));
    expect(ajustarFiducialesEscalaTraslacion(extremos, 2)).toBeNull();
  });
});
