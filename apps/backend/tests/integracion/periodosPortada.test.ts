import request from 'supertest';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { conectarSqlite, prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo.js';

const app = crearApp();
const parsearBinario = (respuesta: NodeJS.ReadableStream, callback: (error: Error | null, body?: Buffer) => void) => {
  const partes: Buffer[] = [];
  respuesta.on('data', (parte: Buffer | string) => partes.push(Buffer.isBuffer(parte) ? parte : Buffer.from(parte)));
  respuesta.on('end', () => callback(null, Buffer.concat(partes)));
  respuesta.on('error', (error: Error) => callback(error));
};

describe('portadas de materias', () => {
  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  async function registrar(correo: string) {
    const respuesta = await request(app)
      .post('/api/autenticacion/registrar')
      .send({ nombreCompleto: 'Docente', correo, contrasena: 'Secreto123!' })
      .expect(201);
    return respuesta.body.token as string;
  }

  async function crearPeriodo(token: string, nombre: string) {
    const respuesta = await request(app)
      .post('/api/periodos')
      .set({ Authorization: `Bearer ${token}` })
      .send({ nombre, fechaInicio: '2026-01-01', fechaFin: '2026-06-30', grupos: ['23A'] })
      .expect(201);
    return respuesta.body.periodo._id as string;
  }

  async function imagenJpeg(width = 640, height = 360) {
    return sharp({ create: { width, height, channels: 3, background: '#285a78' } }).jpeg().toBuffer();
  }

  it('guarda, sirve, reemplaza y retira portada sin incluir bytes en el listado', async () => {
    const token = await registrar('portada@local.test');
    const periodoId = await crearPeriodo(token, 'Legalidad y Marketing');
    const original = await imagenJpeg();

    await request(app)
      .put(`/api/periodos/${periodoId}/portada`)
      .set({ Authorization: `Bearer ${token}` })
      .attach('archivo', original, { filename: 'portada.jpg', contentType: 'image/jpeg' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ ok: true, mimeType: 'image/webp', width: 640, height: 360 });
      });

    const listado = await request(app)
      .get('/api/periodos')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(listado.body.periodos[0].tienePortada).toBe(true);
    expect(listado.body.periodos[0]).not.toHaveProperty('portada');
    expect(listado.body.periodos[0]).not.toHaveProperty('contenido');

    const portada = await request(app)
      .get(`/api/periodos/${periodoId}/portada`)
      .set({ Authorization: `Bearer ${token}` })
      .buffer(true)
      .parse(parsearBinario)
      .expect(200)
      .expect('content-type', 'image/webp')
      .expect('cache-control', 'private, no-store');
    expect(Buffer.isBuffer(portada.body)).toBe(true);
    expect((await sharp(portada.body).metadata()).format).toBe('webp');

    await request(app)
      .put(`/api/periodos/${periodoId}/portada`)
      .set({ Authorization: `Bearer ${token}` })
      .attach('archivo', await imagenJpeg(320, 240), { filename: 'nueva.jpg', contentType: 'image/jpeg' })
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ width: 320, height: 240 }));

    const respuestaRetiro = await request(app)
      .delete(`/api/periodos/${periodoId}/portada`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(respuestaRetiro.body.ok).toBe(true);
    await request(app)
      .delete(`/api/periodos/${periodoId}/portada`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    await request(app)
      .get('/api/periodos')
      .set({ Authorization: `Bearer ${token}` })
      .expect(({ body }) => expect(body.periodos[0].tienePortada).toBe(false));
  });

  it('exige sesión y oculta portadas de materias de otro docente', async () => {
    const tokenPropietario = await registrar('propietario@local.test');
    const tokenAjeno = await registrar('ajeno@local.test');
    const periodoId = await crearPeriodo(tokenPropietario, 'Materia privada');
    const imagen = await imagenJpeg();

    await request(app).get(`/api/periodos/${periodoId}/portada`).expect(401);
    await request(app)
      .put(`/api/periodos/${periodoId}/portada`)
      .set({ Authorization: `Bearer ${tokenPropietario}` })
      .attach('archivo', imagen, { filename: 'portada.jpg', contentType: 'image/jpeg' })
      .expect(200);
    await request(app)
      .get(`/api/periodos/${periodoId}/portada`)
      .set({ Authorization: `Bearer ${tokenAjeno}` })
      .expect(404);
    await request(app)
      .put(`/api/periodos/${periodoId}/portada`)
      .set({ Authorization: `Bearer ${tokenAjeno}` })
      .attach('archivo', imagen, { filename: 'portada.jpg', contentType: 'image/jpeg' })
      .expect(404);
    await request(app)
      .delete(`/api/periodos/${periodoId}/portada`)
      .set({ Authorization: `Bearer ${tokenAjeno}` })
      .expect(404);
  });

  it('rechaza MIME falso, SVG, imágenes sobre 20 MP y solicitudes sobre 20 MiB', async () => {
    const token = await registrar('validacion-portada@local.test');
    const periodoId = await crearPeriodo(token, 'Materia validación');
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#285a78' } }).png().toBuffer();

    await request(app)
      .put(`/api/periodos/${periodoId}/portada`)
      .set({ Authorization: `Bearer ${token}` })
      .attach('archivo', png, { filename: 'falso.jpg', contentType: 'image/jpeg' })
      .expect(415);
    await request(app)
      .put(`/api/periodos/${periodoId}/portada`)
      .set({ Authorization: `Bearer ${token}` })
      .attach('archivo', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), { filename: 'vector.svg', contentType: 'image/svg+xml' })
      .expect(415);

    const grande = await imagenJpeg(4500, 4500);
    await request(app)
      .put(`/api/periodos/${periodoId}/portada`)
      .set({ Authorization: `Bearer ${token}` })
      .attach('archivo', grande, { filename: 'grande.jpg', contentType: 'image/jpeg' })
      .expect(413);

    await request(app)
      .put(`/api/periodos/${periodoId}/portada`)
      .set({ Authorization: `Bearer ${token}` })
      .attach('archivo', Buffer.alloc(20 * 1024 * 1024 + 1), { filename: 'limite.jpg', contentType: 'image/jpeg' })
      .expect(413);
    expect(await prisma.periodoPortada.count({ where: { periodoId } })).toBe(0);
  });

  it('elimina la portada dependiente al borrar el periodo en SQLite', async () => {
    const token = await registrar('cascada-portada@local.test');
    const periodoId = await crearPeriodo(token, 'Materia cascada');
    await request(app)
      .put(`/api/periodos/${periodoId}/portada`)
      .set({ Authorization: `Bearer ${token}` })
      .attach('archivo', await imagenJpeg(), { filename: 'portada.jpg', contentType: 'image/jpeg' })
      .expect(200);

    await prisma.periodo.delete({ where: { id: periodoId } });
    expect(await prisma.periodoPortada.count({ where: { periodoId } })).toBe(0);
  });

  it('crea la tabla de portada al iniciar una base SQLite que ya contiene materias', async () => {
    await prisma.$executeRawUnsafe('DROP TABLE "periodo_portadas"');
    await conectarSqlite();
    const tablas = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='periodo_portadas'"
    );
    expect(tablas).toHaveLength(1);
  });

  it('añade imagenPerfil al actualizar una base SQLite docente existente', async () => {
    await prisma.$executeRawUnsafe('ALTER TABLE "docentes" DROP COLUMN "imagenPerfil"');

    await conectarSqlite();

    const columnas = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("docentes");');
    expect(columnas.some((columna) => columna.name === 'imagenPerfil')).toBe(true);
  });
});
