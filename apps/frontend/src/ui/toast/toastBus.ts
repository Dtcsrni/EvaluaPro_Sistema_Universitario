/**
 * toastBus
 *
 * Responsabilidad: Componente/utilidad de UI reutilizable.
 * Limites: Preservar accesibilidad y contratos de props existentes.
 */
export type ToastLevel = 'info' | 'ok' | 'warn' | 'error';

export type ToastAction = {
  label: string;
  onClick?: () => void | Promise<unknown>;
};

export type ToastSecondaryAction = {
  label: string;
  onClick?: () => void | Promise<unknown>;
};

export type ToastPayload = {
  id?: string;
  level?: ToastLevel;
  title?: string;
  message: string;
  durationMs?: number;
  action?: ToastAction;
  secondaryAction?: ToastSecondaryAction;
  eyebrow?: string;
  /** Mantiene el aviso hasta que la persona lo cierre o use una acción. */
  persistent?: boolean;
};

const EVENT_NAME = 'app:toast';

export function emitToast(payload: ToastPayload) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
  } catch {
    // ignore
  }
}

export function onToast(handler: (payload: ToastPayload) => void) {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const custom = event as CustomEvent;
    handler((custom.detail || {}) as ToastPayload);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
