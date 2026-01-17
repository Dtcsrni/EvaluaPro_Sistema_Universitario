import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

export const CampoTexto = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    etiqueta: ReactNode;
    ayuda?: ReactNode;
    error?: ReactNode;
    children?: never;
  }
>(function CampoTexto({ etiqueta, ayuda, error, id, 'aria-describedby': ariaDescribedBy, ...props }, ref) {
  const auto = useId();
  const inputId = id ?? `campo-${auto}`;
  const invalid = Boolean(error);

  const ayudaId = ayuda ? `${inputId}-ayuda` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  const describedBy = [ariaDescribedBy, invalid ? errorId : undefined, !invalid ? ayudaId : undefined]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <label className="campo" htmlFor={inputId}>
      {etiqueta}
      <input
        {...props}
        ref={ref}
        id={inputId}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={describedBy}
      />
      {error ? (
        <small id={errorId} className="ayuda error">
          {error}
        </small>
      ) : ayuda ? (
        <small id={ayudaId} className="ayuda">
          {ayuda}
        </small>
      ) : null}
    </label>
  );
});

CampoTexto.displayName = 'CampoTexto';
