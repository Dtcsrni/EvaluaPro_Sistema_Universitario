/**
 * uxCopy
 *
 * Responsabilidad: Centralizar copy breve y consistente para feedback de UX.
 */
import type { ConfirmDialogOptions, ConfirmDialogTone } from './ConfirmDialogProvider';

export function crearConfirmacionDestructiva({
  title,
  message,
  details,
  confirmLabel = 'Sí, continuar',
  cancelLabel = 'Cancelar',
  tone = 'danger'
}: {
  title: string;
  message: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
}): ConfirmDialogOptions {
  return {
    title,
    message,
    details,
    confirmLabel,
    cancelLabel,
    tone
  };
}

export function mensajeOperacion(area: string, estado: 'ok' | 'error' | 'warn', accion: string) {
  const zona = String(area || '').trim() || 'Operación';
  const verbo = String(accion || '').trim() || 'actualizada';
  if (estado === 'error') return { title: `No se pudo completar`, message: `${zona}: ${verbo}.` };
  if (estado === 'warn') return { title: `Revisa antes de continuar`, message: `${zona}: ${verbo}.` };
  return { title: `${zona}`, message: `${verbo}.` };
}
