/**
 * Boton
 *
 * Responsabilidad: Componente/utilidad de UI reutilizable.
 * Limites: Preservar accesibilidad y contratos de props existentes.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from '../../iconos';

export function Boton({
  variante = 'primario',
  tamano = 'md',
  cargando = false,
  icono,
  children,
  className,
  type = 'button',
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario';
  tamano?: 'sm' | 'md' | 'lg';
  cargando?: boolean;
  icono?: ReactNode;
  children: ReactNode;
}) {
  const clases = [
    'boton',
    variante === 'secundario' ? 'secundario' : '',
    tamano !== 'md' ? `boton--${tamano}` : '',
    icono || cargando ? 'boton--con-icono' : '',
    className || ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button {...props} type={type} className={clases} disabled={Boolean(disabled) || cargando}>
      {cargando || icono ? <span className="boton__icono">{cargando ? <Spinner /> : icono}</span> : null}
      <span className="boton__texto">{children}</span>
    </button>
  );
}
