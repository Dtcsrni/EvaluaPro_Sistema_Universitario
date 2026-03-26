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

  it('usa valores por defecto cuando faltan datos de estado', () => {
    render(
      <UpdatePanel
        status={{ state: '' }}
        onCheck={vi.fn()}
        onDownload={vi.fn()}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('update-state')).toHaveTextContent('idle');
    expect(screen.getByTestId('update-progress')).toHaveTextContent('0%');
    expect(screen.getByTestId('update-diff-summary')).toHaveTextContent('Sin resumen estructurado');
    expect(screen.getByTestId('update-error')).toHaveTextContent('Sin errores');
  });

  it('bloquea acciones durante checking/downloading y habilita cancelar en descarga', () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <UpdatePanel
        status={{ state: 'checking' }}
        onCheck={vi.fn()}
        onDownload={vi.fn()}
        onApply={vi.fn()}
        onCancel={onCancel}
      />
    );

    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descargar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();

    rerender(
      <UpdatePanel
        status={{ state: 'downloading', download: { percent: 55 } }}
        onCheck={vi.fn()}
        onDownload={vi.fn()}
        onApply={vi.fn()}
        onCancel={onCancel}
      />
    );

    expect(screen.getByTestId('update-progress')).toHaveTextContent('55%');
    const cancel = screen.getByRole('button', { name: 'Cancelar' });
    expect(cancel).toBeEnabled();
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
