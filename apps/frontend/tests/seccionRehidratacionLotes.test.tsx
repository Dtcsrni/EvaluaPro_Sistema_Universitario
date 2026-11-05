/**
 * seccionRehidratacionLotes.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionRehidratacionLotes } from '../src/apps/app_docente/SeccionRehidratacionLotes';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { emitToast } from '../src/ui/toast/toastBus';
import { ErrorRemoto } from '../src/servicios_api/clienteComun';
import type { Docente } from '../src/apps/app_docente/tipos';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: vi.fn(),
    enviar: vi.fn(),
    eliminar: vi.fn(),
    registrarEventosUso: vi.fn().mockResolvedValue({})
  }
}));

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

describe('SeccionRehidratacionLotes', () => {
  const docenteMock: Docente = {
    _id: 'doc-1',
    nombre: 'Profesor Titular',
    correo: 'profesor@cuh.mx'
  };

  const bundlesMock = [
    {
      bundleHash: 'hash-bundle-12345',
      loteId: 'lote-101',
      templateVersion: 4,
      examCount: 25,
      questionBankCount: 10,
      signatureValid: true,
      recoverable: true,
      causes: []
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clienteApi.obtener).mockResolvedValue({ items: bundlesMock });
    vi.mocked(clienteApi.enviar).mockResolvedValue({});
  });

  it('mantiene el error de carga del inventario en el panel sin duplicarlo en un toast', async () => {
    vi.mocked(clienteApi.obtener).mockRejectedValueOnce(new Error('No se pudo cargar el inventario.'));

    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={true}
        puedeUsar={true}
      />
    );

    expect(await screen.findByText('No se pudo cargar el inventario.')).toBeVisible();
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('mantiene el error de verificación en el panel sin duplicarlo en un toast', async () => {
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('No se pudo verificar el paquete.'));
    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={true}
        puedeUsar={true}
      />
    );

    await screen.findByText(/Paquete activo: hash-bundle-12345/i);
    fireEvent.click(screen.getByRole('button', { name: /Verificar paquete/i }));

    expect(await screen.findByText('No se pudo verificar el paquete.')).toBeVisible();
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('mantiene el error de reconstrucción en el panel sin duplicarlo en un toast', async () => {
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('No se pudo reconstruir el paquete.'));
    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={true}
        puedeUsar={true}
      />
    );

    await screen.findByText(/Paquete activo: hash-bundle-12345/i);
    fireEvent.click(screen.getByRole('button', { name: /Reconstruir lote/i }));

    expect(await screen.findByText('No se pudo reconstruir el paquete.')).toBeVisible();
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('conserva el toast con acción complementaria cuando expira la sesión', async () => {
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new ErrorRemoto('La sesión expiró.', { status: 401 }));
    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={true}
        puedeUsar={true}
      />
    );

    await screen.findByText(/Paquete activo: hash-bundle-12345/i);
    fireEvent.click(screen.getByRole('button', { name: /Verificar paquete/i }));

    expect(await screen.findByText('La sesión expiró.')).toBeVisible();
    await waitFor(() => expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Renueva tu sesión docente',
      message: expect.stringContaining('Cierra sesión y vuelve a entrar'),
      action: expect.objectContaining({ label: 'Cerrar sesión' }),
      persistent: true
    })));
  });

  it('muestra mensaje de advertencia cuando no se tienen permisos para usar el módulo', () => {
    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={false}
        puedeUsar={false}
      />
    );

    expect(screen.getByText(/Esta capacidad de recuperación solo está disponible/i)).toBeInTheDocument();
  });

  it('lista paquetes recuperables, expone la selección y permite verificarlos', async () => {
    vi.mocked(clienteApi.enviar).mockResolvedValue({
      bundleHash: 'hash-bundle-12345',
      signatureValid: true,
      templateVersion: 4,
      examCount: 25,
      questionBankCount: 10,
      recoverable: true,
      causes: []
    });

    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={true}
        puedeUsar={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Paquete activo: hash-bundle-12345/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Estado de operación').parentElement).toHaveTextContent('Sin operación ejecutada');
    expect(screen.getByText('Estado de operación').nextElementSibling).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByText('Banco y exámenes recuperados')).not.toBeInTheDocument();
    expect(screen.getByText(/Pulsa «Verificar paquete» para comprobar su firma y compatibilidad/i)).toBeInTheDocument();
    expect(screen.queryByText(/recoveryBundle|recoveryManifest/)).not.toBeInTheDocument();

    const paquete = screen.getByRole('button', { name: /Lote lote-101/i });
    expect(paquete).toHaveAttribute('aria-pressed', 'true');
    expect(paquete.querySelector('div')).toBeNull();
    expect(document.querySelector('.calificaciones-kpi')).not.toHaveAttribute('aria-live');

    const botonVerificar = screen.getByRole('button', { name: /Verificar paquete/i });
    fireEvent.click(botonVerificar);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/recuperacion/verificar', {
        bundleHash: 'hash-bundle-12345'
      });
    });

    expect(emitToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Verificación del paquete' })
    );
    expect(await screen.findByText('Resultado de verificación')).toBeInTheDocument();
    expect(screen.getByText('Estado de operación').parentElement).toHaveTextContent('Verificado; sin reconstrucción');
  });

  it('permite reconstruir el lote cuando es recuperable', async () => {
    vi.mocked(clienteApi.enviar).mockResolvedValue({
      status: 'reconstruida',
      reconstructedExamIds: ['ex-1', 'ex-2'],
      reconstructedQuestionBankIds: ['preg-1'],
      conflicts: [],
      bundleHash: 'hash-bundle-12345',
      manifestHashes: ['man-1']
    });

    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={true}
        puedeUsar={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Paquete activo: hash-bundle-12345/i)).toBeInTheDocument();
    });

    const botonReconstruir = screen.getByRole('button', { name: /Reconstruir lote/i });
    fireEvent.click(botonReconstruir);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/recuperacion/bundle/reconstruir', {
        bundleHash: 'hash-bundle-12345'
      });
    });

    expect(emitToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Reconstrucción del lote' })
    );
    expect(await screen.findByText('Resultado de reconstrucción')).toBeInTheDocument();
    expect(screen.getByText('La reconstrucción quedó guardada sin conflictos estructurales.')).toBeInTheDocument();
    expect(screen.getByText('Estado de operación').parentElement).toHaveTextContent('Reconstrucción completada');
  });

  it('distingue la carga inicial del inventario vacío', () => {
    vi.mocked(clienteApi.obtener).mockImplementation(() => new Promise(() => undefined));

    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={false}
        puedeUsar={true}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Cargando inventario de paquetes de recuperación');
    expect(screen.getByText('Paquetes detectados').parentElement).toHaveTextContent('Cargando…');
    expect(screen.queryByText(/No se encontraron paquetes de recuperación/i)).not.toBeInTheDocument();
  });

  it('presenta un estado vacío claro cuando el inventario se carga sin resultados', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({ items: [] });

    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={false}
        puedeUsar={true}
      />
    );

    expect(await screen.findByText(/No se encontraron paquetes de recuperación/i)).toBeInTheDocument();
    expect(screen.getByText('Paquetes detectados').parentElement).toHaveTextContent('0');
  });

  it('no presenta el inventario vacío como resultado cuando falla la carga y ofrece reintento', async () => {
    vi.mocked(clienteApi.obtener).mockRejectedValueOnce(new Error('Sin conexión'));

    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={false}
        puedeUsar={true}
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    expect(screen.getByText('Paquetes detectados').parentElement).toHaveTextContent('No se pudo cargar');
    expect(screen.getByText('Estado de operación').parentElement).toHaveTextContent('No disponible');
    expect(screen.queryByText(/No se encontraron paquetes de recuperación/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar carga/i })).toBeInTheDocument();
  });

  it.each([
    { signatureValid: false, recoverable: true, motivo: /firma no es válida/i },
    { signatureValid: true, recoverable: false, motivo: /observaciones que impiden/i }
  ])('bloquea paquetes no aptos para reconstrucción y explica el motivo', async ({ signatureValid, recoverable, motivo }) => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({
      items: [{ ...bundlesMock[0]!, signatureValid, recoverable }]
    });

    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={false}
        puedeUsar={true}
      />
    );

    expect(await screen.findByText(motivo)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reconstruir lote/i })).toBeDisabled();
    expect(clienteApi.enviar).not.toHaveBeenCalled();
  });

  it('muestra ocupada solo la acción activa y bloquea cambios de paquete durante la verificación', async () => {
    let completarVerificacion: ((resultado: unknown) => void) | undefined;
    vi.mocked(clienteApi.enviar).mockImplementationOnce(() => new Promise((resolve) => {
      completarVerificacion = resolve;
    }));

    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={false}
        puedeUsar={true}
      />
    );
    await waitFor(() => expect(screen.getByText(/Paquete activo: hash-bundle-12345/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Verificar paquete/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Verificando el paquete seleccionado');
    expect(screen.getByRole('button', { name: /Verificar paquete/i })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: /Reconstruir lote/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Lote lote-101/i })).toBeDisabled();

    completarVerificacion?.({
      bundleHash: 'hash-bundle-12345', signatureValid: true, templateVersion: 4,
      examCount: 25, questionBankCount: 10, recoverable: true, causes: []
    });
    await waitFor(() => expect(screen.getByText('Resultado de verificación')).toBeInTheDocument());
  });

  it('retira una verificación anterior si la nueva consulta falla', async () => {
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({
      bundleHash: 'hash-bundle-12345', signatureValid: true, templateVersion: 4,
      examCount: 25, questionBankCount: 10, recoverable: true, causes: []
    });

    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={false}
        puedeUsar={true}
      />
    );
    await waitFor(() => expect(screen.getByText(/Paquete activo: hash-bundle-12345/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Verificar paquete/i }));
    expect(await screen.findByText('Resultado de verificación')).toBeInTheDocument();
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('No se pudo verificar'));

    fireEvent.click(screen.getByRole('button', { name: /Verificar paquete/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo verificar');
    expect(screen.queryByText('Resultado de verificación')).not.toBeInTheDocument();
  });

  it('presenta una reconstrucción fallida como error, no como guardado exitoso', async () => {
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({
      status: 'fallida', reconstructedExamIds: [], reconstructedQuestionBankIds: [],
      conflicts: [], bundleHash: 'hash-bundle-12345', manifestHashes: []
    });

    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={false}
        puedeUsar={true}
      />
    );
    await waitFor(() => expect(screen.getByText(/Paquete activo: hash-bundle-12345/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Reconstruir lote/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('La reconstrucción no se completó');
    expect(screen.getByText('Estado de operación').parentElement).toHaveTextContent('Reconstrucción fallida');
    expect(screen.queryByText('La reconstrucción quedó guardada sin conflictos estructurales.')).not.toBeInTheDocument();
  });

  it('resume un fallo de transporte sin afirmar que la reconstrucción se completó', async () => {
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('Servicio temporalmente no disponible'));

    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={false}
        puedeUsar={true}
      />
    );
    await waitFor(() => expect(screen.getByText(/Paquete activo: hash-bundle-12345/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Reconstruir lote/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio temporalmente no disponible');
    expect(screen.getByText('Estado de operación').parentElement).toHaveTextContent('Operación no completada');
  });

  it.each([
    { status: 'conflicto', conflicts: [{ cause: 'Folio discrepante' }], resumen: 'Conflictos detectados' },
    { status: 'verificada', conflicts: [], resumen: 'Verificado; sin reconstrucción' }
  ] as const)('mantiene distinto el estado de reconstrucción $status', async ({ status, conflicts, resumen }) => {
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({
      status, reconstructedExamIds: [], reconstructedQuestionBankIds: [],
      conflicts, bundleHash: 'hash-bundle-12345', manifestHashes: []
    });

    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={false}
        puedeUsar={true}
      />
    );
    await waitFor(() => expect(screen.getByText(/Paquete activo: hash-bundle-12345/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Reconstruir lote/i }));

    expect(await screen.findByText('Resultado de reconstrucción')).toBeInTheDocument();
    expect(screen.getByText('Estado de operación').parentElement).toHaveTextContent(resumen);
  });

  it('mantiene las observaciones del paquete fuera del botón de selección', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({
      items: [{ ...bundlesMock[0]!, causes: ['El manifiesto requiere revisión'] }]
    });

    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={false}
        puedeUsar={true}
      />
    );

    const observacion = await screen.findByText('El manifiesto requiere revisión');
    expect(observacion.closest('button')).toBeNull();
  });

  it('mantiene el apoyo visual plegado y lo explica al abrirlo', () => {
    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={false}
        puedeUsar={true}
      />
    );

    const titulo = screen.getByText('Apoyo visual (opcional)');
    const disclosure = titulo.closest('details');
    expect(disclosure).not.toHaveAttribute('open');
    fireEvent.click(titulo);

    expect(screen.getByText(/comprueba que el servicio de apoyo esté en ejecución y que la URL configurada sea correcta/i)).toBeVisible();
    expect(screen.queryByText(/test:omr:canonical:gate:ci/i)).not.toBeInTheDocument();
  });
});
