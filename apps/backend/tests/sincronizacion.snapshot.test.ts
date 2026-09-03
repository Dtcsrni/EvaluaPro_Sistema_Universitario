/** Contratos de la instantanea local 1:1 usando una SQLite temporal. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ErrorAplicacion } from '../src/compartido/errores/errorAplicacion';

const raiz = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-snapshot-test-'));
const db = path.join(raiz, 'evaluapro.db');
process.env.DATABASE_URL = `file:${db.replace(/\\/g, '/')}`;
process.env.BACKEND_DATABASE_URL = process.env.DATABASE_URL;

const [{ prisma, conectarSqlite, desconectarSqlite }, { crearHash }, modulo] = await Promise.all([
  import('../src/infraestructura/baseDatos/sqlite'),
  import('../src/modulos/modulo_autenticacion/servicioHash'),
  import('../src/modulos/modulo_sincronizacion_nube/domain/instantaneaLocal')
]);

const docenteId = 'snapshot-docente-1';
const password = 'Snapshot-Password-123!';

describe('instantanea local 1:1', () => {
  beforeAll(async () => {
    await fs.copyFile(path.resolve(process.cwd(), '..', '..', 'data', 'evaluapro.db'), db);
    await conectarSqlite();
  });
  beforeEach(async () => {
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
    const tablas = await prisma.$queryRawUnsafe<Array<{ name: string }>>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    for (const tabla of tablas) await prisma.$executeRawUnsafe(`DELETE FROM "${tabla.name.replace(/"/g, '""')}"`);
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
    await prisma.docente.create({ data: { id: docenteId, correo: 'snapshot@evaluapro.test', nombreCompleto: 'Docente Snapshot', hashContrasena: await crearHash(password), roles: '["docente"]', activo: true } });
    await fs.rm(path.join(raiz, 'examenes'), { recursive: true, force: true });
    await fs.mkdir(path.join(raiz, 'examenes'), { recursive: true });
  });
  afterAll(async () => { await desconectarSqlite(); await fs.rm(raiz, { recursive: true, force: true }); });

  it('exporta SQLite y archivos en un unico archivo cifrado', async () => {
    await prisma.periodo.create({ data: { id: 'periodo-1', docenteId, nombre: 'Origen', nombreNormalizado: 'origen', fechaInicio: new Date('2026-01-01T00:00:00.000Z'), fechaFin: new Date('2026-06-30T00:00:00.000Z'), grupos: '["A"]' } });
    await fs.writeFile(path.join(raiz, 'examenes', 'fixture.pdf'), Buffer.from('pdf-fixture'));
    const resultado = await modulo.exportarInstantaneaLocal({ docenteId, metodo: 'contrasena', credencial: password });
    expect(resultado.archivo.toString('utf8')).not.toContain('pdf-fixture');
    expect(resultado.archivo.toString('utf8')).not.toContain(password);
    expect(resultado.archivo.toString('utf8')).not.toContain('hashContrasena');
    expect(resultado.conteos).toMatchObject({ archivos: 1 });
  });

  it('acepta una SQLite valida cuando la cuenta autenticada no es la primera docente', async () => {
    await prisma.docente.delete({ where: { id: docenteId } });
    await prisma.docente.create({ data: { id: 'snapshot-primera-cuenta', correo: 'otra-cuenta@evaluapro.test', nombreCompleto: 'Otra cuenta', hashContrasena: await crearHash('Otra-Password-123!'), roles: '["docente"]', activo: true } });
    await prisma.docente.create({ data: { id: docenteId, correo: 'snapshot@evaluapro.test', nombreCompleto: 'Docente Snapshot', hashContrasena: await crearHash(password), roles: '["docente"]', activo: true } });
    await prisma.periodo.create({ data: { id: 'periodo-multiple-docentes', docenteId, nombre: 'Cuenta no primera', nombreNormalizado: 'cuenta no primera', fechaInicio: new Date('2026-01-01T00:00:00.000Z'), fechaFin: new Date('2026-06-30T00:00:00.000Z'), grupos: '["A"]' } });

    const resultado = await modulo.exportarInstantaneaLocal({ docenteId, metodo: 'contrasena', credencial: password });
    await expect(modulo.importarInstantaneaLocal({ docenteId, archivo: resultado.archivo, metodo: 'contrasena', credencial: password, dryRun: true })).resolves.toMatchObject({ mensaje: 'Instantánea válida' });
  });

  it('rechaza password incorrecta sin modificar la instalacion', async () => {
    await prisma.periodo.create({ data: { id: 'periodo-2', docenteId, nombre: 'Protegido', nombreNormalizado: 'protegido', fechaInicio: new Date('2026-01-01T00:00:00.000Z'), fechaFin: new Date('2026-06-30T00:00:00.000Z'), grupos: '["A"]' } });
    const resultado = await modulo.exportarInstantaneaLocal({ docenteId, metodo: 'contrasena', credencial: password });
    await expect(modulo.importarInstantaneaLocal({ docenteId, archivo: resultado.archivo, metodo: 'contrasena', credencial: 'incorrecta', dryRun: true })).rejects.toMatchObject({ codigo: 'SYNC_CREDENCIAL_INVALIDA' });
    expect(await prisma.periodo.count({ where: { docenteId } })).toBe(1);
  });

  it('rechaza una instantánea alterada sin modificar la instalación', async () => {
    await prisma.periodo.create({ data: { id: 'periodo-alterado', docenteId, nombre: 'Protegido', nombreNormalizado: 'protegido', fechaInicio: new Date('2026-01-01T00:00:00.000Z'), fechaFin: new Date('2026-06-30T00:00:00.000Z'), grupos: '["A"]' } });
    const resultado = await modulo.exportarInstantaneaLocal({ docenteId, metodo: 'contrasena', credencial: password });
    const sobre = JSON.parse(resultado.archivo.toString('utf8')) as { payload: { ciphertext: string } };
    const bytes = Buffer.from(sobre.payload.ciphertext, 'base64');
    bytes[0] ^= 0x01;
    sobre.payload.ciphertext = bytes.toString('base64');
    const alterada = Buffer.from(JSON.stringify(sobre), 'utf8');

    await expect(modulo.importarInstantaneaLocal({ docenteId, archivo: alterada, metodo: 'contrasena', credencial: password, dryRun: true })).rejects.toMatchObject({ codigo: 'SYNC_INSTANTANEA_INVALIDA' });
    expect(await prisma.periodo.findUnique({ where: { id: 'periodo-alterado' } })).toBeTruthy();
  });

  it('rechaza Google sin credencial y no permite un desbloqueo implícito', async () => {
    await prisma.docente.update({ where: { id: docenteId }, data: { googleSub: 'google-snapshot-sub' } });
    await expect(modulo.exportarInstantaneaLocal({ docenteId, metodo: 'google' })).rejects.toMatchObject({ codigo: 'SYNC_CREDENCIAL_INVALIDA' });
  });

  it('valida e importa reemplazando la base y conservando respaldo', async () => {
    await prisma.periodo.create({ data: { id: 'periodo-origen', docenteId, nombre: 'Origen', nombreNormalizado: 'origen', fechaInicio: new Date('2026-01-01T00:00:00.000Z'), fechaFin: new Date('2026-06-30T00:00:00.000Z'), grupos: '["A"]' } });
    const resultado = await modulo.exportarInstantaneaLocal({ docenteId, metodo: 'contrasena', credencial: password });
    await prisma.periodo.create({ data: { id: 'periodo-extra', docenteId, nombre: 'Extra', nombreNormalizado: 'extra', fechaInicio: new Date('2026-01-01T00:00:00.000Z'), fechaFin: new Date('2026-06-30T00:00:00.000Z'), grupos: '["B"]' } });
    const validacion = await modulo.importarInstantaneaLocal({ docenteId, archivo: resultado.archivo, metodo: 'contrasena', credencial: password, dryRun: true });
    expect(validacion.mensaje).toBe('Instantánea válida');
    expect(await prisma.periodo.count({ where: { docenteId } })).toBe(2);
    const aplicado = await modulo.importarInstantaneaLocal({ docenteId, archivo: resultado.archivo, metodo: 'contrasena', credencial: password, dryRun: false });
    expect(aplicado.requiereReinicioSesion).toBe(true);
    expect(await prisma.periodo.findUnique({ where: { id: 'periodo-origen' } })).toBeTruthy();
    expect(await prisma.periodo.findUnique({ where: { id: 'periodo-extra' } })).toBeNull();
    expect(aplicado.respaldo).toBeTruthy();
  });

  it('no reemplaza la SQLite si el lease se pierde antes del intercambio', async () => {
    await prisma.periodo.create({ data: { id: 'periodo-guard-origen', docenteId, nombre: 'Origen guardado', nombreNormalizado: 'origen guardado', fechaInicio: new Date('2026-01-01T00:00:00.000Z'), fechaFin: new Date('2026-06-30T00:00:00.000Z'), grupos: '["A"]' } });
    const resultado = await modulo.exportarInstantaneaLocal({ docenteId, metodo: 'contrasena', credencial: password });
    await prisma.periodo.create({ data: { id: 'periodo-guard-extra', docenteId, nombre: 'Dato local', nombreNormalizado: 'dato local', fechaInicio: new Date('2026-01-01T00:00:00.000Z'), fechaFin: new Date('2026-06-30T00:00:00.000Z'), grupos: '["B"]' } });

    await expect(modulo.importarInstantaneaLocal({
      docenteId,
      archivo: resultado.archivo,
      metodo: 'contrasena',
      credencial: password,
      dryRun: false,
      verificarAntesDeReemplazar: async () => {
        throw new ErrorAplicacion('SYNC_LEASE_REQUERIDO', 'El lease expiró antes del intercambio', 423);
      }
    })).rejects.toMatchObject({ codigo: 'SYNC_LEASE_REQUERIDO', estadoHttp: 423 });
    expect(await prisma.periodo.findUnique({ where: { id: 'periodo-guard-extra' } })).toBeTruthy();
    expect(await prisma.periodo.findUnique({ where: { id: 'periodo-guard-origen' } })).toBeTruthy();
    expect((await fs.readdir(os.tmpdir())).filter((nombre) => nombre.startsWith('evaluapro-local-snapshot-'))).toHaveLength(0);
  });
});
