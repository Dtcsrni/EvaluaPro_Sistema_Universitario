/**
 * Prueba de integración para el módulo de Temarios.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';
import { registrarDocente } from './_flujoDocenteHelper';
import { parsearTextoTemario } from '../../src/modulos/modulo_temarios/servicioParserTemario';

describe('Integración: Temarios y Parser de PDF', () => {
  const app = crearApp();
  let auth: { Authorization: string };
  let periodoId: string;

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();

    // Registrar docente y obtener token
    const token = await registrarDocente(app, 'docente-temarios@prueba.test');
    auth = { Authorization: `Bearer ${token}` };

    // Crear un periodo
    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({
        nombre: 'Periodo Temarios 2026',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-06-01',
        grupos: ['A']
      })
      .expect(201);
    periodoId = periodoResp.body.periodo._id;
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  describe('Unidad: Parser de Texto de Temario', () => {
    it('debe parsear correctamente temas y subtemas numerados', () => {
      const texto = `
        1 Introducción a la Programación
        1.1 Conceptos Básicos
        1.1.1 Algoritmos y Diagramas
        2 Estructuras de Control
        2.1 Condicionales
        Esto es texto decorativo que debe ser ignorado
        2.2 Bucles e Iteración
      `;

      const nodos = parsearTextoTemario(texto);

      expect(nodos).toHaveLength(6);
      expect(nodos[0]).toEqual({ numero: '1', nivel: 1, titulo: 'Introducción a la Programación' });
      expect(nodos[1]).toEqual({ numero: '1.1', nivel: 2, titulo: 'Conceptos Básicos' });
      expect(nodos[2]).toEqual({ numero: '1.1.1', nivel: 3, titulo: 'Algoritmos y Diagramas' });
      expect(nodos[3]).toEqual({ numero: '2', nivel: 1, titulo: 'Estructuras de Control' });
      expect(nodos[4]).toEqual({ numero: '2.1', nivel: 2, titulo: 'Condicionales' });
      expect(nodos[5]).toEqual({ numero: '2.2', nivel: 2, titulo: 'Bucles e Iteración' });
    });
  });

  describe('API: Endpoints de Temario', () => {
    it('debe crear un temario manualmente, listar nodos, actualizar estado y calcular avance', async () => {
      const textoTemario = `
        1 Primer Parcial
        1.1 Tema Uno
        1.2 Tema Dos
      `;

      // 1. Crear temario manualmente
      const crearResp = await request(app)
        .post('/api/temarios/manual')
        .set(auth)
        .send({
          periodoId,
          nombre: 'Temario de Álgebra',
          texto: textoTemario
        })
        .expect(201);

      const temarioId = crearResp.body.temario._id;
      expect(temarioId).toBeDefined();
      expect(crearResp.body.totalNodos).toBe(3);

      // 2. Listar temarios creados
      const listarResp = await request(app)
        .get(`/api/temarios?periodoId=${periodoId}`)
        .set(auth)
        .expect(200);

      expect(listarResp.body.temarios).toHaveLength(1);
      expect(listarResp.body.temarios[0]._id).toBe(temarioId);
      expect(listarResp.body.temarios[0].porcentajeAvance).toBe(0);

      // 3. Obtener nodos de ese temario
      const nodosResp = await request(app)
        .get(`/api/temarios/${temarioId}/nodos`)
        .set(auth)
        .expect(200);

      expect(nodosResp.body.nodos).toHaveLength(3);
      const nodoId = nodosResp.body.nodos[0]._id;

      // 4. Cambiar estado de un nodo a 'cubierto'
      const updateResp = await request(app)
        .post(`/api/temarios/nodos/${nodoId}/estado`)
        .set(auth)
        .send({
          estado: 'cubierto',
          notas: 'Completado en clase presencial'
        })
        .expect(200);

      expect(updateResp.body.nodo.estado).toBe('cubierto');
      expect(updateResp.body.nodo.notas).toBe('Completado en clase presencial');
      // Avance: 1 de 3 cubierto = 33%
      expect(updateResp.body.porcentajeAvance).toBe(33);

      // 5. Eliminar el temario
      await request(app)
        .post(`/api/temarios/${temarioId}/eliminar`)
        .set(auth)
        .expect(200);

      // 6. Verificar que ya no existe
      await request(app)
        .get(`/api/temarios/${temarioId}/nodos`)
        .set(auth)
        .expect(404);
    });

    it('debe fallar al intentar parsear un PDF sin texto válido', async () => {
      // Intentar subir un PDF vacío
      await request(app)
        .post('/api/temarios/desde-pdf')
        .set(auth)
        .field('periodoId', periodoId)
        .field('nombre', 'PDF Inválido')
        .attach('archivo', Buffer.from('FAKE PDF CONTENT'), 'test.pdf')
        .expect(400); // Lanzará error de parser o temario vacío
    });
  });
});
