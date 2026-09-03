/** Contratos de coordinacion de escritura con una carpeta sincronizada real. */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const raiz = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-lease-test-'));
const db = path.join(raiz, 'evaluapro.db');
const nube = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-lease-cloud-'));
process.env.DATABASE_URL = `file:${db.replace(/\\/g, '/')}`;
process.env.BACKEND_DATABASE_URL = process.env.DATABASE_URL;
process.env.EVALUAPRO_SYNC_CLOUD_DIR = nube;

const [{ prisma, conectarSqlite, desconectarSqlite }, { crearHash }, modulo] = await Promise.all([
  import('../src/infraestructura/baseDatos/sqlite'),
  import('../src/modulos/modulo_autenticacion/servicioHash'),
  import('../src/modulos/modulo_sincronizacion_nube/domain/leaseSincronizacion')
]);
const preferencias = await import('../src/modulos/modulo_sincronizacion_nube/domain/preferenciasSincronizacion');

const docenteId = 'lease-docente-1';
const password = 'Lease-Password-123!';
const equipoA = 'equipo-a-123456';
const equipoB = 'equipo-b-123456';

describe('lease de sincronizacion entre equipos', () => {
  beforeAll(async () => {
    await fs.copyFile(path.resolve(process.cwd(), '..', '..', 'data', 'evaluapro.db'), db);
    await conectarSqlite();
  });
  beforeEach(async () => {
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
    const tablas = await prisma.$queryRawUnsafe<Array<{ name: string }>>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    for (const tabla of tablas) await prisma.$executeRawUnsafe(`DELETE FROM "${tabla.name.replace(/"/g, '""')}"`);
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
    await prisma.docente.create({ data: { id: docenteId, correo: 'lease@evaluapro.test', nombreCompleto: 'Docente Lease', hashContrasena: await crearHash(password), roles: '["docente"]', activo: true } });
    await fs.rm(nube, { recursive: true, force: true });
  });
  afterAll(async () => { await desconectarSqlite(); await fs.rm(raiz, { recursive: true, force: true }); await fs.rm(nube, { recursive: true, force: true }); });

  it('permite un solo escritor incluso ante dos adquisiciones simultáneas', async () => {
    const resultados = await Promise.allSettled([
      modulo.adquirirLease(docenteId, equipoA),
      modulo.adquirirLease(docenteId, equipoB)
    ]);
    const exitosos = resultados.filter((resultado): resultado is PromiseFulfilledResult<Awaited<ReturnType<typeof modulo.adquirirLease>>> => resultado.status === 'fulfilled');
    const fallidos = resultados.filter((resultado): resultado is PromiseRejectedResult => resultado.status === 'rejected');
    expect(exitosos).toHaveLength(1);
    expect(fallidos).toHaveLength(1);
    expect(fallidos[0].reason).toMatchObject({ codigo: 'SYNC_LEASE_OCUPADO', estadoHttp: 423 });

    const equipoGanador = exitosos[0].value.lease.equipoId;
    const equipoPerdedor = equipoGanador === equipoA ? equipoB : equipoA;
    await expect(modulo.verificarLeaseEscritura(docenteId, equipoGanador)).resolves.toBeUndefined();
    await expect(modulo.verificarLeaseEscritura(docenteId, equipoPerdedor)).rejects.toMatchObject({ codigo: 'SYNC_LEASE_OCUPADO' });
  });

  it('publica el snapshot cifrado y libera el control', async () => {
    const lease = await modulo.adquirirLease(docenteId, equipoA);
    const publicado = await modulo.publicarInstantaneaNube({ docenteId, equipoId: equipoA, leaseId: lease.lease.leaseId, metodo: 'contrasena', credencial: password });
    expect(publicado.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(publicado.leaseLiberado).toBe(true);
    const remoto = await modulo.descargarInstantaneaNube(docenteId);
    expect(remoto.checksumSha256).toBe(publicado.checksumSha256);
    expect(remoto.archivo.subarray(0, 1).toString()).toBe('{');
    const estado = await modulo.obtenerEstadoLease(docenteId, equipoA);
    expect(estado.modo).toBe('disponible');
  });

  it('recupera un lease expirado conservando el metadato anterior', async () => {
    const correoHash = createHash('sha256').update('lease@evaluapro.test', 'utf8').digest('hex');
    const directorio = path.join(nube, correoHash);
    await fs.mkdir(directorio, { recursive: true });
    await fs.writeFile(path.join(directorio, '.evaluapro.lease.json'), JSON.stringify({ version: 1, propietarioHash: correoHash, equipoId: equipoA, leaseId: 'lease-expirado-123456', adquiridoEn: '2020-01-01T00:00:00.000Z', ultimoHeartbeatEn: '2020-01-01T00:00:00.000Z', expiraEn: '2020-01-01T00:01:00.000Z' }));
    const nuevo = await modulo.adquirirLease(docenteId, equipoB);
    expect(nuevo.lease.equipoId).toBe(equipoB);
    const archivos = await fs.readdir(directorio);
    expect(archivos.some((item) => item.startsWith('.evaluapro.lease.expirado-'))).toBe(true);
  });

  it('no libera ni elimina un lease que ya fue reemplazado por otro equipo', async () => {
    const leaseA = await modulo.adquirirLease(docenteId, equipoA);
    const correoHash = createHash('sha256').update('lease@evaluapro.test', 'utf8').digest('hex');
    const ruta = path.join(nube, correoHash, '.evaluapro.lease.json');
    const leaseAEnDisco = JSON.parse(await fs.readFile(ruta, 'utf8'));
    const leaseB = {
      ...leaseAEnDisco,
      equipoId: equipoB,
      leaseId: 'lease-reemplazo-123456',
      adquiridoEn: new Date().toISOString(),
      ultimoHeartbeatEn: new Date().toISOString(),
      expiraEn: new Date(Date.now() + 60_000).toISOString()
    };
    await fs.writeFile(ruta, JSON.stringify(leaseB));

    await expect(modulo.liberarLease(docenteId, equipoA, leaseA.lease.leaseId)).rejects.toMatchObject({ codigo: 'SYNC_LEASE_OCUPADO' });
    expect(JSON.parse(await fs.readFile(ruta, 'utf8'))).toMatchObject({ equipoId: equipoB, leaseId: leaseB.leaseId });
  });

  it('renueva el lease vigente y rechaza una renovación con metadato sustituido', async () => {
    const leaseA = await modulo.adquirirLease(docenteId, equipoA);
    const renovado = await modulo.renovarLease(docenteId, equipoA, leaseA.lease.leaseId);
    expect(renovado.lease.leaseId).toBe(leaseA.lease.leaseId);
    expect(Date.parse(renovado.lease.expiraEn)).toBeGreaterThan(Date.now());

    const correoHash = createHash('sha256').update('lease@evaluapro.test', 'utf8').digest('hex');
    const ruta = path.join(nube, correoHash, '.evaluapro.lease.json');
    const leaseAEnDisco = JSON.parse(await fs.readFile(ruta, 'utf8'));
    const leaseB = {
      ...leaseAEnDisco,
      equipoId: equipoB,
      leaseId: 'lease-renovacion-reemplazo',
      expiraEn: new Date(Date.now() + 60_000).toISOString()
    };
    await fs.writeFile(ruta, JSON.stringify(leaseB));

    await expect(modulo.renovarLease(docenteId, equipoA, leaseA.lease.leaseId)).rejects.toMatchObject({ codigo: 'SYNC_LEASE_OCUPADO' });
    expect(JSON.parse(await fs.readFile(ruta, 'utf8'))).toMatchObject({ equipoId: equipoB, leaseId: leaseB.leaseId });
  });

  it('reintenta si OneDrive replica primero el manifiesto y después el snapshot', async () => {
    const correoHash = createHash('sha256').update('lease@evaluapro.test', 'utf8').digest('hex');
    const directorio = path.join(nube, correoHash);
    await fs.mkdir(directorio, { recursive: true });
    const contenido = Buffer.from('snapshot-real-replicado-despues', 'utf8');
    const checksum = createHash('sha256').update(contenido).digest('hex');
    const archivo = `evaluapro-snapshot-${checksum}.ep-snapshot`;
    await fs.writeFile(path.join(directorio, 'evaluapro.manifest.json'), JSON.stringify({
      formato: 'evaluapro-cloud-manifest',
      version: 1,
      archivo,
      checksumSha256: checksum,
      exportadoEn: new Date().toISOString(),
      publicadoEn: new Date().toISOString(),
      leaseId: 'lease-replicacion-123456',
      equipoId: equipoA,
      conteos: { baseDatosBytes: 0, archivos: 0, archivosBytes: 0 }
    }));
    const escrituraDiferida = setTimeout(() => {
      fs.writeFile(path.join(directorio, archivo), contenido).catch(() => undefined);
    }, 100);

    const descargado = await modulo.descargarInstantaneaNube(docenteId);
    clearTimeout(escrituraDiferida);
    expect(descargado.archivo).toEqual(contenido);
    expect(descargado.checksumSha256).toBe(checksum);
  });

  it('usa la carpeta elegida por el docente y rechaza el almacenamiento SQLite local', async () => {
    const carpetaElegida = path.join(os.tmpdir(), `evaluapro-lease-selected-${Date.now()}`);
    const configurada = await preferencias.configurarDirectorioSincronizacion(docenteId, carpetaElegida);
    expect(configurada).toMatchObject({ configurado: true, directorio: path.resolve(carpetaElegida), origen: 'docente' });

    const lease = await modulo.adquirirLease(docenteId, equipoA);
    const correoHash = createHash('sha256').update('lease@evaluapro.test', 'utf8').digest('hex');
    await expect(fs.access(path.join(carpetaElegida, correoHash, '.evaluapro.lease.json'))).resolves.toBeUndefined();
    expect((await modulo.obtenerEstadoLease(docenteId, equipoA)).directorio).toBe(path.resolve(carpetaElegida));
    await modulo.liberarLease(docenteId, equipoA, lease.lease.leaseId);

    await expect(preferencias.configurarDirectorioSincronizacion(docenteId, path.dirname(db))).rejects.toMatchObject({ codigo: 'SYNC_CONFIG_RUTA_INVALIDA' });
    await fs.rm(carpetaElegida, { recursive: true, force: true });
  });

  it('rechaza una preferencia persistida que apunte al almacenamiento local', async () => {
    const preferenciasPath = path.join(path.dirname(db), 'sincronizacion-preferencias.json');
    const correoHash = createHash('sha256').update('lease@evaluapro.test', 'utf8').digest('hex');
    await fs.writeFile(preferenciasPath, JSON.stringify({ version: 1, docentes: { [correoHash]: { directorio: path.dirname(db), actualizadoEn: new Date().toISOString() } } }));

    await expect(preferencias.obtenerConfiguracionSincronizacion(docenteId)).rejects.toMatchObject({ codigo: 'SYNC_CONFIG_RUTA_INVALIDA' });
    await fs.rm(preferenciasPath, { force: true });
  });
});
