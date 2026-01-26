import { useEffect, useMemo, useRef, useState } from 'react';

type TooltipState = {
  visible: boolean;
  text: string;
  x: number;
  y: number;
  placement: 'top' | 'bottom';
};

const SKIP_TYPES = new Set([
  'checkbox',
  'radio',
  'file',
  'date',
  'datetime-local',
  'time',
  'number',
  'range',
  'color'
]);

function limpiarTexto(valor: string) {
  return valor.replace(/\s+/g, ' ').trim().replace(/[:：]$/, '').trim();
}

function buscarTextoLabel(target: HTMLElement) {
  if (target.id) {
    const label = document.querySelector(`label[for="${target.id}"]`);
    if (label) return limpiarTexto(label.textContent || '');
  }
  const labelPadre = target.closest('label');
  if (!labelPadre) return '';
  const copia = labelPadre.cloneNode(true) as HTMLElement;
  copia.querySelectorAll('input,textarea,select,button,svg').forEach((n) => n.remove());
  return limpiarTexto(copia.textContent || '');
}

function tooltipDesdeElemento(target: HTMLElement) {
  const data = target.getAttribute('data-tooltip');
  if (data) return limpiarTexto(data);
  const aria = target.getAttribute('aria-label');
  if (aria) return limpiarTexto(aria);
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    if (target.placeholder) return limpiarTexto(target.placeholder);
    const tipo = target.getAttribute('type') || '';
    if (SKIP_TYPES.has(tipo)) return '';
    return buscarTextoLabel(target);
  }
  if (target instanceof HTMLSelectElement) {
    return buscarTextoLabel(target);
  }
  if (target instanceof HTMLButtonElement) {
    const texto = limpiarTexto(target.textContent || '');
    return texto;
  }
  return '';
}

function aplicarPlaceholders(root: ParentNode) {
  root.querySelectorAll('input, textarea').forEach((node) => {
    if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) return;
    if (node.placeholder) return;
    const tipo = node.getAttribute('type') || '';
    if (node instanceof HTMLInputElement && SKIP_TYPES.has(tipo)) return;
    const texto = buscarTextoLabel(node);
    if (!texto) return;
    node.placeholder = texto;
  });
}

export function TooltipLayer() {
  const [state, setState] = useState<TooltipState>({
    visible: false,
    text: '',
    x: 0,
    y: 0,
    placement: 'top'
  });
  const targetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    aplicarPlaceholders(document);
    const observer = new MutationObserver((entries) => {
      for (const entry of entries) {
        entry.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) aplicarPlaceholders(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const mostrar = (target: HTMLElement) => {
      const texto = tooltipDesdeElemento(target);
      if (!texto) {
        setState((prev) => ({ ...prev, visible: false }));
        targetRef.current = null;
        return;
      }
      targetRef.current = target;
      setState((prev) => ({ ...prev, visible: true, text: texto }));
      actualizarPosicion();
    };

    const ocultar = () => {
      targetRef.current = null;
      setState((prev) => ({ ...prev, visible: false }));
    };

    const onOver = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const candidato = target.closest('[data-tooltip],button,input,select,textarea');
      if (candidato instanceof HTMLElement) mostrar(candidato);
    };

    const onOut = (event: Event) => {
      const related = (event as MouseEvent).relatedTarget as HTMLElement | null;
      if (related && targetRef.current && targetRef.current.contains(related)) return;
      ocultar();
    };

    const onFocus = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const candidato = target.closest('[data-tooltip],button,input,select,textarea');
      if (candidato instanceof HTMLElement) mostrar(candidato);
    };

    const onBlur = () => ocultar();

    const actualizarPosicion = () => {
      const target = targetRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const ancho = Math.max(180, Math.min(320, rect.width + 40));
      let x = rect.left + rect.width / 2;
      let y = rect.top;
      let placement: TooltipState['placement'] = 'top';
      if (rect.top < 70) {
        placement = 'bottom';
        y = rect.bottom;
      }
      setState((prev) => ({ ...prev, x, y, placement, text: prev.text }));
      const root = document.documentElement;
      root.style.setProperty('--tooltip-x', `${x}px`);
      root.style.setProperty('--tooltip-y', `${y}px`);
      root.style.setProperty('--tooltip-w', `${ancho}px`);
    };

    const onScroll = () => {
      if (!targetRef.current) return;
      actualizarPosicion();
    };

    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);

    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  if (!state.visible) return null;

  return (
    <div className={`tooltip-layer tooltip-${state.placement}`} role="tooltip" aria-hidden={!state.visible}>
      <div className="tooltip-bubble">{state.text}</div>
      <div className="tooltip-arrow" />
    </div>
  );
}
