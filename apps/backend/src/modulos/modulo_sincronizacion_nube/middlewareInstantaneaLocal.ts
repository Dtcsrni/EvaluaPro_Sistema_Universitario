import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import type { MetodoDesbloqueoInstantanea } from './domain/instantaneaLocal.js';
import { MAX_CONTENIDO_LOCAL_STREAM_BYTES } from './domain/instantaneaLocalStreaming.js';

export type SolicitudInstantaneaLocal = { metodo: MetodoDesbloqueoInstantanea; credencial?: string; dryRun: boolean };
export type SolicitudConInstantaneaLocal = Request & { instantaneaLocal?: { rutaArchivo: string; temporal: string; solicitud: SolicitudInstantaneaLocal } };

class LectorSolicitud {
  private readonly iterator: AsyncIterator<Buffer>;
  private pendiente: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  private terminado = false;

  constructor(request: Request) {
    this.iterator = (async function* () { for await (const parte of request) yield Buffer.from(parte); })()[Symbol.asyncIterator]();
  }

  async exacto(longitud: number) {
    while (this.pendiente.length < longitud && !this.terminado) {
      const siguiente = await this.iterator.next();
      this.terminado = siguiente.done === true;
      if (!siguiente.done) this.pendiente = this.pendiente.length ? Buffer.concat([this.pendiente, siguiente.value]) : siguiente.value;
    }
    if (this.pendiente.length < longitud) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La solicitud de importación está incompleta', 400);
    const resultado = this.pendiente.subarray(0, longitud);
    this.pendiente = this.pendiente.subarray(longitud);
    return resultado;
  }

  async *resto(): AsyncGenerator<Buffer> {
    if (this.pendiente.length) {
      yield this.pendiente;
      this.pendiente = Buffer.alloc(0);
    }
    while (!this.terminado) {
      const siguiente = await this.iterator.next();
      this.terminado = siguiente.done === true;
      if (!siguiente.done) yield siguiente.value;
    }
  }
}

function escribir(salida: NodeJS.WritableStream, chunk: Buffer) {
  return new Promise<void>((resolve, reject) => {
    if (salida.write(chunk)) resolve();
    else {
      const drenar = () => { salida.removeListener('error', fallar); resolve(); };
      const fallar = (error: Error) => { salida.removeListener('drain', drenar); reject(error); };
      salida.once('drain', drenar);
      salida.once('error', fallar);
    }
  });
}

export function recibirInstantaneaLocal(req: SolicitudConInstantaneaLocal, res: Response, next: NextFunction) {
  void (async () => {
    let temporal: string | undefined;
    try {
      if (!req.is('application/vnd.evaluapro.snapshot')) throw new ErrorAplicacion('SYNC_TIPO_CONTENIDO_INVALIDO', 'El tipo de contenido de la instantánea no es válido', 415);
      const lector = new LectorSolicitud(req);
      const longitudBytes = await lector.exacto(4);
      const longitudCabecera = longitudBytes.readUInt32BE(0);
      if (longitudCabecera < 2 || longitudCabecera > 4096) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La cabecera de importación es inválida', 400);
      let cabecera: { metodo?: unknown; credencial?: unknown; dryRun?: unknown };
      try { cabecera = JSON.parse((await lector.exacto(longitudCabecera)).toString('utf8')) as typeof cabecera; }
      catch { throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La cabecera de importación no es válida', 400); }
      const metodo = String(cabecera.metodo || '').trim() as MetodoDesbloqueoInstantanea;
      if (metodo !== 'contrasena' && metodo !== 'google') throw new ErrorAplicacion('SYNC_METODO_INVALIDO', 'Método de desbloqueo inválido', 400);
      if (typeof cabecera.dryRun !== 'boolean') throw new ErrorAplicacion('SYNC_SOLICITUD_INVALIDA', 'Falta indicar si la importación es de validación', 400);
      const credencial = typeof cabecera.credencial === 'string' ? cabecera.credencial : undefined;
      if (credencial && credencial.length > 8192) throw new ErrorAplicacion('SYNC_CREDENCIAL_INVALIDA', 'La credencial es demasiado larga', 400);
      temporal = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-local-snapshot-upload-'));
      const rutaArchivo = path.join(temporal, 'importacion.ep-snapshot');
      const salida = createWriteStream(rutaArchivo, { flags: 'wx' });
      let total = 0;
      try {
        for await (const chunk of lector.resto()) {
          total += chunk.length;
          if (total > MAX_CONTENIDO_LOCAL_STREAM_BYTES + 2 * 1024 * 1024) throw new ErrorAplicacion('SYNC_INSTANTANEA_GRANDE', 'La instantánea supera el límite de 2 GiB', 413);
          await escribir(salida, chunk);
        }
        const finalizado = once(salida, 'finish');
        salida.end();
        await finalizado;
      } catch (error) {
        salida.destroy();
        throw error;
      }
      if (total === 0) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'El archivo de instantánea está vacío', 400);
      req.instantaneaLocal = { rutaArchivo, temporal, solicitud: { metodo, credencial, dryRun: cabecera.dryRun === true } };
      const limpiar = () => { if (temporal) void fs.rm(temporal, { recursive: true, force: true }).catch(() => undefined); };
      res.once('finish', limpiar);
      res.once('close', limpiar);
      next();
    } catch (error) {
      if (temporal) await fs.rm(temporal, { recursive: true, force: true }).catch(() => undefined);
      next(error);
    }
  })();
}
