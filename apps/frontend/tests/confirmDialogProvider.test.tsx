/**
 * confirmDialogProvider.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useConfirmDialog } from '../src/ui/feedback/ConfirmDialogProvider';

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
});
