import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SeccionRegistroEntrega } from '../src/apps/app_docente/SeccionRegistroEntrega';
import { ErrorRemoto } from '../src/servicios_api/clienteApi';
import { emitToast } from '../src/ui/toast/toastBus';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: vi.fn(),
    enviar: vi.fn(),
    eliminar: vi.fn(),
    registrarEventosUso: vi.fn().mockResolvedValue({})
  }
}));

vi.mock('../src/ui/toast/toastBus', () => ({ emitToast: vi.fn() }));

const alumno = {
  _id: 'alumno-dummy-17',
  nombreCompleto: 'Alumna de Prueba',
  matricula: 'DUMMY-017',
  grupo: '2A'
};

describe('SeccionRegistroEntrega', () => {
  let objectUrlOriginal: typeof URL.createObjectURL | undefined;

  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null as unknown as CanvasRenderingContext2D);
    objectUrlOriginal = URL.createObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:fixture-entrega')
    });
    Object.defineProperty(window, 'BarcodeDetector', {
      configurable: true,
      value: class {
        async detect(image: { nombreArchivo: string }) {
          return image.nombreArchivo.includes('sin-qr') ? [] : [{ rawValue: 'EXAMEN:EX-DUMMY-17' }];
        }
      }
    });
    vi.stubGlobal('createImageBitmap', vi.fn().mockImplementation(async (archivo: File) => ({
      width: 100,
      height: 100,
      nombreArchivo: archivo.name,
      close: vi.fn()
    })));
  });

  afterEach(() => {
    if (objectUrlOriginal) {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: objectUrlOriginal });
    } else {
      Reflect.deleteProperty(URL, 'createObjectURL');
    }
    Reflect.deleteProperty(window, 'BarcodeDetector');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('presenta el lote con identidad legible, estado textual y etiqueta de bono válida', async () => {
    render(
      <SeccionRegistroEntrega
        alumnos={[alumno]}
        onVincular={vi.fn().mockResolvedValue({})}
        puedeGestionar
        avisarSinPermiso={vi.fn()}
        examenesPorFolio={new Map([['EX-DUMMY-17', { alumnoId: alumno._id }]])}
      />
    );

    const archivo = new File(['imagen dummy'], 'examen-dummy.png', { type: 'image/png' });
    const archivoSinQr = new File(['sin qr'], 'sin-qr-dummy.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/Seleccionar varias imágenes/i), { target: { files: [archivo, archivoSinQr] } });

    const checkboxBono = await screen.findByRole('checkbox', { name: /Aplicar bono de \+0\.25/i });
    await waitFor(() => expect(screen.getByText(/Alumno asignado: Alumna de Prueba · Matrícula DUMMY-017/i)).toBeInTheDocument());
    expect(screen.getByText('Por confirmar')).toBeInTheDocument();
    expect(await screen.findByText('Con errores: 1')).toBeInTheDocument();
    expect(screen.getByText('No se detectó ningún código QR')).toBeInTheDocument();
    expect(screen.queryByText(alumno._id)).not.toBeInTheDocument();
    const selectorAlumno = screen.getByRole('combobox', { name: /Alumno asignado/ });
    const accionVincular = screen.getByRole('button', { name: 'Vincular y continuar' });
    const ayudaSinAlumno = 'Folio reconocido. Selecciona un alumno para habilitar «Vincular y continuar».';
    const ayudaConAlumno = 'Alumno seleccionado. Verifica que corresponda con el folio antes de vincular.';
    expect(accionVincular).toBeEnabled();

    fireEvent.change(selectorAlumno, { target: { value: '' } });
    expect(screen.getAllByText(ayudaSinAlumno).some((element) => element.getAttribute('role') === 'status')).toBe(true);
    expect(selectorAlumno).toHaveAccessibleDescription(ayudaSinAlumno);
    expect(accionVincular).toBeDisabled();
    expect(accionVincular).toHaveAccessibleDescription(ayudaSinAlumno);

    fireEvent.change(selectorAlumno, { target: { value: alumno._id } });
    expect(screen.getAllByText(ayudaConAlumno).some((element) => element.getAttribute('role') === 'status')).toBe(true);
    expect(screen.queryByText(ayudaSinAlumno)).not.toBeInTheDocument();
    expect(selectorAlumno).toHaveAccessibleDescription(ayudaConAlumno);
    expect(accionVincular).toBeEnabled();
    expect(checkboxBono.closest('.entregas-vinculacion__checkbox-field')).toHaveProperty('tagName', 'DIV');
    expect(checkboxBono.closest('label')).toBeInTheDocument();
    expect(document.querySelector('[data-icono="publicar"]')).toBeInTheDocument();
  });

  it('procesa imágenes de carpeta con MIME vacío y explica cuando no encuentra imágenes', async () => {
    render(
      <SeccionRegistroEntrega
        alumnos={[alumno]}
        onVincular={vi.fn().mockResolvedValue({})}
        puedeGestionar
        avisarSinPermiso={vi.fn()}
        examenesPorFolio={new Map([['EX-DUMMY-17', { alumnoId: alumno._id }]])}
      />
    );

    const selectorCarpeta = screen.getByLabelText('Seleccionar carpeta completa de imágenes');
    const imagenSinMime = new File(['imagen dummy'], 'examen-dummy.png');
    expect(imagenSinMime.type).toBe('');
    fireEvent.change(selectorCarpeta, { target: { files: [imagenSinMime] } });

    expect(await screen.findAllByText(/Alumno asignado por el folio/i)).not.toHaveLength(0);

    const archivoNoImagen = new File(['documento dummy'], 'instrucciones.pdf', { type: 'application/pdf' });
    fireEvent.change(selectorCarpeta, { target: { files: [archivoNoImagen] } });
    expect(await screen.findByText(/No se reconocieron imágenes de examen/i)).toBeInTheDocument();
  });

  it('anuncia una vinculación manual exitosa en contexto sin repetirla en un toast', async () => {
    vi.mocked(emitToast).mockClear();
    const onVincular = vi.fn().mockResolvedValue({});
    render(
      <SeccionRegistroEntrega
        alumnos={[alumno]}
        onVincular={onVincular}
        puedeGestionar
        avisarSinPermiso={vi.fn()}
        examenesPorFolio={new Map()}
      />
    );

    fireEvent.change(screen.getByLabelText('Folio impreso del examen'), { target: { value: 'EX-DUMMY-17' } });
    fireEvent.change(screen.getByLabelText('Alumno receptor'), { target: { value: alumno._id } });
    fireEvent.click(screen.getByRole('button', { name: 'Vincular examen' }));

    expect((await screen.findByText('Entrega vinculada')).closest('[role="status"]')).toBeInTheDocument();
    expect(onVincular).toHaveBeenCalledWith('EX-DUMMY-17', alumno._id);
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('expone el error de vinculación como alerta contextual sin duplicarlo en un toast', async () => {
    vi.mocked(emitToast).mockClear();
    const onVincular = vi.fn().mockRejectedValue(new Error('El folio ya está vinculado.'));
    render(
      <SeccionRegistroEntrega
        alumnos={[alumno]}
        onVincular={onVincular}
        puedeGestionar
        avisarSinPermiso={vi.fn()}
        examenesPorFolio={new Map()}
      />
    );

    fireEvent.change(screen.getByLabelText('Folio impreso del examen'), { target: { value: 'EX-DUMMY-17' } });
    fireEvent.change(screen.getByLabelText('Alumno receptor'), { target: { value: alumno._id } });
    fireEvent.click(screen.getByRole('button', { name: 'Vincular examen' }));

    expect((await screen.findByText('El folio ya está vinculado.')).closest('[role="alert"]')).toBeInTheDocument();
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('anuncia el resultado de vincular una imagen de la mesa sin duplicar el toast', async () => {
    vi.mocked(emitToast).mockClear();
    const onVincular = vi.fn().mockResolvedValue({});
    render(
      <SeccionRegistroEntrega
        alumnos={[alumno]}
        onVincular={onVincular}
        puedeGestionar
        avisarSinPermiso={vi.fn()}
        examenesPorFolio={new Map([['EX-DUMMY-17', { alumnoId: alumno._id }]])}
      />
    );

    fireEvent.change(screen.getByLabelText(/Seleccionar varias imágenes/i), {
      target: { files: [new File(['imagen dummy'], 'examen-dummy.png', { type: 'image/png' })] }
    });
    const vincular = await screen.findByRole('button', { name: 'Vincular y continuar' });
    await waitFor(() => expect(vincular).toBeEnabled());
    fireEvent.click(vincular);

    expect(await screen.findByText('Vinculado', { selector: 'span[role="status"]' })).toBeInTheDocument();
    expect(onVincular).toHaveBeenCalledWith('EX-DUMMY-17', alumno._id, { acordeonEntregado: false, bonoAcordeon: 0 });
    expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Lote de entrega',
      message: expect.stringContaining('Pendientes: 0')
    }));
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Entrega', message: 'Ítem vinculado' }));
  });

  it('anuncia como alerta el error de vincular desde la mesa y ofrece toast solo para renovar sesión', async () => {
    vi.mocked(emitToast).mockClear();
    const onVincular = vi.fn().mockRejectedValue(new ErrorRemoto('Sesión vencida.', { status: 401 }));
    render(
      <SeccionRegistroEntrega
        alumnos={[alumno]}
        onVincular={onVincular}
        puedeGestionar
        avisarSinPermiso={vi.fn()}
        examenesPorFolio={new Map([['EX-DUMMY-17', { alumnoId: alumno._id }]])}
      />
    );

    fireEvent.change(screen.getByLabelText(/Seleccionar varias imágenes/i), {
      target: { files: [new File(['imagen dummy'], 'examen-dummy.png', { type: 'image/png' })] }
    });
    const vincular = await screen.findByRole('button', { name: 'Vincular y continuar' });
    await waitFor(() => expect(vincular).toBeEnabled());
    fireEvent.click(vincular);

    expect(await screen.findByRole('alert')).toHaveTextContent(/sesión|sesion/i);
    expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warn',
      title: 'Renueva tu sesión docente',
      action: expect.objectContaining({ label: expect.any(String), onClick: expect.any(Function) })
    }));
  });
});
