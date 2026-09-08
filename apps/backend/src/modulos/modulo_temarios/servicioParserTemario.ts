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

function esDigito(caracter: string | undefined): boolean {
  return caracter !== undefined && caracter >= '0' && caracter <= '9';
}

function esEspacio(caracter: string | undefined): boolean {
  return caracter !== undefined && caracter.trim() === '';
}

function extraerTema(linea: string): { numero: string; titulo: string } | null {
  let indice = 0;
  const inicioNumero = indice;

  while (esDigito(linea[indice])) indice += 1;
  if (indice === inicioNumero) return null;

  while (linea[indice] === '.') {
    indice += 1;
    const inicioSegmento = indice;
    while (esDigito(linea[indice])) indice += 1;
    if (indice === inicioSegmento) return null;
  }

  if (!esEspacio(linea[indice])) return null;
  while (esEspacio(linea[indice])) indice += 1;

  const titulo = linea.slice(indice).trim();
  if (!titulo) return null;

  return { numero: linea.slice(inicioNumero, indice).trim(), titulo };
}

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
    const tema = extraerTema(linea);
    if (!tema) continue;

    const { numero, titulo } = tema;
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
  const pdfParseMod = require('pdf-parse') as {
    PDFParse?: new (options: { data: Buffer }) => {
      getText: () => Promise<{ text?: string }>;
      destroy: () => Promise<void>;
    };
    default?: (buf: Buffer) => Promise<{ text?: string }>;
  } | ((buf: Buffer) => Promise<{ text?: string }>);

  if (typeof pdfParseMod === 'function') {
    const data = await pdfParseMod(buffer);
    return data.text ?? '';
  }

  if (typeof pdfParseMod.default === 'function') {
    const data = await pdfParseMod.default(buffer);
    return data.text ?? '';
  }

  if (typeof pdfParseMod.PDFParse === 'function') {
    const parser = new pdfParseMod.PDFParse({ data: buffer });
    try {
      const data = await parser.getText();
      return data.text ?? '';
    } finally {
      await parser.destroy();
    }
  }

  throw new Error('pdf-parse no disponible');
}
