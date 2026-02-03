/**
 * Almacenamiento local para PDFs e imagenes (uso docente local).
 *
 * Contrato:
 * - Persiste archivos dentro de `process.cwd()/data/examenes`.
 * - Crea la carpeta en caso de no existir (mkdir -p).
 * - Devuelve la ruta completa para que el documento la referencie.
 *
 * Nota operativa:
 * - En despliegue Docker, normalmente se monta `data/` como volumen para persistencia.
 */
import { promises as fs } from 'fs';
import path from 'path';

const carpetaBase = path.join(process.cwd(), 'data', 'examenes');

async function asegurarCarpeta() {
  await fs.mkdir(carpetaBase, { recursive: true });
}

/**
 * Guarda un PDF y devuelve su ruta absoluta en disco.
 */
export async function guardarPdfExamen(nombreArchivo: string, buffer: Buffer) {
  await asegurarCarpeta();
  const rutaCompleta = path.join(carpetaBase, nombreArchivo);
  await fs.writeFile(rutaCompleta, buffer);
  return rutaCompleta;
}

/**
 * Resuelve la ruta absoluta de un PDF guardado (sin validar existencia).
 */
export function resolverRutaPdfExamen(nombreArchivo: string) {
  return path.join(carpetaBase, nombreArchivo);
}
