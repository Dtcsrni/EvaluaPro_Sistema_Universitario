import { describe, expect, it } from 'vitest';
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
});
