/**
 * Limpieza de prefijos editoriales que llegan al banco desde texto pegado.
 * No modifica el contenido de la pregunta ni sus opciones.
 */

const ETIQUETAS_TEMA = [
  'CORS',
  'HTTP',
  'JSON',
  'Express',
  'API REST',
  'MongoDB',
  'Mongoose',
  'CRUD',
  'Node.js',
  'Manejo de errores'
];

const ETIQUETAS_TEMA_RE = ETIQUETAS_TEMA
  .sort((a, b) => b.length - a.length)
  .map((etiqueta) => etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

function textoPlanoInicial(valor: string): string {
  return valor
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function esEtiquetaTema(valor: string): boolean {
  const texto = textoPlanoInicial(valor)
    .replace(/^\d+\s*[.)-]\s*/, '')
    .replace(/[.:)]\s*$/, '')
    .trim();
  return new RegExp(`^(?:${ETIQUETAS_TEMA_RE})(?:\\s*,\\s*(?:${ETIQUETAS_TEMA_RE}|etc?\\.?))*$`, 'i').test(texto)
    || /^CORS\s*,\s*JSON\s*,\s*etc\.?$/i.test(texto);
}

function quitarNumeroInicial(valor: string): string {
  return valor.replace(/^\s*\d+\s*[.)-]\s+(?=\S)/, '');
}

/**
 * Quita etiquetas como "17. HTTP" o "CORS, JSON, etc." al inicio.
 * También quita un número aislado al inicio ("17. ¿...").
 * Solo se considera una etiqueta cuando ocupa su propia línea o bloque,
 * para no alterar números legítimos dentro del enunciado.
 */
export function normalizarEnunciadoBanco(valor: unknown): string {
  let texto = String(valor ?? '').trim();

  const bloqueInicial = /^\s*<(p|div|li)\b[^>]*>([\s\S]*?)<\/\1>\s*/i.exec(texto);
  if (bloqueInicial && esEtiquetaTema(bloqueInicial[2] ?? '')) {
    texto = texto.slice(bloqueInicial[0].length).trim();
  }

  const primeraLinea = /^(\s*[^\r\n<]*(?:\r?\n|<br\s*\/?>))/i.exec(texto);
  if (primeraLinea) {
    const contenido = primeraLinea[1] ?? '';
    const separador = contenido.match(/(?:\r?\n|<br\s*\/?>)\s*$/i)?.[0] ?? '';
    const linea = contenido.slice(0, contenido.length - separador.length);
    if (esEtiquetaTema(linea)) {
      texto = texto.slice(primeraLinea[0].length).trim();
    } else {
      const sinNumero = quitarNumeroInicial(linea);
      if (sinNumero !== linea) texto = `${sinNumero}${texto.slice(primeraLinea[0].length)}`.trim();
    }
  } else {
    texto = quitarNumeroInicial(texto).trim();
  }

  return texto;
}
