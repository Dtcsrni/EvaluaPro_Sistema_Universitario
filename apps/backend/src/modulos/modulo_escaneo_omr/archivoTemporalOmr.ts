import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';

const rutasGeneradasPorCarga = new WeakMap<object, string>();

/** Registra una ruta construida por el StorageEngine con directorio y UUID aleatorios. */
export function registrarRutaTemporalOmr(archivo: object, rutaGenerada: string): void {
  rutasGeneradasPorCarga.set(archivo, rutaGenerada);
}

/** Resuelve solo rutas generadas durante esta petición; ignora propiedades del multipart. */
export function obtenerRutaTemporalOmr(archivo: object): string {
  const ruta = rutasGeneradasPorCarga.get(archivo);
  if (!ruta) throw new ErrorAplicacion('OMR_CARGA_TEMPORAL_INVALIDA', 'El archivo temporal OMR no pertenece a esta carga', 400);
  return ruta;
}

/** Retira y devuelve una ruta generada para que su directorio temporal pueda eliminarse. */
export function retirarRutaTemporalOmr(archivo: object): string | null {
  const ruta = rutasGeneradasPorCarga.get(archivo) ?? null;
  rutasGeneradasPorCarga.delete(archivo);
  return ruta;
}
