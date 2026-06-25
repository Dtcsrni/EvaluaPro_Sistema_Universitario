/**
 * Parser de texto de temario a árbol jerárquico de nodos.
 *
 * Soporta formatos numerados estilo:
 *   1   Introducción
 *   1.1 Conceptos básicos
 *   1.1.1 Definición
 *
 * Estrategia: regex de detección de número jerárquico al inicio de línea.
 */

export type NodoTemarioParseado = {
  numero: string;
  nivel: number;
  titulo: string;
};

const PATRON_TEMA = /^(\d+(?:\.\d+)*)\s+(.+)$/;

/**
 * Parsea texto plano de un temario y retorna la lista de nodos ordenados.
 * Ignora líneas vacías y líneas que no comienzan con un número jerárquico.
 */
export function parsearTextoTemario(texto: string): NodoTemarioParseado[] {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const nodos: NodoTemarioParseado[] = [];

  for (const linea of lineas) {
    const match = PATRON_TEMA.exec(linea);
    if (!match) continue;

    const numero = match[1]!.trim();
    const titulo = match[2]!.trim();
    const nivel = numero.split('.').length;

    nodos.push({ numero, nivel, titulo });
  }

  // Ordenar por número jerárquico correctamente (1.2 antes que 1.10)
  nodos.sort((a, b) => {
    const partsA = a.numero.split('.').map(Number);
    const partsB = b.numero.split('.').map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const pa = partsA[i] ?? 0;
      const pb = partsB[i] ?? 0;
      if (pa !== pb) return pa - pb;
    }
    return 0;
  });

  return nodos;
}

/**
 * Extrae texto de un buffer PDF usando pdf-parse (lazy import).
 * Retorna texto plano o lanza error si no puede parsear.
 */
export async function extraerTextoPdf(buffer: Buffer): Promise<string> {
  // pdf-parse es CJS; usamos require para evitar problemas de interop ESM/CJS
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParseMod = require('pdf-parse') as { default?: (buf: Buffer) => Promise<{ text: string }> } | ((buf: Buffer) => Promise<{ text: string }>);
  const pdfParse = typeof pdfParseMod === 'function' ? pdfParseMod : pdfParseMod.default;
  if (!pdfParse) throw new Error('pdf-parse no disponible');
  const data = await pdfParse(buffer);
  return data.text ?? '';
}
