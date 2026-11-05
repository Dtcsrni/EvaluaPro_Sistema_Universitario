/**
 * ConfirmDialogProvider
 *
 * Responsabilidad: Proveer confirmaciones accesibles y consistentes en toda la app.
 * Limites: Mantener fallback seguro cuando no exista provider.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Icono } from '../iconos';

export type ConfirmDialogTone = 'default' | 'danger' | 'warning';

export type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  details?: string[];
};

type EstadoDialogo = ConfirmDialogOptions & {
  open: boolean;
};

type ConfirmDialogApi = {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
};

const ConfirmDialogContext = createContext<ConfirmDialogApi | null>(null);

const estadoInicial: EstadoDialogo = {
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  tone: 'default',
  details: []
};

function iconoPorTono(tone: ConfirmDialogTone) {
  if (tone === 'danger') return <Icono nombre="alerta" />;
  if (tone === 'warning') return <Icono nombre="info" />;
  return <Icono nombre="ok" />;
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<EstadoDialogo>(estadoInicial);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const elementoInvocadorRef = useRef<HTMLElement | null>(null);

  const cerrar = useCallback((resultado: boolean) => {
    resolverRef.current?.(resultado);
    resolverRef.current = null;
    setEstado(estadoInicial);
  }, []);

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      elementoInvocadorRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      resolverRef.current = resolve;
      setEstado({
        open: true,
        title: String(options.title || '').trim(),
        message: String(options.message || '').trim(),
        confirmLabel: String(options.confirmLabel || '').trim() || 'Confirmar',
        cancelLabel: String(options.cancelLabel || '').trim() || 'Cancelar',
        tone: options.tone || 'default',
        details: Array.isArray(options.details) ? options.details.filter(Boolean) : []
      });
    });
  }, []);

  const api = useMemo<ConfirmDialogApi>(() => ({ confirm }), [confirm]);
  const toneActual: ConfirmDialogTone = estado.tone || 'default';
  const detallesActuales = Array.isArray(estado.details) ? estado.details : [];

  const manejarTecladoDialogo = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cerrar(false);
      return;
    }
    if (event.key !== 'Tab') return;

    const dialogo = dialogRef.current;
    if (!dialogo) return;
    const controles = Array.from(
      dialogo.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((control) => control.getAttribute('aria-hidden') !== 'true');
    const primero = controles[0];
    const ultimo = controles.at(-1);
    if (!primero || !ultimo) {
      event.preventDefault();
      dialogo.focus();
      return;
    }

    const focoActual = document.activeElement;
    if (!dialogo.contains(focoActual)) {
      event.preventDefault();
      (event.shiftKey ? ultimo : primero).focus();
    } else if (event.shiftKey && focoActual === primero) {
      event.preventDefault();
      ultimo.focus();
    } else if (!event.shiftKey && focoActual === ultimo) {
      event.preventDefault();
      primero.focus();
    }
  }, [cerrar]);

  useEffect(() => {
    if (estado.open) {
      cancelButtonRef.current?.focus();
      document.addEventListener('keydown', manejarTecladoDialogo);
      return () => document.removeEventListener('keydown', manejarTecladoDialogo);
    }
    const elementoInvocador = elementoInvocadorRef.current;
    elementoInvocadorRef.current = null;
    if (elementoInvocador?.isConnected) elementoInvocador.focus();
  }, [estado.open, manejarTecladoDialogo]);

  return (
    <ConfirmDialogContext.Provider value={api}>
      {children}
      {estado.open ? (
        <div
          className="confirm-dialog-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) cerrar(false);
          }}
        >
          <section
            ref={dialogRef}
            className={`confirm-dialog confirm-dialog--${toneActual}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            tabIndex={-1}
          >
            <div className="confirm-dialog__hero">
              <span className="confirm-dialog__icon" aria-hidden="true">
                {iconoPorTono(toneActual)}
              </span>
              <div>
                <p className="eyebrow">Confirmación requerida</p>
                <h3 id="confirm-dialog-title">{estado.title}</h3>
              </div>
            </div>
            <p id="confirm-dialog-message" className="confirm-dialog__message">
              {estado.message}
            </p>
            {detallesActuales.length > 0 ? (
              <ul className="confirm-dialog__details">
                {detallesActuales.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
            <div className="confirm-dialog__actions">
              <button ref={cancelButtonRef} type="button" className="boton secundario" onClick={() => cerrar(false)}>
                {estado.cancelLabel}
              </button>
              <button
                type="button"
                className={`boton ${estado.tone === 'danger' ? 'confirm-dialog__confirm--danger' : ''}`}
                onClick={() => cerrar(true)}
              >
                {estado.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const ctx = useContext(ConfirmDialogContext);
  if (ctx) return ctx.confirm;

  return async () => {
    throw new Error('useConfirmDialog debe usarse dentro de <ConfirmDialogProvider>');
  };
}
