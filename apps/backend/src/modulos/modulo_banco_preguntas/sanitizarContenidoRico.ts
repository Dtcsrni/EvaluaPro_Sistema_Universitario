const ETIQUETAS_FORMATO = new Set(['strong', 'b', 'em', 'i', 'u', 'sub', 'sup']);

function buscarFinEtiqueta(valor: string, inicio: number): number {
  let comilla: '"' | "'" | null = null;
  for (let indice = inicio; indice < valor.length; indice += 1) {
    const caracter = valor[indice];
    if (comilla) {
      if (caracter === comilla) comilla = null;
    } else if (caracter === '"' || caracter === "'") {
      comilla = caracter;
    } else if (caracter === '>') {
      return indice;
    }
  }
  return -1;
}

function decodificarEntidadesBasicas(valor: string): string {
  return valor.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, (entidad) => {
    const nombre = entidad.toLowerCase();
    if (nombre === '&amp;') return '&';
    if (nombre === '&lt;') return '<';
    if (nombre === '&gt;') return '>';
    if (nombre === '&quot;') return '"';
    if (nombre === '&apos;' || nombre === '&#39;') return "'";
    if (nombre === '&nbsp;') return ' ';
    const numerico = nombre.startsWith('&#x')
      ? Number.parseInt(nombre.slice(3, -1), 16)
      : Number.parseInt(nombre.slice(2, -1), 10);
    if (!Number.isSafeInteger(numerico) || numerico <= 0 || numerico > 0x10ffff || (numerico >= 0xd800 && numerico <= 0xdfff)) return '\uFFFD';
    return String.fromCodePoint(numerico);
  });
}

function escaparAtributoHtml(valor: string): string {
  return valor.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function spanLatexSeguro(etiqueta: string): string | null {
  const apertura = /^<\s*span\b([\s\S]*?)\s*\/?>$/i.exec(etiqueta);
  if (!apertura) return null;
  const atributos = apertura[1] ?? '';
  let indice = 0;
  let valorLatex: string | null = null;
  while (indice < atributos.length) {
    while (/\s/.test(atributos[indice] ?? '')) indice += 1;
    if (indice >= atributos.length || atributos[indice] === '/') break;
    const inicioNombre = indice;
    while (indice < atributos.length && !/[\s=/>]/.test(atributos[indice] ?? '')) indice += 1;
    if (indice === inicioNombre) {
      indice += 1;
      continue;
    }
    const nombre = atributos.slice(inicioNombre, indice).toLowerCase();
    while (/\s/.test(atributos[indice] ?? '')) indice += 1;
    let valor: string | null = null;
    if (atributos[indice] === '=') {
      indice += 1;
      while (/\s/.test(atributos[indice] ?? '')) indice += 1;
      const comilla = atributos[indice];
      if (comilla === '"' || comilla === "'") {
        indice += 1;
        const inicioValor = indice;
        while (indice < atributos.length && atributos[indice] !== comilla) indice += 1;
        if (indice < atributos.length) {
          valor = atributos.slice(inicioValor, indice);
          indice += 1;
        }
      } else {
        while (indice < atributos.length && !/[\s>]/.test(atributos[indice] ?? '')) indice += 1;
      }
    }
    if (nombre === 'data-latex') {
      if (valorLatex !== null || valor === null) return null;
      valorLatex = valor;
    }
  }
  return valorLatex === null ? null : `<span data-latex="${escaparAtributoHtml(decodificarEntidadesBasicas(valorLatex))}">`;
}

function encontrarCierreRawText(valor: string, etiqueta: 'script' | 'style', inicio: number): number {
  const minusc = valor.toLowerCase();
  let cursor = inicio;
  while ((cursor = minusc.indexOf(`</${etiqueta}`, cursor)) >= 0) {
    const fin = buscarFinEtiqueta(valor, cursor + 2 + etiqueta.length);
    if (fin >= 0 && /^<\/\s*(?:script|style)\s*>$/i.test(valor.slice(cursor, fin + 1))) return fin + 1;
    cursor += etiqueta.length + 2;
  }
  return valor.length;
}

/** Conserva el formato docente admitido y elimina etiquetas/atributos ejecutables. */
export function sanitizarContenidoRico(valor: unknown): string {
  const fuente = String(valor ?? '');
  let salida = '';
  let cursor = 0;

  while (cursor < fuente.length) {
    const inicio = fuente.indexOf('<', cursor);
    if (inicio < 0) {
      salida += fuente.slice(cursor);
      break;
    }
    salida += fuente.slice(cursor, inicio);

    if (fuente.startsWith('<!--', inicio)) {
      const cierreComentario = fuente.indexOf('-->', inicio + 4);
      cursor = cierreComentario < 0 ? fuente.length : cierreComentario + 3;
      continue;
    }

    const fin = buscarFinEtiqueta(fuente, inicio + 1);
    if (fin < 0) {
      salida += '&lt;';
      cursor = inicio + 1;
      continue;
    }

    const etiqueta = fuente.slice(inicio, fin + 1);
    const nombre = /^<\s*([a-z][a-z0-9:-]*)\b/i.exec(etiqueta)?.[1]?.toLowerCase();
    if (!nombre) {
      cursor = fin + 1;
      continue;
    }

    const esCierre = /^<\s*\//.test(etiqueta);
    if (!esCierre && (nombre === 'script' || nombre === 'style')) {
      cursor = encontrarCierreRawText(fuente, nombre, fin + 1);
      continue;
    }

    if (nombre === 'br' && !esCierre) salida += '<br>';
    else if (ETIQUETAS_FORMATO.has(nombre)) salida += esCierre ? `</${nombre}>` : `<${nombre}>`;
    else if (nombre === 'span') {
      if (esCierre) salida += '</span>';
      else salida += spanLatexSeguro(etiqueta) ?? '';
    }
    cursor = fin + 1;
  }

  return salida;
}
