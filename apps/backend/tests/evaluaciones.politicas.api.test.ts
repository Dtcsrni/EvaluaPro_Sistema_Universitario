import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const memoria = vi.hoisted(() => {
  const estado: { politicas: Array<Record<string, any>>; auditoria: Array<Record<string, any>> } = { politicas: [], auditoria: [] };
  const prisma: any = {};
  prisma.$transaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma));
  prisma.politicaCalificacion = {
    findMany: vi.fn(async ({ where = {} } = {}) => estado.politicas
      .filter((row) => row.docenteId === where.docenteId && (where.codigo === undefined || row.codigo === where.codigo || (where.codigo?.not === null && row.codigo !== null)))
      .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)) || b.version - a.version)),
    create: vi.fn(async ({ data }) => {
      estado.politicas.push(data);
      return data;
    })
  };
  prisma.$queryRawUnsafe = vi.fn(async (query: string, ...params: unknown[]) => {
    if (query.includes('clientRequestId = ?')) {
      return estado.auditoria.filter((row) => row.docenteId === params[0] && row.clientRequestId === params[1]).slice(0, 1);
    }
    const [docenteId, codigo] = params;
    const tieneCursor = params.length === 6;
    const createdAt = tieneCursor ? params[2] : undefined;
    const id = tieneCursor ? String(params[4]) : '';
    const limite = tieneCursor ? params[5] : params[2];
    let filas = estado.auditoria.filter((row) => row.docenteId === docenteId && row.codigo === codigo)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || String(b.id).localeCompare(String(a.id)));
    if (createdAt) {
      const indiceCursor = filas.findIndex((row) => row.id === id);
      filas = indiceCursor >= 0 ? filas.slice(indiceCursor + 1) : [];
    }
    return filas.slice(0, Number(limite));
  });
  prisma.$executeRawUnsafe = vi.fn(async (_query: string, ...params: unknown[]) => {
    const [id, docenteId, codigo, version, accion, motivo, clientRequestId, requestHash, antes, despues, createdAt] = params;
    estado.auditoria.push({ id, docenteId, codigo, version, accion, motivo, clientRequestId, requestHash, antes, despues, createdAt });
    return 1;
  });
  return { estado, prisma };
});

vi.mock('../src/infraestructura/baseDatos/sqlite.js', () => ({ prisma: memoria.prisma }));
vi.mock('../src/compartido/compat.js', () => ({
  buildCompatModel: () => new Proxy({}, { get: () => vi.fn(async () => []) })
}));

import {
  archivarPoliticaDocente,
  crearPoliticaDocente,
  listarAuditoriaPolitica,
  listarPoliticasDocente,
  obtenerPoliticaDocente,
  versionarPoliticaDocente
} from '../src/modulos/modulo_evaluaciones/servicioCrudPoliticasCalificacion.js';
import { esquemaCrearPolitica } from '../src/modulos/modulo_evaluaciones/validacionesEvaluaciones.js';
import rutasEvaluaciones from '../src/modulos/modulo_evaluaciones/rutasEvaluaciones.js';

const crearPayload = (clientRequestId: string, nombre = 'Política de prueba') => ({
  codigo: 'POLICY_DOCENTE_LISC',
  familia: 'lisc_encuadre' as const,
  nombre,
  descripcion: 'Parámetros de evaluación del docente',
  clientRequestId,
  parametros: { pesosGlobales: { continua: 0.7, examenes: 0.3 } }
});

function crearAppPoliticasTest() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { docenteId: req.header('x-docente-id') ?? 'docente-1', docenteRoles: ['docente'] });
    next();
  });
  app.use('/api/evaluaciones', rutasEvaluaciones);
  app.use((error: Error & { codigo?: string; estadoHttp?: number }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(error);
    return res.status(error.estadoHttp ?? 500).json({ error: { codigo: error.codigo ?? 'ERROR', mensaje: error.message } });
  });
  return app;
}

