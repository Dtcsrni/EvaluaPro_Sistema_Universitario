import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeccionInstantaneaLocal } from '../src/apps/app_docente/SeccionInstantaneaLocal';
import { emitToast } from '../src/ui/toast/toastBus';

vi.mock('../src/ui/toast/toastBus', () => ({ emitToast: vi.fn() }));

const mockConfirm = vi.fn().mockResolvedValue(true);
vi.mock('../src/ui/feedback/ConfirmDialogProvider', () => ({
  useConfirmDialog: () => mockConfirm
}));

describe('SeccionInstantaneaLocal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('explica por qué exportar e importar aún no están disponibles y a quién pedir la configuración', () => {
    render(
      <SeccionInstantaneaLocal
        puedeUsarContrasena={false}
        puedeUsarGoogle={false}
        onExportar={vi.fn()}
        onImportar={vi.fn()}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(/No puedes exportar ni importar respaldos completos todavía/i);
    expect(screen.getByRole('status')).toHaveTextContent(/Pide al administrador local/i);
    expect(screen.queryByRole('button', { name: /Exportar respaldo completo/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Importar respaldo completo/i)).not.toBeInTheDocument();
  });

  it('marca como alerta el error contextual sin repetirlo en un toast', async () => {
    const onExportar = vi.fn().mockRejectedValue(new Error('El respaldo no está disponible'));
    render(
      <SeccionInstantaneaLocal
        puedeUsarContrasena
        puedeUsarGoogle={false}
        onExportar={onExportar}
        onImportar={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/Contraseña actual/i), { target: { value: 'clave-dummy-123' } });
    fireEvent.click(screen.getByRole('button', { name: /Exportar respaldo completo/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/El respaldo no está disponible/i);
    expect(screen.getByRole('alert')).not.toHaveTextContent('clave-dummy-123');
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('explica la credencial faltante como alerta y evita iniciar la exportación', () => {
    const onExportar = vi.fn();
    render(
      <SeccionInstantaneaLocal
        puedeUsarContrasena
        puedeUsarGoogle={false}
        onExportar={onExportar}
        onImportar={vi.fn()}
      />
    );

    expect(screen.getByRole('option', { name: 'Contraseña de cuenta' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Exportar respaldo completo/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Escribe la contraseña actual/i);
    expect(onExportar).not.toHaveBeenCalled();
  });

  it('explica que debe volver a elegir el archivo si falta la credencial de importación', () => {
    const onImportar = vi.fn();
    render(
      <SeccionInstantaneaLocal
        puedeUsarContrasena
        puedeUsarGoogle={false}
        onExportar={vi.fn()}
        onImportar={onImportar}
      />
    );

    const selector = screen.getByLabelText(/Importar respaldo completo/i) as HTMLInputElement;
    fireEvent.change(selector, {
      target: { files: [new File(['respaldo dummy'], 'respaldo-dummy.ep-snapshot', { type: 'application/octet-stream' })] }
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/Escribe la contraseña actual de tu cuenta docente y vuelve a seleccionar el archivo/i);
    expect(onImportar).not.toHaveBeenCalled();
  });
});
