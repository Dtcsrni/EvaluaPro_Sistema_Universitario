import type { ComponentProps } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SeccionCalificaciones } from '../src/apps/app_docente/SeccionCalificaciones';

const mocks = vi.hoisted(() => ({ obtener: vi.fn(async () => ({})) }));

vi.mock('../src/apps/app_docente/ClassroomEnCalificaciones', () => ({
  ClassroomEnCalificaciones: () => <div>Contenido de sincronización Classroom</div>
}));
vi.mock('../src/apps/app_docente/ConsultaCalificaciones', () => ({
  ConsultaCalificaciones: () => <div>Contenido de resultados</div>
}));
vi.mock('../src/apps/app_docente/ExtraordinariosCalificaciones', () => ({
  ExtraordinariosCalificaciones: () => <div>Contenido de extraordinarios</div>
}));
vi.mock('../src/apps/app_docente/SeccionEscaneo', () => ({ SeccionEscaneo: () => null }));
vi.mock('../src/apps/app_docente/SeccionCalificar', () => ({ SeccionCalificar: () => null }));
vi.mock('../src/apps/app_docente/GuiaCalificacionesVisual', () => ({ GuiaCalificacionesVisual: () => null }));
vi.mock('../src/apps/app_docente/SolicitudesRevisionPanel', () => ({ SolicitudesRevisionPanel: () => null }));
vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: { obtener: mocks.obtener, registrarEventosUso: async () => ({}), baseApi: 'http://localhost:4000/api' }
}));
vi.mock('../src/servicios_api/clienteApi', () => ({ obtenerTokenDocente: () => 'dummy-docente-token' }));

const permisos = {
  periodos: { leer: true, gestionar: false, archivar: false },
  alumnos: { leer: true, gestionar: false },
  banco: { leer: true, gestionar: false, archivar: false },
  plantillas: { leer: true, gestionar: false, archivar: false, previsualizar: false },
  examenes: { leer: true, generar: false, archivar: false, regenerar: false, descargar: false },
  entregas: { gestionar: false },
  omr: { analizar: false },
  calificaciones: { calificar: true },
  rehidratacion: { usar: false },
  evaluaciones: { leer: true, gestionar: false },
  classroom: { conectar: false, pull: true },
  publicar: { publicar: false },
  sincronizacion: { listar: false, exportar: false, importar: false, push: false, pull: false },
  cuenta: { leer: false, actualizar: false }
};

const propsBase = {
  periodos: [{ _id: 'periodo-1', nombre: 'Inteligencia de Negocios' }],
  periodosArchivados: [],
  alumnos: [],
  onAnalizar: vi.fn(async () => ({})),
  onPrevisualizar: vi.fn(async () => ({ preview: {} })),
  resultado: null,
  onActualizar: vi.fn(),
  onActualizarPregunta: vi.fn(),
  respuestasPaginaEditable: [],
  revisionOmrConfirmada: false,
  onConfirmarRevisionOmr: vi.fn(),
  revisionesOmr: [],
  examenIdActivo: null,
  paginaActiva: null,
  onSeleccionarRevision: vi.fn(),
  claveCorrectaPorNumero: {},
  ordenPreguntasClave: [],
  examenId: null,
  alumnoId: null,
  resultadoParaCalificar: null,
  respuestasParaCalificar: [],
  onCalificar: vi.fn(async () => undefined),
  permisos,
  avisarSinPermiso: vi.fn()
} as unknown as ComponentProps<typeof SeccionCalificaciones>;

