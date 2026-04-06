/**
 * calificacionGlobalContratoE2E
 *
 * Verifica persistencia y exportacion para tipo "global".
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { Calificacion } from '../../src/modulos/modulo_calificacion/modeloCalificacion';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';
import { prepararEscenarioFlujo } from './_flujoDocenteHelper';

describe('contrato calificacion global e2e', () => {
  const app = crearApp();

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('persiste campos globales y exporta columna global/final', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'global', 'docente-global-contrato@prueba.test');

    const calificacion = await Calificacion.findOne({ examenGeneradoId: escenario.examenId }).lean();
    expect(calificacion).toBeTruthy();
    expect(calificacion?.tipoExamen).toBe('global');
    expect(calificacion?.calificacionGlobalTexto).toBeTruthy();
    expect(calificacion?.proyectoTexto).toBeTruthy();
    expect(calificacion?.calificacionParcialTexto).toBeFalsy();

    const lista = await request(app)
      .get(`/api/analiticas/lista-academica-csv?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set(escenario.auth)
      .expect(200);
    expect(lista.text).toContain(',global,final,');
    expect(lista.text).toContain('CUH512410169');
  });
});

