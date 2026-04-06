import { render, screen } from '@testing-library/react';
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
});