describe('ciclo API de políticas docentes', () => {
  beforeEach(() => {
    memoria.estado.politicas.length = 0;
    memoria.estado.auditoria.length = 0;
    vi.clearAllMocks();
  });

  it('acepta solo pesos tipados normalizados para la familia de cálculo', () => {
    const payload = crearPayload('88888888-8888-4888-8888-888888888888');
    expect(esquemaCrearPolitica.safeParse(payload).success).toBe(true);
    expect(esquemaCrearPolitica.safeParse({ ...payload, parametros: { pesosGlobales: { continua: 0.8, examenes: 0.4 } } }).success).toBe(false);
    expect(esquemaCrearPolitica.safeParse({ ...payload, familia: 'sv_excel_contract' }).success).toBe(false);
  });

  it('expone por HTTP alta, versión, detalle, auditoría y archivo bajo RBAC docente', async () => {
    const app = crearAppPoliticasTest();
    const codigo = 'POLICY_DOCENTE_LISC';
    const primera = await request(app).post('/api/evaluaciones/politicas')
      .send(crearPayload('99999999-9999-4999-8999-999999999991')).expect(201);
    expect(primera.body.politica).toMatchObject({ codigo, version: 1, editable: true });

    await request(app).put(`/api/evaluaciones/politicas/${codigo}`)
      .send({ ...crearPayload('99999999-9999-4999-8999-999999999992', 'Versión actualizada'), parametros: { pesosGlobales: { continua: 0.6, examenes: 0.4 } } })
      .expect(200)
      .expect(({ body }) => expect(body.politica.version).toBe(2));

    await request(app).get(`/api/evaluaciones/politicas/${codigo}?version=1`).expect(200)
      .expect(({ body }) => expect(body.politica.nombre).toBe('Política de prueba'));
    await request(app).get(`/api/evaluaciones/politicas/${codigo}/auditoria`).expect(200)
      .expect(({ body }) => expect(body.eventos).toHaveLength(2));
    await request(app).get(`/api/evaluaciones/politicas/${codigo}`)
      .set('x-docente-id', 'docente-2').expect(404);

    await request(app).delete(`/api/evaluaciones/politicas/${codigo}`)
      .send({ clientRequestId: '99999999-9999-4999-8999-999999999993', motivo: 'Política sustituida' })
      .expect(200)
      .expect(({ body }) => expect(body.politica).toMatchObject({ version: 3, activa: false }));
  });

  it('crea una política aislada e idempotente y detecta reutilización de clave con otro payload', async () => {
    const payload = crearPayload('11111111-1111-4111-8111-111111111111');
    const primera = await crearPoliticaDocente('docente-1', payload);
    const repetida = await crearPoliticaDocente('docente-1', { ...payload, parametros: { pesosGlobales: { examenes: 0.3, continua: 0.7 } } });

    expect(primera.version).toBe(1);
    expect(repetida.id).toBe(primera.id);
    expect(memoria.estado.politicas).toHaveLength(1);
    expect(memoria.estado.auditoria).toHaveLength(1);
    await expect(crearPoliticaDocente('docente-1', { ...payload, nombre: 'Otro payload' }))
      .rejects.toMatchObject({ codigo: 'POLITICA_IDEMPOTENCIA_CONFLICTO', estadoHttp: 409 });

    const deOtroDocente = await crearPoliticaDocente('docente-2', payload);
    expect(deOtroDocente.docenteId).toBe('docente-2');
    await expect(obtenerPoliticaDocente('docente-2', payload.codigo)).resolves.toMatchObject({ docenteId: 'docente-2' });
  });

  it('versiona sin alterar el registro previo y archiva como una versión nueva auditable', async () => {
    const primera = await crearPoliticaDocente('docente-1', crearPayload('22222222-2222-4222-8222-222222222222'));
    const segunda = await versionarPoliticaDocente('docente-1', primera.codigo, {
      ...crearPayload('33333333-3333-4333-8333-333333333333', 'Política ajustada'),
      parametros: { pesosGlobales: { continua: 0.6, examenes: 0.4 } }
    });
    const archivada = await archivarPoliticaDocente('docente-1', primera.codigo, {
      clientRequestId: '44444444-4444-4444-8444-444444444444',
      motivo: 'Sustituida por una política nueva'
    });

    expect(memoria.estado.politicas.map((row) => row.version)).toEqual([1, 2, 3]);
    expect(memoria.estado.politicas[0].nombre).toBe('Política de prueba');
    expect(segunda.version).toBe(2);
    expect(archivada).toMatchObject({ version: 3, activa: false });
    await expect(listarPoliticasDocente('docente-1')).resolves.toEqual([]);
    await expect(listarPoliticasDocente('docente-1', { incluirArchivadas: true })).resolves.toMatchObject([{ version: 3, activa: false }]);
    await expect(listarPoliticasDocente('docente-1', { incluirArchivadas: true, incluirVersiones: true })).resolves.toHaveLength(3);
    await expect(archivarPoliticaDocente('docente-1', primera.codigo, {
      clientRequestId: '55555555-5555-4555-8555-555555555555', motivo: 'Intento repetido'
    })).rejects.toMatchObject({ codigo: 'POLITICA_ARCHIVADA', estadoHttp: 409 });
  });

  it('lista auditoría por código, con actor/versión y cursores acotados', async () => {
    const politica = await crearPoliticaDocente('docente-1', crearPayload('66666666-6666-4666-8666-666666666666'));
    await versionarPoliticaDocente('docente-1', politica.codigo, {
      ...crearPayload('77777777-7777-4777-8777-777777777777', 'Versión 2'),
      parametros: { pesosGlobales: { continua: 0.5, examenes: 0.5 } }
    });
    const pagina = await listarAuditoriaPolitica('docente-1', politica.codigo, { limite: 1 });

    expect(pagina.eventos).toHaveLength(1);
    expect(pagina.eventos[0]).toMatchObject({ docenteId: 'docente-1', codigo: politica.codigo });
    expect(pagina.nextCursor).toBeTruthy();
    const siguiente = await listarAuditoriaPolitica('docente-1', politica.codigo, { limite: 1, cursor: pagina.nextCursor ?? undefined });
    expect(siguiente.eventos).toHaveLength(1);
    expect(new Set([pagina.eventos[0].version, siguiente.eventos[0].version])).toEqual(new Set([1, 2]));
    await expect(listarAuditoriaPolitica('docente-2', politica.codigo)).resolves.toMatchObject({ eventos: [], nextCursor: null });
  });
});
