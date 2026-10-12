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
  shutdownTimeoutMs?: number;
};

export type EstadoCicloVidaApi = 'starting' | 'ready' | 'draining' | 'stopped';
type CicloVidaApi = { state: EstadoCicloVidaApi };
const ciclosVida = new WeakMap<Server, CicloVidaApi>();
const cierres = new WeakMap<Server, Promise<void>>();
const timeoutsCierre = new WeakMap<Server, number>();
const MAX_TIMEOUT_MS = 2_147_483_647;

function resolverTimeoutCierre(explicito?: number): number {
  const desdeEntorno = process.env.EVALUAPRO_API_SHUTDOWN_TIMEOUT_MS;
  const timeout = explicito ?? (desdeEntorno === undefined || desdeEntorno.trim() === ''
    ? 90_000
    : Number(desdeEntorno));
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > MAX_TIMEOUT_MS) {
    throw new Error(`EVALUAPRO_API_SHUTDOWN_TIMEOUT_MS debe ser un número finito entre 0 y ${MAX_TIMEOUT_MS}`);
  }
  return timeout;
}

export async function iniciarApiDocenteLocal({
  conectar = conectarSqlite,
  crearAplicacion = crearApp,
  desconectar = () => prisma.$disconnect(),
  puerto = configuracion.puerto,
  shutdownTimeoutMs
}: OpcionesArranque = {}): Promise<Server> {
  const timeoutCierre = resolverTimeoutCierre(shutdownTimeoutMs);
  const cicloVida: CicloVidaApi = { state: 'starting' };

  let servidor: Server | undefined;
  try {
    await conectar();
    const aplicacion = crearAplicacion();
    aplicacion.locals.apiLifecycle = cicloVida;
    const servidorLocal = aplicacion.listen(puerto, '127.0.0.1');
    servidor = servidorLocal;
    ciclosVida.set(servidorLocal, cicloVida);
    timeoutsCierre.set(servidorLocal, timeoutCierre);
    await new Promise<void>((resolve, reject) => {
      servidorLocal.once('error', reject);
      servidorLocal.once('listening', resolve);
    });
    cicloVida.state = 'ready';
    return servidorLocal;
  } catch (error) {
    if (servidor?.listening) {
      try {
        await new Promise<void>((resolve, reject) => {
          servidor!.close((errorCierre) => errorCierre ? reject(errorCierre) : resolve());
        });
      } catch (errorLimpieza) {
        logError('Error secundario al cerrar HTTP durante el arranque', errorLimpieza);
      }
    }
    cicloVida.state = 'stopped';
    try {
      await desconectar();
    } catch (errorLimpieza) {
      logError('Error secundario al desconectar persistencia durante el arranque', errorLimpieza);
    }
    throw error;
  }
}

export async function cerrarApiDocenteLocal(
  servidor: Server,
  desconectar: () => Promise<unknown> = () => prisma.$disconnect(),
  timeoutMs?: number
): Promise<void> {
  const existente = cierres.get(servidor);
  if (existente) return existente;

  const operacion = cerrarUnaVez(
    servidor,
    desconectar,
    resolverTimeoutCierre(timeoutMs ?? timeoutsCierre.get(servidor))
  );
  cierres.set(servidor, operacion);
  return operacion;
}

async function cerrarUnaVez(
  servidor: Server,
  desconectar: () => Promise<unknown>,
  timeoutMs: number
): Promise<void> {
  const cicloVida = ciclosVida.get(servidor);
  if (cicloVida) cicloVida.state = 'draining';

  let errorHttp: unknown;
  let errorPersistencia: unknown;
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    const cierreHttp = new Promise<void>((resolve, reject) => {
      servidor.close((error) => error ? reject(error) : resolve());
    });
    const vencimiento = new Promise<'timeout'>((resolve) => {
      temporizador = setTimeout(() => resolve('timeout'), timeoutMs);
    });
    const resultado = await Promise.race([cierreHttp.then(() => 'closed' as const), vencimiento]);
    if (resultado === 'timeout') {
      servidor.closeAllConnections();
      await cierreHttp;
    }
  } catch (error) {
    errorHttp = error;
  } finally {
    if (temporizador) clearTimeout(temporizador);
    try {
      await desconectar();
    } catch (error) {
      errorPersistencia = error;
      logError('Error al desconectar persistencia durante el cierre de API docente local', error);
    }
    if (cicloVida) cicloVida.state = 'stopped';
  }

  if (errorHttp && errorPersistencia) {
    const errorCombinado = new Error('Fallaron el cierre HTTP y la desconexión de persistencia');
    Object.assign(errorCombinado, { errors: [errorHttp, errorPersistencia] });
    throw errorCombinado;
  }
  if (errorHttp) throw errorHttp;
  if (errorPersistencia) throw errorPersistencia;
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
    process.exitCode = 1;
  });
}
