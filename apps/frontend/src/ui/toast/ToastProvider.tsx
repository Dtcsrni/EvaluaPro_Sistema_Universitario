/**
 * ToastProvider
 *
 * Responsabilidad: presentar avisos globales sin robar el foco y con anuncios
 * accesibles, duración controlada y recuperación por acciones opcionales.
 */
import React, { createContext, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { onToast, type ToastPayload } from './toastBus';
import { Icono } from '../iconos';

export type ToastLevel = 'info' | 'ok' | 'warn' | 'error';

export type ToastItem = {
  key: string;
  revision: number;
  id?: string;
  level: ToastLevel;
  title: string;
  message: string;
  durationMs: number;
  persistent: boolean;
  paused: boolean;
  actionRunning: boolean;
  eyebrow?: string;
  actionLabel?: string;
  actionOnClick?: () => void | Promise<unknown>;
  secondaryActionLabel?: string;
  secondaryActionOnClick?: () => void | Promise<unknown>;
};

export type ToastApi = {
  push: (payload: ToastPayload) => void;
};

const ELEMENTOS_SIN_BLOQUES_HIJOS = new Set(['A', 'BUTTON', 'FIELDSET', 'FORM', 'LABEL', 'LI', 'OL', 'P', 'SELECT', 'SPAN', 'TABLE', 'TBODY', 'TD', 'TEXTAREA', 'TH', 'TR', 'UL']);

function esVisibleEnViewport(elemento: HTMLElement) {
  const rect = elemento.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
}

function obtenerPuntoAnclaje(regionPrincipal: HTMLElement | null) {
  const region = regionPrincipal?.getBoundingClientRect();
  const top = Math.max(0, region?.top ?? 0);
  const bottom = Math.min(window.innerHeight - 1, region?.bottom ?? window.innerHeight - 1);
  const visible = top <= bottom;
  return {
    x: Math.round(window.innerWidth / 2),
    y: Math.max(visible ? top : 0, Math.min(visible ? bottom : window.innerHeight - 1, Math.round(window.innerHeight * 0.3)))
  };
}

function encontrarElementoAncla(regionPrincipal: HTMLElement | null, x: number, y: number) {
  const candidatos = Array.from(regionPrincipal?.querySelectorAll<HTMLElement>('section, article, div, form, fieldset') ?? [])
    .filter((elemento) => {
      if (elemento.closest('.toast-host')) return false;
      const estilo = getComputedStyle(elemento);
      const rect = elemento.getBoundingClientRect();
      return estilo.display !== 'none' && estilo.visibility !== 'hidden' && Number(estilo.opacity) !== 0 &&
        rect.width > 0 && rect.height > 0 && rect.left <= x && rect.right >= x && rect.top <= y && rect.bottom >= y;
    })
    .sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height);
  const bajoPunto = candidatos[0] ?? document.elementFromPoint?.(x, y) ?? null;
  if (bajoPunto instanceof HTMLElement && esVisibleEnViewport(bajoPunto)) return bajoPunto;
  const activo = document.activeElement;
  return activo instanceof HTMLElement && activo !== document.body && esVisibleEnViewport(activo) ? activo : null;
}

function buscarContenedorInsercion(elemento: HTMLElement | null) {
  let actual = elemento?.closest<HTMLElement>('a[href], button, fieldset, form, label, ol, select, table, textarea, ul') ?? elemento;
  while (actual && actual !== document.documentElement && actual !== document.body) {
    const padre = actual.parentElement;
    if (!padre || padre === document.body) return null;
    if (!ELEMENTOS_SIN_BLOQUES_HIJOS.has(padre.tagName) && getComputedStyle(padre).display !== 'contents') return { padre, referencia: actual };
    actual = padre;
  }
  return null;
}

function configurarHostFlujo(host: HTMLDivElement) {
  host.dataset.placement = 'flow';
  host.style.width = '100%';
  host.style.minWidth = '0';
  host.style.gridColumn = '1 / -1';
  host.style.flex = '0 0 100%';
}

function ubicarHostFlujo(host: HTMLDivElement) {
  const regionPrincipal = document.querySelector<HTMLElement>('.shell-docente__content, main.page, main, [role="main"]');
  const punto = obtenerPuntoAnclaje(regionPrincipal);
  const ancla = encontrarElementoAncla(regionPrincipal, punto.x, punto.y);
  const insercion = buscarContenedorInsercion(ancla);
  if (insercion) insercion.padre.insertBefore(host, insercion.referencia);
  else {
    const root = document.querySelector<HTMLElement>('#root');
    if (root?.parentElement) root.parentElement.insertBefore(host, root);
    else document.body.appendChild(host);
  }
  configurarHostFlujo(host);
}