describe('ruta Classroom desde Calificaciones', () => {
  it('no repite junto al título el icono de sección que ya marca la navegación', () => {
    const { container } = render(<SeccionCalificaciones {...propsBase} />);
    expect(container.querySelector('.calif-panel__head .banco-panel__icon-orb')).toBeNull();
    expect(container.querySelector('.calif-panel__head h2')?.textContent).toBe('Calificaciones');
  });

  it('describe los KPI de Resultados como presencia de una nota registrada', () => {
    const { container } = render(<SeccionCalificaciones {...propsBase} />);

    expect(container.querySelector('.banco-mini-kpi--paginas .banco-mini-kpi__lbl')).toHaveTextContent('Con calificación');
    expect(container.querySelector('.banco-mini-kpi--sintema .banco-mini-kpi__lbl')).toHaveTextContent('Sin calificación');
  });

  it('comunica estados de encuadre con iconos semánticos y texto completo', async () => {
    mocks.obtener.mockImplementation(async (ruta: string) => ruta.includes('/evaluaciones/encuadre/estado/') ? ({
      inicializado: true,
      estado: 'Activo',
      firmas: [
        { id: 'firma-1', rol: 'Docente', nombreFirmante: 'Docente de prueba', firmado: true, tokenFirma: 'token-dummy' },
        { id: 'firma-2', rol: 'Alumno', nombreFirmante: 'Alumno de prueba', firmado: false, tokenFirma: 'token-dummy-2' }
      ]
    }) : ({}));

    const { container } = render(<SeccionCalificaciones {...propsBase} />);
    fireEvent.click(screen.getByRole('button', { name: /Revisión y captura/i }));
    expect(mocks.obtener).toHaveBeenCalledWith('/evaluaciones/encuadre/estado/periodo-1');
    const firmado = await screen.findByText('Firmado');
    const pendiente = screen.getByText('Pendiente');
    expect(firmado.closest('.encuadre-firma-badge-status')?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(pendiente.closest('.encuadre-firma-badge-status')?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.textContent).not.toContain('✓');
    expect(container.textContent).not.toContain('⌛');
    expect(container.textContent).not.toContain('↗');
    expect(screen.getByRole('link', { name: 'Ver PDF oficial' })).toBeInTheDocument();

    mocks.obtener.mockReset().mockResolvedValue({});
  });

  it('conserva el texto al indicar un examen activo con cambios OMR sin confirmar', () => {
    render(<SeccionCalificaciones
      {...propsBase}
      examenIdActivo="examen-dummy"
      hayCambiosPendientesOmrActiva
    />);
    fireEvent.click(screen.getByRole('button', { name: /Revisión y captura/i }));

    expect(screen.getByText('Cambios pendientes')).toBeInTheDocument();
    expect(document.querySelector('.banco-counter-tag svg')).toHaveAttribute('aria-hidden', 'true');
    expect(document.querySelector('.banco-counter-tag')?.textContent).not.toContain('⚠️');
    expect(document.querySelector('.banco-counter-tag')?.textContent).not.toContain('✓');
  });

  it('asocia los errores de lectura de logotipo al selector de Encuadre afectado', async () => {
    const user = userEvent.setup();
    let fallaLectura = true;
    mocks.obtener.mockImplementation(async (ruta: string) => ruta.includes('/evaluaciones/encuadre/estado/')
      ? { inicializado: false }
      : ({}));
    const leerArchivo = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function () {
      if (fallaLectura) {
        this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
        return;
      }
      Object.defineProperty(this, 'result', { configurable: true, value: 'data:image/png;base64,AA==' });
      this.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>);
    });

    render(<SeccionCalificaciones {...propsBase} />);
    await user.click(screen.getByRole('button', { name: /Revisión y captura/i }));
    await user.click(await screen.findByRole('button', { name: 'Configurar y Generar Encuadre' }));

    expect(await screen.findByText('Configuración de Formato y Ponderaciones')).toBeInTheDocument();
    const logoPrincipal = document.getElementById('encuadre-logo-principal') as HTMLInputElement;
    const logoCarrera = document.getElementById('encuadre-logo-carrera') as HTMLInputElement;
    expect(logoPrincipal).toBeInTheDocument();
    expect(logoCarrera).toBeInTheDocument();
    expect(document.querySelector('label[for="encuadre-logo-principal"]')).toHaveTextContent('Logo Principal (Izquierdo)');
    await user.upload(logoPrincipal, new File(['logo'], 'logo.png', { type: 'image/png' }));

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('No se pudo leer el archivo. Selecciona otra imagen e inténtalo de nuevo.');
    expect(logoPrincipal).toHaveAttribute('aria-invalid', 'true');
    expect(logoPrincipal.getAttribute('aria-describedby')?.split(' ')).toContain('encuadre-logo-principal-error');
    expect(logoPrincipal.getAttribute('aria-describedby')?.split(' ')).toContain('encuadre-logo-principal-ayuda');
    expect(logoCarrera).not.toHaveAttribute('aria-invalid');
    expect(logoCarrera).toHaveAttribute('aria-describedby', 'encuadre-logo-carrera-ayuda');

    fallaLectura = false;
    await user.upload(logoPrincipal, new File(['logo actualizado'], 'logo-nuevo.png', { type: 'image/png' }));
    await waitFor(() => expect(logoPrincipal).not.toHaveAttribute('aria-invalid'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(logoPrincipal).toHaveAttribute('aria-describedby', 'encuadre-logo-principal-ayuda');

    leerArchivo.mockRestore();
    mocks.obtener.mockReset().mockResolvedValue({});
  });

  it('ofrece reportes descargables sin presentarlos como actas oficiales', async () => {
    render(<SeccionCalificaciones {...propsBase} />);
    fireEvent.click(screen.getByRole('button', { name: /Reportes y exportación/i }));

    expect(screen.getByRole('heading', { name: 'Reportes y exportación' })).toBeInTheDocument();
    expect(screen.getByText('Exportación de calificaciones')).toBeInTheDocument();
    expect(screen.queryByText(/Resultado oficial|Actas y exportación|Prepara el resultado oficial/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Periodo de calificaciones')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i })).toBeInTheDocument();
    expect(screen.getByText(/HTML es autónomo: no se actualiza solo/i)).toBeInTheDocument();
    expect(screen.getByText('Reporte del periodo')).toBeInTheDocument();
    expect(screen.getByText(/Formatos: HTML · XLSX · CSV/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i })).not.toHaveClass('secundario');
    expect(screen.getByRole('button', { name: 'Descargar CSV' })).toHaveClass('secundario');
    expect(screen.getByRole('button', { name: 'Descargar XLSX' })).toHaveClass('secundario');
    const selectorPeriodo = screen.getByLabelText('Periodo de calificaciones');
    await userEvent.selectOptions(selectorPeriodo, 'periodo-1');
    expect(document.getElementById('calificaciones-html-periodo-seleccionado')).toHaveTextContent('Reporte para: Inteligencia de Negocios');
    expect(selectorPeriodo).toHaveAttribute('aria-describedby', 'calificaciones-html-periodo-seleccionado');
    const selectorAcceso = screen.getByLabelText('Acceso del HTML');
    expect(selectorAcceso).toHaveValue('grupo');
    expect(screen.getByRole('option', { name: 'Lista grupal' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Consulta individual' })).toBeInTheDocument();
    expect(selectorAcceso).toHaveAttribute('aria-describedby', 'calificaciones-html-grupo-ayuda');
    expect(screen.getByText(/cualquier persona con permiso de lectura del archivo podrá ver la lista/i)).toBeInTheDocument();
    await userEvent.selectOptions(selectorAcceso, 'individual');
    expect(selectorAcceso).toHaveValue('individual');
    expect(selectorAcceso).toHaveAttribute('aria-describedby', 'calificaciones-html-individual-ayuda');
    expect(screen.getByText(/puede mostrar el código HTML sin ejecutar el formulario/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/Secreto maestro del ciclo/)).toBeInTheDocument();
    expect(screen.getByText(/volver a escribirlo para actualizar/i)).toBeInTheDocument();
  });

  it('explica que no hay periodos disponibles y desactiva la generación de HTML', () => {
    render(<SeccionCalificaciones {...propsBase} periodos={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Reportes y exportación/i }));

    expect(screen.getByText('No hay periodos disponibles para generar reportes de calificaciones.')).toBeInTheDocument();
    expect(screen.getByLabelText('Periodo de calificaciones')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i })).toBeDisabled();
  });

  it('anuncia la carga de periodos sin confundirla con un catálogo vacío', () => {
    render(<SeccionCalificaciones {...propsBase} periodos={[]} cargandoMaterias />);
    fireEvent.click(screen.getByRole('button', { name: /Reportes y exportación/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Cargando periodos de calificaciones…');
    expect(screen.getByLabelText('Periodo de calificaciones')).toHaveTextContent('Cargando periodos…');
    expect(screen.queryByText('No hay periodos disponibles para generar reportes de calificaciones.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i })).toBeDisabled();
  });

  it('expone el error de carga de periodos y permite reintentar', () => {
    const reintentar = vi.fn();
    render(<SeccionCalificaciones {...propsBase} periodos={[]} errorMaterias onReintentarMaterias={reintentar} />);
    fireEvent.click(screen.getByRole('button', { name: /Reportes y exportación/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar los periodos de calificaciones.');
    expect(screen.getByLabelText('Periodo de calificaciones')).toHaveTextContent('No se pudieron cargar los periodos');
    expect(screen.queryByText('No hay periodos disponibles para generar reportes de calificaciones.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga de periodos' }));
    expect(reintentar).toHaveBeenCalledOnce();
  });

  it('conserva los periodos cargados cuando la actualización falla', () => {
    render(<SeccionCalificaciones {...propsBase} errorMaterias />);
    fireEvent.click(screen.getByRole('button', { name: /Reportes y exportación/i }));

    expect(screen.getByLabelText('Periodo de calificaciones')).toBeEnabled();
    expect(screen.getByRole('option', { name: /Inteligencia de Negocios/ })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('La lista cargada sigue disponible.');
    expect(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i })).toBeEnabled();
  });

  it('explica por qué los reportes están bloqueados cuando falta el permiso', () => {
    const permisosSinCalificar = { ...permisos, calificaciones: { calificar: false } };
    render(<SeccionCalificaciones {...propsBase} permisos={permisosSinCalificar as typeof permisos} />);
    fireEvent.click(screen.getByRole('button', { name: /Reportes y exportación/i }));

    const avisoPermiso = screen.getByText(/permiso requerido para generar reportes de calificaciones/i);
    expect(avisoPermiso.closest('[role="status"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descargar CSV' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descargar XLSX' })).toBeDisabled();
  });

  it('distingue la carga del catálogo de materias en Encuadre', () => {
    render(<SeccionCalificaciones {...propsBase} periodos={[]} cargandoMaterias />);
    fireEvent.click(screen.getByRole('button', { name: /Revisión y captura/i }));

    expect(screen.getByLabelText('Materia / Periodo')).toBeDisabled();
    const estadoCarga = screen.getByText('Cargando materias disponibles…');
    expect(estadoCarga.closest('[role="status"]')).toBeInTheDocument();
    expect(screen.queryByText('No hay materias disponibles para configurar el encuadre.')).not.toBeInTheDocument();
  });

  it('ofrece reintentar la carga de materias de Encuadre ante un error', async () => {
    const reintentar = vi.fn();
    render(<SeccionCalificaciones {...propsBase} periodos={[]} errorMaterias onReintentarMaterias={reintentar} />);
    fireEvent.click(screen.getByRole('button', { name: /Revisión y captura/i }));

    expect(screen.getByLabelText('Materia / Periodo')).toHaveTextContent('No se pudieron cargar las materias');
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar las materias. Reintenta para consultar el encuadre y las firmas.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga de materias' }));
    expect(reintentar).toHaveBeenCalledOnce();
  });

  it('limpia el resultado anterior al cambiar el modo del reporte', async () => {
    const selectorArchivo = vi.fn(async () => ({
      createWritable: async () => ({ write: vi.fn(async () => undefined), close: vi.fn(async () => undefined) })
    }));
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: selectorArchivo });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ html: '<!doctype html><html lang="es-MX"></html>', credenciales: [] })
    } as Response)));

    render(<SeccionCalificaciones {...propsBase} periodos={[
      { _id: 'periodo-1', nombre: 'Inteligencia de Negocios' },
      { _id: 'periodo-2', nombre: 'Materia ficticia dos' }
    ]} />);
    fireEvent.click(screen.getByRole('button', { name: /Reportes y exportación/i }));
    await userEvent.selectOptions(screen.getByLabelText('Periodo de calificaciones'), 'periodo-1');
    await userEvent.click(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i }));

    expect(await screen.findByText(/Reporte HTML guardado en la ubicación seleccionada/i)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Acceso del HTML'), 'individual');
    expect(screen.queryByText(/Reporte HTML guardado en la ubicación seleccionada/i)).not.toBeInTheDocument();

    const secreto = screen.getByLabelText(/Secreto maestro del ciclo/i);
    fireEvent.change(secreto, { target: { value: 'secreto-maestro-dummy-de-prueba-2026' } });
    await userEvent.click(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i }));
    expect(await screen.findByText(/Reporte HTML guardado en la ubicación seleccionada/i)).toBeInTheDocument();
    fireEvent.change(secreto, { target: { value: 'secreto-maestro-dummy-nuevo-2026' } });
    expect(screen.queryByText(/Reporte HTML guardado en la ubicación seleccionada/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i }));
    expect(await screen.findByText(/Reporte HTML guardado en la ubicación seleccionada/i)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Periodo de calificaciones'), 'periodo-2');
    expect(screen.queryByText(/Reporte HTML guardado en la ubicación seleccionada/i)).not.toBeInTheDocument();

    vi.unstubAllGlobals();
    delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });

  it('explica cómo publicar el HTML descargado cuando no existe selector de guardado', async () => {
    delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:reporte-dummy');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickDescarga = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ html: '<!doctype html><html lang="es-MX"></html>', credenciales: [] })
    } as Response)));

    render(<SeccionCalificaciones {...propsBase} />);
    fireEvent.click(screen.getByRole('button', { name: /Reportes y exportación/i }));
    await userEvent.click(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i }));

    expect(clickDescarga).toHaveBeenCalledOnce();
    expect(await screen.findByText(/HTML descargado\. Para publicarlo en OneDrive, guarda este archivo allí y, si ya existe uno, reemplázalo; espera a que termine la sincronización antes de compartirlo\./i)).toBeInTheDocument();

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('explica la cancelación del selector sin asumir que ya existe un reporte', async () => {
    const selectorArchivo = vi.fn(async () => {
      throw new DOMException('El usuario canceló el selector.', 'AbortError');
    });
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: selectorArchivo });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<SeccionCalificaciones {...propsBase} />);
    fireEvent.click(screen.getByRole('button', { name: /Reportes y exportación/i }));
    await userEvent.click(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i }));

    expect(await screen.findByText(/No se guardó el reporte; el archivo existente, si lo había, quedó intacto\./i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i })).toBeEnabled();

    vi.unstubAllGlobals();
    delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });

  it('mantiene el error de descarga en el formulario sin duplicarlo en un toast', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 } as Response));
    const avisos: unknown[] = [];
    const recibirAviso = (event: Event) => avisos.push((event as CustomEvent).detail);
    window.addEventListener('app:toast', recibirAviso);
    vi.stubGlobal('fetch', fetchMock);

    render(<SeccionCalificaciones {...propsBase} />);
    fireEvent.click(screen.getByRole('button', { name: /Reportes y exportación/i }));
    await userEvent.selectOptions(screen.getByLabelText('Periodo de calificaciones'), 'periodo-1');
    await userEvent.click(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i }));

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('No se pudo generar el reporte HTML. Inténtalo de nuevo más tarde.');
    expect(error).not.toHaveTextContent('HTTP 500');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(avisos).toHaveLength(0);

    window.removeEventListener('app:toast', recibirAviso);
    vi.unstubAllGlobals();
  });

  it.each([
    { status: 400, mensaje: 'Revisa los datos del reporte e inténtalo de nuevo.' },
    { status: 401, mensaje: 'La sesión venció. Vuelve a iniciar sesión antes de generar el reporte.' },
    { status: 403, mensaje: 'Tu cuenta no tiene permiso para generar este reporte.' }
  ])('explica la recuperación del reporte ante HTTP $status', async ({ status, mensaje }) => {
    const fetchMock = vi.fn(async () => ({ ok: false, status } as Response));
    const avisos: unknown[] = [];
    const recibirAviso = (event: Event) => avisos.push((event as CustomEvent).detail);
    window.addEventListener('app:toast', recibirAviso);
    vi.stubGlobal('fetch', fetchMock);

    render(<SeccionCalificaciones {...propsBase} />);
    fireEvent.click(screen.getByRole('button', { name: /Reportes y exportación/i }));
    await userEvent.selectOptions(screen.getByLabelText('Periodo de calificaciones'), 'periodo-1');
    await userEvent.click(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i }));

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(mensaje);
    expect(error).not.toHaveTextContent(`HTTP ${status}`);
    expect(avisos).toHaveLength(0);

    window.removeEventListener('app:toast', recibirAviso);
    vi.unstubAllGlobals();
  });

  it('asocia al secreto maestro el error de longitud y permite corregirlo', async () => {
    render(<SeccionCalificaciones {...propsBase} />);
    fireEvent.click(screen.getByRole('button', { name: /Reportes y exportación/i }));
    await userEvent.selectOptions(screen.getByLabelText('Acceso del HTML'), 'individual');
    const secreto = await screen.findByLabelText(/Secreto maestro del ciclo/);
    fireEvent.change(secreto, { target: { value: 'secreto-corto' } });

    await userEvent.click(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i }));

    expect(secreto).toHaveAttribute('aria-invalid', 'true');
    expect(secreto).toHaveAttribute('aria-describedby', 'calificaciones-html-clave-ayuda calificaciones-html-clave-error');
    expect(screen.getByRole('alert')).toHaveTextContent('al menos 20 caracteres');
    const etiquetaSecreto = screen.getByText('Secreto maestro del ciclo (obligatorio)', { selector: 'label' });
    expect(secreto).toHaveAttribute('required');
    expect(etiquetaSecreto).toHaveAttribute('for', 'calificaciones-html-secreto-ciclo');
    expect(etiquetaSecreto).not.toContainElement(screen.getByRole('alert'));
    expect(secreto).toHaveFocus();

    fireEvent.change(secreto, { target: { value: 'secreto-de-prueba-de-veinte-caracteres' } });
    expect(secreto).not.toHaveAttribute('aria-invalid');
    expect(secreto).toHaveAttribute('aria-describedby', 'calificaciones-html-clave-ayuda');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('permite comprobar el secreto sin cambiarlo y vuelve a enmascararlo al cambiar de modo', async () => {
    const user = userEvent.setup();
    render(<SeccionCalificaciones {...propsBase} />);
    await user.click(screen.getByRole('button', { name: /Reportes y exportación/i }));
    const acceso = screen.getByLabelText('Acceso del HTML');
    await user.selectOptions(acceso, 'individual');

    const secreto = await screen.findByLabelText(/Secreto maestro del ciclo/);
    const alternarVisibilidad = screen.getByRole('button', { name: 'Mostrar secreto maestro' });
    expect(secreto).toHaveAttribute('type', 'password');
    expect(alternarVisibilidad).toHaveAttribute('aria-pressed', 'false');
    expect(alternarVisibilidad).toHaveAttribute('aria-controls', 'calificaciones-html-secreto-ciclo');

    await user.type(secreto, 'secreto-maestro-dummy-de-prueba-2026');
    await user.tab();
    expect(alternarVisibilidad).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(secreto).toHaveAttribute('type', 'text');
    expect(secreto).toHaveValue('secreto-maestro-dummy-de-prueba-2026');
    expect(alternarVisibilidad).toHaveAttribute('aria-pressed', 'true');

    await user.keyboard(' ');
    expect(secreto).toHaveAttribute('type', 'password');
    expect(secreto).toHaveValue('secreto-maestro-dummy-de-prueba-2026');
    expect(alternarVisibilidad).toHaveAttribute('aria-pressed', 'false');

    await user.selectOptions(acceso, 'grupo');
    await user.selectOptions(acceso, 'individual');
    expect(secreto).toHaveAttribute('type', 'password');
    expect(alternarVisibilidad).toHaveAttribute('aria-pressed', 'false');
  });

  it('genera el HTML individual y presenta claves privadas para distribuir una por alumno', async () => {
    const escribir = vi.fn(async () => undefined);
    const cerrar = vi.fn(async () => undefined);
    const selectorArchivo = vi.fn(async () => ({ createWritable: async () => ({ write: escribir, close: cerrar }) }));
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: selectorArchivo });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        html: '<!doctype html><html lang="es-MX"><body><time datetime="2026-10-28T12:00:00.000Z">28 oct 2026, 6:00 a. m.</time></body></html>',
        credenciales: [{ matricula: 'A001', nombre: 'Ana Pérez', clave: 'clave-personal-de-prueba' }]
      })
    } as Response));
    vi.stubGlobal('fetch', fetchMock);

    render(<SeccionCalificaciones {...propsBase} />);
    fireEvent.click(screen.getByRole('button', { name: /Reportes y exportación/i }));
    await userEvent.selectOptions(screen.getByLabelText('Acceso del HTML'), 'individual');
    fireEvent.change(await screen.findByLabelText(/Secreto maestro del ciclo/), { target: { value: 'secreto-maestro-dummy-de-prueba-2026' } });
    await userEvent.click(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i }));

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4000/api/analiticas/calificaciones-html', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ periodoId: 'periodo-1', modo: 'individual', secretoCiclo: 'secreto-maestro-dummy-de-prueba-2026' })
    }));
    expect(await screen.findByText('clave-personal-de-prueba')).toBeInTheDocument();
    expect(screen.getByText('Clave personal')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Claves individuales por alumno' })).toBeInTheDocument();
    expect(screen.getByText(/1 clave individual lista para distribución manual/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar clave de Ana Pérez, matrícula A001' })).toBeInTheDocument();
    expect(screen.getByText(/espera a que termine la sincronización antes de compartirlo/i)).toBeInTheDocument();
    expect(screen.getByText(/Fecha de generación:/i)).toContainElement(screen.getByRole('time'));
    expect(screen.getByRole('time')).toHaveAttribute('datetime', '2026-10-28T12:00:00.000Z');
    expect(escribir).toHaveBeenCalledTimes(1);
    expect(cerrar).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });

  it('genera el HTML individual al pulsar Enter desde el secreto maestro', async () => {
    const selectorArchivo = vi.fn(async () => ({ createWritable: async () => ({ write: async () => undefined, close: async () => undefined }) }));
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: selectorArchivo });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ html: '<!doctype html><html lang="es-MX"></html>', credenciales: [] })
    } as Response));
    vi.stubGlobal('fetch', fetchMock);

    render(<SeccionCalificaciones {...propsBase} />);
    fireEvent.click(screen.getByRole('button', { name: /Reportes y exportación/i }));
    await userEvent.selectOptions(screen.getByLabelText('Acceso del HTML'), 'individual');
    const secreto = await screen.findByLabelText(/Secreto maestro del ciclo/);
    await userEvent.type(secreto, 'secreto-maestro-dummy-de-prueba-2026');
    await userEvent.keyboard('{Enter}');

    expect(screen.getByRole('form', { name: 'Reportes de calificaciones' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar CSV' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'Descargar XLSX' })).toHaveAttribute('type', 'button');
    expect(await screen.findByText(/Reporte HTML guardado en la ubicación seleccionada/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4000/api/analiticas/calificaciones-html', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ periodoId: 'periodo-1', modo: 'individual', secretoCiclo: 'secreto-maestro-dummy-de-prueba-2026' })
    }));
    expect(selectorArchivo).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
    delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });

  it('bloquea el contexto desde que abre el selector nativo de destino', async () => {
    let resolverSelector!: (destino: { createWritable: () => Promise<{ write: () => Promise<void>; close: () => Promise<void> }> }) => void;
    const selectorArchivo = vi.fn(() => new Promise<{ createWritable: () => Promise<{ write: () => Promise<void>; close: () => Promise<void> }> }>((resolve) => {
      resolverSelector = resolve;
    }));
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: selectorArchivo });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ html: '<!doctype html><html lang="es-MX"></html>', credenciales: [] })
    } as Response)));

    render(<SeccionCalificaciones {...propsBase} />);
    fireEvent.click(screen.getByRole('button', { name: /Reportes y exportación/i }));
    await userEvent.selectOptions(screen.getByLabelText('Acceso del HTML'), 'individual');
    await userEvent.type(await screen.findByLabelText(/Secreto maestro del ciclo/), 'secreto-maestro-dummy-de-prueba-2026');
    const alternarVisibilidad = screen.getByRole('button', { name: 'Mostrar secreto maestro' });
    await userEvent.click(alternarVisibilidad);
    const boton = screen.getByRole('button', { name: /Generar \/ actualizar HTML/i });
    await userEvent.click(boton);

    expect(selectorArchivo).toHaveBeenCalledTimes(1);
    expect(alternarVisibilidad).toBeDisabled();
    expect(alternarVisibilidad).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText(/Secreto maestro del ciclo/)).toHaveAttribute('type', 'password');
    const controlesBloqueadosDuranteSelector = [
      boton.disabled,
      screen.getByLabelText('Periodo de calificaciones').hasAttribute('disabled'),
      screen.getByLabelText('Acceso del HTML').hasAttribute('disabled'),
      screen.getByLabelText(/Secreto maestro del ciclo/).hasAttribute('disabled'),
      alternarVisibilidad.disabled
    ];

    resolverSelector({ createWritable: async () => ({ write: async () => undefined, close: async () => undefined }) });
    await screen.findByText(/Reporte HTML guardado en la ubicación seleccionada/i);
    expect(controlesBloqueadosDuranteSelector).toEqual([true, true, true, true, true]);

    vi.unstubAllGlobals();
    delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });

  it('anuncia el fallo de portapapeles como error y la copia correcta como estado', async () => {
    const descriptorPortapapeles = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const escribir = vi.fn(async () => undefined);
    const selectorArchivo = vi.fn(async () => ({ createWritable: async () => ({ write: escribir, close: vi.fn(async () => undefined) }) }));
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: selectorArchivo });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ html: '<!doctype html><html lang="es-MX"></html>', credenciales: [{ matricula: 'A001', nombre: 'Ana Pérez', clave: 'clave-personal-dummy' }] })
    } as Response)));

    try {
      const copiar = vi.fn().mockRejectedValueOnce(new Error('Permiso de portapapeles denegado')).mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copiar } });
      render(<SeccionCalificaciones {...propsBase} />);
      fireEvent.click(screen.getByRole('button', { name: /Reportes y exportación/i }));
      await userEvent.selectOptions(screen.getByLabelText('Acceso del HTML'), 'individual');
      fireEvent.change(await screen.findByLabelText(/Secreto maestro del ciclo/), { target: { value: 'secreto-maestro-dummy-de-prueba-2026' } });
      await userEvent.click(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i }));
      await screen.findByText('clave-personal-dummy');

      await userEvent.click(screen.getByRole('button', { name: 'Copiar clave de Ana Pérez, matrícula A001' }));
      const errorCopia = await screen.findByText('No se pudo copiar automáticamente. Selecciona la clave y cópiala manualmente.');
      expect(errorCopia.closest('[role="alert"]')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Copiar clave de Ana Pérez, matrícula A001' }));
      const exitoCopia = await screen.findByText('Clave de A001 copiada. Envíala solo a ese alumno.');
      expect(exitoCopia.closest('[role="status"]')).toBeInTheDocument();
      expect(exitoCopia.textContent).not.toContain('clave-personal-dummy');
      expect(copiar).toHaveBeenCalledTimes(2);
    } finally {
      if (descriptorPortapapeles) Object.defineProperty(navigator, 'clipboard', descriptorPortapapeles);
      else Reflect.deleteProperty(navigator, 'clipboard');
      vi.unstubAllGlobals();
      delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
    }
  });

  it('oculta las claves anteriores y bloquea el contexto mientras genera otro reporte individual', async () => {
    const escribir = vi.fn(async () => undefined);
    const cerrar = vi.fn(async () => undefined);
    const selectorArchivo = vi.fn(async () => ({ createWritable: async () => ({ write: escribir, close: cerrar }) }));
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: selectorArchivo });
    let resolverSegundoReporte!: (respuesta: Response) => void;
    const segundoReporte = new Promise<Response>((resolve) => { resolverSegundoReporte = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ html: '<!doctype html>', credenciales: [{ matricula: 'A001', nombre: 'Ana Pérez', clave: 'clave-anterior-dummy' }] })
      } as Response)
      .mockImplementationOnce(() => segundoReporte);
    vi.stubGlobal('fetch', fetchMock);

    render(<SeccionCalificaciones
      {...propsBase}
      periodos={[...propsBase.periodos, { _id: 'periodo-2', nombre: 'Materia distinta' }]}
    />);
    fireEvent.click(screen.getByRole('button', { name: /Reportes y exportación/i }));
    await userEvent.selectOptions(screen.getByLabelText('Acceso del HTML'), 'individual');
    const secreto = await screen.findByLabelText(/Secreto maestro del ciclo/);
    fireEvent.change(secreto, { target: { value: 'secreto-maestro-dummy-de-prueba-2026' } });
    await userEvent.click(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i }));
    expect(await screen.findByText('clave-anterior-dummy')).toBeInTheDocument();

    fireEvent.change(secreto, { target: { value: 'secreto-maestro-dummy-actualizado-2026' } });
    expect(screen.queryByText('clave-anterior-dummy')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Generar \/ actualizar HTML/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(screen.queryByText('clave-anterior-dummy')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Periodo de calificaciones')).toBeDisabled();
    expect(screen.getByLabelText('Acceso del HTML')).toBeDisabled();
    expect(screen.getByLabelText(/Secreto maestro del ciclo/)).toBeDisabled();
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      body: JSON.stringify({ periodoId: 'periodo-1', modo: 'individual', secretoCiclo: 'secreto-maestro-dummy-actualizado-2026' })
    }));

    resolverSegundoReporte({
      ok: true,
      json: async () => ({ html: '<!doctype html>', credenciales: [{ matricula: 'A001', nombre: 'Ana Pérez', clave: 'clave-actualizada-dummy' }] })
    } as Response);
    expect(await screen.findByText('clave-actualizada-dummy')).toBeInTheDocument();
    expect(screen.getByLabelText('Periodo de calificaciones')).toBeEnabled();
    vi.unstubAllGlobals();
    delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });

  it('distingue materia sin seleccionar de un resultado con cero alumnos', () => {
    const { container } = render(<SeccionCalificaciones {...propsBase} periodos={[]} />);

    expect(screen.getByText('Selecciona una materia')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Selecciona una materia');
    expect(container.querySelector('.banco-header-kpis')).not.toHaveAttribute('aria-live');
    expect(screen.queryByText('0 alumnos en la materia')).not.toBeInTheDocument();
    expect(Array.from(container.querySelectorAll('.banco-mini-kpi__num')).slice(0, 3).map((nodo) => nodo.textContent))
      .toEqual(['—', '—', '—']);
  });

  it('no muestra el padrón global como conteo de las vistas Actas, OMR o Classroom', () => {
    const { container } = render(<SeccionCalificaciones
      {...propsBase}
      alumnos={[{ _id: 'alumno-global', nombreCompleto: 'Alumno ficticio', matricula: 'A001', periodoId: 'periodo-1' }]}
    />);
    const vistasSinConteoDeResultados = [
      { nombre: /Reportes y exportación/i },
      { nombre: /Revisión y captura/i },
      { nombre: /ClassroomVínculos/ }
    ];

    for (const vista of vistasSinConteoDeResultados) {
      fireEvent.click(screen.getByRole('button', { name: vista.nombre }));
      expect(container.querySelector('.calif-panel__head .banco-counter-tag')).toBeNull();
    }
  });

  it('abre el espacio Classroom al seleccionar su navegación', async () => {
    render(<SeccionCalificaciones {...propsBase} />);

    fireEvent.click(screen.getByRole('button', { name: /ClassroomVínculos/ }));
    expect(await screen.findByText('Contenido de sincronización Classroom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ClassroomVínculos/ })).toHaveAttribute('aria-current', 'page');
  });

  it('mantiene Resultados como entrada normal a Calificaciones', async () => {
    render(<SeccionCalificaciones {...propsBase} />);

    expect(await screen.findByText('Contenido de resultados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ResultadosConsulta por alumno/ })).toHaveAttribute('aria-current', 'page');
  });

  it('anuncia la carga del encuadre y permite reintentar si falla su consulta', async () => {
    let rechazarConsulta!: (error: Error & { status?: number }) => void;
    let consultas = 0;
    mocks.obtener.mockImplementation(async (ruta: string) => {
      if (!ruta.includes('/evaluaciones/encuadre/estado/')) return {};
      consultas += 1;
      if (consultas === 1) {
        return await new Promise((_, reject) => { rechazarConsulta = reject; });
      }
      return { inicializado: false };
    });

    render(<SeccionCalificaciones {...propsBase} />);
    fireEvent.click(screen.getByRole('button', { name: /Revisión y captura/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('status').some((estado) => estado.textContent?.includes('Consultando estado del encuadre y sus firmas…'))).toBe(true);
    });
    await waitFor(() => expect(rechazarConsulta).toBeTypeOf('function'));

    await act(async () => {
      rechazarConsulta(Object.assign(new Error('No se pudo consultar el estado de firmas.'), { status: 503 }));
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo consultar el estado de firmas.');
    const reintentar = screen.getByRole('button', { name: 'Reintentar consulta de firmas' });
    await userEvent.click(reintentar);

    await waitFor(() => expect(consultas).toBe(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar consulta de firmas' })).not.toBeInTheDocument();
    mocks.obtener.mockReset().mockResolvedValue({});
  });

  it('descarta el estado de firmas tardío de la materia anterior', async () => {
    const resolverPorPeriodo = new Map<string, (estado: unknown) => void>();
    mocks.obtener.mockImplementation((ruta: string) => {
      const periodoId = ruta.match(/\/evaluaciones\/encuadre\/estado\/([^/?]+)/)?.[1];
      if (!periodoId) return Promise.resolve({});
      return new Promise((resolve) => resolverPorPeriodo.set(periodoId, resolve));
    });

    render(<SeccionCalificaciones
      {...propsBase}
      periodos={[...propsBase.periodos, { _id: 'periodo-2', nombre: 'Materia dos' }]}
    />);
    await waitFor(() => expect(resolverPorPeriodo.has('periodo-1')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /Revisión y captura/i }));
    await userEvent.selectOptions(screen.getByLabelText('Materia / Periodo'), 'periodo-2');
    await waitFor(() => expect(resolverPorPeriodo.has('periodo-2')).toBe(true));

    await act(async () => {
      resolverPorPeriodo.get('periodo-2')?.({
        inicializado: true,
        estado: 'Activo',
        firmas: [{ id: 'firma-2', rol: 'Docente', nombreFirmante: 'Firma materia dos', firmado: true }]
      });
    });
    expect(await screen.findByText('Firma materia dos')).toBeInTheDocument();

    await act(async () => {
      resolverPorPeriodo.get('periodo-1')?.({
        inicializado: true,
        estado: 'Activo',
        firmas: [{ id: 'firma-1', rol: 'Docente', nombreFirmante: 'Firma materia uno', firmado: true }]
      });
    });

    expect(screen.getByText('Firma materia dos')).toBeInTheDocument();
    expect(screen.queryByText('Firma materia uno')).not.toBeInTheDocument();
    mocks.obtener.mockReset().mockResolvedValue({});
  });
});
