/**
 * seccionCuenta.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionCuenta } from '../src/apps/app_docente/SeccionCuenta';
import { GuiaCuentaVisual } from '../src/apps/app_docente/GuiaCuentaVisual';
import { guardarFotoPerfilLocal, MAX_FOTO_PERFIL_BYTES, obtenerFotoPerfilLocal } from '../src/apps/app_docente/fotoPerfilDocente';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { ErrorRemoto } from '../src/servicios_api/clienteApi';
import { emitToast } from '../src/ui/toast/toastBus';
import type { Docente } from '../src/apps/app_docente/tipos';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: vi.fn(),
    enviar: vi.fn(),
    eliminar: vi.fn(),
    registrarEventosUso: vi.fn().mockResolvedValue({})
  }
}));

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

describe('SeccionCuenta', () => {
  const docenteMock: Docente = {
    _id: 'doc-1',
    nombre: 'Profesor Titular',
    correo: 'profesor@cuh.mx',
    tieneGoogle: true,
    tieneContrasena: true,
    preferenciasPdf: {
      institucion: 'Universidad EvaluaPro',
      lema: 'Excelencia y Rigor',
      logos: {
        izquierdaPath: '',
        derechaPath: ''
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clienteApi.obtener).mockResolvedValue({ items: [] });
    vi.mocked(clienteApi.enviar).mockResolvedValue({});
  });

  const renderConOAuth = (ui: React.ReactElement) => {
    return render(<GoogleOAuthProvider clientId="test-client-id">{ui}</GoogleOAuthProvider>);
  };

  const expectErrorAsociado = (control: HTMLElement, texto: string) => {
    expect(control).toHaveAttribute('aria-invalid', 'true');
    const idsDescripcion = control.getAttribute('aria-describedby')?.split(/\s+/) ?? [];
    const idError = idsDescripcion.find((id) => document.getElementById(id)?.textContent?.trim() === texto);
    expect(idError).toBeTruthy();
    if (!idError) return;
    expect(document.getElementById(idError)).toHaveAttribute('role', 'alert');
  };

  it('renderiza resumen de cuenta, estado de accesos y preferencias PDF', () => {
    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
        oauthGoogleDisponible={true}
        classroomDisponible={false}
        smtpDisponible={true}
        requireGoogleOAuth={false}
      />
    );

    expect(screen.getByRole('heading', { name: /^Cuenta$/i })).toBeInTheDocument();
    const resumenCuenta = screen.getByRole('group', { name: 'Resumen de la cuenta docente' });
    expect(resumenCuenta).toBeInTheDocument();
    expect(resumenCuenta).not.toHaveAttribute('aria-live');
    expect(Array.from(resumenCuenta.querySelectorAll('[data-icono]')).map((icono) => icono.getAttribute('data-icono'))).toEqual([
      'docente', 'classroom', 'candado', 'pdf', 'correo'
    ]);
    expect(document.querySelector('.cuenta-panel__icon-orb [data-icono]')).toHaveAttribute('data-icono', 'cuenta');
    expect(screen.getByText('profesor@cuh.mx')).toBeInTheDocument();
    expect(screen.getByText('Vinculado')).toBeInTheDocument();
    expect(screen.getByText('Definida')).toBeInTheDocument();
    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.getByText('Membrete PDF')).toBeInTheDocument();
    expect(screen.getByText('Avisos por correo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Universidad EvaluaPro')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Excelencia y Rigor')).toBeInTheDocument();
  });

  it('ofrece enlaces directos a cada bloque visible de Cuenta con destinos enfocables', () => {
    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
        oauthGoogleDisponible={true}
        classroomDisponible={false}
        smtpDisponible={true}
        requireGoogleOAuth={false}
      />
    );

    const navegacion = screen.getByRole('navigation', { name: 'Secciones de Cuenta' });
    const destinos = [
      ['Foto de perfil', 'Foto de perfil'],
      ['Sincronización', 'Carpeta de sincronización'],
      ['Seguridad', 'Seguridad de acceso'],
      ['PDF institucional', 'PDF institucional'],
      ['Retención', 'Retención de parciales archivados'],
      ['Actualizaciones', 'Buscar actualizaciones de EvaluaPro'],
      ['Accesos del escritorio', 'Accesos del escritorio']
    ];

    expect(within(navegacion).getAllByRole('link')).toHaveLength(destinos.length);
    for (const [nombre, encabezado] of destinos) {
      const enlace = within(navegacion).getByRole('link', { name: nombre });
      const destinoId = enlace.getAttribute('href')?.slice(1);
      const destino = destinoId ? document.getElementById(destinoId) : null;
      expect(destino).not.toBeNull();
      if (!destino) continue;
      expect(destino).toHaveTextContent(encabezado);
      expect(destino).toHaveAttribute('tabindex', '-1');
    }
    expect(within(navegacion).queryByRole('link', { name: 'Papelera' })).not.toBeInTheDocument();
  });

  it('prioriza los ajustes al cargar y conserva la preferencia de mostrar la guía', () => {
    localStorage.removeItem('ep.guia.cuenta.oculta');
    render(<GuiaCuentaVisual />);

    const mostrar = screen.getByRole('button', { name: /Ver guía rápida de cuenta y seguridad/i });
    expect(mostrar).toHaveAttribute('aria-expanded', 'false');
    expect(mostrar).not.toHaveAttribute('data-tooltip');
    expect(mostrar).not.toHaveTextContent('💡');
    expect(screen.queryByRole('region', { name: 'Ayuda: Cuenta docente' })).not.toBeInTheDocument();

    fireEvent.click(mostrar);
    expect(screen.getByRole('region', { name: 'Ayuda: Cuenta docente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ocultar guía rápida' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'Cuenta y foto de perfil' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'PDF institucional' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sincronización y seguridad' })).toBeInTheDocument();
    expect(screen.getByText(/La foto se guarda en este equipo y no se envía al servidor/i)).toBeInTheDocument();
    expect(screen.getByText(/carpeta local sincronizada por OneDrive/i)).toBeInTheDocument();
    expect(screen.queryByText(/licenciamiento|licencia institucional|Plan Pro Multisede|Firma RSA|vigencia offline|soporte multisede/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AES-256|tokens cifrados en reposo|Auditoría Activa/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ocultar guía rápida' }).querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar guía rápida' }));
    expect(localStorage.getItem('ep.guia.cuenta.oculta')).toBe('true');
    expect(screen.queryByRole('region', { name: 'Ayuda: Cuenta docente' })).not.toBeInTheDocument();
  });

  it('regenera los accesos e iconos y confirma el resultado en Cuenta sin toast redundante', async () => {
    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
        oauthGoogleDisponible={true}
        classroomDisponible={false}
        smtpDisponible={true}
        requireGoogleOAuth={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Regenerar accesos e iconos/ }));
    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/autenticacion/accesos-directos/regenerar', {});
    });
    expect(await screen.findByText('Accesos directos de EvaluaPro y Hub actualizados en Escritorio y Menú Inicio.')).toBeInTheDocument();
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('permite usar una foto local si la foto vinculada a la cuenta no carga', async () => {
    const { container } = renderConOAuth(
      <SeccionCuenta
        docente={{ ...docenteMock, id: 'doc-avatar-roto', imagenPerfil: 'https://cuenta.example/foto.png' }}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
        oauthGoogleDisponible={true}
        smtpDisponible={true}
        requireGoogleOAuth={false}
      />
    );

    const imagen = container.querySelector('.cuenta-foto-perfil__avatar img');
    expect(imagen).not.toBeNull();
    fireEvent.error(imagen!);
    expect(container.querySelector('.cuenta-foto-perfil__avatar img')).toBeNull();
    expect(container.querySelector('.cuenta-foto-perfil__avatar .icono')).not.toBeNull();
    expect(screen.getByText(/La imagen vinculada no se pudo cargar/i)).toBeInTheDocument();

    const selectorFoto = screen.getByLabelText('Agregar foto');
    fireEvent.change(selectorFoto, {
      target: { files: [new File(['foto de prueba'], 'respaldo.png', { type: 'image/png' })] }
    });
    await waitFor(() => expect(obtenerFotoPerfilLocal('doc-avatar-roto')).toMatch(/^data:image\/png;base64,/));
    expect(container.querySelector('.cuenta-foto-perfil__avatar img')).toHaveAttribute('src', obtenerFotoPerfilLocal('doc-avatar-roto'));
    expect(screen.getByText(/foto local de respaldo, guardada solo en este equipo/i)).toBeInTheDocument();
    expect(clienteApi.enviar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto' }));
    expect(obtenerFotoPerfilLocal('doc-avatar-roto')).toBeNull();
  });

  it('actualiza la foto local visible cuando cambia la cuenta docente', async () => {
    const fotoDocenteA = 'data:image/png;base64,Zm9v';
    guardarFotoPerfilLocal('doc-avatar-a', fotoDocenteA);
    const { container, rerender } = renderConOAuth(
      <SeccionCuenta
        docente={{ ...docenteMock, id: 'doc-avatar-a' }}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
        oauthGoogleDisponible={true}
        smtpDisponible={true}
        requireGoogleOAuth={false}
      />
    );

    expect(container.querySelector('.cuenta-foto-perfil__avatar img')).toHaveAttribute('src', fotoDocenteA);
    rerender(
      <GoogleOAuthProvider clientId="test-client-id">
        <SeccionCuenta
          docente={{ ...docenteMock, id: 'doc-avatar-b' }}
          onDocenteActualizado={() => {}}
          esAdmin={false}
          esDev={false}
          oauthGoogleDisponible={true}
          smtpDisponible={true}
          requireGoogleOAuth={false}
        />
      </GoogleOAuthProvider>
    );

    await waitFor(() => expect(container.querySelector('.cuenta-foto-perfil__avatar img')).toBeNull());
    expect(container.querySelector('.cuenta-foto-perfil__avatar .icono')).not.toBeNull();
    expect(obtenerFotoPerfilLocal('doc-avatar-a')).toBe(fotoDocenteA);
    expect(obtenerFotoPerfilLocal('doc-avatar-b')).toBeNull();
    localStorage.removeItem('evaluapro:foto-perfil-docente:doc-avatar-a');
  });

  it('guarda la foto elegida solo en el equipo y permite retirarla', async () => {
    renderConOAuth(
      <SeccionCuenta
        docente={{ ...docenteMock, id: 'doc-1' }}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
        oauthGoogleDisponible={true}
        classroomDisponible={false}
        smtpDisponible={true}
        requireGoogleOAuth={false}
      />
    );

    const input = screen.getByLabelText('Agregar foto');
    expect(input).toHaveAccessibleName('Agregar foto');
    expect(input).toHaveAccessibleDescription('PNG, JPG o WebP · máximo 1 MB');
    fireEvent.change(input, { target: { files: [new File(['foto de prueba'], 'perfil.png', { type: 'image/png' })] } });
    await waitFor(() => expect(obtenerFotoPerfilLocal('doc-1')).toMatch(/^data:image\/png;base64,/));
    expect(input).toHaveAccessibleName('Cambiar foto');
    expect(await screen.findByText('La imagen se guarda en este equipo y no se envía al servidor.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto' }));
    expect(obtenerFotoPerfilLocal('doc-1')).toBeNull();
  });

  it('rechaza archivos que no son imagen admitida y no los persiste', async () => {
    renderConOAuth(
      <SeccionCuenta
        docente={{ ...docenteMock, id: 'doc-1' }}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
        oauthGoogleDisponible={true}
        classroomDisponible={false}
        smtpDisponible={true}
        requireGoogleOAuth={false}
      />
    );

    const inputFoto = screen.getByLabelText('Agregar foto');
    fireEvent.change(inputFoto, {
      target: { files: [new File(['documento'], 'archivo.svg', { type: 'image/svg+xml' })] }
    });

    expect(await screen.findByText('La imagen debe ser PNG, JPG o WebP.')).toBeInTheDocument();
    expectErrorAsociado(inputFoto, 'La imagen debe ser PNG, JPG o WebP.');
    expect(obtenerFotoPerfilLocal('doc-1')).toBeNull();
  });

  it('rechaza una foto mayor de 1 MB antes de leerla', async () => {
    renderConOAuth(
      <SeccionCuenta
        docente={{ ...docenteMock, id: 'doc-1' }}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
        oauthGoogleDisponible={true}
        classroomDisponible={false}
        smtpDisponible={true}
        requireGoogleOAuth={false}
      />
    );

    const imagenGrande = new File([new Uint8Array(MAX_FOTO_PERFIL_BYTES + 1)], 'perfil.jpg', { type: 'image/jpeg' });
    const inputFoto = screen.getByLabelText('Agregar foto');
    fireEvent.change(inputFoto, { target: { files: [imagenGrande] } });
    expect(await screen.findByText('La imagen no puede superar 1 MB.')).toBeInTheDocument();
    expectErrorAsociado(inputFoto, 'La imagen no puede superar 1 MB.');
    expect(obtenerFotoPerfilLocal('doc-1')).toBeNull();
  });

  it('informa si el almacenamiento local rechaza la foto seleccionada', async () => {
    const guardar = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (clave, valor) {
      if (clave.startsWith('evaluapro:foto-perfil-docente:')) throw new Error('Almacenamiento lleno');
      return Storage.prototype.setItem.call(this, clave, valor);
    });
    renderConOAuth(
      <SeccionCuenta
        docente={{ ...docenteMock, id: 'doc-1' }}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
        oauthGoogleDisponible={true}
        classroomDisponible={false}
        smtpDisponible={true}
        requireGoogleOAuth={false}
      />
    );

    const inputFoto = screen.getByLabelText('Agregar foto');
    fireEvent.change(inputFoto, {
      target: { files: [new File(['foto'], 'perfil.png', { type: 'image/png' })] }
    });
    expect(await screen.findByText('Almacenamiento lleno')).toBeInTheDocument();
    expectErrorAsociado(inputFoto, 'Almacenamiento lleno');
    guardar.mockRestore();
  });

  it('asocia los errores de lectura con cada selector y permite reintentar el mismo logo', async () => {
    const user = userEvent.setup();
    const leerArchivo = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function () {
      this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
    });
    renderConOAuth(
      <SeccionCuenta
        docente={{ ...docenteMock, id: 'doc-1' }}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
        oauthGoogleDisponible={true}
        classroomDisponible={false}
        smtpDisponible={true}
        requireGoogleOAuth={false}
      />
    );

    const inputFoto = screen.getByLabelText('Agregar foto');
    const inputLogo = screen.getByLabelText('Imagen institucional izquierda');
    await user.upload(inputFoto, new File(['foto'], 'perfil.png', { type: 'image/png' }));
    const archivoLogo = new File(['logo'], 'logo.png', { type: 'image/png' });
    await user.upload(inputLogo, archivoLogo);

    expectErrorAsociado(inputFoto, 'No se pudo leer la imagen seleccionada.');
    expectErrorAsociado(inputLogo, 'No se pudo leer la imagen seleccionada.');
    expect(leerArchivo).toHaveBeenCalledTimes(2);
    await user.upload(inputLogo, archivoLogo);
    expect(leerArchivo).toHaveBeenCalledTimes(3);
    expectErrorAsociado(inputLogo, 'No se pudo leer la imagen seleccionada.');
    leerArchivo.mockRestore();
  });

  it('permite cambiar contraseña tras validar contraseña actual y coincidencia de 8+ caracteres', async () => {
    const user = userEvent.setup();
    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
        oauthGoogleDisponible={true}
        classroomDisponible={false}
        smtpDisponible={true}
        requireGoogleOAuth={false}
      />
    );

    const inputActual = screen.getByLabelText(/Contraseña actual/i, { selector: 'input' });
    const inputNueva = screen.getByLabelText(/^Nueva contraseña/i, { selector: 'input' });
    const inputConfirmar = screen.getByLabelText(/Confirmar contraseña/i, { selector: 'input' });
    const botonGuardar = screen.getByRole('button', { name: /Guardar contraseña/i });

    expect(botonGuardar).toBeDisabled();
    expect(inputActual).toBeRequired();
    expect(inputActual.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(inputActual.getAttribute('aria-describedby')!)).toHaveTextContent('Se necesita para confirmar el cambio.');

    fireEvent.change(inputActual, { target: { value: 'PasswordAnterior123' } });
    fireEvent.change(inputNueva, { target: { value: 'corta' } });
    expect(inputNueva).toHaveAttribute('aria-invalid', 'true');
    expect((inputNueva as HTMLInputElement).minLength).toBe(8);
    const idsAyudaContrasenaNueva = inputNueva.getAttribute('aria-describedby')?.split(/\s+/) ?? [];
    expect(idsAyudaContrasenaNueva).toHaveLength(2);
    expect(document.getElementById(idsAyudaContrasenaNueva[0])).toHaveTextContent(/mínimo 8 caracteres/i);
    expect(document.getElementById(idsAyudaContrasenaNueva[1])).toHaveTextContent('La contraseña nueva es demasiado corta. Agrega caracteres hasta cumplir el mínimo.');
    expect(inputNueva).toBeRequired();
    expect(botonGuardar).toBeDisabled();

    fireEvent.change(inputNueva, { target: { value: 'NuevaClaveSegura2026' } });
    expect(inputNueva).not.toHaveAttribute('aria-invalid', 'true');
    expect(inputNueva.getAttribute('aria-describedby')?.split(/\s+/)).toHaveLength(1);
    fireEvent.change(inputConfirmar, { target: { value: 'Clave distinta de prueba' } });

    expect(inputConfirmar).toHaveAttribute('aria-invalid', 'true');
    const idsDescripcionConfirmacion = inputConfirmar.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(idsDescripcionConfirmacion).toHaveLength(2);
    expect(document.getElementById(idsDescripcionConfirmacion[0])).toHaveTextContent('Repite la nueva contraseña para confirmar el cambio.');
    expect(document.getElementById(idsDescripcionConfirmacion[1])).toHaveTextContent('Las contraseñas no coinciden. Revísalas.');

    fireEvent.change(inputConfirmar, { target: { value: 'NuevaClaveSegura2026' } });

    expect(inputConfirmar).not.toHaveAttribute('aria-invalid', 'true');
    const idAyudaConfirmacion = inputConfirmar.getAttribute('aria-describedby');
    expect(idAyudaConfirmacion).toBeTruthy();
    expect(document.getElementById(idAyudaConfirmacion!)).toHaveTextContent('Repite la nueva contraseña para confirmar el cambio.');
    expect(botonGuardar).not.toBeDisabled();
    expect(inputConfirmar.closest('form')).toHaveAttribute('aria-label', 'Cambiar contraseña');

    inputConfirmar.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith(
        '/autenticacion/definir-contrasena',
        expect.objectContaining({
          contrasenaActual: 'PasswordAnterior123',
          contrasenaNueva: 'NuevaClaveSegura2026'
        })
      );
    });

    const confirmacion = await screen.findByText('Contraseña actualizada.');
    expect(confirmacion.closest('[role="status"]')).toBeInTheDocument();
    expect(confirmacion.closest('.cuenta-seguridad')).toBeInTheDocument();
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('permite mostrar cada contraseña por separado con controles accesibles', async () => {
    const user = userEvent.setup();
    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
        oauthGoogleDisponible={true}
        classroomDisponible={false}
        smtpDisponible={true}
        requireGoogleOAuth={false}
      />
    );

    const entradas = [
      ['actual', /Contraseña actual/i, 'Mostrar contraseña actual', 'Ocultar contraseña actual'],
      ['nueva', /^Nueva contraseña/i, 'Mostrar nueva contraseña', 'Ocultar nueva contraseña'],
      ['confirmacion', /Confirmar contraseña/i, 'Mostrar confirmación de contraseña', 'Ocultar confirmación de contraseña']
    ] as const;

    for (const [id, etiqueta, nombreMostrar, nombreOcultar] of entradas) {
      const campo = screen.getByLabelText(etiqueta, { selector: 'input' });
      fireEvent.change(campo, { target: { value: `clave-${id}-dummy` } });
      expect(campo).toHaveAttribute('type', 'password');
      const boton = screen.getByRole('button', { name: nombreMostrar });
      expect(boton).toHaveAttribute('aria-controls', campo.id);
      expect(boton).toHaveAttribute('aria-pressed', 'false');
      await user.click(boton);
      expect(campo).toHaveAttribute('type', 'text');
      expect(campo).toHaveValue(`clave-${id}-dummy`);
      const botonOcultar = screen.getByRole('button', { name: nombreOcultar });
      expect(botonOcultar).toHaveAttribute('aria-controls', campo.id);
      expect(botonOcultar).toHaveAttribute('aria-pressed', 'true');
      expect(botonOcultar.querySelector('[data-icono="ojoCerrado"]')).toBeInTheDocument();
      expect(clienteApi.enviar).not.toHaveBeenCalled();
      await user.click(botonOcultar);
      expect(campo).toHaveAttribute('type', 'password');
      expect(screen.getByRole('button', { name: nombreMostrar })).toHaveAttribute('aria-pressed', 'false');
      await user.click(screen.getByRole('button', { name: nombreMostrar }));
      await user.tab();
      expect(campo).toHaveAttribute('type', 'password');
      expect(screen.getByRole('button', { name: nombreMostrar })).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('explica con claridad cómo recuperar el acceso si no hay método para confirmar la contraseña', () => {
    renderConOAuth(
      <SeccionCuenta
        docente={{ ...docenteMock, tieneGoogle: false, tieneContrasena: false }}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
        oauthGoogleDisponible={false}
        classroomDisponible={false}
        smtpDisponible={false}
        requireGoogleOAuth={false}
      />
    );

    expect(screen.getByText('Falta un método para confirmar el cambio: contraseña local o Google vinculado. Pide a quien administra EvaluaPro que revise tu acceso.')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Cambiar contraseña' })).not.toBeInTheDocument();
  });

  it('mantiene el error de cambio de contraseña en Cuenta sin duplicarlo en un toast', async () => {
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('No se pudo guardar el cambio.'));
    const user = userEvent.setup();
    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
        oauthGoogleDisponible={true}
        classroomDisponible={false}
        smtpDisponible={true}
        requireGoogleOAuth={false}
      />
    );

    fireEvent.change(screen.getByLabelText(/Contraseña actual/i, { selector: 'input' }), { target: { value: 'PasswordAnterior123' } });
    fireEvent.change(screen.getByLabelText(/^Nueva contraseña/i, { selector: 'input' }), { target: { value: 'NuevaClaveSegura2026' } });
    fireEvent.change(screen.getByLabelText(/Confirmar contraseña/i, { selector: 'input' }), { target: { value: 'NuevaClaveSegura2026' } });
    await user.click(screen.getByRole('button', { name: /Guardar contraseña/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el cambio.');
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('añade solo una acción complementaria de recuperación cuando expira la sesión', async () => {
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new ErrorRemoto('Sesión vencida.', { status: 401 }));
    const user = userEvent.setup();
    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
        oauthGoogleDisponible={true}
        classroomDisponible={false}
        smtpDisponible={true}
        requireGoogleOAuth={false}
      />
    );

    fireEvent.change(screen.getByLabelText(/Contraseña actual/i, { selector: 'input' }), { target: { value: 'PasswordAnterior123' } });
    fireEvent.change(screen.getByLabelText(/^Nueva contraseña/i, { selector: 'input' }), { target: { value: 'NuevaClaveSegura2026' } });
    fireEvent.change(screen.getByLabelText(/Confirmar contraseña/i, { selector: 'input' }), { target: { value: 'NuevaClaveSegura2026' } });
    await user.click(screen.getByRole('button', { name: /Guardar contraseña/i }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo autenticar. Verifica tus datos e intenta de nuevo.');
    expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warn',
      title: 'Renueva tu sesión docente',
      message: 'El detalle está en Cuenta. Cierra sesión y vuelve a entrar para renovar el acceso.',
      action: expect.objectContaining({ label: 'Cerrar sesión' })
    }));
    const aviso = vi.mocked(emitToast).mock.calls[0]?.[0];
    expect(aviso?.message).not.toContain('No se pudo autenticar');
  });

  it('permite actualizar preferencias de encabezado PDF institucional', async () => {
    const mockActualizarDocente = vi.fn();
    vi.mocked(clienteApi.enviar).mockResolvedValue({
      preferenciasPdf: {
        institucion: 'Campus Central',
        lema: 'Innovación Continua'
      }
    });

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={mockActualizarDocente}
        esAdmin={false}
        esDev={false}
      />
    );

    const inputInstitucion = screen.getByLabelText(/^Institución/i, { selector: 'input' });
    expect(inputInstitucion).toHaveAttribute('placeholder', 'Nombre de la institución');
    fireEvent.change(inputInstitucion, { target: { value: 'Campus Central' } });

    const inputLema = screen.getByLabelText(/^Lema/i, { selector: 'input' });
    fireEvent.change(inputLema, { target: { value: 'Innovación Continua' } });
    expect(inputLema).toHaveAttribute('placeholder', 'Lema del PDF');

    const botonGuardarPdf = screen.getByRole('button', { name: /Guardar PDF/i });
    fireEvent.click(botonGuardarPdf);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith(
        '/autenticacion/preferencias/pdf',
        expect.objectContaining({
          institucion: 'Campus Central',
          lema: 'Innovación Continua'
        })
      );
    });

    expect(mockActualizarDocente).toHaveBeenCalledWith(
      expect.objectContaining({
        preferenciasPdf: {
          institucion: 'Campus Central',
          lema: 'Innovación Continua'
        }
      })
    );
    const confirmacion = await screen.findByText('Preferencias de PDF guardadas');
    expect(confirmacion.closest('[role="status"]')).toBeInTheDocument();
    expect(confirmacion.closest('.cuenta-pdf')).toBeInTheDocument();
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('guarda objetivos de páginas pares y retención configurable de parciales', async () => {
    const actualizarDocente = vi.fn();
    vi.mocked(clienteApi.enviar).mockImplementation(async (ruta: string) => {
      if (ruta === '/autenticacion/preferencias/retencion-parciales') {
        return { retencionParcialesArchivadosMeses: 6 } as never;
      }
      return { preferenciasPdf: { paginasPorTipo: { parcial: 2, global: 6, extraordinario: 4 } } } as never;
    });
    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={actualizarDocente}
        esAdmin={false}
        esDev={false}
      />
    );

    const ayudaPaginas = screen.getByText('Número par entre 2 y 50. Cada hoja impresa cuenta con dos páginas.');
    for (const etiqueta of ['Parcial', 'Global', 'Extraordinario']) {
      const campo = screen.getByLabelText(`Páginas predeterminadas · ${etiqueta}`);
      expect(campo).toHaveAttribute('aria-labelledby');
      expect(campo.getAttribute('aria-describedby')?.split(' ')).toContain(ayudaPaginas.id);
    }
    expect(ayudaPaginas).toHaveClass('cuenta-pdf__pages-help');
    expect(screen.getAllByText(/Número par entre 2 y 50/)).toHaveLength(1);
    expect(screen.getByText('2 páginas = 1 hoja impresa (ambas caras).')).toBeInTheDocument();
    const global = screen.getByLabelText('Páginas predeterminadas · Global');
    fireEvent.change(global, { target: { value: '5' } });
    expect(global).toHaveValue(5);
    expect(global).toHaveAttribute('aria-invalid', 'true');
    const errorPaginas = screen.getByText('Escribe un número par entre 2 y 50.');
    expect(global.getAttribute('aria-describedby')?.split(' ')).toEqual(expect.arrayContaining([ayudaPaginas.id, errorPaginas.id]));
    expect(screen.getByRole('button', { name: 'Guardar PDF' })).toBeDisabled();
    fireEvent.change(global, { target: { value: '' } });
    expect(global).toHaveValue(null);
    fireEvent.change(global, { target: { value: '6' } });
    expect(global).not.toHaveAttribute('aria-invalid', 'true');
    const resumenGlobal = screen.getByText('6 páginas = 3 hojas impresas (ambas caras).');
    expect(resumenGlobal).toBeInTheDocument();
    expect(global.getAttribute('aria-describedby')?.split(' ')).toEqual(expect.arrayContaining([ayudaPaginas.id, resumenGlobal.id]));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar PDF' }));
    await waitFor(() => expect(clienteApi.enviar).toHaveBeenCalledWith(
      '/autenticacion/preferencias/pdf',
      expect.objectContaining({ paginasPorTipo: { parcial: 2, global: 6, extraordinario: 4 } })
    ));
    expect(actualizarDocente).toHaveBeenCalledWith(expect.objectContaining({
      preferenciasPdf: expect.objectContaining({ paginasPorTipo: { parcial: 2, global: 6, extraordinario: 4 } })
    }));

    const retencion = screen.getByLabelText('Tiempo de conservación de los PDF de parciales archivados');
    expect(retencion).toHaveAttribute('aria-labelledby');
    expect(retencion.querySelector('option[value=""]')).toHaveTextContent('Conservar siempre');
    const descripcionRetencion = retencion.getAttribute('aria-describedby');
    expect(descripcionRetencion).toBeTruthy();
    expect(document.getElementById(descripcionRetencion!)).toHaveTextContent(/se eliminan solo esos PDF al vencer el plazo/i);
    fireEvent.change(retencion, { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar retención' }));
    await waitFor(() => expect(clienteApi.enviar).toHaveBeenCalledWith(
      '/autenticacion/preferencias/retencion-parciales', { meses: 6 }
    ));
    const confirmacionRetencion = await screen.findByText('Preferencia de retención guardada');
    expect(confirmacionRetencion.closest('.cuenta-retencion')).toBeInTheDocument();
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('permite regenerar accesos directos en el escritorio y confirma en Cuenta', async () => {
    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
      />
    );

    const botonRegenerar = screen.getByRole('button', { name: /Regenerar accesos/i });
    fireEvent.click(botonRegenerar);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/autenticacion/accesos-directos/regenerar', {});
    });

    const resultado = await screen.findByText('Accesos directos de EvaluaPro y Hub actualizados en Escritorio y Menú Inicio.');
    expect(resultado.closest('[role="status"]')).toBeInTheDocument();
    expect(resultado.closest('.cuenta-accesos')).toBeInTheDocument();
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('carga la papelera de reciclaje y permite restaurar elementos cuando es admin y dev', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({
      items: [
        {
          _id: 'item-pap-1',
          tipo: 'plantilla',
          createdAt: '2026-08-20T10:00:00.000Z',
          payload: {
            plantilla: { titulo: 'Examen Parcial Álgebra' }
          }
        }
      ]
    });

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={true}
        esDev={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Examen Parcial Álgebra')).toBeInTheDocument();
    });

    const botonRestaurar = screen.getByRole('button', { name: /Restaurar/i });
    fireEvent.click(botonRestaurar);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/papelera/item-pap-1/restaurar', {});
    });

    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ok', title: 'Papelera' })
    );
  });

  it('no muestra la papelera como vacía cuando falla su consulta inicial', async () => {
    vi.mocked(clienteApi.obtener).mockRejectedValueOnce(new Error('Error de conexión'));

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={true}
        esDev={true}
      />
    );

    const panelPapelera = screen.getByRole('heading', { name: /Papelera \(dev\)/i }).closest('.cuenta-papelera');
    expect(panelPapelera).not.toBeNull();
    const papelera = within(panelPapelera as HTMLElement);

    await waitFor(() => expect(papelera.getByText('No disponible')).toBeInTheDocument());
    expect(papelera.queryByText('No hay elementos en papelera.')).not.toBeInTheDocument();
    expect(papelera.getByRole('alert')).toHaveTextContent('Error de conexión');
  });

  it('identifica los datos anteriores cuando falla la actualización de una papelera ya cargada', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({ items: [] });
    vi.mocked(clienteApi.obtener).mockRejectedValueOnce(new Error('Error de conexión'));

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={true}
        esDev={true}
      />
    );

    const panelPapelera = screen.getByRole('heading', { name: /Papelera \(dev\)/i }).closest('.cuenta-papelera');
    expect(panelPapelera).not.toBeNull();
    const papelera = within(panelPapelera as HTMLElement);
    await papelera.findByText('No hay elementos en papelera.');

    fireEvent.click(papelera.getByRole('button', { name: 'Actualizar papelera' }));

    await papelera.findByText('No se pudo actualizar; se conservan los elementos de la última consulta correcta.');
    expect(papelera.getByText('0 elementos · última carga')).toBeInTheDocument();
    expect(papelera.queryByText('No hay elementos en papelera.')).not.toBeInTheDocument();
  });

  it('renderiza la sección de actualizaciones y permite consultar el estado oficial', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tag_name: 'v1.1.1',
        html_url: 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/tag/v1.1.1',
        assets: [
          { name: 'EvaluaPro-InstallerHub-docente-local-v1.1.1.exe', browser_download_url: 'https://download.url/installer.exe' }
        ]
      })
    } as unknown as Response);

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
      />
    );

    expect(screen.getByRole('heading', { name: /Buscar actualizaciones de EvaluaPro/i })).toBeInTheDocument();
    expect(screen.getByText(/Esta pantalla no instala la actualización, verifica el archivo ni crea un respaldo/i)).toBeInTheDocument();
    expect(screen.getAllByText(/v1.1.1 Estable/i).length).toBeGreaterThanOrEqual(1);

    const botonBuscar = screen.getByRole('button', { name: /Buscar actualizaciones ahora/i });
    expect(botonBuscar).not.toHaveTextContent('🔍');
    fireEvent.click(botonBuscar);

    await waitFor(() => {
      expect(screen.getByText(/El sistema se encuentra en la versión oficial estable más reciente/i)).toBeInTheDocument();
    });

    expect(emitToast).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('anuncia el estado de espera de la consulta de actualizaciones y lo retira al terminar', async () => {
    const user = userEvent.setup();
    let resolverFetch: (response: Response) => void = () => {};
    const fetchPendiente = new Promise<Response>((resolve) => {
      resolverFetch = resolve;
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(fetchPendiente);

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
      />
    );

    const regionEstado = screen.getByRole('status', { name: 'Estado de búsqueda de actualizaciones' });
    expect(regionEstado).toBeEmptyDOMElement();

    const botonBuscar = screen.getByRole('button', { name: /Buscar actualizaciones ahora/i });
    await user.click(botonBuscar);

    expect(regionEstado).toHaveTextContent('Consultando actualizaciones en GitHub Releases.');
    const botonOcupado = screen.getByRole('button', { name: /Consultando releases/i });
    expect(botonOcupado).toHaveAttribute('aria-busy', 'true');
    expect(botonOcupado).toHaveFocus();

    resolverFetch({
      ok: true,
      json: async () => ({
        tag_name: 'v1.1.1',
        html_url: 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/tag/v1.1.1',
        assets: []
      })
    } as unknown as Response);

    await waitFor(() => {
      expect(screen.getByText(/El sistema se encuentra en la versión oficial estable más reciente/i)).toBeInTheDocument();
      expect(regionEstado).toBeEmptyDOMElement();
    });

    fetchSpy.mockRestore();
  });

  it('muestra banner y botón de descarga cuando hay una nueva versión disponible', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tag_name: 'v1.2.0',
        html_url: 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/tag/v1.2.0',
        assets: [
          { name: 'EvaluaPro-InstallerHub-docente-local-v1.2.0.exe', browser_download_url: 'https://download.url/installer-v1.2.0.exe' },
          { name: 'EvaluaPro-InstallerHub-docente-local-v1.2.0.exe.sha256', browser_download_url: 'https://download.url/installer-v1.2.0.exe.sha256' }
        ]
      })
    } as unknown as Response);

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
      />
    );

    const botonBuscar = screen.getByRole('button', { name: /Buscar actualizaciones ahora/i });
    fireEvent.click(botonBuscar);

    await waitFor(() => {
      expect(screen.getByText(/¡Nueva versión estable v1.2.0 disponible!/i)).toBeInTheDocument();
      expect(screen.getByText('Los enlaces externos abren en una pestaña o ventana nueva.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Descargar actualización oficial \(se abre en una pestaña o ventana nueva\)/i })).toHaveAttribute('href', 'https://download.url/installer-v1.2.0.exe');
      expect(screen.getByRole('link', { name: /Ver novedades \(se abre en una pestaña o ventana nueva\)/i })).toHaveAttribute('href', 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/tag/v1.2.0');
      expect(screen.getByRole('link', { name: /Ver checksum SHA-256 \(se abre en una pestaña o ventana nueva\)/i })).toHaveAttribute('href', 'https://download.url/installer-v1.2.0.exe.sha256');
      expect(screen.getByText(/Ábrelo para verificar el instalador antes de ejecutarlo/i)).toBeInTheDocument();
    });

    expect(emitToast).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('indica cuando la release no publica un checksum del instalador', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tag_name: 'v99.0.0',
        html_url: 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/tag/v99.0.0',
        assets: [
          { name: 'EvaluaPro-InstallerHub-docente-local-v99.0.0.exe', browser_download_url: 'https://download.url/installer-v99.0.0.exe' }
        ]
      })
    } as unknown as Response);

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Buscar actualizaciones ahora/i }));

    expect(await screen.findByText(/La release no publica un archivo \.sha256/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver checksum SHA-256' })).not.toBeInTheDocument();
    fetchSpy.mockRestore();
  });

  it('mantiene errores de preferencias PDF y accesos directos en Cuenta sin toast duplicado', async () => {
    vi.mocked(clienteApi.enviar).mockRejectedValue(new Error('Conflicto al guardar'));

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
      />
    );

    const botonGuardarPdf = screen.getByRole('button', { name: /Guardar PDF/i });
    fireEvent.click(botonGuardarPdf);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Conflicto al guardar'));
    expect(screen.getByRole('alert')).toHaveTextContent('Conflicto al guardar');
    expect(emitToast).not.toHaveBeenCalled();

    const botonRegenerar = screen.getByRole('button', { name: /Regenerar accesos/i });
    fireEvent.click(botonRegenerar);

    await waitFor(() => expect(clienteApi.enviar).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('alert')).toHaveTextContent('Conflicto al guardar');
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('maneja error o desconexión en verificación de actualizaciones', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'));

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
      />
    );

    const botonBuscar = screen.getByRole('button', { name: /Buscar actualizaciones ahora/i });
    fireEvent.click(botonBuscar);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo comprobar si hay actualizaciones/i);
    });
    expect(screen.getByRole('button', { name: 'Reintentar búsqueda' })).toBeEnabled();

    expect(emitToast).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('maneja respuesta HTTP no OK al verificar actualizaciones', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500
    } as unknown as Response);

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
      />
    );

    const botonBuscar = screen.getByRole('button', { name: /Buscar actualizaciones ahora/i });
    fireEvent.click(botonBuscar);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo comprobar si hay actualizaciones/i);
    });
    expect(screen.getByRole('button', { name: 'Reintentar búsqueda' })).toBeEnabled();
    expect(emitToast).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('guarda preferencias de PDF incluyendo rutas de logos', async () => {
    const mockActualizarDocente = vi.fn();
    vi.mocked(clienteApi.enviar).mockResolvedValue({
      preferenciasPdf: {
        institucion: 'Campus Norte',
        lema: 'Ciencia y Cultura',
        logos: {
          izquierdaPath: 'logos/izq.png',
          derechaPath: 'logos/der.png'
        }
      }
    });

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={mockActualizarDocente}
        esAdmin={false}
        esDev={false}
      />
    );

    const inputLogoIzq = screen.getByLabelText(/Ruta alternativa del logo izquierdo/i);
    fireEvent.change(inputLogoIzq, { target: { value: 'logos/izq.png' } });

    const inputLogoDer = screen.getByLabelText(/Ruta alternativa del logo derecho/i);
    fireEvent.change(inputLogoDer, { target: { value: 'logos/der.png' } });

    const botonGuardarPdf = screen.getByRole('button', { name: /Guardar PDF/i });
    fireEvent.click(botonGuardarPdf);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith(
        '/autenticacion/preferencias/pdf',
        expect.objectContaining({
          logos: {
            izquierdaPath: 'logos/izq.png',
            derechaPath: 'logos/der.png'
          }
        })
      );
    });
  });

  it('permite cargar logos desde archivo para reutilizarlos en nuevos exámenes', async () => {
    const mockActualizarDocente = vi.fn();
    vi.mocked(clienteApi.enviar).mockResolvedValue({
      preferenciasPdf: {
        institucion: 'Campus Norte',
        lema: 'Ciencia y Cultura',
        logos: {
          izquierdaPath: 'data:image/png;base64,ZmFrZQ==',
          derechaPath: 'data:image/png;base64,ZmFrZQ=='
        }
      }
    });

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={mockActualizarDocente}
        esAdmin={false}
        esDev={false}
      />
    );

    const archivo = new File(['logo'], 'logo.png', { type: 'image/png' });
    const inputIzquierdo = screen.getByLabelText(/Imagen institucional izquierda/i);
    const inputDerecho = screen.getByLabelText(/Imagen institucional derecha/i);
    expect(inputIzquierdo).toHaveAccessibleDescription(/PNG, JPG o WebP · máximo 2 MB por imagen/);
    expect(inputDerecho).toHaveAccessibleDescription(/PNG, JPG o WebP · máximo 2 MB por imagen/);
    fireEvent.change(inputIzquierdo, {
      target: { files: [archivo] }
    });

    await waitFor(() => expect(screen.getByAltText(/Vista previa del logo izquierdo/i)).toBeInTheDocument());
    expect(screen.getByText('Archivo: logo.png', { exact: true })).toHaveClass('cuenta-file-picker__name');
    expect(screen.getAllByText('Elegir imagen', { exact: true })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Guardar PDF/i }));

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith(
        '/autenticacion/preferencias/pdf',
        expect.objectContaining({
          logos: expect.objectContaining({ izquierdaPath: expect.stringMatching(/^data:image\/png;base64,/) })
        })
      );
    });
  });

  it('asocia los errores al logo afectado y limpia solo el error de ese selector al reintentar', async () => {
    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
      />
    );

    const inputIzquierdo = screen.getByLabelText('Imagen institucional izquierda');
    const inputDerecho = screen.getByLabelText('Imagen institucional derecha');
    fireEvent.change(inputIzquierdo, {
      target: { files: [new File(['documento'], 'logo.svg', { type: 'image/svg+xml' })] }
    });
    fireEvent.change(inputDerecho, {
      target: { files: [new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'logo.png', { type: 'image/png' })] }
    });

    expectErrorAsociado(inputIzquierdo, 'La imagen debe ser PNG, JPG o WebP.');
    expectErrorAsociado(inputDerecho, 'La imagen no puede superar 2 MB.');
    expect(clienteApi.enviar).not.toHaveBeenCalled();

    fireEvent.change(inputDerecho, {
      target: { files: [new File(['logo valido'], 'logo-derecho.png', { type: 'image/png' })] }
    });

    await waitFor(() => expect(screen.getByAltText('Vista previa del logo derecho')).toBeInTheDocument());
    expect(inputDerecho).not.toHaveAttribute('aria-invalid', 'true');
    expect(inputIzquierdo).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('La imagen debe ser PNG, JPG o WebP.')).toBeInTheDocument();
  });

  it('renderiza items de papelera tipo periodo y alumno y maneja error al restaurar', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({
      items: [
        {
          _id: 'item-periodo-1',
          tipo: 'periodo',
          eliminadoEn: '2026-08-01T12:00:00.000Z',
          expiraEn: '2026-09-15T12:00:00.000Z',
          payload: { periodo: { nombre: '2026-1' } }
        },
        {
          _id: 'item-alumno-1',
          tipo: 'alumno',
          eliminadoEn: '2026-08-05T12:00:00.000Z',
          expiraEn: '2026-09-20T12:00:00.000Z',
          payload: { alumno: { nombreCompleto: 'Juan Pérez' } }
        }
      ]
    });

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={true}
        esDev={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('2026-1')).toBeInTheDocument();
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });

    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('Fallo al restaurar'));
    const botonesRestaurar = screen.getAllByRole('button', { name: /Restaurar/i });
    fireEvent.click(botonesRestaurar[0]);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Fallo al restaurar'));
    expect(emitToast).not.toHaveBeenCalled();
  });
});
