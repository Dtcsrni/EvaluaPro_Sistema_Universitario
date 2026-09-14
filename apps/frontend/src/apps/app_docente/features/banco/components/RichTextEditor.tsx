import { useEffect, useRef, useState } from 'react';

const TAGS_PERMITIDAS = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'SUB', 'SUP', 'BR', 'SPAN']);
const COMANDOS_LATEX_VISIBLES: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', theta: 'θ', lambda: 'λ', mu: 'μ',
  pi: 'π', sigma: 'σ', phi: 'φ', omega: 'ω', pm: '±', times: '×', cdot: '·',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', approx: '≈', infty: '∞',
  to: '→', rightarrow: '→', leftarrow: '←'
};

function escaparHtml(valor: string): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function textoVisibleLatex(valor: string): string {
  let formula = String(valor ?? '')
    .trim()
    .replace(/^\\\(|\\\)$/g, '')
    .replace(/^\\\[|\\\]$/g, '')
    .replace(/^\$|\$$/g, '')
    .trim();
  formula = escaparHtml(formula)
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)')
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/\\(?:mathrm|mathit|mathbf)\{([^{}]*)\}/g, '$1')
    .replace(/\\([A-Za-z]+)/g, (_coincidencia, comando: string) => COMANDOS_LATEX_VISIBLES[comando] ?? comando)
    .replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>')
    .replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>')
    .replace(/\^([A-Za-z0-9])/g, '<sup>$1</sup>')
    .replace(/_([A-Za-z0-9])/g, '<sub>$1</sub>')
    .replace(/[{}]/g, '')
    .replace(/\s{2,}/g, ' ');
  return formula || 'fórmula vacía';
}

export function textoPlanoRico(valor: string): string {
  if (!valor) return '';
  if (typeof DOMParser === 'undefined') return valor.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const doc = new DOMParser().parseFromString(valor, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function sanearHtml(valor: string): string {
  if (typeof DOMParser === 'undefined') return valor.replace(/<[^>]*>/g, '');
  const doc = new DOMParser().parseFromString(valor, 'text/html');
  const recorrer = (nodo: Node) => {
    for (const hijo of Array.from(nodo.childNodes)) {
      if (hijo.nodeType === Node.ELEMENT_NODE) {
        const elemento = hijo as HTMLElement;
        if (!TAGS_PERMITIDAS.has(elemento.tagName)) {
          hijo.replaceWith(...Array.from(hijo.childNodes));
          continue;
        }
        for (const atributo of Array.from(elemento.attributes)) {
          if (elemento.tagName !== 'SPAN' || atributo.name !== 'data-latex') elemento.removeAttribute(atributo.name);
        }
      }
      recorrer(hijo);
    }
  };
  recorrer(doc.body);
  return doc.body.innerHTML.trim();
}

function normalizarPrevisualizacionLatex(valor: string): string {
  if (typeof DOMParser === 'undefined') return valor;
  const doc = new DOMParser().parseFromString(valor, 'text/html');
  for (const formula of Array.from(doc.querySelectorAll('span[data-latex]'))) {
    formula.innerHTML = textoVisibleLatex(formula.getAttribute('data-latex') ?? formula.textContent ?? '');
  }
  return doc.body.innerHTML.trim();
}

function ejecutarFormato(comando: string) {
  document.execCommand(comando, false);
}

function insertarHtmlSeguro(html: string) {
  const seleccion = window.getSelection();
  if (!seleccion || seleccion.rangeCount === 0) return;
  const rango = seleccion.getRangeAt(0);
  rango.deleteContents();
  const contenedor = document.createElement('span');
  contenedor.innerHTML = sanearHtml(html);
  const fragmento = document.createDocumentFragment();
  while (contenedor.firstChild) fragmento.appendChild(contenedor.firstChild);
  rango.insertNode(fragmento);
  seleccion.removeAllRanges();
  const siguiente = document.createRange();
  siguiente.selectNodeContents(rango.commonAncestorContainer.nodeType === Node.TEXT_NODE ? rango.commonAncestorContainer.parentNode! : rango.commonAncestorContainer);
  siguiente.collapse(false);
  seleccion.addRange(siguiente);
}

export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  ariaLabel,
  minHeight = 88
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  ariaLabel: string;
  minHeight?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [mostrarLatex, setMostrarLatex] = useState(false);
  const [latex, setLatex] = useState('');

  useEffect(() => {
    const editor = editorRef.current;
    const contenido = normalizarPrevisualizacionLatex(sanearHtml(value || ''));
    if (editor && editor.innerHTML !== contenido) editor.innerHTML = contenido;
  }, [value]);

  const emitir = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const limpio = sanearHtml(editor.innerHTML);
    if (editor.innerHTML !== limpio) editor.innerHTML = limpio;
    onChange(limpio);
  };

  return (
    <div className="rich-editor" data-disabled={disabled ? 'true' : 'false'}>
      <textarea
        className="rich-editor__compat-input"
        value={textoPlanoRico(value)}
        placeholder={placeholder}
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="rich-editor__toolbar" role="toolbar" aria-label="Formato de texto">
        <button type="button" title="Negrita" aria-label="Negrita" onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutarFormato('bold')} disabled={disabled}><strong>B</strong></button>
        <button type="button" title="Cursiva" aria-label="Cursiva" onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutarFormato('italic')} disabled={disabled}><em>I</em></button>
        <button type="button" title="Subrayado" aria-label="Subrayado" onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutarFormato('underline')} disabled={disabled}><u>U</u></button>
        <span className="rich-editor__separator" aria-hidden="true" />
        <button type="button" title="Subíndice" aria-label="Subíndice" onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutarFormato('subscript')} disabled={disabled}>x<sub>2</sub></button>
        <button type="button" title="Superíndice" aria-label="Superíndice" onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutarFormato('superscript')} disabled={disabled}>x<sup>2</sup></button>
        <button type="button" className="rich-editor__latex-button" title="Insertar fórmula LaTeX" onClick={() => setMostrarLatex((actual) => !actual)} disabled={disabled}>∑ LaTeX</button>
      </div>
      {mostrarLatex && (
        <div className="rich-editor__latex" role="group" aria-label="Insertar fórmula LaTeX">
          <input value={latex} onChange={(e) => setLatex(e.target.value)} placeholder="Ej. \\(x^2 + y^2 = z^2\\)" aria-label="Fórmula LaTeX" disabled={disabled} />
          <button type="button" onClick={() => { if (latex.trim()) insertarHtmlSeguro(`<span data-latex="${latex.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">${textoVisibleLatex(latex)}</span>`); setLatex(''); setMostrarLatex(false); emitir(); }} disabled={disabled || !latex.trim()}>Insertar</button>
        </div>
      )}
      <div
        id={id}
        ref={editorRef}
        className={`rich-editor__surface ${minHeight < 80 ? 'rich-editor__surface--compact' : 'rich-editor__surface--question'}`}
        contentEditable={!disabled}
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={emitir}
        onBlur={emitir}
        onPaste={(event) => {
          event.preventDefault();
          const texto = event.clipboardData.getData('text/plain');
          insertarHtmlSeguro(texto.replace(/[&<>]/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[caracter] ?? caracter)));
          emitir();
        }}
      />
      <div className="rich-editor__hint">B, I, U · subíndice/superíndice · fórmula LaTeX</div>
    </div>
  );
}
