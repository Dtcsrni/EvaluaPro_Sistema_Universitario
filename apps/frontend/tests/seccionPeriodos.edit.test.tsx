/**
 * seccionPeriodos.edit.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SeccionPeriodos } from '../src/apps/app_docente/SeccionPeriodos';
import { ConfirmDialogProvider } from '../src/ui/feedback/ConfirmDialogProvider';
import { formatearFechaCalendario } from '../src/apps/app_docente/fechaCalendario';
import { ErrorRemoto } from '../src/servicios_api/clienteApi';
import type { Periodo, PermisosUI } from '../src/apps/app_docente/tipos';

const permisos: PermisosUI = {
  periodos: { leer: true, gestionar: true, archivar: true },
  alumnos: { leer: true, gestionar: true },
  banco: { leer: true, gestionar: true, archivar: true },
  plantillas: { leer: true, gestionar: true, archivar: true, previsualizar: true },
  examenes: { leer: true, generar: true, archivar: true, regenerar: true, descargar: true },
  entregas: { gestionar: true },
  omr: { analizar: true },
  calificaciones: { calificar: true },
  publicar: { publicar: true },
  sincronizacion: { listar: true, exportar: true, importar: true, push: true, pull: true },
  cuenta: { leer: true, actualizar: true }
};

describe('SeccionPeriodos edición', () => {
  it('distingue las acciones de cada materia y abre el panel correspondiente', () => {
    const periodos = [
      { _id: 'materia-algebra', nombre: 'Álgebra Lineal', fechaInicio: '2026-02-01', fechaFin: '2026-03-01', grupos: ['1A'] },
      { _id: 'materia-bases', nombre: 'Bases de Datos', fechaInicio: '2026-02-01', fechaFin: '2026-03-01', grupos: ['2B'] }
    ] as unknown as Periodo[];

    render(
      <SeccionPeriodos
        periodos={periodos}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );

    const acciones = screen.getAllByRole('button', { name: /Mostrar acciones/i });
    expect(acciones).toHaveLength(2);
    expect(acciones[0]).toHaveAccessibleName('Mostrar acciones de materia Álgebra Lineal');
    expect(acciones[1]).toHaveAccessibleName('Mostrar acciones de materia Bases de Datos');
    expect(new Set(acciones.map((accion) => accion.getAttribute('aria-label'))).size).toBe(2);

    const panelId = acciones[1].getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    expect(panel).toHaveAttribute('hidden');
    fireEvent.click(acciones[1]);

    expect(acciones[0]).toHaveAttribute('aria-expanded', 'false');
    expect(acciones[1]).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Ocultar acciones de materia Bases de Datos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar materia Bases de Datos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archivar materia Bases de Datos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar lista institucional XLSX de Bases de Datos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar lista institucional PDF de Bases de Datos' })).toBeInTheDocument();
    expect(panel).not.toHaveAttribute('hidden');
    fireEvent.click(acciones[0]);
    expect(screen.getByRole('button', { name: 'Editar materia Álgebra Lineal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archivar materia Álgebra Lineal' })).toBeInTheDocument();
    expect(panel).toHaveAttribute('hidden');
  });

  it('confirma el archivo por teclado y devuelve el foco sin mutar al cancelar', async () => {
    const user = userEvent.setup();
    const periodo = {
      _id: 'periodo-archivo-teclado',
      nombre: 'Materia archivable',
      fechaInicio: '2026-02-01',
      fechaFin: '2026-03-01',
      grupos: ['3A']
    } as unknown as Periodo;
    const enviarConPermiso = vi.fn(async () => ({}));
    render(
      <ConfirmDialogProvider>
        <SeccionPeriodos
          periodos={[periodo]}
          onRefrescar={vi.fn()}
          onVerArchivadas={vi.fn()}
          permisos={permisos}
          puedeEliminarMateriaDev={false}
          enviarConPermiso={enviarConPermiso}
          avisarSinPermiso={vi.fn()}
        />
      </ConfirmDialogProvider>
    );

    await user.click(screen.getByRole('button', { name: /Mostrar acciones/i }));
    const archivar = screen.getByRole('button', { name: /^Archivar materia/ });
    await user.click(archivar);
    const dialogo = screen.getByRole('alertdialog', { name: 'Archivar materia' });
    expect(dialogo).toHaveTextContent('Materia archivable');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(enviarConPermiso).not.toHaveBeenCalled();
    expect(archivar).toHaveFocus();

    await user.click(archivar);
    await user.click(screen.getByRole('button', { name: 'Sí, archivar' }));
    await waitFor(() => expect(enviarConPermiso).toHaveBeenCalledWith(
      'periodos:archivar',
      '/periodos/periodo-archivo-teclado/archivar',
      {},
      'No tienes permiso para archivar materias.'
    ));
    expect(await screen.findByText('Materia archivada')).toBeInTheDocument();
  });

  it('inicia la guía plegada y permite consultarla bajo demanda', () => {
    localStorage.removeItem('ep.guia.materias.oculta');

    const { container } = render(
      <SeccionPeriodos
        periodos={[]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );

    expect(screen.queryByText('PASO 01')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver guía rápida de configuración/i }));
    expect(screen.getByText('PASO 01')).toBeInTheDocument();
    expect(container.querySelector('.materias-panel svg:not(.icono-lucide):not([data-icono]):not(.circular-chart)')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('explica visiblemente el formato de grupos y conserva un estado vacío claro', () => {
    render(
      <SeccionPeriodos
        periodos={[]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Aún no hay materias' })).toBeInTheDocument();
    expect(screen.getByText('Selecciona «Registrar materia» para abrir el formulario y empezar a organizar sus grupos, alumnos y calificaciones.')).toBeInTheDocument();
    const resumenMaterias = screen.getByRole('group', { name: 'Resumen de materias' });
    expect(resumenMaterias).toBeInTheDocument();
    expect(resumenMaterias).not.toHaveAttribute('aria-live');
    expect(screen.queryByText('🎓')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar materia' }));

    expect(screen.getByText('El nombre y las fechas son obligatorios. Los grupos y la portada son opcionales. La fecha de término debe ser igual o posterior a la de inicio.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre de la materia')).toBeRequired();
    expect(screen.getByLabelText('Fecha de inicio')).toBeRequired();
    expect(screen.getByLabelText('Fecha de término')).toBeRequired();

    const portada = screen.getByLabelText('Portada (opcional)');
    expect(portada).toHaveAttribute('aria-describedby', 'portada-nueva-materia-ayuda');
    expect(screen.getByText('Ningún archivo seleccionado')).toHaveAttribute('role', 'status');
    fireEvent.change(portada, {
      target: { files: [new File(['imagen ficticia'], 'portada-demo.png', { type: 'image/png' })] }
    });
    expect(screen.getByText('portada-demo.png')).toHaveAttribute('aria-live', 'polite');
    fireEvent.change(portada, {
      target: { files: [new File(['texto ficticio'], 'portada-no-valida.txt', { type: 'text/plain' })] }
    });
    expect(screen.getByText('Selecciona una imagen JPG/JPEG, PNG o WebP.')).toHaveAttribute('role', 'alert');
    expect(screen.getByText('Ningún archivo seleccionado')).toHaveAttribute('role', 'status');

    const grupos = screen.getByRole('textbox', { name: 'Grupos asignados (opcional)' });
    expect(grupos).not.toBeRequired();
    expect(grupos).toHaveAttribute('aria-describedby', 'grupos-materia-ayuda');
    expect(screen.getByText('Separa varios grupos con comas.')).toBeInTheDocument();
  });

  it('explica por qué el alta está deshabilitada y retira la ayuda cuando los campos son válidos', () => {
    const enviarConPermiso = vi.fn(async () => ({}));
    render(
      <SeccionPeriodos
        periodos={[]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={enviarConPermiso}
        avisarSinPermiso={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Registrar materia' }));
    const crear = screen.getByRole('button', { name: 'Crear materia' });
    const ayuda = screen.getByText('Completa los campos obligatorios y corrige los errores indicados para habilitar la creación.');
    expect(crear).toBeDisabled();
    expect(crear).toHaveAccessibleDescription(ayuda.textContent);
    expect(crear).toHaveAttribute('aria-describedby', ayuda.id);
    expect(enviarConPermiso).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Nombre de la materia'), { target: { value: 'Matemáticas I' } });
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Fecha de término'), { target: { value: '2026-12-18' } });

    expect(screen.queryByText(ayuda.textContent!)).not.toBeInTheDocument();
    expect(crear).toBeEnabled();
    expect(crear).not.toHaveAttribute('aria-describedby');
    expect(enviarConPermiso).not.toHaveBeenCalled();
  });

  it('muestra error recuperable en vez de presentar la carga fallida como catálogo vacío', () => {
    const reintentar = vi.fn(async () => {});
    render(
      <SeccionPeriodos
        periodos={[]}
        errorMaterias
        onRefrescar={reintentar}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo actualizar el catálogo de materias');
    expect(screen.queryByRole('heading', { name: 'Aún no hay materias' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga de materias' }));
    expect(reintentar).toHaveBeenCalledOnce();
  });

  it('no presenta ceros como datos confirmados mientras carga o falla el catálogo', () => {
    const { rerender, container } = render(
      <SeccionPeriodos
        periodos={[]}
        cargandoMaterias
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );
    const resumen = screen.getByRole('group', { name: 'Resumen de materias' });

    expect(screen.getByText('Cargando catálogo…')).toBeInTheDocument();
    expect(within(resumen).getAllByText('—')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: 'Materias activas' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Aún no hay materias' })).not.toBeInTheDocument();

    rerender(
      <SeccionPeriodos
        periodos={[]}
        errorMaterias
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );

    expect(screen.getByText('Catálogo no disponible')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Resumen de materias' })).getAllByText('—')).toHaveLength(3);
    expect(container.querySelector('.materias-section-title')).toHaveTextContent('Materias activas');
    expect(container.querySelector('.materias-section-title')).not.toHaveTextContent('(0)');
  });

  it('usa etiquetas en singular cuando hay una materia y un grupo', () => {
    const { container } = render(
      <SeccionPeriodos
        periodos={[{
          _id: 'periodo-unico',
          nombre: 'Materia de prueba',
          fechaInicio: '2026-08-10',
          fechaFin: '2026-12-18',
          grupos: ['1A']
        } as unknown as Periodo]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );

    expect(container.querySelector('.materia-mini-kpi--active .materia-mini-kpi__lbl')).toHaveTextContent(/^Materia$/);
    expect(container.querySelector('.materia-mini-kpi--groups .materia-mini-kpi__lbl')).toHaveTextContent(/^Grupo$/);
  });

  it('entra en modo edición de materia', () => {
    const periodo = {
      _id: 'per-1',
      nombre: 'Lógica de Programación',
      fechaInicio: '2026-02-01',
      fechaFin: '2026-03-01',
      grupos: ['3A', '3B']
    } as unknown as Periodo;

    render(
      <SeccionPeriodos
        periodos={[periodo]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );

    const acciones = screen.getByRole('button', { name: /Mostrar acciones/i });
    expect(acciones).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(acciones);
    expect(acciones).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Editar/i }));
    expect(screen.getByText(/Guardar cambios/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Nombre de la materia/i).length).toBeGreaterThanOrEqual(2);
    const formularioEdicion = document.querySelector<HTMLElement>('.materias-edicion');
    expect(formularioEdicion).not.toBeNull();
    if (!formularioEdicion) throw new Error('No se encontró el formulario de edición.');
    const camposEdicion = within(formularioEdicion);
    expect(camposEdicion.getByLabelText('Nombre de la materia')).toBeRequired();
    expect(camposEdicion.getByLabelText('Fecha de inicio')).toBeRequired();
    expect(camposEdicion.getByLabelText('Fecha de término')).toBeRequired();
  });

  it('mueve el foco al primer campo al editar con puntero y lo devuelve al cancelar', async () => {
    const user = userEvent.setup();
    const periodo = {
      _id: 'per-foco',
      nombre: 'Álgebra Lineal — 2A',
      fechaInicio: '2026-02-01',
      fechaFin: '2026-03-01',
      grupos: ['3A']
    } as unknown as Periodo;

    render(
      <SeccionPeriodos
        periodos={[periodo]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );

    const avisos: Array<{ id?: string; title?: string; message?: string }> = [];
    const recibirAviso = (event: Event) => avisos.push((event as CustomEvent<typeof avisos[number]>).detail);
    window.addEventListener('app:toast', recibirAviso);
    await user.click(screen.getByRole('button', { name: /Mostrar acciones/i }));
    const editar = screen.getByRole('button', { name: /^Editar materia/ });
    await user.click(editar);
    expect(avisos).toHaveLength(0);

    const formulario = document.querySelector<HTMLElement>('.materias-edicion');
    expect(formulario).not.toBeNull();
    if (!formulario) throw new Error('No se encontró el formulario de edición.');
    const nombre = within(formulario).getByLabelText('Nombre de la materia');
    expect(document.activeElement).toBe(nombre);
    expect(nombre).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: /^Guardar cambios en materia/ })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /^Cancelar edición de materia/ }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Mostrar acciones/i }));
    expect(avisos.at(-1)).toMatchObject({
      id: 'materias:edicion',
      title: 'Edición cancelada',
      message: 'No se guardaron cambios.'
    });
    window.removeEventListener('app:toast', recibirAviso);
  });

  it('mantiene el resultado de edición en Materias sin repetirlo en un toast', async () => {
    const user = userEvent.setup();
    const periodo = {
      _id: 'per-feedback',
      nombre: 'Materia para editar',
      fechaInicio: '2026-02-01',
      fechaFin: '2026-03-01',
      grupos: ['3A']
    } as unknown as Periodo;
    const avisos: Array<{ level?: string; title?: string; message?: string }> = [];
    const recibirAviso = (event: Event) => avisos.push((event as CustomEvent<typeof avisos[number]>).detail);
    window.addEventListener('app:toast', recibirAviso);

    render(
      <SeccionPeriodos
        periodos={[periodo]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Mostrar acciones/i }));
    await user.click(screen.getByRole('button', { name: /^Editar materia/ }));
    await user.click(screen.getByRole('button', { name: /^Guardar cambios en materia/ }));

    const confirmacion = await screen.findByText('Cambios guardados en «Materia para editar».');
    expect(confirmacion.closest('[role="status"]')).toBeInTheDocument();
    expect(confirmacion.closest('.materias-form')).not.toBeInTheDocument();
    expect(avisos).toHaveLength(0);
    window.removeEventListener('app:toast', recibirAviso);
  });

  it('reserva el toast de Materias para la acción de recuperar una sesión vencida', async () => {
    const user = userEvent.setup();
    const periodo = {
      _id: 'per-sesion-vencida',
      nombre: 'Materia para editar',
      fechaInicio: '2026-02-01',
      fechaFin: '2026-03-01',
      grupos: ['3A']
    } as unknown as Periodo;
    const enviarConPermiso = vi.fn().mockRejectedValue(new ErrorRemoto('Sesión vencida.', { status: 401 }));
    const avisos: Array<{ level?: string; title?: string; message?: string; action?: { label?: string } }> = [];
    const recibirAviso = (event: Event) => avisos.push((event as CustomEvent<typeof avisos[number]>).detail);
    window.addEventListener('app:toast', recibirAviso);

    render(
      <SeccionPeriodos
        periodos={[periodo]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={enviarConPermiso}
        avisarSinPermiso={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Mostrar acciones/i }));
    await user.click(screen.getByRole('button', { name: /^Editar materia/ }));
    await user.click(screen.getByRole('button', { name: /^Guardar cambios en materia/ }));

    const detalle = await screen.findByText(/No se pudo autenticar/i);
    expect(detalle.closest('[role="alert"]')).toBeInTheDocument();
    expect(avisos).toContainEqual(expect.objectContaining({
      level: 'warn',
      title: 'Renueva tu sesión docente',
      message: 'El detalle está en Materias. Cierra sesión y vuelve a entrar para renovar el acceso.',
      action: expect.objectContaining({ label: 'Cerrar sesión' })
    }));
    window.removeEventListener('app:toast', recibirAviso);
  });

  it('no guarda al abrir la edición con Enter y permite continuar por teclado', async () => {
    const user = userEvent.setup();
    const periodo = {
      _id: 'per-edicion-teclado',
      nombre: 'Materia por teclado',
      fechaInicio: '2026-02-01',
      fechaFin: '2026-03-01',
      grupos: ['3A']
    } as unknown as Periodo;
    const enviarConPermiso = vi.fn(async () => ({}));

    render(
      <SeccionPeriodos
        periodos={[periodo]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={enviarConPermiso}
        avisarSinPermiso={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Mostrar acciones/i }));
    const editar = screen.getByRole('button', { name: /^Editar materia/ });
    editar.focus();
    await user.keyboard('{Enter}');

    const instrucciones = await screen.findByText('El nombre y las fechas son obligatorios. Los grupos son opcionales. La fecha de término debe ser igual o posterior a la de inicio.');
    expect(document.activeElement).toBe(instrucciones);
    expect(enviarConPermiso).not.toHaveBeenCalled();

    await user.tab();
    const nombre = document.getElementById('nombre-materia-edicion-per-edicion-teclado');
    expect(nombre).not.toBeNull();
    expect(document.activeElement).toBe(nombre);
    expect(enviarConPermiso).not.toHaveBeenCalled();
  });

  it('abre y cancela la edición con Espacio sin guardar ni perder el foco', async () => {
    const user = userEvent.setup();
    const periodo = {
      _id: 'per-edicion-espacio',
      nombre: 'Materia con Espacio',
      fechaInicio: '2026-02-01',
      fechaFin: '2026-03-01',
      grupos: ['3A']
    } as unknown as Periodo;
    const enviarConPermiso = vi.fn(async () => ({}));

    render(
      <SeccionPeriodos
        periodos={[periodo]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={enviarConPermiso}
        avisarSinPermiso={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Mostrar acciones/i }));
    const editar = screen.getByRole('button', { name: /^Editar materia/ });
    editar.focus();
    await user.keyboard(' ');

    const instrucciones = await screen.findByText('El nombre y las fechas son obligatorios. Los grupos son opcionales. La fecha de término debe ser igual o posterior a la de inicio.');
    expect(document.activeElement).toBe(instrucciones);
    expect(enviarConPermiso).not.toHaveBeenCalled();

    const cancelar = screen.getByRole('button', { name: /^Cancelar edición de materia/ });
    cancelar.focus();
    await user.keyboard(' ');

    await waitFor(() => expect(screen.queryByRole('form', { name: /Editar materia/ })).not.toBeInTheDocument());
    const acciones = screen.getByRole('button', { name: /Mostrar acciones/i });
    await waitFor(() => expect(document.activeElement).toBe(acciones));
    expect(enviarConPermiso).not.toHaveBeenCalled();
  });

  it('usa el formulario semántico para guardar y devuelve el foco al control de acciones', async () => {
    const user = userEvent.setup();
    const periodo = {
      _id: 'per-guardar-foco',
      nombre: 'Materia guardada',
      fechaInicio: '2026-02-01',
      fechaFin: '2026-03-01',
      grupos: ['3A']
    } as unknown as Periodo;

    const enviarConPermiso = vi.fn(async () => ({}));
    render(
      <SeccionPeriodos
        periodos={[periodo]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={enviarConPermiso}
        avisarSinPermiso={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Mostrar acciones/i }));
    await user.click(screen.getByRole('button', { name: /^Editar materia/ }));
    const formulario = document.querySelector<HTMLFormElement>('form.materias-edicion');
    expect(formulario).not.toBeNull();
    if (!formulario) throw new Error('No se encontró el formulario de edición.');
    expect(screen.getByRole('button', { name: /^Guardar cambios en materia/ })).toHaveAttribute('form', formulario.id);
    expect(document.activeElement).toBe(within(formulario).getByLabelText('Nombre de la materia'));
    await user.click(screen.getByRole('button', { name: /^Guardar cambios en materia/ }));

    await waitFor(() => expect(enviarConPermiso).toHaveBeenCalledWith(
      'periodos:gestionar',
      '/periodos/per-guardar-foco',
      expect.objectContaining({
        nombre: 'Materia guardada',
        fechaInicio: '2026-02-01',
        fechaFin: '2026-03-01',
        grupos: ['3A']
      }),
      'No tienes permiso para editar materias.'
    ));

    const acciones = await screen.findByRole('button', { name: /Mostrar acciones/i });
    await waitFor(() => expect(document.activeElement).toBe(acciones));
  });

  it('asocia los errores de alta a nombre, fechas y grupos', () => {
    const periodo = {
      _id: 'per-existente',
      nombre: 'Álgebra',
      fechaInicio: '2026-02-01',
      fechaFin: '2026-03-01',
      grupos: ['3A']
    } as unknown as Periodo;

    render(
      <SeccionPeriodos
        periodos={[periodo]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Mostrar formulario/i }));
    fireEvent.change(screen.getByLabelText('Nombre de la materia'), { target: { value: 'Álgebra' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Grupos asignados (opcional)' }), { target: { value: '1A, 1A' } });
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-04-15' } });
    fireEvent.change(screen.getByLabelText('Fecha de término'), { target: { value: '2026-04-01' } });

    const nombre = screen.getByLabelText('Nombre de la materia');
    const grupos = screen.getByRole('textbox', { name: 'Grupos asignados (opcional)' });
    const fechas = [screen.getByLabelText('Fecha de inicio'), screen.getByLabelText('Fecha de término')];
    expect(nombre).toHaveAttribute('aria-invalid', 'true');
    expect(nombre).toHaveAttribute('aria-describedby', expect.stringContaining('error-nombre-alta-duplicado'));
    expect(grupos).toHaveAttribute('aria-invalid', 'true');
    expect(grupos).toHaveAttribute('aria-describedby', expect.stringContaining('error-grupos-alta-duplicados'));
    for (const fecha of fechas) {
      expect(fecha).toHaveAttribute('aria-invalid', 'true');
      expect(fecha).toHaveAttribute('aria-describedby', expect.stringContaining('error-fechas-alta-rango'));
    }
    expect(document.getElementById('error-nombre-alta-duplicado')).toBeInTheDocument();
    expect(document.getElementById('error-grupos-alta-duplicados')).toBeInTheDocument();
    expect(document.getElementById('error-fechas-alta-rango')).toBeInTheDocument();
  });

  it('asocia los errores de edición a los campos afectados', () => {
    const periodos = [
      { _id: 'per-1', nombre: 'Materia Uno', fechaInicio: '2026-02-01', fechaFin: '2026-03-01', grupos: ['3A'] },
      { _id: 'per-2', nombre: 'Materia Dos', fechaInicio: '2026-02-01', fechaFin: '2026-03-01', grupos: ['4A'] }
    ] as unknown as Periodo[];

    render(
      <SeccionPeriodos
        periodos={periodos}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Mostrar acciones/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /^Editar materia/ }));
    const formulario = document.querySelector<HTMLElement>('.materias-edicion');
    expect(formulario).not.toBeNull();
    if (!formulario) throw new Error('No se encontró el formulario de edición.');
    const campos = within(formulario);
    fireEvent.change(campos.getByLabelText('Nombre de la materia'), { target: { value: 'Materia Dos' } });
    fireEvent.change(campos.getByLabelText('Fecha de inicio'), { target: { value: '2026-04-15' } });
    fireEvent.change(campos.getByLabelText('Fecha de término'), { target: { value: '2026-04-01' } });
    fireEvent.change(campos.getByRole('textbox', { name: 'Grupos asignados (opcional)' }), { target: { value: '1A, 1A' } });

    for (const label of ['Nombre de la materia', 'Fecha de inicio', 'Fecha de término']) {
      const campo = campos.getByLabelText(label);
      expect(campo).toHaveAttribute('aria-invalid', 'true');
      const referencias = campo.getAttribute('aria-describedby')?.split(' ') ?? [];
      expect(referencias.length).toBeGreaterThan(0);
      for (const referencia of referencias) {
        expect(document.getElementById(referencia)).toBeInTheDocument();
      }
    }
    const gruposEdicion = campos.getByRole('textbox', { name: 'Grupos asignados (opcional)' });
    expect(gruposEdicion).toHaveAttribute('aria-invalid', 'true');
    for (const referencia of (gruposEdicion.getAttribute('aria-describedby') ?? '').split(' ')) {
      expect(document.getElementById(referencia)).toBeInTheDocument();
    }
    expect(gruposEdicion).toHaveAccessibleDescription('Separa varios grupos con comas; puedes dejarlo vacío. Hay grupos repetidos.');
  });

  it('mantiene visible el error de edición aunque el formulario de alta esté plegado', async () => {
    const periodo = {
      _id: 'per-error',
      nombre: 'Materia de prueba',
      fechaInicio: '2026-02-01',
      fechaFin: '2026-03-01',
      grupos: ['3A']
    } as unknown as Periodo;
    const enviarConPermiso = vi.fn(async () => { throw new Error('Conflicto al guardar'); });

    render(
      <SeccionPeriodos
        periodos={[periodo]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={enviarConPermiso}
        avisarSinPermiso={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Mostrar acciones/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Editar materia/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Guardar cambios en materia/ }));

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Conflicto al guardar');
    expect(error.closest('#registro-nueva-materia')).toBeNull();
  });

  it('conserva el día calendario de fechas API al mostrar y editar una materia', () => {
    const periodo = {
      _id: 'per-fecha-iso',
      nombre: 'Materia con fecha ISO',
      fechaInicio: '2026-08-01T00:00:00.000Z',
      fechaFin: '2026-12-31T00:00:00.000Z',
      grupos: ['3A']
    } as unknown as Periodo;

    render(
      <SeccionPeriodos
        periodos={[periodo]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );

    const tarjeta = screen.getByRole('button', { name: 'Abrir grupo 3A de Materia con fecha ISO; 0 alumnos' });
    expect(tarjeta).toHaveTextContent(formatearFechaCalendario(periodo.fechaInicio) ?? '');
    expect(tarjeta).toHaveTextContent(formatearFechaCalendario(periodo.fechaFin) ?? '');
    fireEvent.click(screen.getByRole('button', { name: /Mostrar acciones/i }));
    fireEvent.click(screen.getByRole('button', { name: /Editar/i }));

    const formularioEdicion = document.querySelector<HTMLElement>('.materias-edicion');
    expect(formularioEdicion).not.toBeNull();
    if (!formularioEdicion) throw new Error('No se encontró el formulario de edición.');
    const camposEdicion = within(formularioEdicion);
    expect(camposEdicion.getByLabelText('Fecha de inicio')).toHaveValue('2026-08-01');
    expect(camposEdicion.getByLabelText('Fecha de término')).toHaveValue('2026-12-31');
  });

  it('mantiene vigente la materia durante todo el día de término', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 9, 28, 12));
      const periodo = {
        _id: 'per-termina-hoy',
        nombre: 'Materia que termina hoy',
        fechaInicio: '2026-10-01T00:00:00.000Z',
        fechaFin: '2026-10-28T00:00:00.000Z',
        grupos: ['3A']
      } as unknown as Periodo;

      render(
        <SeccionPeriodos
          periodos={[periodo]}
          onRefrescar={vi.fn()}
          onVerArchivadas={vi.fn()}
          permisos={permisos}
          puedeEliminarMateriaDev={false}
          enviarConPermiso={vi.fn(async () => ({}))}
          avisarSinPermiso={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /Abrir grupo 3A de Materia que termina hoy/i }))
        .toHaveTextContent('Cierra hoy');
    } finally {
      vi.useRealTimers();
    }
  });

  it('abre Alumnos con el grupo de la tarjeta', () => {
    const onAbrirGrupo = vi.fn();
    const periodo = {
      _id: 'per-grupo',
      nombre: 'Diseño Web',
      fechaInicio: '2026-02-01',
      fechaFin: '2026-03-01',
      grupos: ['E512606A']
    } as unknown as Periodo;

    render(
      <SeccionPeriodos
        periodos={[periodo]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        onAbrirGrupo={onAbrirGrupo}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );

    const abrirGrupo = screen.getByRole('button', { name: 'Abrir grupo E512606A de Diseño Web; 0 alumnos' });
    expect(abrirGrupo).toHaveAccessibleName('Abrir grupo E512606A de Diseño Web; 0 alumnos');
    fireEvent.click(abrirGrupo);
    expect(onAbrirGrupo).toHaveBeenCalledWith('per-grupo', 'E512606A');
  });

  it('usa el nombre de la materia en portada y títulos accesibles sin exponer el ID', () => {
    render(
      <SeccionPeriodos
        periodos={[{ _id: 'per-1', nombre: 'Lógica de Programación', grupos: ['3A'] }]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Abrir grupo 3A de Lógica de Programación; 0 alumnos' }))
      .toBeInTheDocument();
    expect(screen.getByText('Lógica de Programación', { selector: '.item-title' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Mostrar acciones/i }));

    expect(screen.getByLabelText('Seleccionar imagen de portada para Lógica de Programación'))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar portada para Lógica de Programación' }))
      .toBeDisabled();
    expect(screen.queryByLabelText(/Seleccionar imagen de portada para .*ID:/i)).not.toBeInTheDocument();
  });

  it('muestra los alumnos asociados dentro de la tarjeta de materia', () => {
    render(
      <SeccionPeriodos
        periodos={[{ _id: 'per-1', nombre: 'Lógica de Programación', grupos: ['3A'] }]}
        alumnos={[
          { _id: 'alu-1', matricula: 'A1', nombreCompleto: 'Ana Pérez', periodoId: 'per-1', grupo: '3A' },
          { _id: 'alu-2', matricula: 'A2', nombreCompleto: 'Luis Gómez', periodoId: 'per-1', grupo: '3A' }
        ]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );

    const tarjeta = screen.getByRole('button', { name: /Abrir grupo 3A de Lógica de Programación/i });
    expect(within(tarjeta).getByText('Alumnos')).toBeInTheDocument();
    expect(tarjeta).toHaveTextContent('2');
    expect(tarjeta).toHaveTextContent('Ana Pérez');
    expect(tarjeta).toHaveTextContent('Luis Gómez');
  });

  it('reduce la lista de la tarjeta a una vista previa y anuncia el total de alumnos', () => {
    const alumnos = Array.from({ length: 8 }, (_, index) => ({
      _id: `alu-${index + 1}`,
      matricula: `A${index + 1}`,
      nombreCompleto: `Alumno de prueba ${index + 1}`,
      periodoId: 'per-1',
      grupo: '3A'
    }));

    render(
      <SeccionPeriodos
        periodos={[{ _id: 'per-1', nombre: 'Materia de prueba', grupos: ['3A'] }]}
        alumnos={alumnos}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );

    const tarjeta = screen.getByRole('button', { name: 'Abrir grupo 3A de Materia de prueba; 8 alumnos' });
    const listaVistaPrevia = tarjeta.querySelector('.materia-card-alumnos__list');
    expect(listaVistaPrevia?.querySelectorAll('.materia-alumno-chip')).toHaveLength(4);
    expect(tarjeta).toHaveTextContent('Alumno de prueba 1');
    expect(tarjeta).toHaveTextContent('Alumno de prueba 3');
    expect(tarjeta).not.toHaveTextContent('Alumno de prueba 4');
    expect(tarjeta).toHaveTextContent('+5 alumnos');
    expect(tarjeta).toHaveAccessibleDescription(/Alumnos\s*8.*Alumno de prueba 1.*\+5 alumnos/);
  });

  it('calcula y muestra chips de avance para diversos estados de periodo', () => {
    const periodos = [
      {
        _id: 'p-futuro',
        nombre: 'Materia Futura',
        fechaInicio: '2030-01-01',
        fechaFin: '2030-06-01',
        grupos: ['A']
      },
      {
        _id: 'p-pasado',
        nombre: 'Materia Pasada',
        fechaInicio: '2020-01-01',
        fechaFin: '2020-06-01',
        grupos: ['B']
      },
      {
        _id: 'p-invalido',
        nombre: 'Materia Invalida',
        fechaInicio: '2026-06-01',
        fechaFin: '2026-01-01',
        grupos: ['C']
      },
      {
        _id: 'p-sinfechas',
        nombre: 'Materia Sin Fechas',
        grupos: ['D']
      }
    ] as unknown as Periodo[];

    render(
      <SeccionPeriodos
        periodos={periodos}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn(async () => ({}))}
        avisarSinPermiso={vi.fn()}
      />
    );

    expect(screen.getByText(/Materia Futura/i)).toBeInTheDocument();
    expect(screen.getByText(/Materia Pasada/i)).toBeInTheDocument();
    expect(screen.getByText(/Inicia en/i)).toBeInTheDocument();
    expect(screen.getByText(/Concluido/i)).toBeInTheDocument();
  });
});
