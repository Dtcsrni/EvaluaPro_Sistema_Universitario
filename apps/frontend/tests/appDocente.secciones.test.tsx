/**
 * appDocente.secciones.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppDocente } from '../src/apps/app_docente/AppDocente';
import { ConfirmDialogProvider } from '../src/ui/feedback/ConfirmDialogProvider';
import { TemaProvider } from '../src/tema/TemaProvider';

describe('AppDocente secciones (refactor)', () => {
  it('muestra tabs principales con token', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    render(
      <TemaProvider>
        <ConfirmDialogProvider>
          <AppDocente />
        </ConfirmDialogProvider>
      </TemaProvider>
    );

    const nav = await screen.findByRole('navigation', { name: 'Secciones del portal docente' });
    expect(within(nav).getByRole('button', { name: 'Materias' })).toBeInTheDocument();
    fireEvent.click(within(nav).getByRole('button', { name: /Plantillas|Diseño de Exámenes/i }));
    expect(await screen.findByRole('heading', { name: 'Diseño de Exámenes' })).toBeInTheDocument();
  });
});