const ToastContext = createContext<ToastApi | null>(null);
const MAX_VISIBLE_TOASTS = 4;
const DURACION_MINIMA_MS = 4500;
const DURACION_ERROR_MINIMA_MS = 10000;
const DURACION_MAXIMA_MS = 12000;
const MAXIMA_PROPORCION_SOLAPAMIENTO_TOAST = 0.01;
type ToastPlacement =
  | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  | 'top-center' | 'bottom-center' | 'center-left' | 'center-right' | 'center'
  | 'flow';

function limiteVisibleToasts() {
  return window.innerWidth <= 520 ? 1 : MAX_VISIBLE_TOASTS;
}

function areaInterseccion(a: DOMRect, b: { left: number; top: number; right: number; bottom: number }) {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

function proporcionCubierta(elemento: DOMRect, viewport: { left: number; top: number; width: number; height: number }) {
  const area = Math.max(0, elemento.width) * Math.max(0, elemento.height);
  if (area === 0) return 0;
  return areaInterseccion(elemento, {
    left: viewport.left,
    top: viewport.top,
    right: viewport.left + viewport.width,
    bottom: viewport.top + viewport.height
  }) / area;
}

function maximaProporcionContenidoCubierto(elementos: DOMRect[], viewport: { left: number; top: number; width: number; height: number }) {
  return elementos.reduce((maxima, elemento) => Math.max(maxima, proporcionCubierta(elemento, viewport)), 0);
}

function areaTotalContenidoCubierto(elementos: DOMRect[], viewport: { left: number; top: number; width: number; height: number }) {
  const limite = {
    left: viewport.left,
    top: viewport.top,
    right: viewport.left + viewport.width,
    bottom: viewport.top + viewport.height
  };
  const rectangulos = elementos.flatMap((elemento) => {
    const rectangulo = {
      left: Math.max(elemento.left, limite.left),
      top: Math.max(elemento.top, limite.top),
      right: Math.min(elemento.right, limite.right),
      bottom: Math.min(elemento.bottom, limite.bottom)
    };
    return rectangulo.right > rectangulo.left && rectangulo.bottom > rectangulo.top ? [rectangulo] : [];
  });
  const eventos = rectangulos.flatMap(({ left, right, top, bottom }) => [
    { x: left, top, bottom, delta: 1 },
    { x: right, top, bottom, delta: -1 }
  ]).sort((a, b) => a.x - b.x);
  const coordenadasY = [...new Set(rectangulos.flatMap(({ top, bottom }) => [top, bottom]))].sort((a, b) => a - b);
  if (eventos.length === 0 || coordenadasY.length < 2) return 0;
  const indiceY = new Map(coordenadasY.map((coordenada, indice) => [coordenada, indice]));
  const conteos = new Array<number>(coordenadasY.length * 4).fill(0);
  const longitudesCubiertas = new Array<number>(coordenadasY.length * 4).fill(0);
  type ActualizacionCobertura = { nodo: number; inicio: number; fin: number; desde: number; hasta: number; delta: number };
  const actualizarCobertura = ({ nodo, inicio, fin, desde, hasta, delta }: ActualizacionCobertura) => {
    if (desde <= inicio && fin <= hasta) {
      conteos[nodo] = conteos[nodo]! + delta;
    } else {
      const medio = Math.floor((inicio + fin) / 2);
      if (desde <= medio) actualizarCobertura({ nodo: nodo * 2, inicio, fin: medio, desde, hasta, delta });
      if (hasta > medio) actualizarCobertura({ nodo: nodo * 2 + 1, inicio: medio + 1, fin, desde, hasta, delta });
    }
    if (conteos[nodo]! > 0) {
      longitudesCubiertas[nodo] = coordenadasY[fin + 1]! - coordenadasY[inicio]!;
    } else if (inicio === fin) {
      longitudesCubiertas[nodo] = 0;
    } else {
      longitudesCubiertas[nodo] = longitudesCubiertas[nodo * 2]! + longitudesCubiertas[nodo * 2 + 1]!;
    }
  };
  let area = 0;
  let izquierdaAnterior = eventos[0]!.x;
  for (let indice = 0; indice < eventos.length;) {
    const izquierda = eventos[indice]!.x;
    area += (izquierda - izquierdaAnterior) * longitudesCubiertas[1]!;
    while (indice < eventos.length && eventos[indice]!.x === izquierda) {
      const evento = eventos[indice]!;
      const desde = indiceY.get(evento.top)!;
      const hasta = indiceY.get(evento.bottom)! - 1;
      actualizarCobertura({ nodo: 1, inicio: 0, fin: coordenadasY.length - 2, desde, hasta, delta: evento.delta });
      indice += 1;
    }
    izquierdaAnterior = izquierda;
  }
  return area;
}

function elegirUbicacionToast({
  foco,
  controles,
  contenido,
  viewport,
  anchoPantalla,
  altoPantalla,
  actual
}: {
  foco: DOMRect | null;
  controles: DOMRect[];
  contenido: DOMRect[];
  viewport: { width: number; height: number };
  anchoPantalla: number;
  altoPantalla: number;
  actual: ToastPlacement;
}): ToastPlacement {
  const margen = 14;
  const izquierda = margen;
  const derecha = anchoPantalla - margen - viewport.width;
  const arriba = margen;
  const abajo = altoPantalla - margen - viewport.height;
  const centroIzquierda = (anchoPantalla - viewport.width) / 2;
  const centroArriba = (altoPantalla - viewport.height) / 2;
  const ubicaciones: Array<{ placement: Exclude<ToastPlacement, 'flow'>; left: number; top: number }> = [
    { placement: 'bottom-right', left: derecha, top: abajo },
    { placement: 'bottom-left', left: izquierda, top: abajo },
    { placement: 'top-right', left: derecha, top: arriba },
    { placement: 'top-left', left: izquierda, top: arriba },
    { placement: 'top-center', left: centroIzquierda, top: arriba },
    { placement: 'bottom-center', left: centroIzquierda, top: abajo },
    { placement: 'center-left', left: izquierda, top: centroArriba },
    { placement: 'center-right', left: derecha, top: centroArriba },
    { placement: 'center', left: centroIzquierda, top: centroArriba }
  ];
  const evaluadas = ubicaciones.map((ubicacion) => ({
    ...ubicacion,
    proporcionOcultaFoco: foco ? proporcionCubierta(foco, { ...ubicacion, ...viewport }) : 0,
    proporcionesControles: controles.map((control) => proporcionCubierta(control, { ...ubicacion, ...viewport })),
    proporcionContenidoCubierto: maximaProporcionContenidoCubierto(contenido, { ...ubicacion, ...viewport }),
    areaContenidoCubierto: areaTotalContenidoCubierto(contenido, { ...ubicacion, ...viewport })
  }));
  const seguras = evaluadas.filter((ubicacion) => ubicacion.proporcionOcultaFoco <= MAXIMA_PROPORCION_SOLAPAMIENTO_TOAST &&
    ubicacion.proporcionesControles.every((proporcion) => proporcion <= MAXIMA_PROPORCION_SOLAPAMIENTO_TOAST) &&
    ubicacion.proporcionContenidoCubierto <= MAXIMA_PROPORCION_SOLAPAMIENTO_TOAST);
  if (seguras.length === 0) return 'flow';

  seguras.sort((a, b) => a.proporcionOcultaFoco - b.proporcionOcultaFoco ||
    a.proporcionesControles.reduce((suma, proporcion) => suma + proporcion, 0) -
      b.proporcionesControles.reduce((suma, proporcion) => suma + proporcion, 0) ||
    a.areaContenidoCubierto - b.areaContenidoCubierto ||
    Number(b.placement === actual) - Number(a.placement === actual));
  return seguras[0]!.placement;
}

function iconFor(level: ToastLevel) {
  if (level === 'ok') return 'ok';
  if (level === 'warn' || level === 'error') return 'alerta';
  return 'info';
}

function defaultTitle(level: ToastLevel) {
  if (level === 'error') return 'Error';
  if (level === 'warn') return 'Atención';
  if (level === 'ok') return 'Listo';
  return 'Información';
}

function normalizeDuration(ms: number | undefined, level: ToastLevel) {
  const minimum = level === 'error' ? DURACION_ERROR_MINIMA_MS : DURACION_MINIMA_MS;
  const requested = Number.isFinite(ms) && Number(ms) > 0
    ? Number(ms)
    : level === 'error' ? DURACION_ERROR_MINIMA_MS : level === 'warn' ? 8000 : 5000;
  return Math.min(DURACION_MAXIMA_MS, Math.max(minimum, requested));
}

const MENSAJE_ERROR_INESPERADO = 'Ocurrió un problema inesperado. Verifica el resultado antes de repetir la acción; si persiste, contacta a soporte.';
const MENSAJE_ACCION_FALLIDA = 'No se pudo completar esta acción. Verifica el resultado antes de volver a intentarlo; si el problema continúa, contacta a soporte.';

function textoOpcional(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizarNivel(level: unknown): ToastLevel {
  return ['info', 'ok', 'warn', 'error'].includes(level as string) ? level as ToastLevel : 'info';
}

function crearToastItem(payload: ToastPayload, key: string, revision: number, paused: boolean, actionRunning = false): ToastItem | null {
  const level = normalizarNivel(payload.level);
  const message = String(payload.message || '').trim();
  if (!message) return null;

  const actionLabel = textoOpcional(payload.action?.label);
  const secondaryActionLabel = textoOpcional(payload.secondaryAction?.label);
  const persistent = payload.persistent ?? Boolean(actionLabel || secondaryActionLabel || (level === 'error' && payload.durationMs === undefined));
  const title = textoOpcional(payload.title) || defaultTitle(level);
  return {
    key,
    revision,
    ...(typeof payload.id === 'string' && payload.id.trim() ? { id: payload.id.trim() } : {}),
    level,
    title,
    message,
    durationMs: normalizeDuration(payload.durationMs, level),
    persistent,
    paused,
    actionRunning,
    ...(textoOpcional(payload.eyebrow) ? { eyebrow: textoOpcional(payload.eyebrow) } : {}),
    ...(actionLabel ? { actionLabel, actionOnClick: payload.action?.onClick } : {}),
    ...(secondaryActionLabel ? { secondaryActionLabel, secondaryActionOnClick: payload.secondaryAction?.onClick } : {})
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [cantidadEnEspera, setCantidadEnEspera] = useState(0);
  const [anuncioCortes, setAnuncioCortes] = useState({ revision: 0, texto: '' });
  const [ubicacionToast, setUbicacionToast] = useState<ToastPlacement>('bottom-right');
  const [toastHost, setToastHost] = useState<HTMLDivElement | null>(null);
  const toastsRef = useRef<ToastItem[]>([]);
  const pendientesRef = useRef<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());
  const accionesEnCurso = useRef(new Set<string>());
  const remaining = useRef<Map<string, number>>(new Map());
  const startedAt = useRef<Map<string, number>>(new Map());
  const pauseReasons = useRef<Map<string, Set<string>>>(new Map());
  const nextKey = useRef(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const ultimoFocoFueraDeToast = useRef<HTMLElement | null>(null);
  const dismissRef = useRef<(key: string, restaurarFoco?: boolean) => void>(() => {});
  const revisionAnuncio = useRef(0);

  useLayoutEffect(() => {
    const host = document.createElement('div');
    host.className = 'toast-host';
    document.body.appendChild(host);
    setToastHost(host);
    return () => host.remove();
  }, []);

  const recalcularUbicacionToast = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const estiloOriginal = viewport.getAttribute('style');
    if (ubicacionToast === 'flow') {
      Object.assign(viewport.style, {
        position: 'fixed', inset: 'auto', top: '14px', right: '14px', bottom: '', left: '', margin: '0',
        width: window.innerWidth <= 520 ? 'min(320px, calc(100vw - 20px))' : 'min(420px, calc(100vw - 28px))',
        maxHeight: window.innerWidth <= 520 ? 'min(50dvh, calc(100dvh - 20px))' : 'min(75vh, calc(100dvh - 28px))',
        overflowY: 'auto'
      });
    }
    const focoActivo = document.activeElement;
    const elementoFoco = focoActivo instanceof HTMLElement && !viewport.contains(focoActivo) ? focoActivo : null;
    const rectViewport = viewport.getBoundingClientRect();
    const rectFoco = elementoFoco && elementoFoco !== document.body
      ? elementoFoco.getBoundingClientRect()
      : null;
    const controles = Array.from(document.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, a[href], [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])'
    )).filter((elemento) => {
      if (viewport.contains(elemento) || elemento.closest('[aria-hidden="true"]')) return false;
      // El enlace de salto permanece montado fuera de pantalla hasta recibir foco.
      if (elemento.classList.contains('shell-docente__skip-link') && !elemento.matches(':focus-visible')) return false;
      const estilo = window.getComputedStyle(elemento);
      if (estilo.visibility === 'hidden' || estilo.display === 'none' || Number(estilo.opacity) === 0) return false;
      const rect = elemento.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < window.innerWidth &&
        rect.bottom > 0 && rect.top < window.innerHeight && elemento !== elementoFoco;
    }).map((elemento) => elemento.getBoundingClientRect());
    const contenido = Array.from(document.querySelectorAll<HTMLElement>(
      'h1, h2, h3, h4, h5, h6, p, label, legend, summary, li, dt, dd, figcaption, blockquote, span, small, strong, em, b, td, th, output, code, .ayuda, [class*="__hint"], [class*="-hint"], [role="status"], [role="alert"]'
    )).filter((elemento) => {
      if (viewport.contains(elemento) || elemento.closest('[aria-hidden="true"]') || elemento.closest('button, a[href], [role="button"], [role="link"]')) return false;
      const estilo = window.getComputedStyle(elemento);
      if (estilo.visibility === 'hidden' || estilo.display === 'none' || Number(estilo.opacity) === 0) return false;
      const rect = elemento.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && Boolean(elemento.textContent?.trim());
    }).map((elemento) => elemento.getBoundingClientRect());
    const ubicacion = elegirUbicacionToast({
      foco: rectFoco,
      controles,
      contenido,
      viewport: { width: rectViewport.width || viewport.offsetWidth, height: rectViewport.height || viewport.offsetHeight },
      anchoPantalla: window.innerWidth,
      altoPantalla: window.innerHeight,
      actual: ubicacionToast
    });
    setUbicacionToast(ubicacion);
    if (estiloOriginal === null) viewport.removeAttribute('style');
    else viewport.setAttribute('style', estiloOriginal);
  }, [ubicacionToast]);

  useLayoutEffect(() => {
    recalcularUbicacionToast();
  }, [cantidadEnEspera, recalcularUbicacionToast, toasts]);

  useEffect(() => {
    let timer: number | null = null;
    const alCambiarFoco = () => {
      if (ubicacionToast === 'flow' && toastHost?.dataset.placement === 'flow') {
        const rect = toastHost.getBoundingClientRect();
        const visible = rect.right > 0 && rect.left < window.innerWidth && rect.bottom > 0 && rect.top < window.innerHeight;
        if (!visible) ubicarHostFlujo(toastHost);
      }
      recalcularUbicacionToast();
    };
    const alPerderFoco = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        recalcularUbicacionToast();
      }, 0);
    };
    window.addEventListener('resize', alCambiarFoco);
    window.addEventListener('scroll', alCambiarFoco, true);
    document.addEventListener('focusin', alCambiarFoco);
    document.addEventListener('focusout', alPerderFoco);
    return () => {
      window.removeEventListener('resize', alCambiarFoco);
      window.removeEventListener('scroll', alCambiarFoco, true);
      document.removeEventListener('focusin', alCambiarFoco);
      document.removeEventListener('focusout', alPerderFoco);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [recalcularUbicacionToast, toastHost, ubicacionToast]);

  const anunciarCortes = useCallback((texto: string) => {
    revisionAnuncio.current += 1;
    setAnuncioCortes({ revision: revisionAnuncio.current, texto });
  }, []);

  const reemplazarToasts = useCallback((siguientes: ToastItem[]) => {
    toastsRef.current = siguientes;
    setToasts(siguientes);
  }, []);

  const marcarAccionEnCurso = useCallback((key: string) => {
    const indice = toastsRef.current.findIndex((toast) => toast.key === key);
    if (indice < 0 || toastsRef.current[indice]?.actionRunning) return;
    const siguientes = [...toastsRef.current];
    siguientes[indice] = { ...siguientes[indice]!, actionRunning: true };
    reemplazarToasts(siguientes);
  }, [reemplazarToasts]);

  const reemplazarPendientes = useCallback((siguientes: ToastItem[]) => {
    pendientesRef.current = siguientes;
    setCantidadEnEspera(siguientes.length);
  }, []);

  const liberarTemporizador = useCallback((key: string) => {
    const handle = timers.current.get(key);
    if (handle !== undefined) window.clearTimeout(handle);
    timers.current.delete(key);
    startedAt.current.delete(key);
  }, []);

  const actualizarPausaVisible = useCallback((key: string, paused: boolean) => {
    const actuales = toastsRef.current;
    const indice = actuales.findIndex((toast) => toast.key === key);
    if (indice < 0 || actuales[indice]?.paused === paused) return;
    const siguientes = [...actuales];
    siguientes[indice] = { ...siguientes[indice]!, paused };
    reemplazarToasts(siguientes);
  }, [reemplazarToasts]);

  const limpiarSeguimiento = useCallback((key: string) => {
    liberarTemporizador(key);
    remaining.current.delete(key);
    pauseReasons.current.delete(key);
  }, [liberarTemporizador]);

  const schedule = useCallback((key: string, durationMs: number, persistent: boolean, conservarTiempoRestante = false) => {
    liberarTemporizador(key);
    const duracion = conservarTiempoRestante ? remaining.current.get(key) ?? durationMs : durationMs;
    remaining.current.set(key, duracion);
    if (persistent) return;
    if (pauseReasons.current.get(key)?.size) {
      actualizarPausaVisible(key, true);
      return;
    }
    startedAt.current.set(key, Date.now());
    const handle = window.setTimeout(() => dismissRef.current(key), duracion);
    timers.current.set(key, handle);
  }, [actualizarPausaVisible, liberarTemporizador]);

  const dismiss = useCallback((key: string, restaurarFoco = false) => {
    const siguientes = toastsRef.current.filter((toast) => toast.key !== key);
    const cola = pendientesRef.current;
    const siguienteEnEspera = cola[0];
    if (siguienteEnEspera && siguientes.length < limiteVisibleToasts()) {
      siguientes.push(siguienteEnEspera);
      const colaRestante = cola.slice(1);
      reemplazarPendientes(colaRestante);
      schedule(siguienteEnEspera.key, siguienteEnEspera.durationMs, siguienteEnEspera.persistent);
      const cuentaEnEspera = colaRestante.length;
      const textoEspera = cuentaEnEspera === 0
        ? ''
        : cuentaEnEspera === 1
          ? ' Hay 1 notificación más en espera.'
          : ` Hay ${cuentaEnEspera} notificaciones más en espera.`;
      anunciarCortes(siguienteEnEspera.level === 'error'
        ? cuentaEnEspera === 0 ? '' : textoEspera.trim()
        : `${siguienteEnEspera.title}. ${siguienteEnEspera.message}.${textoEspera}`);
    }
    reemplazarToasts(siguientes);
    limpiarSeguimiento(key);
    if (restaurarFoco) {
      window.setTimeout(() => {
        const anterior = ultimoFocoFueraDeToast.current;
        if (anterior?.isConnected && !viewportRef.current?.contains(anterior)) anterior.focus();
      }, 0);
    }
  }, [anunciarCortes, limpiarSeguimiento, reemplazarPendientes, reemplazarToasts, schedule]);
  dismissRef.current = dismiss;

  const pause = useCallback((key: string, reason: string) => {
    const reasons = pauseReasons.current.get(key) ?? new Set<string>();
    if (reasons.has(reason)) return;
    const wasUnpaused = reasons.size === 0;
    reasons.add(reason);
    pauseReasons.current.set(key, reasons);
    if (!wasUnpaused) return;

    const handle = timers.current.get(key);
    const start = startedAt.current.get(key);
    const rem = remaining.current.get(key);
    if (handle !== undefined) {
      window.clearTimeout(handle);
      timers.current.delete(key);
      if (start !== undefined && rem !== undefined) remaining.current.set(key, Math.max(0, rem - (Date.now() - start)));
    }
    startedAt.current.delete(key);
    actualizarPausaVisible(key, true);
  }, [actualizarPausaVisible]);

  const resume = useCallback((key: string, reason: string) => {
    const reasons = pauseReasons.current.get(key);
    if (!reasons?.delete(reason)) return;
    if (reasons.size > 0) return;
    pauseReasons.current.delete(key);
    actualizarPausaVisible(key, false);
    const rem = remaining.current.get(key);
    if (rem === undefined || toastsRef.current.find((toast) => toast.key === key)?.persistent) return;
    startedAt.current.set(key, Date.now());
    const handle = window.setTimeout(() => dismiss(key), rem);
    timers.current.set(key, handle);
  }, [actualizarPausaVisible, dismiss]);

  const reconciliarLimiteVisible = useCallback(() => {
    const limite = limiteVisibleToasts();
    const visibles = toastsRef.current;
    if (visibles.length > limite) {
      const foco = document.activeElement;
      const toastEnfocado = foco instanceof HTMLElement ? foco.closest<HTMLElement>('[data-toast-key]') : null;
      const claveEnfocada = toastEnfocado?.dataset.toastKey;
      const conservar = visibles.find((toast) => toast.key === claveEnfocada) ?? visibles[0]!;
      const enviarACola = visibles.filter((toast) => toast.key !== conservar.key);
      enviarACola.forEach((toast) => {
        const handle = timers.current.get(toast.key);
        if (handle !== undefined) {
          window.clearTimeout(handle);
          timers.current.delete(toast.key);
          const inicio = startedAt.current.get(toast.key);
          const restante = remaining.current.get(toast.key);
          if (inicio !== undefined && restante !== undefined) {
            remaining.current.set(toast.key, Math.max(0, restante - (Date.now() - inicio)));
          }
        }
        startedAt.current.delete(toast.key);
        const razones = new Set<string>(['queue']);
        if (document.visibilityState === 'hidden') razones.add('document');
        pauseReasons.current.set(toast.key, razones);
      });
      reemplazarToasts([conservar]);
      reemplazarPendientes([...enviarACola.slice().reverse(), ...pendientesRef.current]);
      return;
    }

    const espaciosDisponibles = limite - visibles.length;
    const promover = pendientesRef.current.slice(0, espaciosDisponibles);
    if (promover.length === 0) return;
    reemplazarPendientes(pendientesRef.current.slice(promover.length));
    const promoverListos = promover.map((toast) => {
      const razones = pauseReasons.current.get(toast.key);
      razones?.delete('queue');
      if (razones?.size === 0) pauseReasons.current.delete(toast.key);
      return { ...toast, paused: Boolean(razones?.size) };
    });
    reemplazarToasts([...visibles, ...promoverListos]);
    promoverListos.forEach((toast) => schedule(toast.key, toast.durationMs, toast.persistent, true));
  }, [reemplazarPendientes, reemplazarToasts, schedule]);

  useEffect(() => {
    const alCambiarAncho = () => reconciliarLimiteVisible();
    alCambiarAncho();
    window.addEventListener('resize', alCambiarAncho);
    return () => window.removeEventListener('resize', alCambiarAncho);
  }, [reconciliarLimiteVisible]);

  const push = useCallback((payload: ToastPayload) => {
    const id = typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : undefined;
    const existente = id
      ? [...toastsRef.current, ...pendientesRef.current].find((toast) => toast.id === id)
      : undefined;
    const key = existente?.key ?? `toast-${Date.now()}-${++nextKey.current}`;
    const revision = existente ? existente.revision + 1 : 0;
    if (document.visibilityState === 'hidden') {
      const reasons = pauseReasons.current.get(key) ?? new Set<string>();
      reasons.add('document');
      pauseReasons.current.set(key, reasons);
    }
    const item = crearToastItem(
      payload,
      key,
      revision,
      Boolean(pauseReasons.current.get(key)?.size),
      accionesEnCurso.current.has(key)
    );
    if (!item) return;

    if (pendientesRef.current.some((toast) => toast.key === key)) {
      remaining.current.delete(key);
      reemplazarPendientes(pendientesRef.current.map((toast) => toast.key === key ? item : toast));
      if (item.level !== 'error') anunciarCortes(`${item.title}. ${item.message}`);
      return;
    }
    const estabaVisible = toastsRef.current.some((toast) => toast.key === key);
    const visiblesPrevios = toastsRef.current.filter((toast) => toast.key !== key);
    if (!estabaVisible && visiblesPrevios.length >= limiteVisibleToasts()) {
      const pendientesSiguientes = [...pendientesRef.current, item];
      reemplazarPendientes(pendientesSiguientes);
      const cuenta = pendientesSiguientes.length;
      const textoEspera = cuenta === 1
        ? 'Hay 1 notificación más en espera.'
        : `Hay ${cuenta} notificaciones más en espera.`;
      anunciarCortes(item.level === 'error' ? textoEspera : `${item.title}. ${item.message}. ${textoEspera}`);
      return;
    }
    reemplazarToasts([item, ...visiblesPrevios]);
    schedule(key, item.durationMs, item.persistent);
    if (item.level !== 'error') anunciarCortes(`${item.title}. ${item.message}`);
  }, [anunciarCortes, reemplazarPendientes, reemplazarToasts, schedule]);

  const ejecutarAccion = useCallback((key: string, accion?: () => void | Promise<unknown>) => {
    if (accionesEnCurso.current.has(key)) return;
    try {
      const resultado = accion?.() as unknown;
      if (resultado && typeof (resultado as Promise<unknown>).then === 'function') {
        accionesEnCurso.current.add(key);
        marcarAccionEnCurso(key);
        void Promise.resolve(resultado).catch(() => {
          push({ level: 'error', title: 'No se pudo completar la acción', message: MENSAJE_ACCION_FALLIDA, persistent: true });
        }).finally(() => {
          accionesEnCurso.current.delete(key);
          dismiss(key, true);
        });
        return;
      }
    } catch {
      push({ level: 'error', title: 'No se pudo completar la acción', message: MENSAJE_ACCION_FALLIDA, persistent: true });
    }
    dismiss(key, true);
  }, [dismiss, marcarAccionEnCurso, push]);

  useEffect(() => onToast(push), [push]);

  useEffect(() => {
    const onError = () => {
      push({
        id: 'unhandled-global',
        level: 'error',
        title: 'Error inesperado',
        message: MENSAJE_ERROR_INESPERADO,
        persistent: true
      });
    };
    const onRejection = () => {
      push({ id: 'unhandled-global', level: 'error', title: 'Error inesperado', message: MENSAJE_ERROR_INESPERADO, persistent: true });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [push]);

  useEffect(() => {
    const alCambiarVisibilidad = () => {
      const actualmenteVisible = document.visibilityState !== 'hidden';
      const claves = [...toastsRef.current, ...pendientesRef.current].map((toast) => toast.key);
      claves.forEach((key) => actualmenteVisible ? resume(key, 'document') : pause(key, 'document'));
    };
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => document.removeEventListener('visibilitychange', alCambiarVisibilidad);
  }, [pause, resume]);

  useEffect(() => {
    const guardarFocoFueraDeToast = (event: FocusEvent) => {
      if (!viewportRef.current?.contains(event.target as Node)) {
        ultimoFocoFueraDeToast.current = event.target instanceof HTMLElement ? event.target : null;
      }
    };
    document.addEventListener('focusin', guardarFocoFueraDeToast);
    return () => document.removeEventListener('focusin', guardarFocoFueraDeToast);
  }, []);

  useEffect(() => () => {
    timers.current.forEach((handle) => window.clearTimeout(handle));
    timers.current.clear();
    remaining.current.clear();
    startedAt.current.clear();
    pauseReasons.current.clear();
    accionesEnCurso.current.clear();
    toastsRef.current = [];
    pendientesRef.current = [];
  }, []);

  const api = useMemo<ToastApi>(() => ({ push }), [push]);
  const toastViewport = (toasts.length > 0 || cantidadEnEspera > 0) ? (
    <div ref={viewportRef} className="toast-viewport" data-placement={ubicacionToast} role="region" aria-label="Notificaciones">
      {toasts.map((toast, indice) => {
        const titleId = `${toast.key}-title`;
        const messageId = `${toast.key}-message`;
        return (
          <article
            key={toast.key}
            data-toast-key={toast.key}
            className={`toast ${toast.level}${toast.persistent ? ' persistent' : ''}${toast.paused ? ' paused' : ''}`}
            role="group"
            aria-busy={toast.actionRunning}
            aria-labelledby={titleId}
            aria-describedby={messageId}
            onPointerEnter={() => pause(toast.key, 'pointer')}
            onPointerLeave={() => resume(toast.key, 'pointer')}
            onFocusCapture={() => pause(toast.key, 'focus')}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) resume(toast.key, 'focus');
            }}
          >
            {toast.level === 'error' && (
              <div className="toast-announcement" role="alert" aria-atomic="true">
                {toast.title}. {toast.message}
              </div>
            )}
            <div className={`toast-icon ${toast.level}`} aria-hidden="true"><Icono nombre={iconFor(toast.level)} size={20} /></div>
            <div className="toast-body">
              {toast.eyebrow ? <div className="toast-eyebrow">{toast.eyebrow}</div> : null}
              <div className="toast-title" id={titleId}>{toast.title}</div>
              <div className="toast-text" id={messageId}>{toast.message}</div>
              {indice === 0 && cantidadEnEspera > 0 && (
                <div className="toast-queue-status" aria-hidden="true">
                  {`+${cantidadEnEspera} en espera`}
                </div>
              )}
            </div>
            <div className="toast-actions">
              {toast.actionLabel ? (
                <button className="toast-btn action" type="button" aria-describedby={`${titleId} ${messageId}`} aria-disabled={toast.actionRunning} onClick={() => ejecutarAccion(toast.key, toast.actionOnClick)}>
                  {toast.actionRunning ? 'En curso…' : toast.actionLabel}
                </button>
              ) : null}
              {toast.secondaryActionLabel ? (
                <button className="toast-btn secondary" type="button" aria-describedby={`${titleId} ${messageId}`} aria-disabled={toast.actionRunning} onClick={() => ejecutarAccion(toast.key, toast.secondaryActionOnClick)}>
                  {toast.actionRunning ? 'En curso…' : toast.secondaryActionLabel}
                </button>
              ) : null}
              <button
                className="toast-btn close"
                type="button"
                aria-label={`Cerrar notificación: ${toast.title}`}
                onClick={() => dismiss(toast.key, true)}
              >
                Cerrar
              </button>
            </div>
            {!toast.persistent && (
              <div key={`${toast.key}-life-${toast.revision}`} className="toast-life" aria-hidden="true" style={{ animationDuration: `${toast.durationMs}ms`, animationPlayState: toast.paused ? 'paused' : 'running' }} />
            )}
          </article>
        );
      })}
    </div>
  ) : null;
  const hayNotificaciones = toasts.length > 0 || cantidadEnEspera > 0;

  useLayoutEffect(() => {
    if (!toastHost) return;
    if (hayNotificaciones && ubicacionToast === 'flow') {
      if (toastHost.dataset.placement !== 'flow') ubicarHostFlujo(toastHost);
      return;
    }
    if (toastHost.parentElement !== document.body) document.body.appendChild(toastHost);
    toastHost.removeAttribute('style');
    if (hayNotificaciones) toastHost.dataset.placement = ubicacionToast;
    else delete toastHost.dataset.placement;
  }, [hayNotificaciones, toastHost, ubicacionToast]);

  return (
    <ToastContext.Provider value={api}>
      <div className="toast-announcement" role="status" aria-live="polite" aria-atomic="true">
        {anuncioCortes.texto && <span key={anuncioCortes.revision}>{anuncioCortes.texto}</span>}
      </div>
      {toastViewport && toastHost ? createPortal(toastViewport, toastHost) : toastViewport}
      {children}
    </ToastContext.Provider>
  );
}

export function useToasts() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToasts debe usarse dentro de <ToastProvider>');
  return ctx;
}
