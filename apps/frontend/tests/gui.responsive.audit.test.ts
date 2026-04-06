import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(process.cwd(), 'src', 'apps');
const TARGET_DIRS = ['app_docente', 'app_alumno'];

async function listTsxFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listTsxFiles(full);
      if (entry.isFile() && full.endsWith('.tsx')) return [full];
      return [] as string[];
    })
  );
  return files.flat();
}

describe('GUI responsive audit', () => {
  it('evita estilos inline en pantallas Docente/Alumno', async () => {
    const rutas = (
      await Promise.all(TARGET_DIRS.map((d) => listTsxFiles(path.join(ROOT, d))))
    ).flat();

    const conInline: string[] = [];

    for (const ruta of rutas) {
      const contenido = await fs.readFile(ruta, 'utf8');
      if (/style=\{\{/.test(contenido)) {
        conInline.push(path.relative(path.resolve(process.cwd(), 'src'), ruta).replace(/\\/g, '/'));
      }
    }

    expect(conInline, `Archivos con inline style detectado:\n${conInline.join('\n')}`).toEqual([]);
  });
});
