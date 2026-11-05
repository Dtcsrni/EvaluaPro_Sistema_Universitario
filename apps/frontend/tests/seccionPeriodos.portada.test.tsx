import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeccionPeriodos } from '../src/apps/app_docente/SeccionPeriodos';
import type { PermisosUI } from '../src/apps/app_docente/tipos';

const api = vi.hoisted(() => ({
  actualizarFormData: vi.fn(),
  eliminar: vi.fn(),
  obtenerBinario: vi.fn(),
  registrarEventosUso: vi.fn()
}));

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({ clienteApi: api }));

const permisos: PermisosUI = {
  periodos: { leer: true, gestionar: true, archivar: true },
  alumnos: { leer: true, gestionar: true },
  banco: { leer: true, gestionar: true, archivar: true },
  plantillas: { leer: true, gestionar: true, archivar: true, previsualizar: true },
  examenes: { leer: true, generar: true, archivar: true, regenerar: true, descargar: true },
  entregas: { gestionar: true },
  omr: { analizar: true },
  calificaciones: { calificar: true },
  publicar: { publicar: true },
  sincronizacion: { listar: true, exportar: true, importar: true, push: true, pull: true },
  cuenta: { leer: true, actualizar: true }
};

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

function renderSeccion(overrides: Record<string, unknown> = {}) {
  return render(
    <SeccionPeriodos
      periodos={[]}
      onRefrescar={vi.fn()}
      onVerArchivadas={vi.fn()}
      permisos={permisos}
      puedeEliminarMateriaDev={false}
      enviarConPermiso={vi.fn(async () => ({ periodo: { _id: 'periodo-nuevo' } }))}
      avisarSinPermiso={vi.fn()}
      {...overrides}
    />
  );
}

