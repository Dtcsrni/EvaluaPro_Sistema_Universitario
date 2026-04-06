import { describe, expect, it } from 'vitest';
import {
  listarEstrategiasMonetizacion,
  listarNivelesComerciales,
  recomendarMonetizacionComunitaria
} from '../src/modulos/modulo_comercial/servicioMonetizacionComunitaria';

describe('monetizacion comunitaria', () => {
  it('expone 4 niveles por cada persona comercial', () => {
    const niveles = listarNivelesComerciales();
    const conteoPorPersona = niveles.reduce<Record<string, number>>((acumulado, nivel) => {
      acumulado[nivel.persona] = (acumulado[nivel.persona] ?? 0) + 1;
      return acumulado;
    }, {});

    expect(conteoPorPersona.docente).toBe(4);
    expect(conteoPorPersona.coordinacion).toBe(4);
    expect(conteoPorPersona.institucional).toBe(4);
    expect(conteoPorPersona.socio_canal).toBe(4);
  });

  it('recomienda nivel de entrada para docente con presupuesto limitado', () => {
    const salida = recomendarMonetizacionComunitaria({
      persona: 'docente',
      volumenAlumnos: 40,
      presupuestoMensualMxn: 170,
      usaEdicionComunitaria: true
    });

    expect(salida.ofertaPrincipal.id).toBe('docente_esencial');
    expect(salida.guardrails.margenBrutoMinimo).toBe(0.6);
    expect(salida.motivos.some((motivo) => motivo.includes('uso comunitario'))).toBe(true);
  });

  it('escala a institucional multisede cuando hay cumplimiento y multi-sede', () => {
    const salida = recomendarMonetizacionComunitaria({
      persona: 'institucional',
      volumenDocentes: 55,
      volumenAlumnos: 3500,
      incidenciasSoporteMes: 20,
      requiereCumplimiento: true,
      requiereIntegraciones: true,
      multipSede: true,
      presupuestoMensualMxn: 80000
    });

    expect(salida.ofertaPrincipal.id).toBe('institucional_sector_publico');
  });

  it('incluye estrategias por persona con piso de margen sostenible', () => {
    const estrategias = listarEstrategiasMonetizacion();
    expect(estrategias.length).toBeGreaterThanOrEqual(8);
    expect(estrategias.every((estrategia) => estrategia.margenBrutoObjetivoMinimo >= 0.6)).toBe(true);
  });
});

