// Pruebas de infraestructura local.
import { promises as fs } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { guardarPdfExamen } from '../src/infraestructura/archivos/almacenLocal';
import { enviarCorreo } from '../src/infraestructura/correo/servicioCorreo';

describe('almacenLocal', () => {
  it('guarda PDFs y devuelve la ruta', async () => {
    const buffer = Buffer.from('%PDF-1.4 prueba');
    const nombreArchivo = `test-${Date.now()}.pdf`;
    const ruta = await guardarPdfExamen(nombreArchivo, buffer);

    try {
      const contenido = await fs.readFile(ruta);
      expect(contenido.toString()).toBe(buffer.toString());
      expect(path.basename(ruta)).toBe(nombreArchivo);
    } finally {
      await fs.unlink(ruta);
    }
  });
});

describe('servicioCorreo', () => {
  it('informa cuando el servicio no esta configurado', async () => {
    await expect(enviarCorreo('destino@test', 'Asunto', 'Contenido')).rejects.toThrow(
      'Servicio de correo no configurado'
    );
  });
});
