import { describe, expect, it } from 'vitest';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { crearCargadorArchivosPdfOmr } from '../src/modulos/modulo_escaneo_omr/rutasEscaneoOmr.js';
import { obtenerRutaTemporalOmr, registrarRutaTemporalOmr, retirarRutaTemporalOmr } from '../src/modulos/modulo_escaneo_omr/archivoTemporalOmr.js';

describe('rutas temporales OMR', () => {
  it('ignora una ruta puesta en la propiedad path de un objeto no registrado', () => {
    const archivo = { path: '..\\..\\datos\\privados.db' };
    expect(() => obtenerRutaTemporalOmr(archivo)).toThrowError(/no pertenece a esta carga/);
    expect(retirarRutaTemporalOmr(archivo)).toBeNull();
  });

  it('solo permite leer y limpiar la ruta registrada por el StorageEngine', () => {
    const archivo = { path: 'C:\\ruta\\proporcionada-por-cliente.pdf' };
    const rutaGenerada = 'C:\\Temp\\evaluapro-omr-upload-a1b2\\12345678-1234-4234-8234-123456789abc.pdf';
    registrarRutaTemporalOmr(archivo, rutaGenerada);
    expect(obtenerRutaTemporalOmr(archivo)).toBe(rutaGenerada);
    expect(retirarRutaTemporalOmr(archivo)).toBe(rutaGenerada);
    expect(() => obtenerRutaTemporalOmr(archivo)).toThrowError(/no pertenece a esta carga/);
  });

  it('conserva la ruta autorizada cuando Multer copia los metadatos al objeto de req.files', () => {
    const archivo = { path: 'C:\\ruta\\proporcionada-por-cliente.pdf' };
    const rutaGenerada = 'C:\\Temp\\evaluapro-omr-upload-a1b2\\12345678-1234-4234-8234-123456789abc.pdf';
    registrarRutaTemporalOmr(archivo, rutaGenerada);

    // Multer's field strategy copies metadata onto its placeholder with Object.assign.
    const archivoEnRequest = Object.assign({}, archivo);
    expect(obtenerRutaTemporalOmr(archivoEnRequest)).toBe(rutaGenerada);
    expect(retirarRutaTemporalOmr(archivoEnRequest)).toBe(rutaGenerada);
    expect(() => obtenerRutaTemporalOmr(archivoEnRequest)).toThrowError(/no pertenece a esta carga/);
  });

  it('limpia con Multer el primer archivo al abortar una carga que excede el total', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-omr-test-'));
    try {
      const app = express();
      app.post('/carga', crearCargadorArchivosPdfOmr(4, tempRoot), (_req, res) => res.sendStatus(204));
      app.use((_error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
        void next;
        res.sendStatus(400);
      });

      await request(app)
        .post('/carga')
        .attach('archivos', Buffer.from('123'), { filename: 'primero.pdf', contentType: 'application/pdf' })
        .attach('archivos', Buffer.from('456'), { filename: 'segundo.pdf', contentType: 'application/pdf' })
        .expect(400);

      expect(await fs.readdir(tempRoot)).toEqual([]);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
