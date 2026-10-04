import { describe, expect, it } from 'vitest';
import { esquemaGuardarCalificacionLista } from '../src/modulos/modulo_analiticas/validacionesAnaliticas.js';

const base = {
  periodoId: '11111111-1111-4111-8111-111111111111',
  alumnoId: '22222222-2222-4222-8222-222222222222',
  clientRequestId: '33333333-3333-4333-8333-333333333333'
};

describe('captura manual de columnas físicas del Segundo Parcial', () => {
  it('acepta práctica hasta 10 y examen hasta 5.25 para incluir el bono manual', () => {
    expect(esquemaGuardarCalificacionLista.safeParse({ ...base, componente: 'Practica 2do Parcial', calificacion: 10 }).success).toBe(true);
    expect(esquemaGuardarCalificacionLista.safeParse({ ...base, componente: 'Exámen 2do Parcial', calificacion: 5.25 }).success).toBe(true);
  });

  it('acepta Global manual en la escala física de 0 a 5', () => {
    expect(esquemaGuardarCalificacionLista.safeParse({ ...base, componente: 'Exámen Global', calificacion: 5 }).success).toBe(true);
    expect(esquemaGuardarCalificacionLista.safeParse({ ...base, componente: 'Exámen Global', calificacion: 5.01 }).success).toBe(false);
  });

  it('rechaza notas fuera de escala, componente no físico y propiedades no declaradas', () => {
    expect(esquemaGuardarCalificacionLista.safeParse({ ...base, componente: 'Exámen 2do Parcial', calificacion: 5.26 }).success).toBe(false);
    expect(esquemaGuardarCalificacionLista.safeParse({ ...base, componente: 'Tareas y Ejercicios 2do Parcial', calificacion: 9 }).success).toBe(false);
    expect(esquemaGuardarCalificacionLista.safeParse({ ...base, componente: 'Practica 2do Parcial', calificacion: 9, inesperado: true }).success).toBe(false);
  });

  it('requiere una clave UUID de idempotencia para todo guardado manual', () => {
    const sinClave = { periodoId: base.periodoId, alumnoId: base.alumnoId };
    expect(esquemaGuardarCalificacionLista.safeParse({ ...sinClave, componente: 'Exámen Global', calificacion: 4.5 }).success).toBe(false);
    expect(esquemaGuardarCalificacionLista.safeParse({ ...base, clientRequestId: 'no-es-uuid', componente: 'Practica 2do Parcial', calificacion: 7 }).success).toBe(false);
  });
});
