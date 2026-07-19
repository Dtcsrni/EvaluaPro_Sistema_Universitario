/**
 * encuadre.modulo.test
 *
 * Responsabilidad: Pruebas de integración para el módulo de Encuadre Académico.
 * Limites: Probar rutas privadas/públicas, validaciones Zod y flujos de firma.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite';
import { conectarMongoTest, cerrarMongoTest, limpiarMongoTest } from '../utils/mongo';
import { crearTokenDocente } from '../../src/modulos/modulo_autenticacion/servicioTokens';

describe('módulo encuadre integración', () => {
  const app = crearApp();

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
    await prisma.firmaEncuadre.deleteMany();
    await prisma.encuadreAcademico.deleteMany();
    await prisma.alumno.deleteMany();
    await prisma.periodo.deleteMany();
    await prisma.docente.deleteMany();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  async function crearContexto() {
    const docente = await prisma.docente.create({
      data: {
        id: '507f1f77bcf86cd799439100',
        nombreCompleto: 'Docente Encuadre',
        correo: 'docente@cuh.mx',
        roles: '["docente"]',
        activo: true
      }
    });

    const periodo = await prisma.periodo.create({
      data: {
        id: '507f1f77bcf86cd799439101',
        docenteId: docente.id,
        nombre: 'Matematicas I',
        nombreNormalizado: 'matematicas i',
        fechaInicio: new Date('2026-05-18T00:00:00Z'),
        fechaFin: new Date('2026-06-26T00:00:00Z'),
        grupos: '["A"]',
        activo: true
      }
    });

    const alumno = await prisma.alumno.create({
      data: {
        id: '507f1f77bcf86cd799439102',
        periodoId: periodo.id,
        matricula: 'CUH1001',
        nombreCompleto: 'Juan Perez',
        correo: 'juan@cuh.mx',
        grupo: 'A',
        activo: true
      }
    });

    const token = crearTokenDocente({ docenteId: docente.id, roles: ['docente'] });
    const auth = { Authorization: `Bearer ${token}` };

    return { docente, periodo, alumno, auth };
  }

  it('debe fallar al inicializar encuadre si el cuerpo no pasa validación Zod', async () => {
    const { auth } = await crearContexto();

    const respuesta = await request(app)
      .post('/api/evaluaciones/encuadre/inicializar')
      .set(auth)
      .send({
        // sin periodoId (requerido)
        carrera: ''
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toBeDefined();
  });

  it('debe representar el encuadre no inicializado como estado vacío esperado', async () => {
    const { periodo, auth } = await crearContexto();

    const respuesta = await request(app)
      .get(`/api/evaluaciones/encuadre/estado/${periodo.id}`)
      .set(auth);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ periodoId: periodo.id, inicializado: false, encuadre: null });
  });

  it('debe inicializar encuadre correctamente con datos válidos', async () => {
    const { periodo, auth } = await crearContexto();

    const respuesta = await request(app)
      .post('/api/evaluaciones/encuadre/inicializar')
      .set(auth)
      .send({
        periodoId: periodo.id,
        carrera: 'Licenciatura en Sistemas Computacionales',
        clave: 'ISCF213',
        area: 'Ingeniería',
        horasDocente: 50,
        horasIndependientes: 100,
        creditos: 6.25,
        objetivoGeneral: 'Aprender lógica de programación.',
        cicloLectivo: 'Mayo-Junio 2026',
        porcentajeExamenes: 50,
        porcentajeEvalContinua: 50
      });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.success).toBe(true);
    expect(respuesta.body.encuadreId).toBeDefined();
    expect(respuesta.body.docenteToken).toBeDefined();

    // Consultar estado de firmas
    const resEstado = await request(app)
      .get(`/api/evaluaciones/encuadre/estado/${periodo.id}`)
      .set(auth);

    expect(resEstado.status).toBe(200);
    expect(resEstado.body.periodoId).toBe(periodo.id);
    expect(resEstado.body.firmas.length).toBe(2); // Docente + 1 Alumno
  });

  it('debe permitir firmar de forma pública usando el token de firma', async () => {
    const { periodo, auth } = await crearContexto();

    const resInit = await request(app)
      .post('/api/evaluaciones/encuadre/inicializar')
      .set(auth)
      .send({
        periodoId: periodo.id
      });

    const docenteToken = resInit.body.docenteToken;

    // Obtener detalles de firma de forma pública
    const resDetalles = await request(app)
      .get(`/api/evaluaciones-publicas/encuadre/firmar/${docenteToken}`);

    expect(resDetalles.status).toBe(200);
    expect(resDetalles.body.firma.tokenFirma).toBeUndefined(); // Excluir token de firma en respuesta por seguridad
    expect(resDetalles.body.firma.nombreFirmante).toBe('Docente Encuadre');

    // Debe rechazar si enviamos campos no permitidos en el cuerpo (esquemaVacio.strict())
    const resFirmaRechazada = await request(app)
      .post(`/api/evaluaciones-publicas/encuadre/firmar/${docenteToken}`)
      .send({ algoExtra: 1 });
    expect(resFirmaRechazada.status).toBe(400);

    // Firmar públicamente con cuerpo vacío
    const resFirma = await request(app)
      .post(`/api/evaluaciones-publicas/encuadre/firmar/${docenteToken}`)
      .send({});

    expect(resFirma.status).toBe(200);
    expect(resFirma.body.success).toBe(true);

    // Intentar volver a firmar debe fallar
    const resFirmaRepetida = await request(app)
      .post(`/api/evaluaciones-publicas/encuadre/firmar/${docenteToken}`)
      .send({});
    expect(resFirmaRepetida.status).toBe(400);

    // Descargar PDF público
    const resPdf = await request(app)
      .get(`/api/evaluaciones-publicas/encuadre/pdf/${docenteToken}`);
    expect(resPdf.status).toBe(200);
    expect(resPdf.header['content-type']).toBe('application/pdf');
  });
});