describe('SeccionPeriodos portada', () => {
  beforeEach(() => {
    api.actualizarFormData.mockReset().mockResolvedValue({ ok: true });
    api.eliminar.mockReset().mockResolvedValue({ ok: true });
    api.obtenerBinario.mockReset().mockResolvedValue({ blob: async () => new Blob(['webp'], { type: 'image/webp' }) });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:portada-test') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  afterEach(() => {
    if (originalCreateObjectURL) Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL });
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (originalRevokeObjectURL) Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('permite enviar el alta de materia con Enter cuando los campos obligatorios son válidos', async () => {
    const user = userEvent.setup();
    const enviarConPermiso = vi.fn(async () => ({ periodo: { _id: 'periodo-nuevo' } }));
    renderSeccion({ enviarConPermiso });
    await user.click(screen.getByRole('button', { name: /Mostrar formulario/i }));
    expect(screen.getByRole('form', { name: 'Nueva materia' })).toHaveAttribute('aria-describedby', 'nueva-materia-instrucciones');
    await user.type(screen.getByLabelText('Nombre de la materia'), 'Materia de prueba');
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-09-28' } });
    fireEvent.change(screen.getByLabelText('Fecha de término'), { target: { value: '2026-11-06' } });
    await user.type(screen.getByLabelText('Grupos asignados (opcional)'), '1A');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(enviarConPermiso).toHaveBeenCalledOnce());
    expect(enviarConPermiso).toHaveBeenCalledWith(
      'periodos:gestionar',
      '/periodos',
      { nombre: 'Materia de prueba', fechaInicio: '2026-09-28', fechaFin: '2026-11-06', grupos: ['1A'] },
      'No tienes permiso para registrar materias.'
    );
  });

  it('previsualiza y sube portada al crear la materia', async () => {
    const enviarConPermiso = vi.fn(async () => ({ periodo: { _id: 'periodo-nuevo' } }));
    const avisos: unknown[] = [];
    const recibirAviso = (event: Event) => avisos.push((event as CustomEvent).detail);
    window.addEventListener('app:toast', recibirAviso);
    renderSeccion({ enviarConPermiso });
    fireEvent.click(screen.getByRole('button', { name: /Mostrar formulario/i }));
    fireEvent.change(screen.getByLabelText('Nombre de la materia'), { target: { value: 'Materia de prueba' } });
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-09-28' } });
    fireEvent.change(screen.getByLabelText('Fecha de término'), { target: { value: '2026-11-06' } });
    const file = new File(['imagen'], 'portada.webp', { type: 'image/webp' });
    const selectorPortadaNueva = screen.getByLabelText('Portada (opcional)');
    expect(selectorPortadaNueva).toHaveAccessibleName('Portada (opcional)');
    expect(selectorPortadaNueva).toHaveAccessibleDescription(/JPG\/JPEG, PNG o WebP; máximo 20 MiB/);
    fireEvent.change(selectorPortadaNueva, { target: { files: [file] } });
    expect(screen.getByAltText('Vista previa de la portada seleccionada')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Crear materia' }));
    await waitFor(() => expect(enviarConPermiso).toHaveBeenCalledOnce());
    await waitFor(() => expect(api.actualizarFormData).toHaveBeenCalledOnce());
    expect(api.actualizarFormData).toHaveBeenCalledWith('/periodos/periodo-nuevo/portada', expect.any(FormData));
    expect(await screen.findByText('Materia creada', { selector: '[role="status"]' })).toBeInTheDocument();
    expect(avisos).toHaveLength(0);
    window.removeEventListener('app:toast', recibirAviso);
  });

  it('asocia el error de formato de portada al selector del formulario de alta', () => {
    renderSeccion();
    fireEvent.click(screen.getByRole('button', { name: /Mostrar formulario/i }));
    const selector = screen.getByLabelText('Portada (opcional)');
    fireEvent.change(selector, {
      target: { files: [new File(['svg'], 'portada.svg', { type: 'image/svg+xml' })] }
    });

    expect(selector).toHaveAttribute('aria-invalid', 'true');
    expect(selector).toHaveAccessibleDescription(/JPG\/JPEG, PNG o WebP; máximo 20 MiB.*Selecciona una imagen JPG\/JPEG, PNG o WebP/);
    expect(screen.getByRole('alert')).toHaveTextContent('Selecciona una imagen JPG/JPEG, PNG o WebP.');
  });

  it('permite reintentar la portada si la materia se creó pero falló la carga', async () => {
    api.actualizarFormData.mockRejectedValueOnce(new Error('API sin conexión')).mockResolvedValueOnce({ ok: true });
    const enviarConPermiso = vi.fn(async () => ({ periodo: { _id: 'periodo-nuevo' } }));
    const avisos: unknown[] = [];
    const recibirAviso = (event: Event) => avisos.push((event as CustomEvent).detail);
    window.addEventListener('app:toast', recibirAviso);
    renderSeccion({ enviarConPermiso });
    fireEvent.click(screen.getByRole('button', { name: /Mostrar formulario/i }));
    fireEvent.change(screen.getByLabelText('Nombre de la materia'), { target: { value: 'Materia de prueba' } });
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-09-28' } });
    fireEvent.change(screen.getByLabelText('Fecha de término'), { target: { value: '2026-11-06' } });
    fireEvent.change(screen.getByLabelText('Portada (opcional)'), {
      target: { files: [new File(['imagen'], 'portada.webp', { type: 'image/webp' })] }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear materia' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Materia creada; no se pudo guardar la portada');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar portada' }));
    await waitFor(() => expect(api.actualizarFormData).toHaveBeenCalledTimes(2));
    expect(enviarConPermiso).toHaveBeenCalledOnce();
    expect(await screen.findByText('Portada guardada', { selector: '[role="status"]' })).toBeInTheDocument();
    expect(avisos).toHaveLength(0);
    window.removeEventListener('app:toast', recibirAviso);
  });

  it('administra y muestra una portada; conserva fallback al retirarla', async () => {
    const periodo = { _id: 'periodo-1', nombre: 'Materia con portada', grupos: ['23A'], tienePortada: true };
    const { container } = renderSeccion({ periodos: [periodo] });
    await waitFor(() => expect(api.obtenerBinario).toHaveBeenCalledWith('/periodos/periodo-1/portada'));
    const tarjeta = screen.getByRole('button', { name: /Abrir grupo 23A de Materia con portada/i });
    await waitFor(() => expect(tarjeta.querySelector('.materia-avatar__imagen')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Mostrar acciones/i }));
    const selectorPortadaExistente = screen.getByLabelText('Seleccionar imagen de portada para Materia con portada');
    expect(screen.getByText('Portada actual. Elige una imagen para reemplazarla.')).toHaveAttribute('role', 'status');
    expect(selectorPortadaExistente).toHaveAccessibleDescription('Portada actual. Elige una imagen para reemplazarla. JPG/JPEG, PNG o WebP; máximo 20 MiB.');
    fireEvent.change(selectorPortadaExistente, {
      target: { files: [new File(['imagen'], 'nueva.png', { type: 'image/png' })] }
    });
    expect(screen.getByText('nueva.png', { selector: '[role="status"]' })).toBeInTheDocument();
    expect(selectorPortadaExistente).toHaveAccessibleDescription('nueva.png JPG/JPEG, PNG o WebP; máximo 20 MiB.');
    expect(screen.getByAltText('Vista previa de la portada seleccionada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Guardar portada para Materia con portada/i }));
    await waitFor(() => expect(api.actualizarFormData).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole('button', { name: /Retirar portada de Materia con portada/i }));
    await waitFor(() => expect(api.eliminar).toHaveBeenCalledWith('/periodos/periodo-1/portada'));
    expect(container.querySelector('.materia-avatar__imagen')).toBeInTheDocument();

    const sinPortada = renderSeccion({ periodos: [{ _id: 'periodo-2', nombre: 'Materia genérica', grupos: ['23A'], tienePortada: false }] });
    expect(sinPortada.container.querySelector('.materia-avatar .icono')).toBeInTheDocument();
  });

  it('asocia errores de selección y no invalida el campo cuando falla la red al guardar', async () => {
    api.actualizarFormData.mockRejectedValueOnce(new Error('API sin conexión'));
    renderSeccion({ periodos: [{ _id: 'periodo-3', nombre: 'Materia de red', grupos: ['1A'], tienePortada: false }] });
    fireEvent.click(screen.getByRole('button', { name: /Mostrar acciones/i }));
    const selector = screen.getByLabelText('Seleccionar imagen de portada para Materia de red');

    fireEvent.change(selector, {
      target: { files: [new File(['svg'], 'portada.svg', { type: 'image/svg+xml' })] }
    });
    expect(selector).toHaveAttribute('aria-invalid', 'true');
    expect(selector).toHaveAccessibleDescription(/Ningún archivo seleccionado JPG\/JPEG, PNG o WebP; máximo 20 MiB\. Selecciona una imagen JPG\/JPEG, PNG o WebP/);

    fireEvent.change(selector, {
      target: { files: [new File(['png'], 'portada.png', { type: 'image/png' })] }
    });
    expect(selector).not.toHaveAttribute('aria-invalid');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar portada para Materia de red' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('API sin conexión');
    expect(selector).not.toHaveAttribute('aria-invalid');
    expect(selector).toHaveAccessibleDescription('portada.png JPG/JPEG, PNG o WebP; máximo 20 MiB.');
  });
});
