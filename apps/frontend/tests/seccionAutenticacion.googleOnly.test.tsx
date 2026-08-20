/**
 * seccionAutenticacion.googleOnly.test
 *
 * Responsabilidad: Pruebas unitarias de SeccionAutenticacion en modo google-only.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SeccionAutenticacion } from '../src/apps/app_docente/SeccionAutenticacion';

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => <button type="button">Google Login</button>
}));

describe('SeccionAutenticacion google-only', () => {
  it('muestra modo Google-only y oculta el login por contraseña', async () => {
    render(
      <SeccionAutenticacion
        onIngresar={() => {}}
        oauthGoogleDisponible
        requireGoogleOAuth
        passwordLoginAllowed={false}
      />
    );

    expect(screen.getByText(/requiere inicio de sesión con Google/i)).toBeInTheDocument();
    expect(screen.getByText('Google Login')).toBeInTheDocument();
    expect(screen.queryByLabelText('Contrasena')).not.toBeInTheDocument();
  });

  it('permite alternar entre tabs en modo Google-only y muestra notas informativas', async () => {
    const user = userEvent.setup();
    render(
      <SeccionAutenticacion
        onIngresar={() => {}}
        oauthGoogleDisponible
        requireGoogleOAuth
        passwordLoginAllowed={false}
      />
    );

    await user.click(screen.getByRole('button', { name: /^Registrar$/i }));
    expect(screen.getByText(/Modo Google-only activo/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Ingresar$/i }));
    expect(screen.getByText(/requiere inicio de sesión con Google/i)).toBeInTheDocument();
  });
});
