/**
 * seccionAutenticacion.test
 *
 * Responsabilidad: Pruebas unitarias de SeccionAutenticacion.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeccionAutenticacion } from '../src/apps/app_docente/SeccionAutenticacion';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { ErrorRemoto } from '../src/servicios_api/clienteComun';
import * as versionInfoModule from '../src/ui/version/versionInfo';
import * as utilidadesModule from '../src/apps/app_docente/utilidades';

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess, onError }: { onSuccess: (cred: { credential?: string }) => void; onError?: () => void }) => {
    return (
      <div>
        <button
          type="button"
          data-testid="mock-google-login"
          onClick={() => onSuccess({ credential: 'mock.eyJlbWFpbCI6Imdvb2dsZUBsb2NhbC50ZXN0IiwibmFtZSI6Ikp1YW4gUGVyZXogTG9wZXoiLCJnaXZlbl9uYW1lIjoiSnVhbiIsImZhbWlseV9uYW1lIjoiUGVyZXoifQ.sig' })}
        >
          Google Login Mock
        </button>
        <button
          type="button"
          data-testid="mock-google-login-single-name"
          onClick={() => onSuccess({ credential: 'mock.eyJlbWFpbCI6InVuaWNvQGxvY2FsLnRlc3QiLCJuYW1lIjoiU29sb05vbWJyZSJ9.sig' })}
        >
          Google Single Name Mock
        </button>
        <button
          type="button"
          data-testid="mock-google-login-empty"
          onClick={() => onSuccess({})}
        >
          Google Empty Cred
        </button>
        <button
          type="button"
          data-testid="mock-google-login-two-parts"
          onClick={() => onSuccess({ credential: 'mock.eyJlbWFpbCI6InBlZHJvQGxvY2FsLnRlc3QiLCJuYW1lIjoiUGVkcm8gU2FuY2hleiJ9.sig' })}
        >
          Google Two Parts Name Mock
        </button>
        <button
          type="button"
          data-testid="mock-google-login-invalid-jwt"
          onClick={() => onSuccess({ credential: 'invalid.invalid_json.sig' })}
        >
          Google Invalid JWT Mock
        </button>
        <button
          type="button"
          data-testid="mock-google-empty-token"
          onClick={() => onSuccess({ credential: '' })}
        >
          Google Empty Token
        </button>
        <button
          type="button"
          data-testid="mock-google-error"
          onClick={() => onError && onError()}
        >
          Google Error Mock
        </button>
      </div>
    );
  }
}));

describe('SeccionAutenticacion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('ingresa con correo/contrasena y notifica token', async () => {
    const user = userEvent.setup();
    const onIngresar = vi.fn();
    vi.spyOn(clienteApi, 'enviar').mockResolvedValueOnce({ token: 'token-prueba' });

    render(<SeccionAutenticacion onIngresar={onIngresar} />);

    await user.click(screen.getByRole('button', { name: /^Ingresar$/i }));

    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'docente@local.test' } });
    fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: '12345678' } });
    const botonesIngresar = screen.getAllByRole('button', { name: /^Ingresar$/i });
    await user.click(botonesIngresar[botonesIngresar.length - 1]);

    expect(clienteApi.enviar).toHaveBeenCalledWith('/autenticacion/ingresar', {
      correo: 'docente@local.test',
      contrasena: '12345678'
    });
    expect(onIngresar).toHaveBeenCalledWith('token-prueba');
  });

  it('permite registrar cuenta por formulario con codigo de licencia', async () => {
    const user = userEvent.setup();
    const onIngresar = vi.fn();
    vi.spyOn(clienteApi, 'enviar').mockResolvedValueOnce({ token: 'token-registro' });

    render(<SeccionAutenticacion onIngresar={onIngresar} primerUso />);

    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Gomez' } });
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@local.test' } });
    fireEvent.change(screen.getByLabelText(/Clave o Código de Licencia/i), { target: { value: 'LIC-2026-DOC-TEST' } });
    fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: 'segura123' } });
    await user.click(screen.getByRole('button', { name: /Crear cuenta/i }));

    expect(clienteApi.enviar).toHaveBeenCalledWith('/autenticacion/registrar', {
      nombres: 'Ana',
      apellidos: 'Gomez',
      correo: 'ana@local.test',
      contrasena: 'segura123',
      codigoLicencia: 'LIC-2026-DOC-TEST'
    });
    expect(onIngresar).toHaveBeenCalledWith('token-registro');
  });

  it('bloquea crear cuenta cuando faltan datos en registro', async () => {
    render(<SeccionAutenticacion onIngresar={() => {}} />);
    expect(screen.getByRole('button', { name: /Crear cuenta/i })).toBeDisabled();
  });

  it('maneja error 429 e inicia cooldown al ingresar', async () => {
    const user = userEvent.setup();
    const error429 = new ErrorRemoto('Rate limited', { status: 429, error: 'Demasiadas solicitudes' });
    vi.spyOn(clienteApi, 'enviar').mockRejectedValueOnce(error429);

    render(<SeccionAutenticacion onIngresar={() => {}} />);

    await user.click(screen.getByRole('button', { name: /^Ingresar$/i }));
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'docente@local.test' } });
    fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: '12345678' } });

    const botonesIngresar = screen.getAllByRole('button', { name: /^Ingresar$/i });
    await user.click(botonesIngresar[botonesIngresar.length - 1]);

    expect(screen.getByText(/Demasiadas solicitudes/i)).toBeInTheDocument();
    expect(botonesIngresar[botonesIngresar.length - 1]).toBeDisabled();
  });

  it('invita a registrar cuando el docente no está registrado', async () => {
    const user = userEvent.setup();
    const errorNoRegistrado = new ErrorRemoto('No registrado', { status: 404, codigo: 'DOCENTE_NO_REGISTRADO' });
    vi.spyOn(clienteApi, 'enviar').mockRejectedValueOnce(errorNoRegistrado);

    render(<SeccionAutenticacion onIngresar={() => {}} />);

    await user.click(screen.getByRole('button', { name: /^Ingresar$/i }));
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'docente@local.test' } });
    fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: '12345678' } });

    const botonesIngresar = screen.getAllByRole('button', { name: /^Ingresar$/i });
    await user.click(botonesIngresar[botonesIngresar.length - 1]);

    await waitFor(() => {
      expect(screen.getByText(/No existe una cuenta para ese correo/i)).toBeInTheDocument();
    });
  });

  it('permite iniciar sesion con Google en modo ingresar', async () => {
    const user = userEvent.setup();
    const onIngresar = vi.fn();
    vi.spyOn(clienteApi, 'enviar').mockResolvedValueOnce({ token: 'token-google' });

    render(<SeccionAutenticacion onIngresar={onIngresar} oauthGoogleDisponible />);

    await user.click(screen.getByRole('button', { name: /^Ingresar$/i }));

    const googleBtn = screen.getByTestId('mock-google-login');
    await user.click(googleBtn);

    expect(clienteApi.enviar).toHaveBeenCalledWith('/autenticacion/google', expect.objectContaining({
      credential: expect.stringContaining('mock.')
    }));
    expect(onIngresar).toHaveBeenCalledWith('token-google');
  });

  it('maneja error al ingresar con Google cuando el docente no está registrado', async () => {
    const user = userEvent.setup();
    const errorNoRegistrado = new ErrorRemoto('No registrado', { status: 404, codigo: 'DOCENTE_NO_REGISTRADO' });
    vi.spyOn(clienteApi, 'enviar').mockRejectedValueOnce(errorNoRegistrado);

    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    await user.click(screen.getByRole('button', { name: /^Ingresar$/i }));

    const googleBtn = screen.getByTestId('mock-google-login');
    await user.click(googleBtn);

    await waitFor(() => {
      expect(screen.getByText(/No existe una cuenta para ese correo/i)).toBeInTheDocument();
    });
  });

  it('permite registrar con Google completando el formulario precargado', async () => {
    const user = userEvent.setup();
    const onIngresar = vi.fn();
    vi.spyOn(clienteApi, 'enviar').mockResolvedValueOnce({ token: 'token-reg-google' });

    render(<SeccionAutenticacion onIngresar={onIngresar} oauthGoogleDisponible />);

    const googleBtn = screen.getByTestId('mock-google-login');
    await user.click(googleBtn);

    expect(screen.getByLabelText('Nombres')).toHaveValue('Juan Perez');
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Lopez');
    expect(screen.getByLabelText(/Correo/i)).toHaveValue('google@local.test');

    const checkboxContrasena = screen.getByLabelText(/Crear contrasena ahora/i);
    await user.click(checkboxContrasena);
    await user.click(checkboxContrasena);

    const cambiarCorreoBtn = screen.getByRole('button', { name: /Cambiar correo/i });
    expect(cambiarCorreoBtn).toBeEnabled();

    const crearBtn = screen.getByRole('button', { name: /Crear cuenta/i });
    await user.click(crearBtn);

    expect(clienteApi.enviar).toHaveBeenCalledWith('/autenticacion/registrar-google', expect.objectContaining({
      nombres: 'Juan Perez',
      apellidos: 'Lopez'
    }));
    expect(onIngresar).toHaveBeenCalledWith('token-reg-google');
  });

  it('permite alternar recuperación de contraseña con Google', async () => {
    const user = userEvent.setup();
    const onIngresar = vi.fn();
    vi.spyOn(clienteApi, 'enviar').mockResolvedValueOnce({ token: 'token-recuperado' });

    render(<SeccionAutenticacion onIngresar={onIngresar} oauthGoogleDisponible />);

    await user.click(screen.getByRole('button', { name: /^Ingresar$/i }));
    await user.click(screen.getByRole('button', { name: /Recuperar contrasena con Google/i }));

    expect(screen.getByText(/Si tu cuenta tiene Google vinculado/i)).toBeInTheDocument();

    const googleBtns = screen.getAllByTestId('mock-google-login');
    await user.click(googleBtns[googleBtns.length - 1]);

    fireEvent.change(screen.getByLabelText(/Nueva contrasena/i), { target: { value: 'nueva12345' } });
    await user.click(screen.getByRole('button', { name: /Actualizar contrasena/i }));

    expect(clienteApi.enviar).toHaveBeenCalledWith('/autenticacion/recuperar-contrasena-google', expect.objectContaining({
      contrasenaNueva: 'nueva12345'
    }));
    expect(onIngresar).toHaveBeenCalledWith('token-recuperado');
  });

  it('abre la ventana de version al hacer click en el chip de version', async () => {
    const user = userEvent.setup();
    const spyVersion = vi.spyOn(versionInfoModule, 'abrirVentanaVersion').mockImplementation(() => {});

    render(<SeccionAutenticacion onIngresar={() => {}} />);

    const versionBtn = screen.getByTitle(/Abrir información de versión/i);
    await user.click(versionBtn);

    expect(spyVersion).toHaveBeenCalledWith('docente');
  });

  it('valida politicas de dominio institucional en ingresar y registrar', async () => {
    const user = userEvent.setup();
    vi.spyOn(utilidadesModule, 'obtenerDominiosCorreoPermitidosFrontend').mockReturnValue(['@universidad.edu.mx']);

    render(<SeccionAutenticacion onIngresar={() => {}} />);

    // Domain check on ingresar
    await user.click(screen.getByRole('button', { name: /^Ingresar$/i }));
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'docente@externo.com' } });
    fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: '12345678' } });

    const botonesIngresar = screen.getAllByRole('button', { name: /^Ingresar$/i });
    await user.click(botonesIngresar[botonesIngresar.length - 1]);

    expect(screen.getByText(/Solo se permiten correos institucionales/i)).toBeInTheDocument();

    // Domain check on registrar
    await user.click(screen.getByRole('button', { name: /^Registrar$/i }));

    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Doc' } });
    fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'docente@externo.com' } });
    fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: '12345678' } });

    await user.click(screen.getByRole('button', { name: /Crear cuenta/i }));
    expect(screen.getByText(/Solo se permiten correos institucionales/i)).toBeInTheDocument();
  });

  it('permite alternar entre Google y formulario en modo registrar', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    const registrarFormBtn = screen.getByRole('button', { name: /Registrar con correo y contrasena/i });
    await user.click(registrarFormBtn);

    expect(screen.getByRole('button', { name: /Volver a Google/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Volver a Google/i }));

    expect(screen.getByRole('button', { name: /Registrar con correo y contrasena/i })).toBeInTheDocument();
  });

  it('permite alternar formulario en modo ingresar con Google', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    await user.click(screen.getByRole('button', { name: /^Ingresar$/i }));

    const toggleFormBtn = screen.getByRole('button', { name: /Ingresar con correo y contrasena/i });
    await user.click(toggleFormBtn);

    expect(screen.getByRole('button', { name: /Ocultar formulario/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Ocultar formulario/i }));
  });

  it('maneja errores 429 y rechazos al registrar o recuperar', async () => {
    const user = userEvent.setup();
    const error429 = new ErrorRemoto('Rate limited', { status: 429, error: 'Demasiadas solicitudes' });
    vi.spyOn(clienteApi, 'enviar').mockRejectedValueOnce(error429);

    render(<SeccionAutenticacion onIngresar={() => {}} />);

    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Gomez' } });
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@local.test' } });
    fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: 'segura123' } });

    await user.click(screen.getByRole('button', { name: /Crear cuenta/i }));
    expect(screen.getByText(/Demasiadas solicitudes/i)).toBeInTheDocument();
  });

  it('maneja Google error callbacks y nombres únicos', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    // Trigger Google Single Name mock
    const singleNameBtn = screen.getByTestId('mock-google-login-single-name');
    await user.click(singleNameBtn);
    expect(screen.getByLabelText('Nombres')).toHaveValue('SoloNombre');

    // Trigger Google Error Mock
    const errorBtn = screen.getByTestId('mock-google-error');
    await user.click(errorBtn);
    expect(screen.getByText(/No se pudo obtener datos de Google/i)).toBeInTheDocument();
  });

  it('valida dominio institucional en login y recuperacion con Google', async () => {
    const user = userEvent.setup();
    vi.spyOn(utilidadesModule, 'obtenerDominiosCorreoPermitidosFrontend').mockReturnValue(['@institucional.edu']);

    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    // En modo ingresar con Google
    await user.click(screen.getByRole('button', { name: /^Ingresar$/i }));
    const googleBtn = screen.getByTestId('mock-google-login');
    await user.click(googleBtn);
    expect(screen.getByText(/Solo se permiten correos institucionales/i)).toBeInTheDocument();

    // En recuperacion con Google
    await user.click(screen.getByRole('button', { name: /Recuperar contrasena con Google/i }));
    const googleBtns = screen.getAllByTestId('mock-google-login');
    await user.click(googleBtns[googleBtns.length - 1]);
    fireEvent.change(screen.getByLabelText(/Nueva contrasena/i), { target: { value: 'nueva12345' } });
    await user.click(screen.getByRole('button', { name: /Actualizar contrasena/i }));
    expect(screen.getByText(/Solo se permiten correos institucionales/i)).toBeInTheDocument();
  });

  it('maneja error 429 al recuperar contrasena con Google', async () => {
    const user = userEvent.setup();
    const error429 = new ErrorRemoto('Rate limited', { status: 429, error: 'Demasiadas solicitudes' });
    vi.spyOn(clienteApi, 'enviar').mockRejectedValueOnce(error429);

    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    await user.click(screen.getByRole('button', { name: /^Ingresar$/i }));
    await user.click(screen.getByRole('button', { name: /Recuperar contrasena con Google/i }));

    const googleBtns = screen.getAllByTestId('mock-google-login');
    await user.click(googleBtns[googleBtns.length - 1]);

    fireEvent.change(screen.getByLabelText(/Nueva contrasena/i), { target: { value: 'nueva12345' } });
    await user.click(screen.getByRole('button', { name: /Actualizar contrasena/i }));

    expect(screen.getByText(/Demasiadas solicitudes/i)).toBeInTheDocument();
  });

  it('permite modificar todos los campos en modo registro por formulario', async () => {
    render(<SeccionAutenticacion onIngresar={() => {}} />);

    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Docente' } });
    fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Prueba' } });
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'docente@test.com' } });
    fireEvent.change(screen.getByLabelText(/Clave o Código de Licencia/i), { target: { value: 'LIC-123' } });
    fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: 'password123' } });

    expect(screen.getByLabelText('Nombres')).toHaveValue('Docente');
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Prueba');
    expect(screen.getByLabelText('Correo')).toHaveValue('docente@test.com');
    expect(screen.getByLabelText(/Clave o Código de Licencia/i)).toHaveValue('LIC-123');
    expect(screen.getByLabelText('Contrasena')).toHaveValue('password123');
  });

  it('permite editar nombres y clave de licencia tras registro con Google', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    const googleBtn = screen.getByTestId('mock-google-login');
    await user.click(googleBtn);

    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Juan Modificado' } });
    fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Perez Modificado' } });
    fireEvent.change(screen.getByLabelText(/Clave o Código de Licencia/i), { target: { value: 'LIC-GOOGLE-123' } });

    expect(screen.getByLabelText('Nombres')).toHaveValue('Juan Modificado');
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Perez Modificado');
    expect(screen.getByLabelText(/Clave o Código de Licencia/i)).toHaveValue('LIC-GOOGLE-123');
  });

  it('valida datos obligatorios de nombres y apellidos en registro', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    const googleBtn = screen.getByTestId('mock-google-login');
    await user.click(googleBtn);

    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: ' ' } });
    const crearBtn = screen.getByRole('button', { name: /Crear cuenta/i });
    expect(crearBtn).toBeDisabled();
  });

  it('maneja error 429 y credencial vacía en login con Google', async () => {
    const user = userEvent.setup();
    const error429 = new ErrorRemoto('Rate limited', { status: 429, error: 'Demasiadas solicitudes' });
    vi.spyOn(clienteApi, 'enviar').mockRejectedValueOnce(error429);

    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    await user.click(screen.getByRole('button', { name: /^Ingresar$/i }));
    const googleBtn = screen.getByTestId('mock-google-login');
    await user.click(googleBtn);
    expect(screen.getByText(/Demasiadas solicitudes/i)).toBeInTheDocument();

    const emptyBtn = screen.getByTestId('mock-google-login-empty');
    await user.click(emptyBtn);
    expect(screen.getByText(/No se recibio credencial de Google/i)).toBeInTheDocument();
  });

  it('maneja credencial vacía en registro con Google y alternar contraseña opcional', async () => {
    const user = userEvent.setup();
    const { container } = render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    const emptyBtn = screen.getByTestId('mock-google-login-empty');
    await user.click(emptyBtn);
    expect(screen.getByText(/No se recibio credencial de Google/i)).toBeInTheDocument();

    const googleBtn = screen.getByTestId('mock-google-login');
    await user.click(googleBtn);

    const checkboxContrasena = screen.getByLabelText(/Crear contrasena ahora/i);
    await user.click(checkboxContrasena);
    expect(checkboxContrasena).toBeChecked();

    const passwordInput = container.querySelector('input[type="password"]');
    if (passwordInput) {
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
    }

    await user.click(checkboxContrasena);
    expect(checkboxContrasena).not.toBeChecked();
  });

  it('procesa nombre compuesto de Google sin given_name ni family_name', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    const twoPartsBtn = screen.getByTestId('mock-google-login-two-parts');
    await user.click(twoPartsBtn);

    expect(screen.getByLabelText('Nombres')).toHaveValue('Pedro');
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Sanchez');
  });

  it('maneja JWT con formato invalido sin crashear', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    const invalidBtn = screen.getByTestId('mock-google-login-invalid-jwt');
    await user.click(invalidBtn);

    expect(screen.getByLabelText('Nombres')).toHaveValue('');
  });

  it('invita a registrar desde Google cuando el token solo tiene name compuesto y no esta registrado', async () => {
    const user = userEvent.setup();
    const errorNoRegistrado = new ErrorRemoto('No registrado', { status: 404, codigo: 'DOCENTE_NO_REGISTRADO' });
    vi.spyOn(clienteApi, 'enviar').mockRejectedValueOnce(errorNoRegistrado);

    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    await user.click(screen.getByRole('button', { name: /^Ingresar$/i }));
    const twoPartsBtn = screen.getByTestId('mock-google-login-two-parts');
    await user.click(twoPartsBtn);

    await waitFor(() => {
      expect(screen.getByText(/No existe una cuenta para ese correo/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Nombres')).toHaveValue('Pedro');
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Sanchez');
  });

  it('rechaza registro con Google si el correo de Google no cumple el dominio permitido', async () => {
    const user = userEvent.setup();
    vi.spyOn(utilidadesModule, 'obtenerDominiosCorreoPermitidosFrontend').mockReturnValue(['@institucional.edu']);

    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    const googleBtn = screen.getByTestId('mock-google-login');
    await user.click(googleBtn);

    expect(screen.getByText(/Solo se permiten correos institucionales/i)).toBeInTheDocument();
  });
});
