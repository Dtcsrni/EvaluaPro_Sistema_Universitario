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
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const indice = elementos.indexOf(this as HTMLElement);
      if (indice >= 0) return rectangulos[indice]!;
      if (this.classList?.contains('toast-viewport')) return new DOMRect(590, 504, 420, 250);
      return new DOMRect();
    });

    act(() => emitToast({ level: 'info', title: 'Aviso', message: 'La operación terminó.' }));

    expect(screen.getByRole('region', { name: 'Notificaciones' })).toHaveAttribute('data-placement', 'bottom-right');
  });

  it('usa una posición central segura cuando los bloques de texto ocupan las cuatro esquinas', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    const { container } = render(
      <ToastProvider>
        <span>Texto auxiliar superior izquierdo.</span>
        <span>Texto auxiliar superior derecho.</span>
        <span>Texto auxiliar inferior izquierdo.</span>
        <span>Texto auxiliar inferior derecho.</span>
      </ToastProvider>
    );
    const textos = Array.from(container.querySelectorAll('span'));
    const rectangulos = [
      new DOMRect(0, 0, 224, 118),
      new DOMRect(800, 0, 224, 118),
      new DOMRect(0, 650, 224, 118),
      new DOMRect(800, 650, 224, 118)
    ];
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this === textos[0]) return rectangulos[0]!;
      if (this === textos[1]) return rectangulos[1]!;
      if (this === textos[2]) return rectangulos[2]!;
      if (this === textos[3]) return rectangulos[3]!;
      if (this.classList?.contains('toast-viewport')) return new DOMRect(590, 504, 420, 250);
      return new DOMRect();
    });

    act(() => emitToast({ level: 'info', title: 'Aviso', message: 'La operación terminó.' }));

    expect(screen.getByRole('region', { name: 'Notificaciones' })).toHaveAttribute('data-placement', 'top-center');
  });

  it('usa el flujo cuando las nueve posiciones flotantes se solapan con texto', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    const { container } = render(
      <ToastProvider>
        {Array.from({ length: 9 }, (_, index) => <span key={index}>Texto visible {index + 1}.</span>)}
      </ToastProvider>
    );
    const textos = Array.from(container.querySelectorAll('span'));
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => textos[4]!
    });
    const rectangulos = [
      new DOMRect(590, 504, 420, 250),
      new DOMRect(14, 504, 420, 250),
      new DOMRect(590, 14, 420, 250),
      new DOMRect(14, 14, 420, 250),
      new DOMRect(302, 14, 420, 250),
      new DOMRect(302, 504, 420, 250),
      new DOMRect(14, 259, 420, 250),
      new DOMRect(590, 259, 420, 250),
      new DOMRect(302, 259, 420, 250)
    ];
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const indice = textos.indexOf(this as HTMLSpanElement);
      if (indice >= 0) return rectangulos[indice]!;
      if (this.classList?.contains('toast-viewport')) return new DOMRect(590, 504, 420, 250);
      return new DOMRect();
    });

    act(() => emitToast({ level: 'info', title: 'Aviso', message: 'La operación terminó.' }));

    expect(screen.getByRole('region', { name: 'Notificaciones' })).toHaveAttribute('data-placement', 'flow');
    const host = document.querySelector<HTMLElement>('.toast-host');
    expect(host?.dataset.placement).toBe('flow');
    expect(host?.parentElement).toBe(textos[4]?.parentElement);
    expect(host?.previousElementSibling).toBe(textos[4]);
    expect(host?.nextElementSibling).toBe(textos[5]);
  });

  it('devuelve a body el host de flujo vacío al cerrar la última notificación', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    const { container } = render(
      <ToastProvider>
        <main>
          <div className="auth-card-clean">
            <div className="auth-card-header">
              <div className="auth-card-header__anchor">
                {Array.from({ length: 9 }, (_, index) => <span key={index}>Texto visible {index + 1}.</span>)}
              </div>
            </div>
          </div>
        </main>
      </ToastProvider>
    );
    const header = container.querySelector('.auth-card-header')!;
    const anchor = container.querySelector('.auth-card-header__anchor')!;
    const textos = Array.from(container.querySelectorAll('span'));
    const rectangulos = [
      new DOMRect(590, 504, 420, 250),
      new DOMRect(14, 504, 420, 250),
      new DOMRect(590, 14, 420, 250),
      new DOMRect(14, 14, 420, 250),
      new DOMRect(302, 14, 420, 250),
      new DOMRect(302, 504, 420, 250),
      new DOMRect(14, 259, 420, 250),
      new DOMRect(590, 259, 420, 250),
      new DOMRect(302, 259, 420, 250)
    ];
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const indiceTexto = textos.indexOf(this as HTMLSpanElement);
      if (this === document.querySelector('main')) return new DOMRect(0, 0, 1024, 768);
      if (this === header) return new DOMRect(0, 0, 1024, 768);
      if (this === anchor) return new DOMRect(0, 0, 900, 700);
      if (indiceTexto >= 0) return rectangulos[indiceTexto]!;
      if (this.classList?.contains('toast-viewport')) return new DOMRect(590, 504, 420, 250);
      return new DOMRect();
    });

    act(() => emitToast({ level: 'info', title: 'Aviso de prueba', message: 'La operación terminó.' }));
    const host = document.querySelector<HTMLElement>('.toast-host');
    expect(screen.getByRole('region', { name: 'Notificaciones' })).toHaveAttribute('data-placement', 'flow');
    expect(host?.parentElement).toBe(header);

    fireEvent.click(within(screen.getByRole('group', { name: 'Aviso de prueba' }))
      .getByRole('button', { name: 'Cerrar notificación: Aviso de prueba' }));

    expect(screen.queryByRole('region', { name: 'Notificaciones' })).not.toBeInTheDocument();
    expect(host?.parentElement).toBe(document.body);
    expect(host?.dataset.placement).toBeUndefined();
    expect(host?.getAttribute('style')).toBeNull();
    expect(header.querySelector('.toast-host')).toBeNull();
  });

  it('pone las notificaciones en el flujo cuando cualquier esquina ocultaría el control enfocado', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 521 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 });
    render(<ToastProvider><button type="button">Guardar cambios</button></ToastProvider>);
    const origen = screen.getByRole('button', { name: 'Guardar cambios' });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this === origen) return new DOMRect(220, 175, 80, 30);
      if (this.classList?.contains('toast-viewport')) return new DOMRect(87, 136, 420, 250);
      return new DOMRect();
    });

    origen.focus();
    act(() => emitToast({ level: 'error', title: 'No se guardó', message: 'Revisa la conexión.' }));

    expect(screen.getByRole('region', { name: 'Notificaciones' })).toHaveAttribute('data-placement', 'flow');
    expect(origen).toHaveFocus();
  });

  it('recalcula la ubicación al cambiar el foco y el tamaño de la ventana', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    render(<ToastProvider><button type="button">Guardar cambios</button></ToastProvider>);
    const origen = screen.getByRole('button', { name: 'Guardar cambios' });
    let rectOrigen = new DOMRect(220, 175, 80, 30);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this === origen) return rectOrigen;
      if (this.classList?.contains('toast-viewport')) return new DOMRect(590, 500, 420, 250);
      return new DOMRect();
    });

    act(() => emitToast({ level: 'error', title: 'No se guardó', message: 'Revisa la conexión.' }));
    expect(screen.getByRole('region', { name: 'Notificaciones' })).toHaveAttribute('data-placement', 'bottom-right');

    rectOrigen = new DOMRect(930, 720, 70, 36);
    act(() => origen.focus());
    expect(screen.getByRole('region', { name: 'Notificaciones' })).toHaveAttribute('data-placement', 'bottom-left');

    rectOrigen = new DOMRect(220, 175, 80, 30);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 521 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 });
    act(() => fireEvent(window, new Event('resize')));

    expect(screen.getByRole('region', { name: 'Notificaciones' })).toHaveAttribute('data-placement', 'flow');
    expect(origen).toHaveFocus();
  });

  it('pausa al ocultar la pestaña y reanuda con el tiempo restante', () => {
    render(<ToastProvider><button type="button">Acción de origen</button></ToastProvider>);
    act(() => emitToast({ level: 'info', title: 'Sincronización', message: 'En curso.', durationMs: 5000 }));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(15000));
    expect(screen.getByRole('group', { name: 'Sincronización' })).toBeInTheDocument();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(4999));
    expect(screen.getByRole('group', { name: 'Sincronización' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('group', { name: 'Sincronización' })).not.toBeInTheDocument();
  });

  it('inicia pausado si la notificación llega mientras la pestaña ya está oculta', () => {
    render(<ToastProvider><button type="button">Acción de origen</button></ToastProvider>);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });

    act(() => emitToast({ level: 'info', title: 'Sincronización', message: 'En curso.', durationMs: 5000 }));
    act(() => vi.advanceTimersByTime(15000));
    expect(screen.getByRole('group', { name: 'Sincronización' })).toHaveClass('paused');

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(4999));
    expect(screen.getByRole('group', { name: 'Sincronización' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('group', { name: 'Sincronización' })).not.toBeInTheDocument();
  });

  it('actualiza una notificación por id y limita las visibles sin descartar la enfocada', () => {
    render(<ToastProvider><button type="button">Acción de origen</button></ToastProvider>);
    act(() => emitToast({ id: 'actualizacion', level: 'info', title: 'Carga', message: '25 %' }));
    const enfocada = screen.getByRole('group', { name: 'Carga' });
    const close = within(enfocada).getByRole('button', { name: 'Cerrar notificación: Carga' });
    close.focus();
    act(() => emitToast({ id: 'actualizacion', level: 'info', title: 'Carga', message: '50 %' }));
    expect(screen.getAllByRole('group', { name: 'Carga' })).toHaveLength(1);
    expect(enfocada).toHaveTextContent('50 %');

    act(() => {
      for (let i = 0; i < 6; i += 1) emitToast({ title: `Aviso ${i}`, message: `Mensaje ${i}` });
    });
    expect(screen.getAllByRole('group')).toHaveLength(4);
    expect(enfocada).toBeInTheDocument();
  });

  it('encola los avisos que superan el límite y conserva los errores hasta que se cierren', () => {
    render(<ToastProvider><button type="button">Acción de origen</button></ToastProvider>);

    act(() => {
      for (let i = 0; i < 5; i += 1) {
        emitToast({ id: i === 4 ? 'error-en-espera' : undefined, level: 'error', title: `Error ${i}`, message: `Detalle ${i}`, persistent: true });
      }
    });

    expect(screen.getAllByRole('group')).toHaveLength(4);
    expect(screen.getByText('+1 en espera', { selector: '.toast-queue-status' })).toBeInTheDocument();
    act(() => emitToast({ id: 'error-en-espera', level: 'error', title: 'Error actualizado', message: 'Detalle actualizado', persistent: true }));
    expect(screen.getByText('+1 en espera', { selector: '.toast-queue-status' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación: Error 3' }));

    expect(screen.getByRole('group', { name: 'Error actualizado' })).toHaveTextContent('Detalle actualizado');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    act(() => vi.advanceTimersByTime(30000));
    expect(screen.getByRole('group', { name: 'Error actualizado' })).toBeInTheDocument();
  });

  it('muestra un aviso móvil a la vez y solo inicia el temporizador al pasar de la cola', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    render(<ToastProvider><button type="button">Acción de origen</button></ToastProvider>);

    act(() => {
      emitToast({ level: 'error', title: 'Error activo', message: 'Revisa los datos.' });
      emitToast({ level: 'info', title: 'Aviso en cola', message: 'El proceso terminó.', durationMs: 5000 });
    });

    expect(screen.getAllByRole('group')).toHaveLength(1);
    expect(screen.getByRole('group', { name: 'Error activo' })).toBeInTheDocument();
    expect(screen.getByText('+1 en espera', { selector: '.toast-queue-status' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(15000));
    expect(screen.queryByRole('group', { name: 'Aviso en cola' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación: Error activo' }));
    expect(screen.getByRole('group', { name: 'Aviso en cola' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4999));
    expect(screen.getByRole('group', { name: 'Aviso en cola' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('group', { name: 'Aviso en cola' })).not.toBeInTheDocument();
  });

  it('reconcilia la cola al cambiar entre ancho móvil y escritorio sin perder avisos', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    render(<ToastProvider><button type="button">Acción de origen</button></ToastProvider>);
    act(() => {
      emitToast({ level: 'error', title: 'Aviso uno', message: 'Detalle uno.' });
      emitToast({ level: 'warn', title: 'Aviso dos', message: 'Detalle dos.' });
    });
    expect(screen.getAllByRole('group')).toHaveLength(2);

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    act(() => fireEvent(window, new Event('resize')));
    expect(screen.getAllByRole('group')).toHaveLength(1);
    expect(screen.getByText('+1 en espera', { selector: '.toast-queue-status' })).toBeInTheDocument();

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    act(() => fireEvent(window, new Event('resize')));
    expect(screen.getAllByRole('group')).toHaveLength(2);
    expect(screen.queryByText(/notificación(es)? más en espera/)).not.toBeInTheDocument();
  });

  it('conserva el orden de llegada al pasar a móvil con un aviso enfocado y cola previa', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    render(<ToastProvider><button type="button">Acción de origen</button></ToastProvider>);

    act(() => {
      for (const letra of ['A', 'B', 'C', 'D', 'E']) {
        emitToast({ level: 'error', title: `Aviso ${letra}`, message: `Detalle ${letra}.` });
      }
    });
    expect(screen.getAllByRole('group')).toHaveLength(4);
    expect(screen.queryByRole('group', { name: 'Aviso E' })).not.toBeInTheDocument();

    const toastEnfocado = screen.getByRole('group', { name: 'Aviso B' });
    within(toastEnfocado).getByRole('button', { name: 'Cerrar notificación: Aviso B' }).focus();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    act(() => fireEvent(window, new Event('resize')));

    expect(screen.getAllByRole('group')).toHaveLength(1);
    expect(screen.getByRole('group', { name: 'Aviso B' })).toBeInTheDocument();
    expect(screen.getByText('+4 en espera', { selector: '.toast-queue-status' })).toBeInTheDocument();

    let avisoVisible = 'B';
    for (const siguiente of ['A', 'C', 'D', 'E']) {
      const visible = screen.getByRole('group', { name: `Aviso ${avisoVisible}` });
      fireEvent.click(within(visible).getByRole('button', { name: /^Cerrar notificación:/ }));
      expect(screen.getByRole('group', { name: `Aviso ${siguiente}` })).toBeInTheDocument();
      avisoVisible = siguiente;
    }
  });

  it('inicia el temporizador de un aviso temporal cuando sale de la cola', () => {
    render(<ToastProvider><button type="button">Acción de origen</button></ToastProvider>);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });

    act(() => {
      for (let i = 0; i < 5; i += 1) {
        emitToast({ level: 'info', title: `Aviso ${i}`, message: `Detalle ${i}`, durationMs: 5000 });
      }
    });
    expect(vi.getTimerCount()).toBe(0);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(vi.getTimerCount()).toBe(4);

    act(() => vi.advanceTimersByTime(5000));

    expect(screen.getByRole('group', { name: 'Aviso 4' })).toBeInTheDocument();
    expect(screen.getAllByRole('group')).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('reinicia la barra visual cuando se actualiza el temporizador del mismo id', () => {
    render(<ToastProvider><button type="button">Acción de origen</button></ToastProvider>);
    act(() => emitToast({ id: 'progreso', level: 'info', title: 'Carga', message: '25 %', durationMs: 5000 }));
    const toast = screen.getByRole('group', { name: 'Carga' });
    const barraInicial = toast.querySelector('.toast-life');

    act(() => vi.advanceTimersByTime(4000));
    act(() => emitToast({ id: 'progreso', level: 'info', title: 'Carga', message: '50 %', durationMs: 5000 }));

    expect(toast.querySelector('.toast-life')).not.toBe(barraInicial);
    act(() => vi.advanceTimersByTime(4999));
    expect(toast).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('group', { name: 'Carga' })).not.toBeInTheDocument();
  });

  it('limpia temporizadores y listeners al desmontarse', () => {
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<ToastProvider><button type="button">Acción de origen</button></ToastProvider>);
    act(() => emitToast({ level: 'info', title: 'Proceso', message: 'Sigue activo.' }));
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(removeListener).toHaveBeenCalledWith('app:toast', expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    removeListener.mockRestore();
  });

  it('no expone mensajes crudos de errores globales en la notificación', () => {
    const registroEventos = vi.spyOn(window, 'addEventListener');
    render(<ToastProvider><button type="button">Acción de origen</button></ToastProvider>);
    const detalleInterno = 'C:\\build\\app.js?token=secreto: línea 81';
    const errorGlobal = new Event('error');
    Object.defineProperty(errorGlobal, 'message', { value: detalleInterno });
    const rechazoGlobal = new Event('unhandledrejection');
    Object.defineProperty(rechazoGlobal, 'reason', { value: new Error(detalleInterno) });
    const escucharError = registroEventos.mock.calls.find(([tipo]) => tipo === 'error')?.[1] as EventListener;
    const escucharRechazo = registroEventos.mock.calls.find(([tipo]) => tipo === 'unhandledrejection')?.[1] as EventListener;

    act(() => {
      escucharError(errorGlobal);
      escucharRechazo(rechazoGlobal);
    });

    const alertas = screen.getAllByRole('alert');
    expect(alertas).toHaveLength(1);
    alertas.forEach((alerta) => {
      expect(alerta).toHaveTextContent('Verifica el resultado antes de repetir la acción');
      expect(alerta).not.toHaveTextContent(detalleInterno);
      expect(within(alerta).queryByText(detalleInterno)).not.toBeInTheDocument();
    });
    registroEventos.mockRestore();
  });

  it('ejecuta acciones asíncronas y retorna el foco al control de origen', async () => {
    const accion = vi.fn(async () => undefined);
    render(<ToastProvider><button type="button">Abrir actividad</button></ToastProvider>);
    const origen = screen.getByRole('button', { name: 'Abrir actividad' });
    origen.focus();
    act(() => emitToast({
      level: 'warn',
      title: 'Sesión por vencer',
      message: 'Guarda tu trabajo y continúa la sesión.',
      action: { label: 'Continuar', onClick: accion }
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await act(async () => { await Promise.resolve(); });
    expect(accion).toHaveBeenCalledOnce();
    expect(screen.queryByRole('group', { name: 'Sesión por vencer' })).not.toBeInTheDocument();
    act(() => vi.runOnlyPendingTimers());
    expect(document.activeElement).toBe(origen);
  });

  it('deshabilita las acciones mientras espera y evita invocaciones concurrentes', async () => {
    let resolver!: () => void;
    const pendiente = new Promise<void>((resolve) => { resolver = resolve; });
    const accion = vi.fn(() => pendiente);
    render(<ToastProvider><button type="button">Abrir actividad</button></ToastProvider>);
    act(() => emitToast({
      level: 'warn',
      title: 'Sesión por vencer',
      message: 'Guarda tu trabajo y continúa la sesión.',
      action: { label: 'Continuar', onClick: accion },
      secondaryAction: { label: 'Después', onClick: vi.fn() }
    }));

    const continuar = screen.getByRole('button', { name: 'Continuar' });
    const despues = screen.getByRole('button', { name: 'Después' });
    const contexto = screen.getByRole('group', { name: 'Sesión por vencer' });
    const titleId = within(contexto).getByText('Sesión por vencer').getAttribute('id');
    const messageId = within(contexto).getByText('Guarda tu trabajo y continúa la sesión.').getAttribute('id');
    expect(continuar).toHaveAttribute('aria-describedby', `${titleId} ${messageId}`);
    expect(despues).toHaveAttribute('aria-describedby', `${titleId} ${messageId}`);
    continuar.focus();
    fireEvent.click(continuar);
    fireEvent.click(continuar);

    expect(accion).toHaveBeenCalledOnce();
    expect(continuar).toHaveAttribute('aria-disabled', 'true');
    expect(despues).toHaveAttribute('aria-disabled', 'true');
    expect(continuar).toHaveTextContent('En curso…');
    expect(continuar).toHaveFocus();
    expect(screen.getByRole('group', { name: 'Sesión por vencer' })).toHaveAttribute('aria-busy', 'true');

    await act(async () => { resolver(); await pendiente; });
    expect(screen.queryByRole('group', { name: 'Sesión por vencer' })).not.toBeInTheDocument();
  });

  it('convierte el rechazo de una acción en un error persistente y controlado', async () => {
    const detalleInterno = 'C:\\build\\app.js?token=secreto: línea 81';
    const accion = vi.fn(async () => { throw new Error(detalleInterno); });
    render(<ToastProvider><button type="button">Volver al panel</button></ToastProvider>);
    act(() => emitToast({
      level: 'info',
      title: 'Sin conexión',
      message: 'Comprueba la red.',
      action: { label: 'Reintentar', onClick: accion }
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const error = screen.getByRole('group', { name: 'No se pudo completar la acción' });
    expect(error).toHaveClass('persistent');
    expect(within(error).getByText('No se pudo completar esta acción. Verifica el resultado antes de volver a intentarlo; si el problema continúa, contacta a soporte.')).toBeInTheDocument();
    expect(error).not.toHaveTextContent(detalleInterno);
    expect(accion).toHaveBeenCalledOnce();
  });

  it('no expone el mensaje arbitrario de una acción que falla sincrónicamente', () => {
    const detalleInterno = 'C:\\private\\installer\\token=secreto';
    const accion = vi.fn(() => { throw new Error(detalleInterno); });
    render(<ToastProvider><button type="button">Volver al panel</button></ToastProvider>);
    act(() => emitToast({
      level: 'info',
      title: 'Sesión por vencer',
      message: 'Renueva el acceso para continuar.',
      action: { label: 'Renovar sesión', onClick: accion },
      persistent: true
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Renovar sesión' }));

    const error = screen.getByRole('group', { name: 'No se pudo completar la acción' });
    expect(error).toHaveClass('persistent');
    expect(error).toHaveTextContent('Verifica el resultado antes de volver a intentarlo');
    expect(error).not.toHaveTextContent(detalleInterno);
    expect(accion).toHaveBeenCalledOnce();
  });
});
