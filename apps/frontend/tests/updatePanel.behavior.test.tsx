import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UpdatePanel } from '../src/ui/version/UpdatePanel';

describe('UpdatePanel', () => {
  it('habilita acciones según estado', () => {
    render(
      <UpdatePanel
        status={{
          state: 'available',
          availableVersion: '1.2.3',
          diffSummary: { counts: { releaseRelevantFiles: 4 } }
        }}
        onCheck={vi.fn()}
        onDownload={vi.fn()}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('update-state')).toHaveTextContent('available');
    expect(screen.getByTestId('update-version')).toHaveTextContent('1.2.3');
    expect(screen.getByTestId('update-diff-summary')).toHaveTextContent('Cambios relevantes beta: 4');
    expect(screen.getByRole('button', { name: 'Descargar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
  });

  it('muestra bloqueo y error en fase applying/error', () => {
    const onApply = vi.fn();
    render(
      <UpdatePanel
        status={{ state: 'error', lastError: 'Falló preflight' }}
        onCheck={vi.fn()}
        onDownload={vi.fn()}
        onApply={onApply}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('update-error')).toHaveTextContent('Falló preflight');
    const apply = screen.getByRole('button', { name: 'Aplicar' });
    expect(apply).toBeDisabled();
    fireEvent.click(apply);
    expect(onApply).not.toHaveBeenCalled();
  });
});
