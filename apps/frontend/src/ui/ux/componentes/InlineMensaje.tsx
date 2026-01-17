import type { ReactNode } from 'react';
import { Icono } from '../../iconos';

export type TipoMensaje = 'info' | 'ok' | 'error';

export function InlineMensaje({
  tipo = 'info',
  leading,
  mostrarIcono = true,
  children
}: {
  tipo?: TipoMensaje;
  leading?: ReactNode;
  mostrarIcono?: boolean;
  children: ReactNode;
}) {
  const clase = `mensaje${tipo === 'ok' ? ' ok' : tipo === 'error' ? ' error' : ''}`;
  const icono = tipo === 'error' ? 'alerta' : tipo === 'ok' ? 'ok' : 'info';
  const role = tipo === 'error' ? 'alert' : 'status';

  return (
    <p className={clase} role={role}>
      {leading ? leading : mostrarIcono ? <Icono nombre={icono} /> : null} {children}
    </p>
  );
}
