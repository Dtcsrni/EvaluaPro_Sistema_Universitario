/**
 * toastProvider.test
 *
 * Responsabilidad: proteger anuncios, acciones y ciclo de vida del toast global.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emitToast } from '../src/ui/toast/toastBus';
import { ToastProvider } from '../src/ui/toast/ToastProvider';

describe('ToastProvider', () => {
  const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  const elementFromPointDescriptor = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
  const innerWidthDescriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth');
  const innerHeightDescriptor = Object.getOwnPropertyDescriptor(window, 'innerHeight');
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (visibilityDescriptor) Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
    else Reflect.deleteProperty(document, 'visibilityState');
    if (elementFromPointDescriptor) Object.defineProperty(document, 'elementFromPoint', elementFromPointDescriptor);
    else Reflect.deleteProperty(document, 'elementFromPoint');
    if (innerWidthDescriptor) Object.defineProperty(window, 'innerWidth', innerWidthDescriptor);
    if (innerHeightDescriptor) Object.defineProperty(window, 'innerHeight', innerHeightDescriptor);
  });

  it('anuncia los estados por nivel y mantiene los errores hasta que se cierren', () => {
    render(<ToastProvider><button type="button">Acción de origen</button></ToastProvider>);
    const estadoCortes = screen.getByRole('status');
    expect(estadoCortes).toBeEmptyDOMElement();

    act(() => emitToast({ level: 'ok', title: 'Guardado', message: 'Los cambios se guardaron.' }));
    expect(estadoCortes).toHaveTextContent('Guardado. Los cambios se guardaron.');
    expect(within(screen.getByRole('group', { name: 'Guardado' })).queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Guardado' })).toBeInTheDocument();

    act(() => emitToast({ level: 'error', title: 'No se guardó', message: 'Intenta de nuevo.' }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No se guardó. Intenta de nuevo.');
    expect(alert.closest('[aria-live="off"]')).toBeNull();
    expect(estadoCortes).toHaveTextContent('Guardado. Los cambios se guardaron.');
    const errorToast = screen.getByRole('group', { name: 'No se guardó' });
    expect(errorToast).toHaveClass('persistent');
    expect(within(errorToast).getByRole('button', { name: 'Cerrar notificación: No se guardó' })).toHaveTextContent('Cerrar');
    expect(errorToast.querySelector('[data-icono="alerta"]')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(30000));
    expect(screen.getByRole('group', { name: 'No se guardó' })).toBeInTheDocument();
  });

  it('pausa el tiempo restante mientras el aviso tiene foco', () => {
    render(<ToastProvider><button type="button">Acción de origen</button></ToastProvider>);
    act(() => emitToast({ level: 'info', title: 'Proceso', message: 'Sigue activo.', durationMs: 5000 }));
    const toast = screen.getByRole('group', { name: 'Proceso' });
    const close = within(toast).getByRole('button', { name: 'Cerrar notificación: Proceso' });

    close.focus();
    act(() => vi.advanceTimersByTime(12000));
    expect(toast).toBeInTheDocument();

    fireEvent.blur(close, { relatedTarget: screen.getByRole('button', { name: 'Acción de origen' }) });
    act(() => vi.advanceTimersByTime(4999));
    expect(toast).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('group', { name: 'Proceso' })).not.toBeInTheDocument();
  });

  it('reubica el toast cuando taparía el control de la página que tiene el foco', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    render(<ToastProvider><button type="button">Guardar cambios</button></ToastProvider>);
    const origen = screen.getByRole('button', { name: 'Guardar cambios' });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this === origen) return new DOMRect(930, 720, 70, 36);
      if (this.classList?.contains('toast-viewport')) return new DOMRect(590, 500, 420, 250);
      return new DOMRect();
    });

    act(() => origen.focus());
    act(() => emitToast({ level: 'error', title: 'No se guardó', message: 'Revisa la conexión.' }));

    expect(screen.getByRole('region', { name: 'Notificaciones' })).toHaveAttribute('data-placement', 'bottom-left');
    expect(origen).toHaveFocus();
  });

  it('evita cubrir por completo una acción visible aunque no tenga el foco', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    render(<ToastProvider><button type="button">Editar alumna</button></ToastProvider>);
    const accion = screen.getByRole('button', { name: 'Editar alumna' });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this === accion) return new DOMRect(930, 720, 70, 36);
      if (this.classList?.contains('toast-viewport')) return new DOMRect(590, 504, 420, 250);
      return new DOMRect();
    });

    act(() => emitToast({ level: 'warn', title: 'Sesión próxima a vencer', message: 'Guarda tu trabajo.' }));

    expect(screen.getByRole('region', { name: 'Notificaciones' })).toHaveAttribute('data-placement', 'bottom-left');
  });

  it('prefiere una esquina que no tape texto auxiliar cuando protege los mismos controles', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    render(<ToastProvider><p>Instrucciones importantes para el formulario.</p></ToastProvider>);
    const copy = screen.getByText('Instrucciones importantes para el formulario.');
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this === copy) return new DOMRect(800, 720, 190, 24);
      if (this.classList?.contains('toast-viewport')) return new DOMRect(590, 504, 420, 250);
      return new DOMRect();
    });

    act(() => emitToast({ level: 'info', title: 'Aviso', message: 'La operación terminó.' }));

    expect(screen.getByRole('region', { name: 'Notificaciones' })).toHaveAttribute('data-placement', 'bottom-left');
  });

  it('elige la posición segura que cubre menos área total de texto', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    const { container } = render(
      <ToastProvider>
        <span>Bloque superior derecho.</span>
        <span>Bloque superior izquierdo.</span>
        <span>Bloque superior central.</span>
        <span>Bloque inferior central.</span>
        <span>Bloque central izquierdo.</span>
        <span>Bloque central derecho.</span>
        <span>Bloque central.</span>
        <p>Texto inferior derecho uno.</p>
        <p>Texto inferior derecho dos.</p>
        <p>Texto inferior izquierdo.</p>
      </ToastProvider>
    );
    const elementos = Array.from(container.querySelectorAll('span, p'));
    const rectangulos = [
      new DOMRect(900, 100, 40, 16),
      new DOMRect(100, 100, 40, 16),
      new DOMRect(500, 100, 40, 16),
      new DOMRect(500, 700, 40, 16),
      new DOMRect(100, 400, 40, 16),
      new DOMRect(900, 400, 40, 16),
      new DOMRect(500, 400, 40, 16),
      new DOMRect(590, 504, 50000, 100),
      new DOMRect(590, 654, 50000, 100),
      new DOMRect(14, 504, 420, 250000)
    ];
    vi.spyOn(HTMLElement.prototype, '