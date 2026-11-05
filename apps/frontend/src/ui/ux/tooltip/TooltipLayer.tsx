/**
 * TooltipLayer
 *
 * Responsabilidad: Componente/utilidad de UI reutilizable.
 * Limites: Preservar accesibilidad y contratos de props existentes.
 */
import { useEffect, useId, useRef, useState } from 'react';

type TooltipState = {
  visible: boolean;
  text: string;
  x: number;
  y: number;
  placement: 'top' | 'bottom' | 'cursor';
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

function textoVisible(el: HTMLElement) {
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function obtenerAyudas(target: HTMLElement) {
  const ids = target.getAttribute('aria-describedby');
  if (!ids) return [];
  return ids
    .split(/\s+/)
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => Boolean(el))
    .filter((el) => textoVisible(el))
    .map((el) => limpiarTexto(el.textContent || ''))
    .filter(Boolean);
}

function tooltipDesdeElemento(target: HTMLElement) {
  const data = target.getAttribute('data-tooltip');
  const title = target.getAttribute('title') || target.getAttribute('data-ep-title');
  const aria = target.getAttribute('aria-label');
  const ayudaTextos = obtenerAyudas(target);

  let placeholder = '';
  let label = '';
  let botonTexto = '';

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const tipo = target.getAttribute('type') || '';
    if (SKIP_TYPES.has(tipo)) return '';
    placeholder = limpiarTexto(target.placeholder || '');
    label = buscarTextoLabel(target);
  } else if (target instanceof HTMLSelectElement) {
    label = buscarTextoLabel(target);
  } else if (target instanceof HTMLButtonElement) {
    botonTexto = limpiarTexto(target.textContent || '');
  }

  const candidato =
    limpiarTexto(data || '') ||
    limpiarTexto(title || '') ||
    limpiarTexto(aria || '') ||
    placeholder ||
    label ||
    botonTexto;

  if (!candidato) return '';

  const redundantes = new Set(
    [placeholder, label, botonTexto, ...ayudaTextos].filter(Boolean)
  );
  if (redundantes.has(candidato)) return '';

  return candidato;
}

