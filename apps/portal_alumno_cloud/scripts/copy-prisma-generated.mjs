import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(__dirname, '..', 'src', 'infraestructura', 'baseDatos', 'generado', 'cliente');
const destination = path.resolve(__dirname, '..', 'dist', 'infraestructura', 'baseDatos', 'generado', 'cliente');
const nativeEngines = [
  'libquery_engine-debian-openssl-3.0.x.so.node',
  'query_engine-windows.dll.node'
];

await mkdir(destination, { recursive: true });
for (const engine of nativeEngines) {
  await cp(path.join(source, engine), path.join(destination, engine), { force: true });
}
console.log(`Motores nativos de Prisma copiados a ${destination}`);
