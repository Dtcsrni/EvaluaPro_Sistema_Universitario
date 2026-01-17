import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from '../../iconos';

export function Boton({
  variante = 'primario',
  cargando = false,
  icono,
  children,
  className,
  type = 'button',
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario';
  cargando?: boolean;
  icono?: ReactNode;
  children: ReactNode;
}) {
  const clases = [
    'boton',
    variante === 'secundario' ? 'secundario' : '',
    className || ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button {...props} type={type} className={clases} disabled={Boolean(disabled) || cargando}>
      {cargando ? <Spinner /> : icono}
      {children}
    </button>
  );
}
