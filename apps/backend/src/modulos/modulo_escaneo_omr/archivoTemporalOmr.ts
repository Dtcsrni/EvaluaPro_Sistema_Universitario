import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';

// Multer's OBJECT strategy copies file metadata into its `req.files` placeholder
// with Object.assign. An enumerable private symbol survives that trusted copy
// but cannot be supplied through multipart field names or ordinary file fields.
const RUTA_TEMPORAL_OMR = Symbol('rutaTemporalOmr');
type ArchivoConRutaTemporal = object & { [RUTA_TEMPORAL_OMR]?: string };

/** Registra una ruta construida por el StorageEngine con directorio y UUID aleatorios. */
export function registrarRutaTemporalOmr(archivo: object, rutaGenerada: string): void {
  Object.defineProperty(archivo, RUTA_TEMPORAL_OMR, {
    value: rutaGenerada,
    enumerable: true,
    configurable: true
  });
}

/** Resuelve solo rutas generadas durante esta petición; ignora propiedades del multipart. */
export function obtenerRutaTemporalOmr(archivo: object): string {
  const ruta = (archivo as ArchivoConRutaTemporal)[RUTA_TEMPORAL_OMR];
  if (!ruta) throw new ErrorAplicacion('OMR_CARGA_TEMPORAL_INVALIDA', 'El archivo temporal OMR no pertenece a esta carga', 400);
  return ruta;
}

/** Retira y devuelve una ruta generada para que su directorio temporal pueda eliminarse. */
export function retirarRutaTemporalOmr(archivo: object): string | null {
  const archivoTemporal = archivo as ArchivoConRutaTemporal;
  const ruta = archivoTemporal[RUTA_TEMPORAL_OMR] ?? null;
  delete archivoTemporal[RUTA_TEMPORAL_OMR];
  return ruta;
}
