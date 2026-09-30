import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(__dirname, '..', 'src', 'infraestructura', 'baseDatos', 'generado', 'cliente');
const destination = path.resolve(__dirname, '..', 'dist', 'infraestructura', 'baseDatos', 'generado', 'cliente');
const nativeEngines = (await readdir(source)).filter((name) =>
  /^(?:libquery_engine-.*\.so\.node|query_engine-.*\.dll\.node)$/.test(name),
);

await mkdir(destination, { recursive: true });
for (const engine of nativeEngines) {
  await cp(path.join(source, engine), path.join(destination, engine), { force: true });
}
console.log(`${nativeEngines.length} motores nativos de Prisma copiados a ${destination}`);
