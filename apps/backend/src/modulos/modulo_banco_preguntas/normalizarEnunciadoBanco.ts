/**
 * Limpieza de prefijos editoriales que llegan al banco desde texto pegado.
 * No modifica el contenido persistido del banco. La salida de opciones puede
 * compactarse de forma conservadora únicamente al maquetar el PDF.
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

const FORMATO_RICO_RE = /<\s*(?:strong|em|u|sub|sup|span)\b|```|`[^`]+`|\*\*|__|\*[^*]+\*/i;

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

function quitarEtiquetaTemaInicial(valor: string): string {
  // Estas etiquetas son metadatos editoriales que quedaron pegados al
  // enunciado al importar preguntas. Solo se quitan cuando el texto siguiente
  // tiene forma clara de enunciado; así no se altera una pregunta que empieza
  // realmente con el nombre de una tecnología.
  const inicioEnunciado = '(?=(?:¿|Qué\\b|Cuál\\b|Cómo\\b|Si\\b|Una\\b|Un\\b|En\\b|Después\\b|Se\\b|Para\\b|El\\b|La\\b))';
  const etiquetaEnriquecida = new RegExp(
    `^\\s*<([a-z][\\w-]*)(?:\\s[^>]*)?>\\s*(?:${ETIQUETAS_TEMA_RE})\\s*</\\1>\\s*`,
    'i'
  );
  const sinEtiquetaEnriquecida = valor.replace(etiquetaEnriquecida, '');
  return sinEtiquetaEnriquecida.replace(
    new RegExp(`^\\s*(?:${ETIQUETAS_TEMA_RE})\\s*[:.)-]?\\s+${inicioEnunciado}`, 'i'),
    ''
  );
}

/**
 * Quita etiquetas como "17. HTTP", "HTTP Una..." o "CORS, JSON, etc." al inicio.
 * También quita un número aislado al inicio ("17. ¿...").
 * Solo se considera una etiqueta cuando ocupa su propia línea o bloque,
 * para no alterar números legítimos dentro del enunciado.
 */
export function normalizarEnunciadoBanco(valor: unknown): string {
  let texto = String(valor ?? '').trim();

  // El editor puede conservar el número editorial dentro de una etiqueta
  // HTML. Se elimina solo en el inicio para no tocar números del contenido.
  texto = texto.replace(/^\s*<([a-z][\w-]*)(?:\s[^>]*)?>\s*\d+\s*[.)-]?\s*<\/\1>\s*/i, '');

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

  texto = quitarEtiquetaTemaInicial(texto).trim();

  return texto;
}

/**
 * Reduce redundancia editorial de una opción para el PDF sin modificar el
 * banco persistido. En texto plano conserva la proposición inicial y omite la
 * justificación repetitiva posterior a "porque"; el formato rico y el código
 * se dejan intactos para no alterar su sintaxis ni sus segmentos visuales.
 */
export function compactarOpcionBancoParaPdf(valor: unknown): string {
  const texto = String(valor ?? '').trim();
  if (!texto || FORMATO_RICO_RE.test(texto)) return texto;

  return texto
    .replace(/^\s*(?:opci[oó]n|respuesta)\s*[A-E]\s*[:.)-]\s*/i, '')
    // La justificación repetía el mismo patrón en casi todas las opciones y
    // añadía varias líneas a cada reactivo. El segmento previo a "porque"
    // sigue siendo la alternativa evaluable; no se aplica a "porque" al
    // inicio ni a contenido con formato rico.
    .replace(/,\s+porque\s+[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
