import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionTemarios } from '../src/apps/app_docente/SeccionTemarios';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { emitToast } from '../src/ui/toast/toastBus';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: vi.fn(),
    enviar: vi.fn(),
    eliminar: vi.fn()
  }
}));

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

describe('SeccionTemarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite cargar temarios de un periodo y navegar entre pestañas', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({
      temarios: [
        {
          _id: 'tem-1',
          nombre: 'Matemáticas I',
          totalNodos: 5,
          porcentajeAvance: 40,
          createdAt: new Date().toISOString()
        }
      ]
    });

    render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'per-1' } });

    await waitFor(() => {
      expect(screen.getByText('Matemáticas I')).toBeInTheDocument();
    });

    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('permite la carga manual de un temario y abre la vista de árbol', async () => {
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({ temarios: [] })
      .mockResolvedValueOnce({
        nodos: [
          { _id: 'n-1', numero: '1', nivel: 1, titulo: 'Unidad 1', estado: 'pendiente' },
          { _id: 'n-2', numero: '1.1', nivel: 2, titulo: 'Tema 1.1', estado: 'cubierto', cubiertaEn: new Date().toISOString() }
        ]
      });

    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({
      temario: {
        _id: 'tem-2',
        nombre: 'Física',
        totalNodos: 2,
        porcentajeAvance: 50,
        createdAt: new Date().toISOString()
      },
      totalNodos: 2
    });

    render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });

    // Ir a pestaña cargar
    const tabCargar = screen.getByRole('button', { name: /Cargar temario/i });
    fireEvent.click(tabCargar);

    // Input nombre temario manual
    const inputs = screen.getAllByPlaceholderText(/Nombre del temario/i);
    fireEvent.change(inputs[1], { target: { value: 'Física' } });

    // Textarea contenido manual
    const textarea = screen.getByPlaceholderText(/1 Introducción/i);
    fireEvent.change(textarea, { target: { value: '1 Unidad 1\n1.1 Tema 1.1' } });

    const btnCrear = screen.getByRole('button', { name: /Crear temario/i });
    fireEvent.click(btnCrear);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/temarios/manual', expect.objectContaining({
        nombre: 'Física',
        periodoId: 'per-1'
      }));
    });
  });

  it('permite ciclar el estado de un nodo en el árbol de temas', async () => {
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({
        temarios: [
          { _id: 'tem-1', nombre: 'Álgebra', totalNodos: 1, porcentajeAvance: 0, createdAt: new Date().toISOString() }
        ]
      })
      .mockResolvedValueOnce({
        nodos: [
          { _id: 'n-1', numero: '1', nivel: 1, titulo: 'Unidad 1', estado: 'pendiente' }
        ]
      });

    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({
      nodo: { _id: 'n-1', numero: '1', nivel: 1, titulo: 'Unidad 1', estado: 'en_progreso' },
      porcentajeAvance: 50
    });

    render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });

    const temarioCard = await screen.findByText('Álgebra');
    fireEvent.click(temarioCard);

    const nodoItem = await screen.findByText(/Unidad 1/i);
    fireEvent.click(nodoItem);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith(
        '/temarios/nodos/n-1/estado',
        { estado: 'en_progreso' }
      );
    });
  });

  it('permite subir un archivo PDF para extraer el temario', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({ temarios: [] });
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({
      temario: { _id: 'tem-pdf', nombre: 'Química', totalNodos: 4, porcentajeAvance: 0, createdAt: new Date().toISOString() },
      totalNodos: 4
    });

    render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });

    fireEvent.click(screen.getByRole('button', { name: /Cargar temario/i }));

    const dropBox = screen.getByText(/Arrastra tu PDF aquí/i);
    const pdfFile = new File(['%PDF-1.4 dummy'], 'Química.pdf', { type: 'application/pdf' });

    fireEvent.drop(dropBox, {
      dataTransfer: { files: [pdfFile] }
    });

    await screen.findByText(/Química\.pdf/i);

    const btnSubir = screen.getByRole('button', { name: /Cargar PDF/i });
    fireEvent.click(btnSubir);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/temarios/pdf', expect.objectContaining({
        periodoId: 'per-1'
      }));
    });
  });

  it('rechaza archivos que no sean PDF y maneja errores del servidor', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({ temarios: [] });
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('PDF corrupto'));

    render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });

    fireEvent.click(screen.getByRole('button', { name: /Cargar temario/i }));

    const dropBox = screen.getByText(/Arrastra tu PDF aquí/i);

    // Intentar archivo de texto (invalido)
    const txtFile = new File(['hola'], 'test.txt', { type: 'text/plain' });
    fireEvent.drop(dropBox, { dataTransfer: { files: [txtFile] } });

    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'warn', title: 'Archivo inválido' })
    );

    // Subir archivo PDF valido pero que falla en el backend
    const pdfFile = new File(['%PDF'], 'fallo.pdf', { type: 'application/pdf' });
    fireEvent.drop(dropBox, { dataTransfer: { files: [pdfFile] } });

    const btnSubir = screen.getByRole('button', { name: /Cargar PDF/i });
    fireEvent.click(btnSubir);

    await waitFor(() => {
      expect(emitToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', message: 'PDF corrupto' })
      );
    });
  });
});

