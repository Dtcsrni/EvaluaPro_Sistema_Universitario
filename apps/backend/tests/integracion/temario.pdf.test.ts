/**
 * Prueba de integración para el módulo de Temarios.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';
import { registrarDocente } from './_flujoDocenteHelper.js';
import { parsearTextoTemario } from '../../src/modulos/modulo_temarios/servicioParserTemario.js';

describe('Integración: Temarios y Parser de PDF', () => {
  const app = crearApp();
  let auth: { Authorization: string };
  let periodoId: string;

  beforeAll(async () => {
    await conectarSqliteTest();
  });

  beforeEach(async () => {
    await limpiarSqliteTest();

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
    await cerrarSqliteTest();
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
    it('edita el temario con concurrencia optimista y conserva el avance de nodos', async () => {
      const creado = await request(app)
        .post('/api/temarios/manual')
        .set(auth)
        .send({ periodoId, nombre: 'Programa', texto: '1 Unidad inicial\n1.1 Tema conservado\n1.2 Tema removible' })
        .expect(201);
      const temarioId = creado.body.temario.id ?? creado.body.temario._id;
      const detalleInicial = await request(app).get(`/api/temarios/${temarioId}`).set(auth).expect(200);
      const nodoInicial = detalleInicial.body.nodos.find((nodo: { numero: string }) => nodo.numero === '1.1');
      const nodoId = nodoInicial.id ?? nodoInicial._id;
      await request(app)
        .post(`/api/temarios/nodos/${nodoId}/estado`)
        .set(auth)
        .send({ estado: 'cubierto', notas: 'Avance preservado' })
        .expect(200);

      const detalle = await request(app).get(`/api/temarios/${temarioId}`).set(auth).expect(200);
      const actualizado = await request(app)
        .put(`/api/temarios/${temarioId}`)
        .set(auth)
        .send({
          nombre: 'Programa actualizado',
          texto: '1 Unidad inicial revisada\n1.1 Tema conservado actualizado\n1.3 Tema nuevo',
          expectedUpdatedAt: detalle.body.temario.updatedAt,
          motivoCambio: 'Corrección del programa docente'
        })
        .expect(200);

      expect(actualizado.body.temario.nombre).toBe('Programa actualizado');
      expect(actualizado.body.temario.porcentajeAvance).toBe(33);
      expect(actualizado.body.nodos.find((nodo: { numero: string }) => nodo.numero === '1.1')).toMatchObject({
        id: nodoId,
        titulo: 'Tema conservado actualizado',
        estado: 'cubierto',
        notas: 'Avance preservado'
      });
      expect(actualizado.body.nodos.map((nodo: { numero: string }) => nodo.numero)).toEqual(['1', '1.1', '1.3']);
      expect(JSON.parse(actualizado.body.temario.auditoriaCambios)).toHaveLength(1);
      expect(JSON.parse(actualizado.body.temario.auditoriaCambios)[0]).toMatchObject({
        actorDocenteId: expect.any(String),
        motivo: 'Corrección del programa docente'
      });

      const segundaActualizacion = await request(app)
        .put(`/api/temarios/${temarioId}`)
        .set(auth)
        .send({
          nombre: 'Programa actualizado',
          texto: '1 Unidad inicial revisada\n1.1 Tema conservado actualizado\n1.3 Tema nuevo',
          expectedUpdatedAt: actualizado.body.temario.updatedAt,
          motivoCambio: 'Confirmar nombres oficiales'
        })
        .expect(200);
      const auditoriaPagina1 = await request(app)
        .get(`/api/temarios/${temarioId}/auditoria?limite=1`)
        .set(auth)
        .expect(200);
      expect(auditoriaPagina1.body.eventos).toHaveLength(1);
      expect(auditoriaPagina1.body.nextCursor).toBeTruthy();
      const auditoriaPagina2 = await request(app)
        .get(`/api/temarios/${temarioId}/auditoria?limite=1&cursor=${encodeURIComponent(auditoriaPagina1.body.nextCursor)}`)
        .set(auth)
        .expect(200);
      expect(auditoriaPagina2.body.eventos).toHaveLength(1);
      expect(new Set([...auditoriaPagina1.body.eventos, ...auditoriaPagina2.body.eventos].map((evento) => evento.motivo))).toEqual(
        new Set(['Corrección del programa docente', 'Confirmar nombres oficiales'])
      );
      expect(segundaActualizacion.body.temario.auditoriaCambios).toContain('Confirmar nombres oficiales');

      const otroToken = await registrarDocente(app, 'docente-temarios-ajeno@prueba.test');
      const authAjeno = { Authorization: `Bearer ${otroToken}` };
      await request(app).get(`/api/temarios/${temarioId}`).set(authAjeno).expect(404);
      await request(app).get(`/api/temarios/${temarioId}/auditoria`).set(authAjeno).expect(404);

      await request(app)
        .put(`/api/temarios/${temarioId}`)
        .set(auth)
        .send({
          nombre: 'Escritura obsoleta',
          texto: '1 Unidad',
          expectedUpdatedAt: detalle.body.temario.updatedAt,
          motivoCambio: 'Debe dar conflicto'
        })
        .expect(409);

      await request(app)
        .post('/api/temarios/manual')
        .set(auth)
        .send({ periodoId, nombre: 'No reemplazar', texto: '1 Otra unidad' })
        .expect(409);
      const final = await request(app).get(`/api/temarios/${temarioId}`).set(auth).expect(200);
      expect(final.body.temario.nombre).toBe('Programa actualizado');
    });

    it('rechaza quitar un nodo que ya conserva notas o avance', async () => {
      const creado = await request(app)
        .post('/api/temarios/manual')
        .set(auth)
        .send({ periodoId, nombre: 'Programa', texto: '1 Unidad\n1.1 Tema con notas' })
        .expect(201);
      const temarioId = creado.body.temario.id ?? creado.body.temario._id;
      const detalle = await request(app).get(`/api/temarios/${temarioId}`).set(auth).expect(200);
      const nodo = detalle.body.nodos.find((item: { numero: string }) => item.numero === '1.1');
      const nodoId = nodo.id ?? nodo._id;
      await request(app)
        .post(`/api/temarios/nodos/${nodoId}/estado`)
        .set(auth)
        .send({ estado: 'pendiente', notas: 'No borrar este registro' })
        .expect(200);
      const despues = await request(app).get(`/api/temarios/${temarioId}`).set(auth).expect(200);
      await request(app)
        .put(`/api/temarios/${temarioId}`)
        .set(auth)
        .send({
          nombre: 'Programa',
          texto: '1 Unidad',
          expectedUpdatedAt: despues.body.temario.updatedAt,
          motivoCambio: 'Actualizar temas'
        })
        .expect(409);
    });

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

      // 5. La eliminación explícita protege el avance asociado.
      const detalleAntesDeEliminar = await request(app)
        .get(`/api/temarios/${temarioId}`)
        .set(auth)
        .expect(200);
      await request(app)
        .post(`/api/temarios/${temarioId}/eliminar`)
        .set(auth)
        .send({
          confirmarEliminacion: true,
          expectedUpdatedAt: detalleAntesDeEliminar.body.temario.updatedAt,
          motivoCambio: 'Prueba de protección de historial'
        })
        .expect(409);

      // 6. El registro y los nodos con historial permanecen.
      await request(app)
        .get(`/api/temarios/${temarioId}/nodos`)
        .set(auth)
        .expect(200);
    });

    it('elimina solo un temario sin historial con confirmación y conserva evento auditable', async () => {
      const creado = await request(app)
        .post('/api/temarios/manual')
        .set(auth)
        .send({ periodoId, nombre: 'Borrador', texto: '1 Unidad temporal' })
        .expect(201);
      const temarioId = creado.body.temario.id ?? creado.body.temario._id;
      const detalle = await request(app).get(`/api/temarios/${temarioId}`).set(auth).expect(200);

      await request(app)
        .post(`/api/temarios/${temarioId}/eliminar`)
        .set(auth)
        .send({
          confirmarEliminacion: true,
          expectedUpdatedAt: detalle.body.temario.updatedAt,
          motivoCambio: 'Borrador duplicado'
        })
        .expect(200);
      await request(app).get(`/api/temarios/${temarioId}`).set(auth).expect(404);
      const auditoria = await request(app).get(`/api/temarios/${temarioId}/auditoria`).set(auth).expect(200);
      expect(auditoria.body.eventos).toHaveLength(1);
      expect(auditoria.body.eventos[0]).toMatchObject({ accion: 'eliminado', motivo: 'Borrador duplicado' });
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
