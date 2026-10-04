import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('previsualiza y sube portada al crear la materia', async () => {
    const enviarConPermiso = vi.fn(async () => ({ periodo: { _id: 'periodo-nuevo' } }));
    renderSeccion({ enviarConPermiso });
    fireEvent.click(screen.getByRole('button', { name: /Mostrar formulario/i }));
    fireEvent.change(screen.getByLabelText('Nombre de la materia'), { target: { value: 'Materia de prueba' } });
    fireEvent.change(screen.getByLabelText('Fecha inicio'), { target: { value: '2026-09-28' } });
    fireEvent.change(screen.getByLabelText('Fecha fin'), { target: { value: '2026-11-06' } });
    const file = new File(['imagen'], 'portada.webp', { type: 'image/webp' });
    fireEvent.change(screen.getByLabelText('Seleccionar portada para la nueva materia'), { target: { files: [file] } });
    expect(screen.getByAltText('Vista previa de la portada seleccionada')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Crear materia' }));
    await waitFor(() => expect(enviarConPermiso).toHaveBeenCalledOnce());
    await waitFor(() => expect(api.actualizarFormData).toHaveBeenCalledOnce());
    expect(api.actualizarFormData).toHaveBeenCalledWith('/periodos/periodo-nuevo/portada', expect.any(FormData));
    expect(await screen.findByRole('status')).toHaveTextContent('Materia creada');
  });

  it('permite reintentar la portada si la materia se creó pero falló la carga', async () => {
    api.actualizarFormData.mockRejectedValueOnce(new Error('API sin conexión')).mockResolvedValueOnce({ ok: true });
    const enviarConPermiso = vi.fn(async () => ({ periodo: { _id: 'periodo-nuevo' } }));
    renderSeccion({ enviarConPermiso });
    fireEvent.click(screen.getByRole('button', { name: /Mostrar formulario/i }));
    fireEvent.change(screen.getByLabelText('Nombre de la materia'), { target: { value: 'Materia de prueba' } });
    fireEvent.change(screen.getByLabelText('Fecha inicio'), { target: { value: '2026-09-28' } });
    fireEvent.change(screen.getByLabelText('Fecha fin'), { target: { value: '2026-11-06' } });
    fireEvent.change(screen.getByLabelText('Seleccionar portada para la nueva materia'), {
      target: { files: [new File(['imagen'], 'portada.webp', { type: 'image/webp' })] }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear materia' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Materia creada; no se pudo guardar la portada');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar portada' }));
    await waitFor(() => expect(api.actualizarFormData).toHaveBeenCalledTimes(2));
    expect(enviarConPermiso).toHaveBeenCalledOnce();
    expect(await screen.findByRole('status')).toHaveTextContent('Portada guardada');
  });

  it('administra y muestra una portada; conserva fallback al retirarla', async () => {
    const periodo = { _id: 'periodo-1', nombre: 'Materia con portada', grupos: ['23A'], tienePortada: true };
    const { container } = renderSeccion({ periodos: [periodo] });
    await waitFor(() => expect(api.obtenerBinario).toHaveBeenCalledWith('/periodos/periodo-1/portada'));
    const tarjeta = screen.getByRole('button', { name: /Abrir grupo 23A de Materia con portada/i });
    await waitFor(() => expect(tarjeta.querySelector('.materia-avatar__imagen')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Mostrar acciones/i }));
    fireEvent.change(screen.getByLabelText('Seleccionar imagen de portada para Materia con portada (ID: eriodo-1)'), {
      target: { files: [new File(['imagen'], 'nueva.png', { type: 'image/png' })] }
    });
    expect(screen.getByAltText('Vista previa de la portada seleccionada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Guardar portada para Materia con portada/i }));
    await waitFor(() => expect(api.actualizarFormData).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole('button', { name: /Retirar portada de Materia con portada/i }));
    await waitFor(() => expect(api.eliminar).toHaveBeenCalledWith('/periodos/periodo-1/portada'));
    expect(container.querySelector('.materia-avatar__imagen')).toBeInTheDocument();

    const sinPortada = renderSeccion({ periodos: [{ _id: 'periodo-2', nombre: 'Materia genérica', grupos: ['23A'], tienePortada: false }] });
    expect(sinPortada.container.querySelector('.materia-avatar .icono')).toBeInTheDocument();
  });
});