export function TooltipLayer() {
  const tooltipId = useId();
  const [state, setState] = useState<TooltipState>({
    visible: false,
    text: '',
    x: 0,
    y: 0,
    placement: 'top'
  });
  const targetRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const clamp = (valor: number, min: number, max: number) => Math.min(max, Math.max(min, valor));

    const anchoPorTexto = (texto: string) => {
      const base = Math.max(180, Math.min(320, texto.length * 7 + 40));
      return base;
    };

    const alturaEstimada = (texto: string, width: number) => {
      const caracteresPorLinea = Math.max(1, Math.floor((width - 28) / 7));
      const lineas = Math.ceil(texto.length / caracteresPorLinea);
      return lineas * 18 + 30;
    };

    const anchoPorElemento = (target: HTMLElement, rect: DOMRect) => {
      const base = rect.width + 40;
      const tarjetaAlumno = target.closest('.alumnos-lista__item');
      const disponible = tarjetaAlumno ? Math.max(base, window.innerWidth - 24) : base;
      return Math.max(180, Math.min(320, disponible));
    };

    const posicionPorElemento = (target: HTMLElement, texto: string) => {
      const rect = target.getBoundingClientRect();
      const ancho = anchoPorElemento(target, rect);
      const x = rect.left + rect.width / 2;
      const alto = alturaEstimada(texto, ancho) + 12;
      const cabeArriba = rect.top >= alto;
      const cabeAbajo = window.innerHeight - rect.bottom >= alto;
      let y = rect.top;
      let placement: TooltipState['placement'] = 'top';
      const prefiereAbajo = rect.top > window.innerHeight / 2;
      if ((rect.top < 70 || prefiereAbajo || !cabeArriba) && cabeAbajo) {
        placement = 'bottom';
        y = rect.bottom;
      }
      return { x, y, placement, width: ancho };
    };

    const asegurarEspacioInferior = (target: HTMLElement, texto: string) => {
      if (!target.closest('.alumnos-lista__item')) return;
      const rect = target.getBoundingClientRect();
      const ancho = anchoPorElemento(target, rect);
      const alto = alturaEstimada(texto, ancho) + 12;
      const espacioAbajo = window.innerHeight - rect.bottom;
      if (rect.top > window.innerHeight / 2 && espacioAbajo < alto) {
        window.scrollBy(0, alto - espacioAbajo + 8);
      }
    };

    const posicionPorCursor = (texto: string) => {
      const punto = lastPointerRef.current;
      const baseX = punto ? punto.x : 0;
      const baseY = punto ? punto.y : 0;
      const x = clamp(baseX, 12, window.innerWidth - 12);
      const y = clamp(baseY, 12, window.innerHeight - 12);
      return { x, y, placement: 'cursor' as const, width: anchoPorTexto(texto) };
    };

    const desvincular = (target: HTMLElement) => {
      const ids = (target.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter((id) => id && id !== tooltipId);
      if (ids.length) target.setAttribute('aria-describedby', ids.join(' '));
      else target.removeAttribute('aria-describedby');
      if (target.hasAttribute('data-ep-title')) {
        const tVal = target.getAttribute('data-ep-title') || '';
        target.setAttribute('title', tVal);
        target.removeAttribute('data-ep-title');
      }
    };

    const mostrar = (target: HTMLElement, preferCursor: boolean) => {
      const texto = tooltipDesdeElemento(target);
      if (!texto) {
        if (targetRef.current) desvincular(targetRef.current);
        targetRef.current = null;
        setState((prev) => ({ ...prev, visible: false }));
        return;
      }
      if (targetRef.current && targetRef.current !== target) desvincular(targetRef.current);
      // Suprimir tooltip nativo del navegador para que no se duplique
      if (target.hasAttribute('title')) {
        const tVal = target.getAttribute('title') || '';
        target.setAttribute('data-ep-title', tVal);
        target.removeAttribute('title');
      }
      targetRef.current = target;
      const ids = (target.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      if (!ids.includes(tooltipId)) target.setAttribute('aria-describedby', [...ids, tooltipId].join(' '));
      if (!preferCursor) asegurarEspacioInferior(target, texto);
      const info = preferCursor ? posicionPorCursor(texto) : posicionPorElemento(target, texto);
      setState((prev) => ({
        ...prev,
        visible: true,
        text: texto,
        x: info.x,
        y: info.y,
        placement: info.placement
      }));
      document.documentElement.style.setProperty('--tooltip-w', `${info.width}px`);
    };

    const ocultar = () => {
      if (targetRef.current) desvincular(targetRef.current);
      targetRef.current = null;
      setState((prev) => ({ ...prev, visible: false }));
    };

    const onMove = (event: MouseEvent) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      if (!state.visible || state.placement !== 'cursor') return;
      const info = posicionPorCursor(state.text);
      setState((prev) => ({ ...prev, x: info.x, y: info.y }));
    };

    const onOver = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const candidato = target.closest('[data-tooltip],button,input,select,textarea,a');
      if (event instanceof MouseEvent) {
        lastPointerRef.current = { x: event.clientX, y: event.clientY };
      }
      if (candidato instanceof HTMLElement) mostrar(candidato, true);
    };

    const onOut = (event: Event) => {
      const related = (event as MouseEvent).relatedTarget as HTMLElement | null;
      if (
        related && (
          targetRef.current?.contains(related) ||
          tooltipRef.current?.contains(related)
        )
      ) return;
      ocultar();
    };

    const onFocus = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const candidato = target.closest('[data-tooltip],button,input,select,textarea,a');
      if (candidato instanceof HTMLElement) mostrar(candidato, false);
    };

    const onBlur = () => ocultar();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !targetRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      ocultar();
    };

    const onScroll = () => {
      if (!targetRef.current) return;
      if (state.placement === 'cursor') return;
      const info = posicionPorElemento(targetRef.current, state.text);
      setState((prev) => ({ ...prev, x: info.x, y: info.y, placement: info.placement }));
      document.documentElement.style.setProperty('--tooltip-w', `${info.width}px`);
    };

    const onResize = () => {
      if (targetRef.current && state.placement !== 'cursor') {
        asegurarEspacioInferior(targetRef.current, state.text);
      }
      onScroll();
    };

    const target = targetRef.current;
    const targetObserver = state.visible && target
      ? new MutationObserver(() => {
        if (targetRef.current !== target || !target.isConnected) return;
        const texto = tooltipDesdeElemento(target);
        if (!texto) {
          ocultar();
          return;
        }
        setState((prev) => {
          if (prev.text === texto) return prev;
          const info = prev.placement === 'cursor' ? posicionPorCursor(texto) : posicionPorElemento(target, texto);
          document.documentElement.style.setProperty('--tooltip-w', `${info.width}px`);
          return { ...prev, text: texto, x: info.x, y: info.y, placement: info.placement };
        });
      })
      : null;
    if (targetObserver && target) {
      targetObserver.observe(target, {
        attributes: true,
        attributeFilter: ['aria-label', 'data-tooltip', 'title', 'data-ep-title', 'placeholder'],
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);

    return () => {
      targetObserver?.disconnect();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [state.visible, state.placement, state.text, tooltipId]);

  if (!state.visible) return null;

  return (
    <div
      ref={tooltipRef}
      id={tooltipId}
      className={`tooltip-layer tooltip-${state.placement}`}
      role="tooltip"
      aria-hidden={!state.visible}
      style={{ left: state.x, top: state.y }}
    >
      <div className="tooltip-bubble">{state.text}</div>
      <div className="tooltip-arrow" />
    </div>
  );
}
