/**
 * confirmDialogProvider.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialogProvider, useConfirmDialog } from '../src/ui/feedback/ConfirmDialogProvider';

function DialogTrigger({ onResult }: { onResult: (result: boolean) => void }) {
  const confirm = useConfirmDialog();
  return (
    <button type="button" onClick={async () => onResult(await confirm({
      title: 'Archivar materia',
      message: 'La materia dejará de mostrarse en la lista activa.',
      confirmLabel: 'Sí, archivar',
      details: ['Los datos se conservarán.']
    }))}>
      Archivar materia
    </button>
  );
}

describe('ConfirmDialogProvider contract', () => {
  it('rechaza usar el hook fuera del provider', async () => {
    const { result } = renderHook(() => useConfirmDialog());

    await expect(
      result.current({
        title: 'Confirmacion requerida',
        message: 'Esta llamada debe fallar fuera del provider.'
      })
    ).rejects.toThrow('useConfirmDialog debe usarse dentro de <ConfirmDialogProvider>');
  });

  it('contiene el foco, permite cancelar con Escape y lo devuelve al control invocador', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(
      <ConfirmDialogProvider>
        <DialogTrigger onResult={onResult} />
      </ConfirmDialogProvider>
    );

    const invocador = screen.getByRole('button', { name: 'Archivar materia' });
    await user.click(invocador);
    const dialogo = screen.getByRole('alertdialog', { name: 'Archivar materia' });
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    const confirmar = screen.getByRole('button', { name: 'Sí, archivar' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(cancelar).toHaveFocus();

    await user.tab();
    expect(confirmar).toHaveFocus();
    await user.tab();
    expect(cancelar).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(confirmar).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(false));
    expect(invocador).toHaveFocus();
  });

  it('resuelve afirmativamente y devuelve el foco al control invocador', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(
      <ConfirmDialogProvider>
        <DialogTrigger onResult={onResult} />
      </ConfirmDialogProvider>
    );

    const invocador = screen.getByRole('button', { name: 'Archivar materia' });
    await user.click(invocador);
    await user.click(screen.getByRole('button', { name: 'Sí, archivar' }));

    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(true));
    expect(invocador).toHaveFocus();
  });
});
