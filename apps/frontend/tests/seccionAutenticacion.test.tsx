/**
 * seccionAutenticacion.test
 *
 * Responsabilidad: Pruebas unitarias de SeccionAutenticacion.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeccionAutenticacion } from '../src/apps/app_docente/SeccionAutenticacion';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { ErrorRemoto } from '../src/servicios_api/clienteComun';
import * as versionInfoModule from '../src/ui/version/versionInfo';

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess, onError, theme, text }: {
    onSuccess: (cred: { credential?: string }) => void;
    onError?: () => void;
    theme?: string;
    text?: string;
  }) => {
    return (
      <div data-google-theme={theme} data-google-text={text}>
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
    localStorage.clear();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('nombra el grupo de modos y expone cuál está activo', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    const grupoModoAcceso = screen.getByRole('group', { name: 'Modo de acceso' });
    const ingresar = within(grupoModoAcceso).getByRole('button', { name: /Ingresar/i });
    const registrar = within(grupoModoAcceso).getByRole('button', { name: /Registrar/i });

    expect(ingresar).toHaveAttribute('aria-pressed', 'true');
    expect(registrar).toHaveAttribute('aria-pressed', 'false');
    await user.click(registrar);
    expect(ingresar).toHaveAttribute('aria-pressed', 'false');
    expect(registrar).toHaveAttribute('aria-pressed', 'true');
  });

  it('evita mostrar Google Web duplicado en Registro cuando Google Desktop está disponible', () => {
    render(
      <SeccionAutenticacion
        onIngresar={() => {}}
        oauthGoogleDisponible
        oauthGoogleDesktopDisponible
        modoInicial="registrar"
      />
    );

    expect(screen.getAllByRole('button', { name: 'Acceder con Google' })).toHaveLength(1);
    expect(screen.queryByTestId('mock-google-login')).not.toBeInTheDocument();
  });

  it('describe las funciones de acceso sin prometer latencias ni privacidad absoluta', () => {
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    expect(screen.getByRole('heading', { name: 'Evaluación docente y calificación OMR' })).toBeInTheDocument();
    expect(screen.getByText('Organiza tus materias, genera exámenes impresos con QR y revisa hojas ópticas con ayuda de OMR.')).toBeInTheDocument();
    expect(screen.getByText('Procesa lotes de hojas escaneadas y revisa sus resultados.')).toBeInTheDocument();
    expect(screen.getByText('La base de datos de EvaluaPro se guarda en SQLite en este equipo.')).toBeInTheDocument();
    expect(screen.getByText('Base de datos SQLite en este equipo')).toBeInTheDocument();
    expect(screen.queryByText(/instantánea|en segundos|al instante|privacidad local total|100% locales/i)).not.toBeInTheDocument();
    const ilustracionOmr = document.querySelector('.auth-omr-mockup-card');
    expect(ilustracionOmr).toHaveTextContent('Leída');
    expect(ilustracionOmr).toHaveTextContent('Procesa las hojas y revisa los resultados.');
    expect(ilustracionOmr).not.toHaveTextContent(/100%|precisa|<\s*1\s*seg/i);
  });

  it('configura el boton oficial de Google con tema y texto de alto contraste', () => {
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    const googleLogin = screen.getByTestId('mock-google-login').parentElement;
    expect(googleLogin).toHaveAttribute('data-google-theme', 'filled_blue');
    expect(googleLogin).toHaveAttribute('data-google-text', 'signin_with');
  });

  it('en desarrollo no oculta Google si el backend pierde su configuración y muestra el diagnóstico', () => {
    vi.stubEnv('DEV', true);
    render(
      <SeccionAutenticacion
        onIngresar={() => {}}
        oauthGoogleDisponible
        oauthGoogleBackendDisponible={false}
      />
    );

    expect(screen.getByTestId('mock-google-login')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/no reporta su configuración OAuth/i);
    expect(screen.getByRole('button', { name: /copiar diagnóstico de acceso/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Correo/)).toBeInTheDocument();
  });

  it('en producción oculta diagnósticos de configuración y copia sin ocultar los accesos', () => {
    vi.stubEnv('DEV', false);
    render(
      <SeccionAutenticacion
        onIngresar={() => {}}
        oauthGoogleDisponible
        oauthGoogleBackendDisponible={false}
      />
    );

    expect(screen.getByTestId('mock-google-login')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copiar diagnóstico de acceso/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/no reporta su configuración OAuth/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Correo/)).toBeInTheDocument();
  });

  it('mantiene un acceso de recuperación visible si falta el Client ID y reintenta cargarlo', async () => {
    const user = userEvent.setup();
    const onReintentarGoogle = vi.fn().mockResolvedValue(false);
    render(<SeccionAutenticacion onIngresar={() => {}} onReintentarGoogle={onReintentarGoogle} oauthGoogleDisponible={false} oauthGoogleConsultaFallida />);

    await user.click(screen.getByRole('button', { name: /Volver a consultar Google/i }));

    expect(onReintentarGoogle).toHaveBeenCalledOnce();
    expect(await screen.findByText(/No se pudo confirmar la disponibilidad del inicio de sesión con Google/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Correo/)).toBeInTheDocument();
  });

  it('anuncia el reintento de Google y retira el error anterior mientras consulta', async () => {
    const user = userEvent.setup();
    let resolverReintento: (recuperado: boolean) => void = () => {};
    const reintentoPendiente = new Promise<boolean>((resolve) => {
      resolverReintento = resolve;
    });
    const onReintentarGoogle = vi.fn(() => reintentoPendiente);

    render(
      <SeccionAutenticacion
        onIngresar={() => {}}
        onReintentarGoogle={onReintentarGoogle}
        oauthGoogleDisponible={false}
        oauthGoogleConsultaFallida
      />
    );

    const estadoConsulta = screen.getByRole('status', { name: 'Estado de consulta de Google' });
    expect(estadoConsulta).toBeEmptyDOMElement();
    const botonReintento = screen.getByRole('button', { name: /Volver a consultar Google/i });
    await user.click(botonReintento);

    expect(estadoConsulta).toHaveTextContent('Consultando la disponibilidad de Google.');
    expect(estadoConsulta.closest('.auth-google-status')).toHaveAttribute('data-state', 'loading');
    expect(screen.queryByText(/No fue posible consultar la disponibilidad de Google/i)).not.toBeInTheDocument();
    const botonOcupado = screen.getByRole('button', { name: /Consultando Google/i });
    expect(botonOcupado).toHaveAttribute('aria-busy', 'true');
    expect(botonOcupado).toHaveFocus();

    resolverReintento(false);

    expect(await screen.findByText(/No se pudo confirmar la disponibilidad del inicio de sesión con Google/i)).toBeInTheDocument();
    expect(estadoConsulta).toBeEmptyDOMElement();
  });

  it('explica cuando Google está deshabilitado y no muestra una acción de reintento contradictoria', () => {
    render(
      <SeccionAutenticacion
        onIngresar={() => {}}
        oauthGoogleDisponible={false}
        oauthGoogleBackendDisponible={false}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(/Google no está habilitado/i);
    expect(screen.getByRole('status')).toHaveTextContent(/formulario para ingresar/i);
    expect(screen.queryByRole('button', { name: /consultar Google/i })).not.toBeInTheDocument();
  });

  it('no ofrece abrir el formulario de correo cuando ya está visible como alternativa a Google Desktop', () => {
    render(
      <SeccionAutenticacion
        onIngresar={() => {}}
        oauthGoogleDisponible={false}
        oauthGoogleDesktopDisponible
      />
    );

    expect(screen.getByRole('button', { name: 'Acceder con Google' })).toBeVisible();
    expect(screen.getByLabelText(/^Correo/)).toBeVisible();
    expect(screen.getByLabelText(/^Contraseña/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Ingresar con correo y contraseña' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restablecer contraseña' })).toBeVisible();
  });

  it('mantiene las etiquetas visibles sin placeholders que parezcan credenciales capturadas', () => {
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible={false} />);

    const email = screen.getByLabelText(/^Correo/);
    const password = screen.getByLabelText(/^Contraseña/);
    expect(email).toBeRequired();
    expect(password).toBeRequired();
    expect(screen.getByText('(obligatorio)')).toBeVisible();
    expect(screen.getByText('(obligatoria)')).toBeVisible();
    expect(email).not.toHaveAttribute('placeholder');
    expect(password).not.toHaveAttribute('placeholder');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('button', { name: /Mostrar contraseña/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('anuncia el nivel textual de fortaleza de contraseña durante el registro', () => {
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible={false} modoInicial="registrar" />);

    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: 'abcdefgh' } });

    const nivel = screen.getByText('Aceptable');
    expect(nivel).toHaveAttribute('role', 'status');
    expect(nivel).toHaveAttribute('aria-live', 'polite');
    expect(nivel.closest('.auth-pwd-meter')).not.toHaveAttribute('aria-hidden');
    expect(nivel.parentElement).not.toHaveAttribute('aria-hidden');
    expect(nivel.previousElementSibling).toHaveAttribute('aria-hidden', 'true');
  });

  it('representa el nivel del medidor con el número correspondiente de segmentos activos', () => {
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible={false} modoInicial="registrar" />);
    const password = screen.getByLabelText(/^Contraseña/);

    for (const [valor, nivel, etiqueta] of [
      ['abcde', '1', 'Muy corta'],
      ['abcdefg', '2', 'Mínimo 8 caracteres'],
      ['abcdefg1', '3', 'Buena seguridad'],
      ['Abcdefgh1!', '4', 'Excelente y segura']
    ]) {
      fireEvent.change(password, { target: { value: valor } });
      const medidor = screen.getByText(etiqueta).closest('.auth-pwd-meter');
      expect(medidor?.querySelector('.auth-pwd-meter-label')).toHaveAttribute('role', 'status');
      expect(medidor).toHaveAttribute('data-nivel', nivel);
      expect(medidor?.querySelectorAll('.auth-pwd-bar--active')).toHaveLength(Number(nivel));
    }
  });

  it('ingresa con correo/contrasena y notifica token', async () => {
    const user = userEvent.setup();
    const onIngresar = vi.fn();
    vi.spyOn(clienteApi, 'enviar').mockResolvedValueOnce({ token: 'token-prueba' });

    render(<SeccionAutenticacion onIngresar={onIngresar} />);

    fireEvent.change(screen.getByLabelText(/^Correo/), { target: { value: 'docente@local.test' } });
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: '12345678' } });
    const botonesIngresar = screen.getAllByRole('button', { name: /^Ingresar$/i });
    await user.click(botonesIngresar[botonesIngresar.length - 1]);

    expect(clienteApi.enviar).toHaveBeenCalledWith('/autenticacion/ingresar', {
      correo: 'docente@local.test',
      contrasena: '12345678'
    }, { headers: { 'X-Auth-Flow-ID': expect.stringMatching(/^[0-9a-f-]{36}$/i) } });
    expect(onIngresar).toHaveBeenCalledWith('token-prueba', true, expect.stringMatching(/^[0-9a-f-]{36}$/i));
  });

  it('acepta correos de cualquier dominio sin mostrar una política institucional', async () => {
    const user = userEvent.setup();
    vi.spyOn(clienteApi, 'enviar').mockResolvedValueOnce({ token: 'token-externo' });

    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible={false} />);

    fireEvent.change(screen.getByLabelText(/^Correo/), { target: { value: 'docente@externo.test' } });
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: '12345678' } });
    const botonesIngresar = screen.getAllByRole('button', { name: /^Ingresar$/i });
    await user.click(botonesIngresar[botonesIngresar.length - 1]);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/autenticacion/ingresar', {
        correo: 'docente@externo.test',
        contrasena: '12345678'
      }, { headers: { 'X-Auth-Flow-ID': expect.stringMatching(/^[0-9a-f-]{36}$/i) } });
    });
    expect(screen.queryByText(/Solo se permiten/i)).not.toBeInTheDocument();
  });

  it('permite registrar cuenta por formulario con codigo de licencia', async () => {
    const user = userEvent.setup();
    const onIngresar = vi.fn();
    vi.spyOn(clienteApi, 'enviar').mockResolvedValueOnce({ token: 'token-registro' });

    render(<SeccionAutenticacion onIngresar={onIngresar} primerUso />);

    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Gomez' } });
    fireEvent.change(screen.getByLabelText(/^Correo/), { target: { value: 'ana@local.test' } });
    fireEvent.change(screen.getByLabelText(/Clave o Código de Licencia/i), { target: { value: 'LIC-2026-DOC-TEST' } });
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: 'segura123' } });
    await user.click(screen.getByRole('button', { name: /Crear cuenta/i }));

    expect(clienteApi.enviar).toHaveBeenCalledWith('/autenticacion/registrar', {
      nombres: 'Ana',
      apellidos: 'Gomez',
      correo: 'ana@local.test',
      contrasena: 'segura123',
      codigoLicencia: 'LIC-2026-DOC-TEST'
    });
    expect(onIngresar).toHaveBeenCalledWith('token-registro', true);
  });

  it('bloquea crear cuenta cuando faltan datos en registro', async () => {
    render(<SeccionAutenticacion onIngresar={() => {}} modoInicial="registrar" />);
    expect(screen.getByRole('button', { name: /Crear cuenta/i })).toBeDisabled();
  });

  it('maneja error 429 e inicia cooldown al ingresar', async () => {
    const user = userEvent.setup();
    const error429 = new ErrorRemoto('Rate limited', { status: 429, error: 'Demasiadas solicitudes' });
    vi.spyOn(clienteApi, 'enviar').mockRejectedValueOnce(error429);

    render(<SeccionAutenticacion onIngresar={() => {}} />);

    fireEvent.change(screen.getByLabelText(/^Correo/), { target: { value: 'docente@local.test' } });
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: '12345678' } });

    const botonesIngresar = screen.getAllByRole('button', { name: /^Ingresar$/i });
    await user.click(botonesIngresar[botonesIngresar.length - 1]);

    expect(screen.getByText(/Demasiadas solicitudes/i)).toBeInTheDocument();
    const form = screen.getByRole('form', { name: 'Acceso docente' });
    expect(form).toHaveAttribute('aria-describedby', 'auth-form-feedback');
    expect(document.getElementById('auth-form-feedback')).toHaveTextContent(/Demasiadas solicitudes/i);
    expect(botonesIngresar[botonesIngresar.length - 1]).toBeDisabled();
  });

  it('mantiene el error de credenciales en el formulario sin repetirlo en un toast', async () => {
    const user = userEvent.setup();
    const errorCredenciales = new ErrorRemoto('Correo o contraseña incorrectos.', {
      status: 401,
      codigo: 'CREDENCIALES_INVALIDAS'
    });
    const toasts: { message?: string }[] = [];
    const listener = (event: Event) => {
      toasts.push((event as CustomEvent<{ message?: string }>).detail);
    };
    window.addEventListener('app:toast', listener);
    vi.spyOn(clienteApi, 'enviar').mockRejectedValueOnce(errorCredenciales);

    try {
      render(<SeccionAutenticacion onIngresar={() => {}} />);
      fireEvent.change(screen.getByLabelText(/^Correo/), { target: { value: 'docente@local.test' } });
      fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: 'incorrecta' } });
      await user.click(screen.getAllByRole('button', { name: /^Ingresar$/i }).at(-1)!);

      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent('Correo o contrasena incorrectos.');
      expect(screen.getByLabelText(/^Correo/)).toHaveValue('docente@local.test');
      expect(toasts).toEqual([]);
    } finally {
      window.removeEventListener('app:toast', listener);
    }
  });

  it('conserva solo el toast persistente que aporta una acción distinta para una sesión expirada', async () => {
    const user = userEvent.setup();
    const errorSesion = new ErrorRemoto('La sesión expiró.', { status: 401, codigo: 'TOKEN_EXPIRADO' });
    type ToastCapturado = { title?: string; message?: string; persistent?: boolean; action?: { label?: string } };
    const toasts: ToastCapturado[] = [];
    const listener = (event: Event) => {
      toasts.push((event as CustomEvent<ToastCapturado>).detail);
    };
    window.addEventListener('app:toast', listener);
    vi.spyOn(clienteApi, 'enviar').mockRejectedValueOnce(errorSesion);

    try {
      render(<SeccionAutenticacion onIngresar={() => {}} />);
      fireEvent.change(screen.getByLabelText(/^Correo/), { target: { value: 'docente@local.test' } });
      fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: 'contraseña' } });
      await user.click(screen.getAllByRole('button', { name: /^Ingresar$/i }).at(-1)!);

      const alerta = await screen.findByRole('alert');
      await waitFor(() => expect(toasts).toHaveLength(1));
      expect(alerta).toHaveTextContent('Tu sesion expiro. Inicia sesion de nuevo.');
      expect(toasts[0]).toMatchObject({
        title: 'Sesión anterior activa',
        message: 'Cierra la sesión actual para volver a intentarlo.',
        persistent: true,
        action: { label: 'Cerrar sesión' }
      });
      expect(toasts[0]?.message).not.toBe(alerta.textContent?.trim());
    } finally {
      window.removeEventListener('app:toast', listener);
    }
  });

  it('invita a registrar cuando el docente no está registrado', async () => {
    const user = userEvent.setup();
    const errorNoRegistrado = new ErrorRemoto('No registrado', { status: 404, codigo: 'DOCENTE_NO_REGISTRADO' });
    vi.spyOn(clienteApi, 'enviar').mockRejectedValueOnce(errorNoRegistrado);

    render(<SeccionAutenticacion onIngresar={() => {}} />);

    fireEvent.change(screen.getByLabelText(/^Correo/), { target: { value: 'docente@local.test' } });
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: '12345678' } });

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

    expect(clienteApi.enviar).toHaveBeenCalledWith(
      '/autenticacion/google',
      expect.objectContaining({ credential: expect.stringContaining('mock.') }),
      { headers: { 'X-Auth-Flow-ID': expect.stringMatching(/^[0-9a-f-]{36}$/i) } }
    );
    expect(onIngresar).toHaveBeenCalledWith('token-google', true, expect.stringMatching(/^[0-9a-f-]{36}$/i));
  });

  it('presenta el error genérico de Google sin atribuir una causa y permite copiar un diagnóstico seguro', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);
    await user.click(screen.getByTestId('mock-google-error'));
    const alertaOAuth = await screen.findByRole('alert');
    expect(alertaOAuth).toHaveTextContent('No se pudo completar el acceso con Google');
    expect(alertaOAuth).toHaveTextContent('Inténtalo de nuevo con Google o usa tu correo y contraseña.');
    expect(alertaOAuth).not.toHaveTextContent(/origin_mismatch|Google Cloud/i);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByRole('link', { name: /Credenciales en Google Cloud/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Usar correo y contraseña/i })).toBeInTheDocument();
    expect(alertaOAuth?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    const textoPantalla = document.body.textContent ?? '';
    ['⚠️', '🔗', '✉️', '⚡', '🔒', '✓'].forEach((glifo) => expect(textoPantalla).not.toContain(glifo));

    await user.click(screen.getByRole('button', { name: /copiar diagnóstico de acceso/i }));
    await waitFor(() => expect(screen.getByText(/Diagnóstico local copiado/i)).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledOnce();
    const diagnostico = String(writeText.mock.calls[0]?.[0]);
    expect(diagnostico).toContain('PROVIDER_ERROR');
    expect(diagnostico).not.toContain('mock.eyJ');
  });

  it('muestra error si no puede copiar el diagnóstico de Google', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('clipboard blocked')) }
    });
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);
    await user.click(screen.getByTestId('mock-google-error'));
    await user.click(screen.getByRole('button', { name: /copiar diagnóstico de acceso/i }));
    expect(await screen.findByText(/No se pudo copiar el diagnóstico desde este navegador/i)).toBeInTheDocument();
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

    render(<SeccionAutenticacion onIngresar={onIngresar} oauthGoogleDisponible modoInicial="registrar" />);

    const googleBtn = screen.getByTestId('mock-google-login');
    await user.click(googleBtn);

    expect(screen.getByLabelText('Nombres')).toHaveValue('Juan Perez');
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Lopez');
    expect(screen.getByLabelText(/Correo/i)).toHaveValue('google@local.test');

    const checkboxContrasena = screen.getByLabelText(/Crear contrase[nñ]a ahora/i);
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
    expect(onIngresar).toHaveBeenCalledWith('token-reg-google', true);
  });

  it('permite alternar recuperación de contraseña con Google', async () => {
    const user = userEvent.setup();
    const onIngresar = vi.fn();
    vi.spyOn(clienteApi, 'enviar').mockResolvedValueOnce({ token: 'token-recuperado' });

    render(<SeccionAutenticacion onIngresar={onIngresar} oauthGoogleDisponible />);

    const botonesIngresar = screen.getAllByRole('button', { name: /^Ingresar$/i });
    await user.click(botonesIngresar[0]);
    await user.click(screen.getByRole('button', { name: /Restablecer contraseña/i }));

    expect(screen.getByText(/Verifica con Google la cuenta vinculada para establecer una contraseña nueva/i)).toBeInTheDocument();

    const googleBtns = screen.getAllByTestId('mock-google-login');
    await user.click(googleBtns[googleBtns.length - 1]);

    fireEvent.change(screen.getByLabelText(/Nueva contrase[nñ]a/i), { target: { value: 'nueva12345' } });
    await user.click(screen.getByRole('button', { name: /Actualizar contrase[nñ]a/i }));

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

  it('permite alternar entre Google y formulario en modo registrar', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible modoInicial="registrar" />);

    const registrarFormBtn = screen.getByRole('button', { name: /Registrar con correo y contrase[nñ]a/i });
    await user.click(registrarFormBtn);

    expect(screen.getByRole('button', { name: /Volver a Google/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Volver a Google/i }));

    expect(screen.getByRole('button', { name: /Registrar con correo y contrase[nñ]a/i })).toBeInTheDocument();
  });

  it('permite alternar formulario en modo ingresar con Google', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    const botonesIngresar = screen.getAllByRole('button', { name: /^Ingresar$/i });
    await user.click(botonesIngresar[0]);

    const toggleFormBtn = screen.getByRole('button', { name: /Ingresar con correo y contrase[nñ]a/i });
    await user.click(toggleFormBtn);

    expect(screen.getByRole('button', { name: /Ocultar formulario/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Ocultar formulario/i }));
  });

  it('maneja errores 429 y rechazos al registrar o recuperar', async () => {
    const user = userEvent.setup();
    const error429 = new ErrorRemoto('Rate limited', { status: 429, error: 'Demasiadas solicitudes' });
    vi.spyOn(clienteApi, 'enviar').mockRejectedValueOnce(error429);

    render(<SeccionAutenticacion onIngresar={() => {}} modoInicial="registrar" />);

    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Gomez' } });
    fireEvent.change(screen.getByLabelText(/^Correo/), { target: { value: 'ana@local.test' } });
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: 'segura123' } });

    await user.click(screen.getByRole('button', { name: /Crear cuenta/i }));
    expect(screen.getByText(/Demasiadas solicitudes/i)).toBeInTheDocument();
  });

  it('maneja Google error callbacks y nombres únicos', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible modoInicial="registrar" />);

    // Trigger Google Single Name mock
    const singleNameBtn = screen.getByTestId('mock-google-login-single-name');
    await user.click(singleNameBtn);
    expect(screen.getByLabelText('Nombres')).toHaveValue('SoloNombre');

    // Trigger Google Error Mock
    const errorBtn = screen.getByTestId('mock-google-error');
    await user.click(errorBtn);
    expect(screen.getByText(/No se pudo obtener datos de Google/i)).toBeInTheDocument();
  });

  it('no atribuye el fallo genérico de Google a una causa técnica y ofrece la alternativa de correo', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    const alternarCorreo = screen.getByRole('button', { name: 'Ingresar con correo y contraseña' });
    expect(alternarCorreo).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByTestId('mock-google-error'));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo completar el acceso con Google');
    expect(alerta).toHaveTextContent('Inténtalo de nuevo con Google o usa tu correo y contraseña.');
    expect(alerta).not.toHaveTextContent(/origin_mismatch|Google Cloud Console/i);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByRole('link', { name: /Credenciales en Google Cloud/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Usar correo y contraseña/i }));
    expect(screen.getByLabelText(/^Correo/)).toBeVisible();
    expect(screen.getByLabelText(/^Contraseña/)).toBeVisible();
    const ocultarCorreo = screen.getByRole('button', { name: 'Ocultar formulario' });
    expect(ocultarCorreo).toHaveAttribute('aria-expanded', 'true');
    await user.click(ocultarCorreo);
    expect(screen.getByRole('button', { name: 'Ingresar con correo y contraseña' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText(/^Correo/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ingresar con correo y contraseña' }));
    expect(screen.getByLabelText(/^Correo/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ocultar formulario' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Restablecer contraseña' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Recuperar contraseña con Google/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));
    expect(screen.getByText(/Verifica con Google la cuenta vinculada para establecer una contraseña nueva/i)).toBeVisible();
  });

  it('presenta el fallo de Google Desktop como error y ofrece reintentar', async () => {
    const user = userEvent.setup();
    const popup = {
      location: { replace: vi.fn() },
      closed: false,
      close: vi.fn()
    } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);
    vi.spyOn(clienteApi, 'enviar')
      .mockResolvedValueOnce({ flowId: 'flow-google-dummy', url: 'https://accounts.google.com/dummy' } as never)
      .mockResolvedValueOnce({ estado: 'error', codigo: 'GOOGLE_DESKTOP_OAUTH_FAILED' } as never)
      .mockResolvedValueOnce({} as never);

    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDesktopDisponible />);
    await user.click(screen.getByRole('button', { name: 'Acceder con Google' }));

    const alerta = await screen.findByRole('alert', {}, { timeout: 4000 });
    expect(alerta).toHaveTextContent('Google no pudo confirmar tu identidad. Inténtalo de nuevo.');
    expect(screen.getByRole('button', { name: 'Reintentar con Google' })).toBeVisible();
    expect(screen.getByLabelText(/^Correo/)).toBeVisible();
    expect(screen.getByLabelText(/^Contraseña/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Ingresar con correo y contraseña' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restablecer contraseña' })).toBeVisible();
  });

  it('retira el error anterior de contraseña cuando comienza Google Desktop', async () => {
    const user = userEvent.setup();
    const popup = {
      location: { replace: vi.fn() },
      closed: false,
      close: vi.fn()
    } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);
    vi.spyOn(clienteApi, 'enviar')
      .mockRejectedValueOnce(new ErrorRemoto('Correo o contraseña incorrectos.', {
        status: 401,
        codigo: 'CREDENCIALES_INVALIDAS'
      }))
      .mockResolvedValueOnce({ flowId: 'flow-google-after-password', url: 'https://accounts.google.com/dummy' } as never)
      .mockResolvedValueOnce({ estado: 'error', codigo: 'GOOGLE_DESKTOP_OAUTH_FAILED' } as never)
      .mockResolvedValueOnce({} as never);

    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDesktopDisponible />);
    fireEvent.change(screen.getByLabelText(/^Correo/), { target: { value: 'docente@example.invalid' } });
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: 'dummy-password' } });
    await user.click(screen.getAllByRole('button', { name: /^Ingresar$/i }).at(-1)!);
    expect(await screen.findByText('Correo o contrasena incorrectos.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Acceder con Google' }));
    expect(await screen.findByText(
      'Google no pudo confirmar tu identidad. Inténtalo de nuevo.',
      {},
      { timeout: 3000 }
    )).toBeVisible();
    expect(screen.queryByText('Correo o contrasena incorrectos.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('alterna la visibilidad de contraseña y el estado de sesión recordada', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} />);
    await user.click(screen.getAllByRole('button', { name: /^Ingresar$/i })[0]!);
    const contrasena = screen.getByLabelText(/^Contraseña/);
    expect(contrasena).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(contrasena).toHaveAttribute('type', 'text');
    const recordar = screen.getByRole('checkbox', { name: /Mantener sesión iniciada/i });
    expect(recordar).toBeChecked();
    expect(recordar).toHaveAccessibleDescription('Si lo compartes, desactívala.');
    expect(screen.getByText('Si lo compartes, desactívala.')).toBeVisible();
    await user.click(recordar);
    expect(recordar).not.toBeChecked();
  });

  it('muestra la validación si Google no entrega credencial al reautenticar', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);
    await user.click(screen.getByRole('button', { name: /^Ingresar$/i }));
    await user.click(screen.getByRole('button', { name: /Restablecer contraseña/i }));
    const vacios = screen.getAllByTestId('mock-google-login-empty');
    await user.click(vacios[vacios.length - 1]!);
    expect(await screen.findByText(/No se recibió credencial de Google/i)).toBeInTheDocument();
  });

  it('maneja error 429 al recuperar contrasena con Google', async () => {
    const user = userEvent.setup();
    const error429 = new ErrorRemoto('Rate limited', { status: 429, error: 'Demasiadas solicitudes' });
    vi.spyOn(clienteApi, 'enviar').mockRejectedValueOnce(error429);

    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    const botonesIngresar = screen.getAllByRole('button', { name: /^Ingresar$/i });
    await user.click(botonesIngresar[0]);
    await user.click(screen.getByRole('button', { name: /Restablecer contraseña/i }));

    const googleBtns = screen.getAllByTestId('mock-google-login');
    await user.click(googleBtns[googleBtns.length - 1]);

    fireEvent.change(screen.getByLabelText(/Nueva contrase[nñ]a/i), { target: { value: 'nueva12345' } });
    await user.click(screen.getByRole('button', { name: /Actualizar contrase[nñ]a/i }));

    expect(screen.getByText(/Demasiadas solicitudes/i)).toBeInTheDocument();
  });

  it('permite modificar todos los campos en modo registro por formulario', async () => {
    render(<SeccionAutenticacion onIngresar={() => {}} modoInicial="registrar" />);

    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Docente' } });
    fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Prueba' } });
    fireEvent.change(screen.getByLabelText(/^Correo/), { target: { value: 'docente@test.com' } });
    fireEvent.change(screen.getByLabelText(/Clave o Código de Licencia/i), { target: { value: 'LIC-123' } });
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: 'password123' } });
    fireEvent.input(screen.getByLabelText(/^Correo/), { target: { value: 'docente-input@test.com' } });
    fireEvent.input(screen.getByLabelText(/Clave o Código de Licencia/i), { target: { value: 'LIC-INPUT-123' } });
    fireEvent.input(screen.getByLabelText(/^Contraseña/), { target: { value: 'password-input-123' } });

    expect(screen.getByLabelText('Nombres')).toHaveValue('Docente');
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Prueba');
    expect(screen.getByLabelText(/^Correo/)).toHaveValue('docente-input@test.com');
    expect(screen.getByLabelText(/Clave o Código de Licencia/i)).toHaveValue('LIC-INPUT-123');
    expect(screen.getByLabelText(/^Contraseña/)).toHaveValue('password-input-123');
  });

  it('permite editar nombres y clave de licencia tras registro con Google', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible modoInicial="registrar" />);

    const googleBtn = screen.getByTestId('mock-google-login');
    await user.click(googleBtn);

    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Juan Modificado' } });
    fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Perez Modificado' } });
    fireEvent.change(screen.getByLabelText(/Clave o Código de Licencia/i), { target: { value: 'LIC-GOOGLE-123' } });

    expect(screen.getByLabelText('Nombres')).toHaveValue('Juan Modificado');
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Perez Modificado');
    expect(screen.getByLabelText(/Clave o Código de Licencia/i)).toHaveValue('LIC-GOOGLE-123');
    await user.click(screen.getByRole('button', { name: 'Cambiar correo' }));
  });

  it('valida datos obligatorios de nombres y apellidos en registro', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible modoInicial="registrar" />);

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
    expect(screen.getByText(/No se recibi[oó] credencial de Google/i)).toBeInTheDocument();
  });

  it('maneja credencial vacía en registro con Google y alternar contraseña opcional', async () => {
    const user = userEvent.setup();
    const { container } = render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible modoInicial="registrar" />);

    const emptyBtn = screen.getByTestId('mock-google-login-empty');
    await user.click(emptyBtn);
    expect(screen.getByText(/No se recibi[oó] credencial de Google/i)).toBeInTheDocument();

    const googleBtn = screen.getByTestId('mock-google-login');
    await user.click(googleBtn);

    const checkboxContrasena = screen.getByLabelText(/Crear contrase[nñ]a ahora/i);
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
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible modoInicial="registrar" />);

    const twoPartsBtn = screen.getByTestId('mock-google-login-two-parts');
    await user.click(twoPartsBtn);

    expect(screen.getByLabelText('Nombres')).toHaveValue('Pedro');
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Sanchez');
  });

  it('maneja JWT con formato invalido sin crashear', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible modoInicial="registrar" />);

    const invalidBtn = screen.getByTestId('mock-google-login-invalid-jwt');
    await user.click(invalidBtn);

    expect(screen.getByLabelText('Nombres')).toHaveValue('');
  });

  it('invita a registrar desde Google cuando el token solo tiene name compuesto y no esta registrado', async () => {
    const user = userEvent.setup();
    const errorNoRegistrado = new ErrorRemoto('No registrado', { status: 404, codigo: 'DOCENTE_NO_REGISTRADO' });
    vi.spyOn(clienteApi, 'enviar').mockRejectedValueOnce(errorNoRegistrado);

    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible />);

    const botonesIngresar = screen.getAllByRole('button', { name: /^Ingresar$/i });
    await user.click(botonesIngresar[0]);
    const twoPartsBtn = screen.getByTestId('mock-google-login-two-parts');
    await user.click(twoPartsBtn);

    await waitFor(() => {
      expect(screen.getByText(/No existe una cuenta para ese correo/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Nombres')).toHaveValue('Pedro');
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Sanchez');
  });

});
