/**
 * appDocente.secciones.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AppDocente } from '../src/apps/app_docente/AppDocente';
import { TemaProvider } from '../src/tema/TemaProvider';

describe('AppDocente secciones (refactor)', () => {
  it('muestra tabs principales con token', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    const user = userEvent.setup();
    render(
      <TemaProvider>
        <AppDocente />
      </TemaProvider>
    );

    expect(await screen.findByRole('navigation', { name: 'Secciones del portal docente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Materias' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Plantillas' }));
    expect(await screen.findByRole('heading', { name: /^Plantillas$/i })).toBeInTheDocument();
  });
});
