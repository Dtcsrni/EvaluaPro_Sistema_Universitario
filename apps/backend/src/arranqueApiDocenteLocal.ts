/** Arranque local acotado de la API docente para GUI y validación de flujos. */
import type { Express } from 'express';
import type { Server } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { crearApp } from './app.js';
import { configuracion } from './configuracion.js';
import { conectarSqlite, prisma } from './infraestructura/baseDatos/sqlite.js';
import { log, logError } from './infraestructura/logging/logger.js';

type OpcionesArranque = {
  conectar?: () => Promise<void>;
  crearAplicacion?: () => Express;
  desconectar?: () => Promise<unknown>;
  puerto?: number;
};

export async function iniciarApiDocenteLocal({
  conectar = conectarSqlite,
  crearAplicacion = crearApp,
  desconectar = () => prisma.$disconnect(),
  puerto = configuracion.puerto
}: OpcionesArranque = {}): Promise<Server> {
  await conectar();

  let servidor: Server | undefined;
  try {
    const servidorLocal = crearAplicacion().listen(puerto, '127.0.0.1');
    servidor = servidorLocal;
    await new Promise<void>((resolve, reject) => {
      servidorLocal.once('error', reject);
      servidorLocal.once('listening', resolve);
    });
    return servidorLocal;
  } catch (error) {
    if (servidor?.listening) {
      await new Promise<void>((resolve) => servidor!.close(() => resolve()));
    }
    await desconectar().catch(() => undefined);
    throw error;
  }
}

export async function cerrarApiDocenteLocal(
  servidor: Server,
  desconectar: () => Promise<unknown> = () => prisma.$disconnect()
): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      servidor.close((error) => error ? reject(error) : resolve());
    });
  } finally {
    await desconectar();
  }
}

async function ejecutar(): Promise<void> {
  const servidor = await iniciarApiDocenteLocal();
  const direccion = servidor.address();
  const puerto = typeof direccion === 'object' && direccion ? direccion.port : configuracion.puerto;
  log('ok', 'API docente local escuchando en loopback', { host: '127.0.0.1', puerto });

  let cerrando = false;
  const cerrar = async () => {
    if (cerrando) return;
    cerrando = true;
    await cerrarApiDocenteLocal(servidor);
  };
  process.once('SIGINT', () => { void cerrar().catch((error) => logError('Error al cerrar API docente local', error)); });
  process.once('SIGTERM', () => { void cerrar().catch((error) => logError('Error al cerrar API docente local', error)); });
}

const archivoEjecutado = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (archivoEjecutado === import.meta.url) {
  void ejecutar().catch(async (error) => {
    logError('No se pudo iniciar la API docente local', error);
    await prisma.$disconnect().catch(() => undefined);
    process.exitCode = 1;
  });
}
