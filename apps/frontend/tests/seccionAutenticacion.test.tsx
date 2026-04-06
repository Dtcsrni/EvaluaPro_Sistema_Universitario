import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeccionAutenticacion } from '../src/apps/app_docente/SeccionAutenticacion';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => <button type="button">Google Login</button>
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

  it('permite registrar cuenta por formulario', async () => {
    const user = userEvent.setup();
    const onIngresar = vi.fn();
    vi.spyOn(clienteApi, 'enviar').mockResolvedValueOnce({ token: 'token-registro' });

    render(<SeccionAutenticacion onIngresar={onIngresar} />);
    await user.click(screen.getByRole('button', { name: /^Registrar$/i }));

    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Gomez' } });
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@local.test' } });
    fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: 'segura123' } });
    await user.click(screen.getByRole('button', { name: /Crear cuenta/i }));

    expect(clienteApi.enviar).toHaveBeenCalledWith('/autenticacion/registrar', {
      nombres: 'Ana',
      apellidos: 'Gomez',
      correo: 'ana@local.test',
      contrasena: 'segura123'
    });
    expect(onIngresar).toHaveBeenCalledWith('token-registro');
  });

  it('bloquea crear cuenta cuando faltan datos en registro', async () => {
    const user = userEvent.setup();
    render(<SeccionAutenticacion onIngresar={() => {}} />);
    await user.click(screen.getByRole('button', { name: /^Registrar$/i }));
    expect(screen.getByRole('button', { name: /Crear cuenta/i })).toBeDisabled();
  });
});
