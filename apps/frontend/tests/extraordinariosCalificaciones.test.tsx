import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtraordinariosCalificaciones } from '../src/apps/app_docente/ExtraordinariosCalificaciones';

const obtenerMock = vi.fn();
const enviarMock = vi.fn();
const tokenMock = vi.fn();
const refrescarTokenMock = vi.fn();
vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: { obtener: (...args: unknown[]) => obtenerMock(...args), enviar: (...args: unknown[]) => enviarMock(...args), baseApi: 'http://localhost/api', intentarRefrescarToken: (...args: unknown[]) => refrescarTokenMock(...args) }
}));
vi.mock('../src/servicios_api/clienteApi', () => ({ obtenerTokenDocente: (...args: unknown[]) => tokenMock(...args) }));

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('ExtraordinariosCalificaciones', () => {
  beforeEach(() => {
    obtenerMock.mockReset();
    enviarMock.mockReset();
    tokenMock.mockReset().mockReturnValue('token-docente');
    refrescarTokenMock.mockReset();
    localStorage.clear();
    obtenerMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/analiticas/lista-academica')) return Promise.resolve({ filas: [
        { alumnoId: 'a-1', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: '', matricula: 'A001', grupo: 'A', calificacionFinalCurso: '5.99', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, solicitudExtraVersion: 1, resultadosExtraordinarios: [] },
        { alumnoId: 'a-2', nombre: 'Luis', apellidoPaterno: 'Soto', apellidoMaterno: '', matricula: 'A002', grupo: 'A', calificacionFinalCurso: '6.00', calificacionFinalCursoActa: '6', extraDisponible: false, solicitaExtra: false, resultadosExtraordinarios: [{ claseRegistro: 'externo', folio: 'FOLIO-1', calificacionSobre5: '2.29', calificacionSobre10: '4.58', estadoAprobatorio: 'No aprobatoria', origen: 'inferida manualmente' }] }
      ] });
      return Promise.resolve({ plantillas: [] });
    });
  });

  it('muestra elegibilidad exacta y conserva historial de un alumno ya no elegible', async () => {
    render(<ExtraordinariosCalificaciones
      periodos={[{ _id: 'p-1', nombre: 'Materia de prueba' }]}
      periodoId="p-1"
      onPeriodoChange={vi.fn()}
      puedeCalificar
      puedeGenerar
      onAbrirRevision={vi.fn()}
    />);

    expect((await screen.findAllByText('Pérez Ana')).length).toBeGreaterThan(0);
    expect(screen.getByText('5.99')).toBeInTheDocument();
    expect(screen.getAllByText('6.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Resultado externo · folio FOLIO-1')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Seleccionar para generar Extra: Pérez Ana' })).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Seleccionar para generar Extra: Soto Luis' })).not.toBeInTheDocument();
    await waitFor(() => expect(obtenerMock).toHaveBeenCalledWith('/examenes/plantillas?periodoId=p-1&archivado=true'));
  });

  it('calcula SHA-256 del PDF local y envía solo metadatos confirmados', async () => {
    vi.stubGlobal('crypto', {
      subtle: { digest: vi.fn(async () => new Uint8Array(32).fill(0x0a).buffer) },
      getRandomValues: (value: Uint8Array) => value.fill(1),
      randomUUID: () => 'request-test-1'
    });
    enviarMock.mockResolvedValue({});
    render(<ExtraordinariosCalificaciones
      periodos={[{ _id: 'p-1', nombre: 'Materia de prueba' }]}
      periodoId="p-1"
      onPeriodoChange={vi.fn()}
      puedeCalificar
      puedeGenerar
      onAbrirRevision={vi.fn()}
    />);

    fireEvent.change(await screen.findByRole('combobox', { name: 'Alumno solicitante elegible' }), { target: { value: 'a-1' } });
    const archivo = new File(['%PDF-1.7 contenido privado'], 'anwar-extra.pdf', { type: 'application/pdf' });
    Object.defineProperty(archivo, 'arrayBuffer', { value: async () => new TextEncoder().encode('%PDF-1.7 contenido privado').buffer });
    fireEvent.change(screen.getByLabelText('PDF local'), { target: { files: [archivo] } });
    expect(await screen.findByText(`SHA-256 local: ${'0a'.repeat(32)}`)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Folio visible'), { target: { value: 'FOLIO-EXTRA' } });
    fireEvent.change(screen.getByLabelText('Aciertos confirmados'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Reactivos evaluables'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Criterios aplicados'), { target: { value: 'Revisión manual con rúbrica documentada.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado externo' }));

    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/analiticas/lista-academica/resultados-extra-externos', expect.objectContaining({
      fuenteArchivo: 'anwar-extra.pdf', documentoSha256: '0a'.repeat(32), folio: 'FOLIO-EXTRA', aciertos: 7, totalReactivos: 10
    })));
    const payload = enviarMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('archivo');
    expect(JSON.stringify(payload)).not.toContain('contenido privado');
  });
});

  it('retira solicitud y pagina historial conservando los datos previos si falla la página siguiente', async () => {
    const fila = { alumnoId: 'a-1', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: '', matricula: 'A001', grupo: 'A', calificacionFinalCurso: '5.99', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, solicitudExtraVersion: 3, resultadosExtraordinarios: [] };
    obtenerMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/analiticas/lista-academica')) return Promise.resolve({ filas: [fila] });
      if (ruta.startsWith('/examenes/generados')) return ruta.includes('cursor=') ? Promise.reject(new Error('Página no disponible')) : Promise.resolve({ examenes: [{ _id: 'e-ord', folio: 'ORD-1', tipoExamen: 'ordinario' }, { _id: 'e-extra', folio: 'EX-1', loteId: 'L-1', tipoExamen: 'extraordinario', alumnoId: 'a-1' }], nextCursor: 'cursor/2' });
      return Promise.resolve({ plantillas: [] });
    });
    vi.stubGlobal('crypto', { randomUUID: () => '44444444-aaaa-bbbb-cccc-123456789000' });
    enviarMock.mockRejectedValueOnce(new Error('No se guardó')).mockResolvedValue({});
    render(<ExtraordinariosCalificaciones periodos={[{ _id: 'p-1', nombre: 'Materia' }]} periodoId="p-1" onPeriodoChange={vi.fn()} puedeCalificar puedeGenerar onAbrirRevision={vi.fn()} />);

    expect(await screen.findByText('Lote L-1 · folio EX-1')).toBeInTheDocument();
    expect(screen.queryByText('folio ORD-1')).not.toBeInTheDocument();
    const solicitud = screen.getByRole('checkbox', { name: 'Solicitud docente' });
    fireEvent.click(solicitud);
    expect(await screen.findByText('No se guardó')).toBeInTheDocument();
    fireEvent.click(solicitud);
    await waitFor(() => expect(enviarMock).toHaveBeenCalledTimes(2));
    expect(enviarMock.mock.calls[0][1].clientRequestId).toBe(enviarMock.mock.calls[1][1].clientRequestId);
    expect(await screen.findByText(/Solicitud retirada para Pérez Ana/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cargar más exámenes' }));
    expect(await screen.findByText('Página no disponible')).toBeInTheDocument();
    expect(screen.getByText('Lote L-1 · folio EX-1')).toBeInTheDocument();
  });

  it('muestra error de carga académica y mantiene la vista vacía', async () => {
    obtenerMock.mockRejectedValue(new Error('API académica fuera de línea'));
    render(<ExtraordinariosCalificaciones periodos={[{ _id: 'p-1', nombre: 'Materia' }]} periodoId="p-1" onPeriodoChange={vi.fn()} puedeCalificar puedeGenerar onAbrirRevision={vi.fn()} />);
    expect(await screen.findByText('API académica fuera de línea')).toBeInTheDocument();
    expect(screen.getByText('No hay alumnos registrados en este periodo.')).toBeInTheDocument();
  });

  it('valida preview y generación, persiste clave de lote y renueva token al descargar PDF', async () => {
    const fila = { alumnoId: 'a-1', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: '', matricula: 'A001', grupo: 'A', calificacionFinalCurso: '5.99', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, solicitudExtraVersion: 1, resultadosExtraordinarios: [] };
    const hash = 'ab'.repeat(32);
    obtenerMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/analiticas/lista-academica')) return Promise.resolve({ filas: [fila] });
      if (ruta.startsWith('/examenes/generados')) return Promise.resolve({ examenes: [], nextCursor: null });
      if (ruta.endsWith('/previsualizar')) return Promise.resolve({ layoutConfirmado: true, numeroPaginas: 2, totalUsados: 10, totalDisponibles: 12 });
      if (ruta.startsWith('/examenes/plantillas')) return Promise.resolve({ plantillas: [{ _id: 'tpl-1', periodoId: 'p-1', titulo: 'Plantilla global', numeroPaginas: 2 }] });
      return Promise.resolve({});
    });
    vi.stubGlobal('crypto', { randomUUID: () => '12345678-aaaa-bbbb-cccc-123456789000' });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ paginas: [{ numero: 1, width: 100, height: 140, dataUrl: 'data:image/png;base64,AA==' }] }) })
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: (name: string) => name === 'X-EvaluaPro-PDF-SHA256' ? hash : null }, blob: async () => new Blob(['pdf']) });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:extra'), revokeObjectURL: vi.fn() });
    refrescarTokenMock.mockResolvedValue('token-renovado');
    enviarMock.mockResolvedValue({ loteId: 'L-EXTRA-1', totalAlumnos: 1, totalPaginas: 2, paginasPorExamen: 2, pdfSha256: hash, lotePdfUrl: '/examenes/generados/lote/L-EXTRA-1/pdf', examenesGenerados: [{ folio: 'F-1' }] });
    const clickDescarga = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<ExtraordinariosCalificaciones periodos={[{ _id: 'p-1', nombre: 'Materia' }]} periodoId="p-1" onPeriodoChange={vi.fn()} puedeCalificar puedeGenerar onAbrirRevision={vi.fn()} />);

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Seleccionar para generar Extra: Pérez Ana' }));
    fireEvent.change(screen.getByLabelText('Plantilla de examen'), { target: { value: 'tpl-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar vista previa' }));
    expect(await screen.findByText(/Vista previa validada · 1 páginas/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Revisé el diseño y las páginas de la vista previa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generar lote Extra' }));
    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/examenes/generados/lote', expect.objectContaining({ plantillaId: 'tpl-1', tipoExamen: 'extraordinario', alumnoIds: ['a-1'], loteId: '12345678' })));
    expect(await screen.findByText(/Lote L-EXTRA-1 · 1 exámenes · 2 páginas/)).toBeInTheDocument();
    expect(localStorage.getItem('evaluapro.plantillas.lote-pendiente.v1:tpl-1:extraordinario:a-1')).toBe('12345678');

    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF del lote' }));
    await waitFor(() => expect(clickDescarga).toHaveBeenCalled());
    expect(refrescarTokenMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenNthCalledWith(3, expect.any(String), expect.objectContaining({ headers: { Authorization: 'Bearer token-renovado' } }));
    expect(screen.getByText(/SHA-256 verificado/)).toBeInTheDocument();
  });

  it('rechaza preview sin sesión ni diseño confirmado y mantiene bloqueada la generación', async () => {
    const fila = { alumnoId: 'a-1', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: '', matricula: 'A001', grupo: 'A', calificacionFinalCurso: '5.99', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, resultadosExtraordinarios: [] };
    obtenerMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/analiticas/lista-academica')) return Promise.resolve({ filas: [fila] });
      if (ruta.startsWith('/examenes/generados')) return Promise.resolve({ examenes: [] });
      if (ruta.endsWith('/previsualizar')) return Promise.resolve({ layoutConfirmado: false });
      if (ruta.startsWith('/examenes/plantillas')) return Promise.resolve({ plantillas: [{ _id: 'tpl-1', periodoId: 'p-1', titulo: 'Plantilla global' }] });
      return Promise.resolve({});
    });
    vi.stubGlobal('crypto', { randomUUID: () => '11111111-aaaa-bbbb-cccc-123456789000' });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ paginas: [{ numero: 1, width: 100, height: 140, dataUrl: 'data:image/png;base64,AA==' }] }) })));
    render(<ExtraordinariosCalificaciones periodos={[{ _id: 'p-1', nombre: 'Materia' }]} periodoId="p-1" onPeriodoChange={vi.fn()} puedeCalificar puedeGenerar onAbrirRevision={vi.fn()} />);

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Seleccionar para generar Extra: Pérez Ana' }));
    fireEvent.change(screen.getByLabelText('Plantilla de examen'), { target: { value: 'tpl-1' } });
    tokenMock.mockReturnValueOnce(null);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar vista previa' }));
    expect(await screen.findByText('Sesión docente no válida. Vuelve a iniciar sesión.')).toBeInTheDocument();
    tokenMock.mockReturnValue('token-docente');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar vista previa' }));
    expect(await screen.findByText('El diseño de la plantilla aún no está confirmado; revisa la plantilla antes de generar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generar lote Extra' })).toBeDisabled();
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it('valida archivo, firma PDF, disponibilidad criptográfica y aciertos antes de registrar', async () => {
    const fila = { alumnoId: 'a-1', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: '', matricula: 'A001', grupo: 'A', calificacionFinalCurso: '5.99', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, resultadosExtraordinarios: [] };
    obtenerMock.mockImplementation((ruta: string) => ruta.startsWith('/analiticas/lista-academica') ? Promise.resolve({ filas: [fila] }) : Promise.resolve({ plantillas: [], examenes: [] }));
    vi.stubGlobal('crypto', { randomUUID: () => '22222222-aaaa-bbbb-cccc-123456789000', subtle: { digest: vi.fn(async () => new Uint8Array(32).buffer) } });
    render(<ExtraordinariosCalificaciones periodos={[{ _id: 'p-1', nombre: 'Materia' }]} periodoId="p-1" onPeriodoChange={vi.fn()} puedeCalificar puedeGenerar onAbrirRevision={vi.fn()} />);
    fireEvent.change(await screen.findByRole('combobox', { name: 'Alumno solicitante elegible' }), { target: { value: 'a-1' } });
    const input = screen.getByLabelText('PDF local');
    fireEvent.change(input, { target: { files: [new File(['texto'], 'examen.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText('Selecciona un PDF válido y no vacío.')).toBeInTheDocument();

    const pdfSinFirma = new File(['no es pdf'], 'examen.pdf', { type: 'application/pdf' });
    Object.defineProperty(pdfSinFirma, 'arrayBuffer', { value: async () => new TextEncoder().encode('texto falso').buffer });
    fireEvent.change(input, { target: { files: [pdfSinFirma] } });
    expect(await screen.findByText('El contenido seleccionado no tiene firma PDF.')).toBeInTheDocument();

    vi.stubGlobal('crypto', { randomUUID: () => '22222222-aaaa-bbbb-cccc-123456789000' });
    const pdfValido = new File(['%PDF-1.7'], 'examen.pdf', { type: 'application/pdf' });
    Object.defineProperty(pdfValido, 'arrayBuffer', { value: async () => new TextEncoder().encode('%PDF-1.7').buffer });
    fireEvent.change(input, { target: { files: [pdfValido] } });
    expect(await screen.findByText('SHA-256 local requiere un navegador en contexto seguro.')).toBeInTheDocument();
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it('rechaza aciertos fuera de rango y conserva request id si falla el alta externa', async () => {
    const fila = { alumnoId: 'a-1', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: '', matricula: 'A001', grupo: 'A', calificacionFinalCurso: '5.99', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, resultadosExtraordinarios: [] };
    obtenerMock.mockImplementation((ruta: string) => ruta.startsWith('/analiticas/lista-academica') ? Promise.resolve({ filas: [fila] }) : Promise.resolve({ plantillas: [], examenes: [] }));
    vi.stubGlobal('crypto', { randomUUID: () => '33333333-aaaa-bbbb-cccc-123456789000', subtle: { digest: vi.fn(async () => new Uint8Array(32).fill(0x0a).buffer) } });
    enviarMock.mockRejectedValueOnce(new Error('Error de registro')).mockResolvedValue({});
    render(<ExtraordinariosCalificaciones periodos={[{ _id: 'p-1', nombre: 'Materia' }]} periodoId="p-1" onPeriodoChange={vi.fn()} puedeCalificar puedeGenerar onAbrirRevision={vi.fn()} />);
    fireEvent.change(await screen.findByRole('combobox', { name: 'Alumno solicitante elegible' }), { target: { value: 'a-1' } });
    const pdf = new File(['%PDF-1.7'], 'anwar.pdf', { type: 'application/pdf' });
    Object.defineProperty(pdf, 'arrayBuffer', { value: async () => new TextEncoder().encode('%PDF-1.7').buffer });
    fireEvent.change(screen.getByLabelText('PDF local'), { target: { files: [pdf] } });
    await screen.findByText('SHA-256 local: ' + '0a'.repeat(32));
    fireEvent.change(screen.getByLabelText('Folio visible'), { target: { value: ' extra-1 ' } });
    fireEvent.change(screen.getByLabelText('Aciertos confirmados'), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText('Reactivos evaluables'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Criterios aplicados'), { target: { value: 'Criterio manual detallado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado externo' }));
    expect(await screen.findByText(/Confirma elegibilidad y solicitud/)).toBeInTheDocument();
    expect(enviarMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Aciertos confirmados'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado externo' }));
    await screen.findByText('Error de registro');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado externo' }));
    await waitFor(() => expect(enviarMock).toHaveBeenCalledTimes(2));
    expect(enviarMock.mock.calls[0][1].clientRequestId).toBe(enviarMock.mock.calls[1][1].clientRequestId);
  });
