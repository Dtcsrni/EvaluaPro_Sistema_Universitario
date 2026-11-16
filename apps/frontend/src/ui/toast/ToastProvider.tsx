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
  if (regionPrincipal?.matches('.shell-docente__content')) {
    regionPrincipal.insertBefore(host, regionPrincipal.firstChild);
    configurarHostFlujo(host);
    return;
  }
  const punto = obtenerPuntoAnclaje(regionPrincipal);
  const ancla = encontrarElementoAncla(regionPrincipal, punto.x, punto.y);
  const insercion = buscarContenedorInsercion(ancla);
  // Insertar antes del ancla visible activa el scroll anchoring del navegador:
  // el aviso puede terminar fuera del viewport aunque el ancla siga visible.
  if (insercion) insercion.padre.insertBefore(host, insercion.referencia.nextSibling);
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
      if (hasta > medio)