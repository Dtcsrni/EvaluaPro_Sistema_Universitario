/**
 * seccionTemarios.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionTemarios } from '../src/apps/app_docente/SeccionTemarios';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { emitToast } from '../src/ui/toast/toastBus';
import { ErrorRemoto } from '../src/servicios_api/clienteComun';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: vi.fn(),
    enviar: vi.fn(),
    actualizar: vi.fn(),
    enviarFormData: vi.fn(),
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

  it('mantiene el nombre de sección claro sin repetir el icono principal del encabezado', () => {
    render(<SeccionTemarios periodos={[]} />);

    const heading = screen.getByRole('heading', { level: 2, name: 'Temarios' });
    expect(heading.querySelector('svg')).toBeNull();
    expect(document.querySelector('.temarios-panel__icon-orb svg')).toBeInTheDocument();
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

    expect(screen.getByRole('status')).toHaveTextContent('Elige una materia');

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'per-1' } });

    await waitFor(() => {
      expect(screen.getByText('Matemáticas I')).toBeInTheDocument();
    });

    expect(screen.getByRole('status')).toHaveTextContent('Periodo actualizado');
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('mantiene asociada cada pestaña con su panel al cambiar de vista', async () => {
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({
        temarios: [
          { _id: 'tem-tabs', nombre: 'Historia', totalNodos: 1, porcentajeAvance: 0, createdAt: new Date().toISOString() }
        ]
      })
      .mockResolvedValueOnce({ nodos: [] });

    render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);

    const comprobarAsociaciones = () => {
      screen.getAllByRole('tab').forEach((tab) => {
        const panelId = tab.getAttribute('aria-controls');
        expect(panelId).toBeTruthy();
        const panel = document.getElementById(panelId!);
        expect(panel).toHaveAttribute('role', 'tabpanel');
        expect(panel).toHaveAttribute('aria-labelledby', tab.id);
      });
    };

    comprobarAsociaciones();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });
    fireEvent.click(await screen.findByRole('button', { name: /Abrir temario Historia/i }));
    await screen.findByRole('tab', { name: /Historia \(0%\)/i });
    comprobarAsociaciones();

    fireEvent.click(screen.getByRole('tab', { name: /Mis temarios/i }));
    comprobarAsociaciones();
  });

  it('permite la carga manual de un temario y abre la vista de árbol', async () => {
    const user = userEvent.setup();
    const temario = {
      _id: 'tem-2',
      nombre: 'Física',
      totalNodos: 2,
      porcentajeAvance: 50,
      createdAt: new Date().toISOString()
    };
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({ temarios: [] })
      .mockResolvedValueOnce({ temarios: [temario] })
      .mockResolvedValueOnce({ temario, nodos: [
          { _id: 'n-1', numero: '1', nivel: 1, titulo: 'Unidad 1', estado: 'pendiente' },
          { _id: 'n-2', numero: '1.1', nivel: 2, titulo: 'Tema 1.1', estado: 'cubierto', cubiertaEn: new Date().toISOString() }
      ] });

    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({
      temario,
      totalNodos: 2
    });

    render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });

    // Ir a pestaña cargar
    const tabCargar = screen.getByRole('tab', { name: /Cargar temario/i });
    fireEvent.click(tabCargar);
    const formulario = screen.getByRole('form', { name: 'Carga manual de temario' });

    // Input nombre temario manual
    fireEvent.change(within(formulario).getByRole('textbox', { name: 'Nombre del temario' }), { target: { value: 'Física' } });

    // Textarea contenido manual
    const textarea = screen.getByRole('textbox', { name: 'Contenido del temario' });
    fireEvent.change(textarea, { target: { value: '1 Unidad 1\n1.1 Tema 1.1' } });

    const btnCrear = screen.getByRole('button', { name: /Crear temario/i });
    expect(btnCrear).toBeEnabled();
    expect(formulario).toHaveAttribute('novalidate');
    await user.click(within(formulario).getByRole('textbox', { name: 'Nombre del temario' }));
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/temarios/manual', expect.objectContaining({
        nombre: 'Física',
        periodoId: 'per-1'
      }));
    });
    expect(await screen.findByRole('tab', { name: /Física \(50%\)/i })).toBeInTheDocument();
    expect(screen.getByText('Unidad 1')).toBeInTheDocument();
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({
      level: 'ok',
      title: 'Temario cargado'
    }));
  });

  it('muestra el error de captura manual solo en el formulario que lo originó', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({ temarios: [] });
    render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });
    fireEvent.click(screen.getByRole('tab', { name: /Cargar temario/i }));
    fireEvent.click(screen.getByRole('button', { name: /Crear temario/i }));

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(/completa el nombre y contenido/i);
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Datos incompletos' }));
  });

  it('presenta el fallo al guardar manualmente junto al formulario y conserva un mensaje útil', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({ temarios: [] });
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('Conflicto temporal de guardado'));

    const user = userEvent.setup();
    render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Periodo o materia' }), 'per-1');
    await user.click(screen.getByRole('tab', { name: /Cargar temario/i }));
    const formulario = screen.getByRole('form', { name: 'Carga manual de temario' });
    await user.type(within(formulario).getByRole('textbox', { name: 'Nombre del temario' }), 'Ecología');
    await user.type(within(formulario).getByRole('textbox', { name: 'Contenido del temario' }), '1 Ecosistemas');
    await user.click(within(formulario).getByRole('button', { name: 'Crear temario' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo guardar el temario: Conflicto temporal de guardado.*Revisa los datos e inténtalo de nuevo/i);
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'error', title: 'Error' }));
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

    const nodoItem = await screen.findByRole('button', { name: /Unidad 1\. Estado: Pendiente/i });
    ['✅', '🔄', '🌳'].forEach((glifo) => {
      expect(nodoItem.textContent).not.toContain(glifo);
    });
    fireEvent.click(nodoItem);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith(
        '/temarios/nodos/n-1/estado',
        { estado: 'en_progreso' }
      );
    });
    expect(await screen.findByRole('button', { name: /Unidad 1\. Estado: En progreso/i })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Avance de Álgebra' })).toHaveAttribute('aria-valuenow', '50');
  });

  it('permite subir un archivo PDF para extraer el temario', async () => {
    const user = userEvent.setup();
    const temario = { _id: 'tem-pdf', nombre: 'Química', totalNodos: 4, porcentajeAvance: 0, createdAt: new Date().toISOString() };
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({ temarios: [] })
      .mockResolvedValueOnce({ temarios: [temario] })
      .mockResolvedValueOnce({ temario, nodos: [{ _id: 'n-pdf', numero: '1', nivel: 1, titulo: 'Enlaces químicos', estado: 'pendiente' }] });
    vi.mocked(clienteApi.enviarFormData).mockResolvedValueOnce({
      temario,
      totalNodos: 4
    });

    const { container } = render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });

    fireEvent.click(screen.getByRole('tab', { name: /Cargar temario/i }));

    const dropBox = () => container.querySelector('.temarios-upload-box') as HTMLElement;
    expect(screen.getByRole('button', { name: 'Seleccionar archivo PDF' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Archivo PDF' })).toHaveTextContent('Ningún archivo seleccionado.');
    const nativeFileInput = container.querySelector<HTMLInputElement>('#temarios-archivo-pdf')!;
    const openNativePicker = vi.spyOn(nativeFileInput, 'click');
    await user.click(screen.getByRole('button', { name: 'Seleccionar archivo PDF' }));
    expect(openNativePicker).toHaveBeenCalledOnce();
    const pdfFile = new File(['%PDF-1.4 dummy'], 'Química.pdf', { type: 'application/pdf' });

    fireEvent.drop(dropBox(), {
      dataTransfer: { files: [pdfFile] }
    });

    const archivoPdfStatus = await screen.findByRole('status', { name: /Archivo seleccionado: Química\.pdf/i });
    expect(archivoPdfStatus).toHaveTextContent('(menos de 1 KB).');
    expect(container.querySelector('.temarios-file-pill .nota')).toHaveTextContent('(menos de 1 KB)');
    expect(screen.getByRole('button', { name: 'Cambiar archivo PDF' })).toBeInTheDocument();

    const btnSubir = screen.getByRole('button', { name: /Cargar PDF/i });
    expect(btnSubir).toBeEnabled();
    const formulario = screen.getByRole('form', { name: 'Carga de temario desde PDF' });
    expect(formulario).toHaveAttribute('novalidate');
    await user.click(within(formulario).getByRole('textbox', { name: 'Nombre del temario' }));
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(clienteApi.enviarFormData).toHaveBeenCalledWith('/temarios/desde-pdf', expect.any(FormData));
    });
    expect(await screen.findByRole('tab', { name: /Química \(0%\)/i })).toBeInTheDocument();
    expect(screen.getByText('Enlaces químicos')).toBeInTheDocument();
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({
      level: 'ok',
      title: 'Temario procesado'
    }));
  });

  it('acepta extensión PDF si el navegador no determina el MIME y conserva nombre y bytes', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({ temarios: [] });
    vi.mocked(clienteApi.enviarFormData).mockRejectedValueOnce(new Error('PDF dummy sin estructura procesable'));

    const { container } = render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });
    fireEvent.click(screen.getByRole('tab', { name: /Cargar temario/i }));

    const contenido = '%PDF-1.7 contenido dummy';
    const pdfConMimeIndeterminado = new File([contenido], 'Programa.PDF', { type: '' });
    const dropBox = container.querySelector('.temarios-upload-box') as HTMLElement;
    fireEvent.drop(dropBox, { dataTransfer: { files: [pdfConMimeIndeterminado] } });

    expect(await screen.findByRole('status', { name: /Archivo seleccionado: Programa\.PDF/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cargar PDF/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/PDF dummy sin estructura procesable/i);

    const formData = vi.mocked(clienteApi.enviarFormData).mock.calls[0]?.[1];
    const archivoEnviado = formData?.get('archivo');
    expect(archivoEnviado).toBeInstanceOf(File);
    expect((archivoEnviado as File).name).toBe('Programa.PDF');
    expect((archivoEnviado as File).type).toBe('application/pdf');
    expect(await (archivoEnviado as File).text()).toBe(contenido);
  });

  it('permite editar un temario conservando su versión leída y deja motivo de cambio', async () => {
    const updatedAt = '2026-09-28T05:00:00.000Z';
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({ temarios: [{ _id: 'tem-1', nombre: 'Biología', totalNodos: 1, porcentajeAvance: 0, createdAt: updatedAt, updatedAt }] })
      .mockResolvedValueOnce({
        temario: { _id: 'tem-1', nombre: 'Biología', textoOriginal: '1 Célula', totalNodos: 1, porcentajeAvance: 0, updatedAt },
        nodos: [{ _id: 'n-1', numero: '1', nivel: 1, titulo: 'Célula', estado: 'pendiente' }]
      })
      .mockResolvedValueOnce({ temarios: [] })
      .mockResolvedValueOnce({
        temario: { _id: 'tem-1', nombre: 'Biología celular', textoOriginal: '1 Célula revisada', totalNodos: 1, porcentajeAvance: 0, updatedAt: '2026-09-28T05:05:00.000Z' },
        nodos: [{ _id: 'n-1', numero: '1', nivel: 1, titulo: 'Célula revisada', estado: 'pendiente' }]
      });
    vi.mocked(clienteApi.actualizar).mockResolvedValueOnce({
      temario: { _id: 'tem-1', nombre: 'Biología celular', textoOriginal: '1 Célula revisada', totalNodos: 1, porcentajeAvance: 0, updatedAt: '2026-09-28T05:05:00.000Z' },
      nodos: [{ _id: 'n-1', numero: '1', nivel: 1, titulo: 'Célula revisada', estado: 'pendiente' }]
    });

    render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });
    fireEvent.click(await screen.findByText('Biología'));
    fireEvent.click(await screen.findByRole('button', { name: 'Editar temario' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre del temario' }), { target: { value: 'Biología celular' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Contenido del temario' }), { target: { value: '1 Célula revisada' } });
    fireEvent.change(screen.getByLabelText('Motivo del cambio'), { target: { value: 'Precisión curricular' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(clienteApi.actualizar).toHaveBeenCalledWith('/temarios/tem-1', {
        nombre: 'Biología celular', texto: '1 Célula revisada', expectedUpdatedAt: updatedAt, motivoCambio: 'Precisión curricular'
      });
    });
    expect(await screen.findByText('Célula revisada')).toBeInTheDocument();
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({
      level: 'ok',
      title: 'Temario actualizado'
    }));
  });

  it('solicita confirmación y motivo antes de eliminar un temario sin historial', async () => {
    const updatedAt = '2026-09-28T05:00:00.000Z';
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({ temarios: [{ _id: 'tem-1', nombre: 'Borrador', totalNodos: 1, porcentajeAvance: 0, createdAt: updatedAt, updatedAt }] })
      .mockResolvedValueOnce({
        temario: { _id: 'tem-1', nombre: 'Borrador', textoOriginal: '1 Unidad', totalNodos: 1, porcentajeAvance: 0, updatedAt },
        nodos: [{ _id: 'n-1', numero: '1', nivel: 1, titulo: 'Unidad', estado: 'pendiente' }]
      });
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({ ok: true });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'prompt').mockReturnValue('Borrador duplicado');

    render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });
    fireEvent.click(await screen.findByText('Borrador'));
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar temario' }));

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/temarios/tem-1/eliminar', {
        confirmarEliminacion: true,
        expectedUpdatedAt: updatedAt,
        motivoCambio: 'Borrador duplicado'
      });
    });
  });

  it('no muestra errores técnicos crudos al fallar la eliminación', async () => {
    const updatedAt = '2026-09-28T05:00:00.000Z';
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({ temarios: [{ _id: 'tem-1', nombre: 'Borrador', totalNodos: 1, porcentajeAvance: 0, createdAt: updatedAt, updatedAt }] })
      .mockResolvedValueOnce({
        temario: { _id: 'tem-1', nombre: 'Borrador', textoOriginal: '1 Unidad', totalNodos: 1, porcentajeAvance: 0, updatedAt },
        nodos: [{ _id: 'n-1', numero: '1', nivel: 1, titulo: 'Unidad', estado: 'pendiente' }]
      });
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('TypeError: SQLITE_BUSY at C:\\private\\temarios.db'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'prompt').mockReturnValue('Error del servidor');

    render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });
    fireEvent.click(await screen.findByText('Borrador'));
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar temario' }));

    await waitFor(() => {
      expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({
        level: 'error',
        title: 'No se pudo eliminar',
        message: 'No se pudo eliminar el temario. Revisa la conexión e inténtalo de nuevo.'
      }));
    });
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('SQLITE_BUSY') }));
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('private\\temarios.db') }));
  });

  it('ofrece cerrar sesión si la eliminación falla por sesión vencida', async () => {
    const updatedAt = '2026-09-28T05:00:00.000Z';
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({ temarios: [{ _id: 'tem-1', nombre: 'Borrador', totalNodos: 1, porcentajeAvance: 0, createdAt: updatedAt, updatedAt }] })
      .mockResolvedValueOnce({
        temario: { _id: 'tem-1', nombre: 'Borrador', textoOriginal: '1 Unidad', totalNodos: 1, porcentajeAvance: 0, updatedAt },
        nodos: [{ _id: 'n-1', numero: '1', nivel: 1, titulo: 'Unidad', estado: 'pendiente' }]
      });
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new ErrorRemoto('Sesión vencida', { status: 401 }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'prompt').mockReturnValue('Error del servidor');

    render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });
    fireEvent.click(await screen.findByText('Borrador'));
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar temario' }));

    await waitFor(() => {
      expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({
        level: 'error',
        title: 'No se pudo eliminar',
        message: 'Tu sesión venció. Cierra sesión y vuelve a ingresar.',
        action: expect.objectContaining({ label: 'Cerrar sesión' })
      }));
    });
  });

  it('rechaza archivos que no sean PDF y maneja errores del servidor', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({ temarios: [] });
    vi.mocked(clienteApi.enviarFormData).mockRejectedValueOnce(new Error('PDF corrupto'));

    const { container } = render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });

    fireEvent.click(screen.getByRole('tab', { name: /Cargar temario/i }));

    const dropBox = () => container.querySelector('.temarios-upload-box') as HTMLElement;

    const pdfAnterior = new File(['%PDF-1.4'], 'anterior.pdf', { type: 'application/pdf' });
    fireEvent.drop(dropBox(), { dataTransfer: { files: [pdfAnterior] } });
    expect(await screen.findByRole('status', { name: /Archivo seleccionado: anterior\.pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cargar PDF/i })).toBeEnabled();

    // Un archivo inválido no debe dejar seleccionable el PDF anterior.
    const txtFile = new File(['hola'], 'test.txt', { type: 'text/plain' });
    fireEvent.drop(dropBox(), { dataTransfer: { files: [txtFile] } });

    expect(screen.getByRole('alert')).toHaveTextContent(/no es un PDF/i);
    expect(screen.queryByRole('status', { name: /Archivo seleccionado: anterior\.pdf/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cargar PDF/i })).toBeDisabled();
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Archivo inválido' }));

    // Subir archivo PDF valido pero que falla en el backend
    const pdfFile = new File(['%PDF'], 'fallo.pdf', { type: 'application/pdf' });
    fireEvent.drop(dropBox(), { dataTransfer: { files: [pdfFile] } });

    const btnSubir = screen.getByRole('button', { name: /Cargar PDF/i });
    fireEvent.click(btnSubir);

    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo procesar el PDF: PDF corrupto/i);
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'error', message: 'PDF corrupto' }));
  });

  it('mantiene el error de actualización del nodo junto al árbol sin repetirlo en toast', async () => {
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({ temarios: [{ _id: 'tem-error', nombre: 'Biología', totalNodos: 1, porcentajeAvance: 0 }] })
      .mockResolvedValueOnce({ nodos: [{ _id: 'n-error', numero: '1', nivel: 1, titulo: 'Célula', estado: 'pendiente' }] });
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('Conflicto temporal'));

    render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });
    fireEvent.click(await screen.findByRole('button', { name: /Abrir temario Biología/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Célula\. Estado: Pendiente/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo actualizar el estado de «Célula»/i);
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'error', message: 'No se pudo actualizar.' }));
  });

  it('muestra el fallo al listar y permite reintentar sin perder el periodo', async () => {
    vi.mocked(clienteApi.obtener)
      .mockRejectedValueOnce(new Error('sin conexión'))
      .mockResolvedValueOnce({ temarios: [{ _id: 'tem-retry', nombre: 'Reintento', totalNodos: 1, porcentajeAvance: 0 }] });

    render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/Reintenta la consulta/i);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No se pudo consultar'));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: /Abrir temario Reintento/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Periodo actualizado');
  });

  it('muestra y permite reintentar un error al abrir un temario desde la lista', async () => {
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({ temarios: [{ _id: 'tem-open', nombre: 'Programa', totalNodos: 1, porcentajeAvance: 0 }] })
      .mockRejectedValueOnce(new Error('sin conexión'))
      .mockResolvedValueOnce({ nodos: [{ _id: 'n-open', numero: '1', nivel: 1, titulo: 'Unidad inicial', estado: 'pendiente' }] });

    render(<SeccionTemarios periodos={[{ _id: 'per-1', nombre: '2026-A', activo: true }]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });
    fireEvent.click(await screen.findByRole('button', { name: /Abrir temario Programa/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo cargar este temario/i);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga del temario' }));
    expect(await screen.findByRole('button', { name: /1 Unidad inicial.*Estado: Pendiente/i })).toBeInTheDocument();
  });

  it('descarta una lista tardía cuando se cambia a otro periodo', async () => {
    let resolverA!: (value: { temarios: Array<{ _id: string; nombre: string; totalNodos: number; porcentajeAvance: number }> }) => void;
    let resolverB!: (value: { temarios: Array<{ _id: string; nombre: string; totalNodos: number; porcentajeAvance: number }> }) => void;
    vi.mocked(clienteApi.obtener)
      .mockImplementationOnce(() => new Promise((resolve) => { resolverA = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolverB = resolve; }));

    render(<SeccionTemarios periodos={[
      { _id: 'per-a', nombre: '2026-A', activo: true },
      { _id: 'per-b', nombre: '2026-B', activo: true }
    ]} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'per-a' } });
    fireEvent.change(select, { target: { value: 'per-b' } });

    await waitFor(() => expect(clienteApi.obtener).toHaveBeenCalledTimes(2));
    resolverB({ temarios: [{ _id: 'tem-b', nombre: 'Periodo B', totalNodos: 1, porcentajeAvance: 0 }] });
    expect(await screen.findByRole('button', { name: /Abrir temario Periodo B/i })).toBeInTheDocument();
    resolverA({ temarios: [{ _id: 'tem-a', nombre: 'Periodo A obsoleto', totalNodos: 1, porcentajeAvance: 0 }] });
    await waitFor(() => expect(screen.queryByText('Periodo A obsoleto')).not.toBeInTheDocument());
  });

  it('usa navegación de pestañas con flechas y no presenta ceros sin periodo', () => {
    render(<SeccionTemarios periodos={[]} />);
    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.getByRole('combobox', { name: 'Periodo o materia' })).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Elige materia' })).toBeInTheDocument();
    const lista = screen.getByRole('tab', { name: /Mis temarios/i });
    fireEvent.keyDown(lista, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /Cargar temario/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Cargar temario/i })).toHaveFocus();
  });
});

