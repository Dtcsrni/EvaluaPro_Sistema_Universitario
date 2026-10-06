/**
 * plantillas.refactor.test
 *
 * Responsabilidad: Pruebas unitarias de navegación por pestañas y guías rápidas en Diseño de Exámenes (SPEC-034).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  existeTituloPlantillaDuplicadoPorPeriodo,
  SeccionPlantillas
} from '../src/apps/app_docente/SeccionPlantillas';
import { PlantillasListado } from '../src/apps/app_docente/features/plantillas/components/PlantillasListado';
import { ConfirmDialogProvider } from '../src/ui/feedback/ConfirmDialogProvider';
import type { PreviewPdfUrls } from '../src/apps/app_docente/features/plantillas/hooks/usePlantillasPreviewActions';
import type { Alumno, PermisosUI, Plantilla, PreviewPlantilla } from '../src/apps/app_docente/tipos';

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

function HarnessPlantillas({
  permisosEntrada = permisos,
  plantillas = [] as Plantilla[],
  preguntas = [],
  alumnos = [] as Alumno[],
  enviarConPermiso = async () => ({}),
  onRefrescar = () => {}
}: {
  permisosEntrada?: PermisosUI;
  plantillas?: Plantilla[];
  preguntas?: Pregunta[];
  alumnos?: Alumno[];
  enviarConPermiso?: (permiso: string, ruta: string, payload: Record<string, unknown>, mensaje?: string) => Promise<unknown>;
  onRefrescar?: () => void;
}) {
  const [previewPorPlantillaId, setPreviewPorPlantillaId] = useState<Record<string, PreviewPlantilla>>({});
  const [cargandoPreviewPlantillaId, setCargandoPreviewPlantillaId] = useState<string | null>(null);
  const [plantillaPreviewId, setPlantillaPreviewId] = useState<string | null>(null);
  const [previewPdfUrlPorPlantillaId, setPreviewPdfUrlPorPlantillaId] = useState<
    Record<string, PreviewPdfUrls>
  >({});
  const [cargandoPreviewPdfPlantillaId, setCargandoPreviewPdfPlantillaId] = useState<string | null>(null);

  return (
    <SeccionPlantillas
      plantillas={plantillas}
      periodos={[{ _id: 'per-1', nombre: 'Periodo 1', grupos: ['A'] }]}
      preguntas={preguntas}
      alumnos={alumnos}
      permisos={permisosEntrada}
      enviarConPermiso={enviarConPermiso}
      avisarSinPermiso={() => {}}
      previewPorPlantillaId={previewPorPlantillaId}
      setPreviewPorPlantillaId={setPreviewPorPlantillaId}
      cargandoPreviewPlantillaId={cargandoPreviewPlantillaId}
      setCargandoPreviewPlantillaId={setCargandoPreviewPlantillaId}
      plantillaPreviewId={plantillaPreviewId}
      setPlantillaPreviewId={setPlantillaPreviewId}
      previewPdfUrlPorPlantillaId={previewPdfUrlPorPlantillaId}
      setPreviewPdfUrlPorPlantillaId={setPreviewPdfUrlPorPlantillaId}
      cargandoPreviewPdfPlantillaId={cargandoPreviewPdfPlantillaId}
      setCargandoPreviewPdfPlantillaId={setCargandoPreviewPdfPlantillaId}
      onRefrescar={onRefrescar}
    />
  );
}

describe('plantillas refactor y navegación por pestañas (SPEC-034)', () => {
  beforeEach(() => {
    sessionStorage.removeItem('evaluapro.plantillas.tab-activa');
  });

  it('acota la validación de títulos a la materia seleccionada', () => {
    const plantillas = [
      { _id: 'pla-uno', titulo: 'Segundo Parcial', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-uno' },
      { _id: 'pla-dos', titulo: 'Segundo Parcial', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-dos' }
    ] as Plantilla[];

    expect(existeTituloPlantillaDuplicadoPorPeriodo(plantillas, '  segundo   parcial ', 'per-uno')).toBe(true);
    expect(existeTituloPlantillaDuplicadoPorPeriodo(plantillas, '  segundo   parcial ', 'per-tres')).toBe(false);
    expect(existeTituloPlantillaDuplicadoPorPeriodo(plantillas, 'Segundo Parcial', 'per-dos', 'pla-dos')).toBe(false);
  });

  it('renderiza encabezado principal y pestañas operativas', () => {
    render(<HarnessPlantillas />);
    expect(screen.getByRole('heading', { level: 2, name: /Diseño de Exámenes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Diseñar Exámenes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Historial de Lotes/i })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Tamaño de fuente/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Espaciado de línea/i })).not.toBeInTheDocument();
    expect(screen.getByText('Tipografía e interlineado')).toBeInTheDocument();
    expect(screen.getByText('Gestionados por el motor')).toBeInTheDocument();
    expect(screen.getByText('Selecciona una materia para comenzar')).toBeInTheDocument();
    expect(screen.getByLabelText('Cantidad de páginas')).toHaveValue(2);
    fireEvent.change(screen.getByLabelText('Tipo de plantilla'), { target: { value: 'global' } });
    expect(screen.getByLabelText('Cantidad de páginas')).toHaveValue(4);
  });

  it('advierte sobre reverso en blanco y captura solo de caras impresas en la plantilla inline', () => {
    render(<HarnessPlantillas />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Plantilla OMR del examen' }), {
      target: { value: 'omr-inline-exam-v1' }
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Agrega un reverso en blanco por página para impedir trasluz; al imprimir a doble cara usa una hoja por página de examen. Al cargar fotos, envía solo las caras impresas.'
    );
  });

  it('alterna interactivamente entre pestañas y muestra sus componentes y guías rápidas dedicadas', () => {
    render(
      <HarnessPlantillas
        plantillas={[{
          _id: 'pla-1',
          titulo: 'Parcial Algebra',
          tipo: 'parcial',
          numeroPaginas: 2,
          periodoId: 'per-1',
          temas: ['Algebra']
        }]}
      />
    );

    // Pestaña 1 (Diseño) activa por defecto
    expect(screen.getByRole('heading', { name: /Diseño de plantilla/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Plantillas existentes/i })).toBeInTheDocument();
    expect(screen.getAllByText('OMR canónico · v4').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/ESTUDIO DE CONSTRUCCIÓN/i)).toBeInTheDocument();

    // Cambiar a Pestaña 2 (Generación)
    fireEvent.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));
    expect(screen.getByRole('heading', { name: /Generación de exámenes/i })).toBeInTheDocument();
    expect(screen.getByText('OMR canónico · v4')).toBeInTheDocument();
    expect(screen.getByText(/Producción OMR, Folios Únicos y Códigos QR/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Plantillas existentes/i })).not.toBeInTheDocument();

    // Cambiar a Pestaña 3 (Historial)
    fireEvent.click(screen.getByRole('tab', { name: /Historial de Lotes/i }));
    expect(screen.getByRole('heading', { level: 3, name: /^Exámenes generados$/i })).toBeInTheDocument();
    expect(screen.getAllByText('OMR canónico · v4').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Custodia, Descargas y Trazabilidad OMR/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /OMR canónico · v4/i })).toBeInTheDocument();
  });

  it('permite seleccionar destinatarios al elegir el tipo extraordinario', () => {
    render(
      <HarnessPlantillas
        plantillas={[{
          _id: 'pla-1',
          titulo: 'Parcial Algebra',
          tipo: 'parcial',
          numeroPaginas: 2,
          periodoId: 'per-1',
          temas: ['Algebra']
        }]}
        alumnos={[
          { _id: 'al-1', matricula: 'MAT-1', nombreCompleto: 'Ana Uno', periodoId: 'per-1', activo: true },
          { _id: 'al-2', matricula: 'MAT-2', nombreCompleto: 'Luis Dos', periodoId: 'per-1', activo: true },
          { _id: 'al-3', matricula: 'MAT-3', nombreCompleto: 'Eva Otra Materia', periodoId: 'per-2', activo: true }
        ]}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'pla-1' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de examen' }), { target: { value: 'extraordinario' } });

    expect(screen.getByRole('group', { name: /Alumnos que presentarán el extraordinario/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Ana Uno · MAT-1/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Luis Dos · MAT-2/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Eva Otra Materia/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generar examen individual de muestra/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /Ana Uno · MAT-1/i }));
    expect(screen.getByText('Seleccionados: 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generar extraordinarios \(1 alumnos\)/i })).toBeEnabled();
  });

  it('conserva la pestaña activa cuando la sección se vuelve a montar después de actualizar', () => {
    const primerRender = render(<HarnessPlantillas />);
    fireEvent.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));
    expect(screen.getByRole('tabpanel', { name: /Generar Paquete PDF\/OMR/i })).toBeInTheDocument();

    primerRender.unmount();
    render(<HarnessPlantillas />);

    expect(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: /Generar Paquete PDF\/OMR/i })).toBeInTheDocument();
  });

  it('emite retroalimentación visible al actualizar y cambiar de sección', async () => {
    const mensajes: string[] = [];
    const listener = (event: Event) => {
      mensajes.push(String((event as CustomEvent<{ message?: string }>).detail?.message ?? ''));
    };
    window.addEventListener('app:toast', listener);

    try {
      render(<HarnessPlantillas />);
      fireEvent.click(screen.getByRole('button', { name: /Actualizar/i }));
      expect(mensajes).toContain('Actualizando el catálogo…');

      fireEvent.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));
      expect(mensajes).toContain('Mostrando Generación de paquete PDF/OMR');

      await waitFor(() => expect(mensajes).toContain('Catálogo actualizado'));
    } finally {
      window.removeEventListener('app:toast', listener);
    }
  });

  it('bloquea crear y generar cuando faltan permisos de gestión/generación', () => {
    const permisosLimitados: PermisosUI = {
      ...permisos,
      plantillas: { ...permisos.plantillas, gestionar: false },
      examenes: { ...permisos.examenes, generar: false }
    };

    render(<HarnessPlantillas permisosEntrada={permisosLimitados} />);
    expect(screen.getByRole('button', { name: /Crear plantilla/i })).toBeDisabled();

    // En pestaña de generación
    fireEvent.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));
    expect(screen.getByRole('button', { name: /Generar paquete de exámenes/i })).toBeDisabled();
  });

  it('aplica filtro de listado por título en la pestaña de diseño', () => {
    render(
      <HarnessPlantillas
        plantillas={[
          { _id: 'pla-1', titulo: 'Parcial Algebra', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra'] },
          { _id: 'pla-2', titulo: 'Global Fisica', tipo: 'global', numeroPaginas: 3, periodoId: 'per-1', temas: ['Fisica'] }
        ]}
      />
    );

    const titulosIniciales = Array.from(document.querySelectorAll('.plantillas-lista .item-title')).map((node) => node.textContent?.trim());
    expect(titulosIniciales).toContain('Parcial Algebra');
    expect(titulosIniciales).toContain('Global Fisica');
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'Algebra' } });
    const titulosFiltrados = Array.from(document.querySelectorAll('.plantillas-lista .item-title')).map((node) => node.textContent?.trim());
    expect(titulosFiltrados).toContain('Parcial Algebra');
    expect(titulosFiltrados).not.toContain('Global Fisica');
  });

  it('permite iniciar la edición de una plantilla cargando sus datos en el formulario', () => {
    render(
      <HarnessPlantillas
        plantillas={[
          { _id: 'pla-1', titulo: 'Parcial Algebra', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra'] }
        ]}
      />
    );

    const botonEditar = screen.getByRole('button', { name: /Editar/i });
    fireEvent.click(botonEditar);

    const inputTitulo = screen.getByLabelText(/Titulo/i) as HTMLInputElement;
    expect(inputTitulo.value).toBe('Parcial Algebra');

    const editorInline = screen.getByTestId('plantillas-editor-inline');
    expect(editorInline.previousElementSibling).toHaveTextContent('Parcial Algebra');
    expect(document.querySelector('.plantillas-item--editando')).toHaveTextContent('Parcial Algebra');

    expect(screen.getByRole('button', { name: /Actualizar plantilla/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Previsualizar PDF/i })).toHaveLength(2);
    expect(screen.getByRole('button', { name: /^Cancelar$/i })).toBeInTheDocument();

    // Cancelar edición
    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }));
    expect(screen.getByRole('button', { name: /Crear plantilla/i })).toBeInTheDocument();
  });

  it('actualiza una plantilla con un clientRequestId estable y refresca el listado al confirmar éxito', async () => {
    const enviarConPermiso = vi.fn(async () => ({}));
    const onRefrescar = vi.fn();
    render(
      <HarnessPlantillas
        enviarConPermiso={enviarConPermiso}
        onRefrescar={onRefrescar}
        plantillas={[
          { _id: 'pla-1', titulo: 'Parcial Algebra', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra'] }
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Editar/i }));
    fireEvent.change(screen.getByLabelText(/Titulo/i), { target: { value: 'Parcial Algebra actualizado' } });
    fireEvent.click(screen.getByRole('button', { name: /Actualizar plantilla/i }));

    await waitFor(() => expect(enviarConPermiso).toHaveBeenCalledOnce());
    const [, ruta, payload] = enviarConPermiso.mock.calls[0];
    expect(ruta).toBe('/examenes/plantillas/pla-1');
    expect(payload.clientRequestId).toMatch(/^[0-9a-f-]{36}$/i);
    await waitFor(() => expect(onRefrescar).toHaveBeenCalledOnce());
  });

  it('crea una plantilla con un clientRequestId estable y refresca el listado al confirmar éxito', async () => {
    const enviarConPermiso = vi.fn(async () => ({}));
    const onRefrescar = vi.fn();
    render(
      <HarnessPlantillas
        enviarConPermiso={enviarConPermiso}
        onRefrescar={onRefrescar}
        preguntas={[{ _id: 'pre-1', periodoId: 'per-1', tema: 'Algebra', versiones: [{ enunciado: 'Pregunta' }] }]}
      />
    );

    fireEvent.change(screen.getByLabelText(/Titulo/i), { target: { value: 'Nuevo examen' } });
    fireEvent.change(document.querySelector('.campo--materia select') as HTMLSelectElement, { target: { value: 'per-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Algebra/i }));
    fireEvent.click(screen.getByRole('button', { name: /Crear plantilla/i }));

    await waitFor(() => expect(enviarConPermiso).toHaveBeenCalledOnce());
    const [, ruta, payload] = enviarConPermiso.mock.calls[0];
    expect(ruta).toBe('/examenes/plantillas');
    expect(payload.clientRequestId).toMatch(/^[0-9a-f-]{36}$/i);
    await waitFor(() => expect(onRefrescar).toHaveBeenCalledOnce());
  });

  it('elimina una plantilla con un clientRequestId y refresca solo después de confirmar', async () => {
    const enviarConPermiso = vi.fn(async () => ({}));
    const onRefrescar = vi.fn();
    render(
      <ConfirmDialogProvider>
        <HarnessPlantillas
          enviarConPermiso={enviarConPermiso}
          onRefrescar={onRefrescar}
          plantillas={[
            { _id: 'pla-1', titulo: 'Parcial Algebra', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra'] }
          ]}
        />
      </ConfirmDialogProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Archivar/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, eliminar plantilla' }));

    await waitFor(() => expect(enviarConPermiso).toHaveBeenCalledOnce());
    const [, ruta, payload] = enviarConPermiso.mock.calls[0];
    expect(ruta).toBe('/examenes/plantillas/pla-1/eliminar');
    expect(payload.clientRequestId).toMatch(/^[0-9a-f-]{36}$/i);
    await waitFor(() => expect(onRefrescar).toHaveBeenCalledOnce());
  });

  it('preserva los temas de la plantilla al entrar en modo edición', () => {
    render(
      <HarnessPlantillas
        plantillas={[
          { _id: 'pla-1', titulo: 'Parcial Algebra', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra'] }
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Editar/i }));

    expect(screen.getByText('Seleccionados: 1')).toBeInTheDocument();
  });

  it('identifica la materia en el selector de generación además del id de la plantilla', () => {
    render(
      <HarnessPlantillas
        plantillas={[
          { _id: 'pla-1', titulo: 'Segundo Parcial', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra'] }
        ]}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));

    expect(screen.getByRole('option', { name: 'Periodo 1 · Segundo Parcial (ID: pla-1)' })).toBeInTheDocument();
  });

  it('cambia a Actualizar PDF cuando se modifica la configuración de una plantilla', () => {
    render(
      <HarnessPlantillas
        plantillas={[
          { _id: 'pla-1', titulo: 'Parcial Algebra', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra'] }
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Editar/i }));
    fireEvent.change(screen.getByLabelText('Cantidad de páginas'), { target: { value: '3' } });

    const editorInline = screen.getByTestId('plantillas-editor-inline');
    expect(within(editorInline).getByRole('button', { name: /^Actualizar PDF$/i })).toBeInTheDocument();
    expect(within(editorInline).queryByRole('button', { name: /^Previsualizar PDF$/i })).not.toBeInTheDocument();
  });

  it('carga únicamente la previsualización PDF al pulsar Previsualizar PDF', () => {
    const cargarPreviewPdfPlantilla = vi.fn(async () => {});

    render(
      <PlantillasListado
        totalPlantillasTodas={1}
        totalPlantillas={1}
        filtroPlantillas=""
        setFiltroPlantillas={() => {}}
        plantillasFiltradas={[
          { _id: 'pla-1', titulo: 'Parcial Algebra', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra'] } as Plantilla
        ]}
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', grupos: ['A'] }]}
        previewPdfUrlPorPlantillaId={{}}
        puedePrevisualizarPlantillas={true}
        cargandoPreviewPdfPlantillaId={null}
        cargarPreviewPdfPlantilla={cargarPreviewPdfPlantilla}
        cerrarPreviewPdfPlantilla={() => {}}
        abrirPdfFullscreen={() => {}}
        pdfFullscreenUrl={null}
        cerrarPdfFullscreen={() => {}}
        iniciarEdicion={() => {}}
        puedeGestionarPlantillas={true}
        archivandoPlantillaId={null}
        archivarPlantilla={async () => {}}
        puedeArchivarPlantillas={true}
        formatearFechaHora={() => '-'}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Previsualizar PDF$/i }));

    expect(cargarPreviewPdfPlantilla).toHaveBeenCalledWith('pla-1', 'booklet');
  });

  it('renderiza únicamente las páginas rasterizadas del PDF', () => {
    render(
      <PlantillasListado
        totalPlantillasTodas={1}
        totalPlantillas={1}
        filtroPlantillas=""
        setFiltroPlantillas={() => {}}
        plantillasFiltradas={[
          { _id: 'pla-1', titulo: 'Parcial Algebra', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra'] } as Plantilla
        ]}
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', grupos: ['A'] }]}
        previewPdfUrlPorPlantillaId={{
          'pla-1': {
            booklet: 'blob://pdf-preview',
            bookletPages: [{ numero: 1, width: 100, height: 140, dataUrl: 'data:image/png;base64,AAAA' }],
            bookletPagesTotal: 4
          }
        }}
        puedePrevisualizarPlantillas={true}
        cargandoPreviewPdfPlantillaId={null}
        cargarPreviewPdfPlantilla={async () => {}}
        cerrarPreviewPdfPlantilla={() => {}}
        abrirPdfFullscreen={() => {}}
        pdfFullscreenUrl={null}
        cerrarPdfFullscreen={() => {}}
        iniciarEdicion={() => {}}
        puedeGestionarPlantillas={true}
        archivandoPlantillaId={null}
        archivarPlantilla={async () => {}}
        puedeArchivarPlantillas={true}
        formatearFechaHora={() => '-'}
      />
    );

    const pagina = screen.getByAltText('Página 1 de la previsualización del examen');
    expect(pagina).toHaveAttribute('src', 'data:image/png;base64,AAAA');
    expect(screen.queryAllByText('Página 1')).toHaveLength(0);
    expect(screen.getByText('PDF real: 4 páginas')).toBeInTheDocument();
    expect(screen.getByText('Configuradas: 2 · el contenido requiere 4')).toBeInTheDocument();
  });

  it('muestra el PDF debajo del editor cuando la tarjeta está minimizada', () => {
    render(
      <PlantillasListado
        totalPlantillasTodas={1}
        totalPlantillas={1}
        filtroPlantillas=""
        setFiltroPlantillas={() => {}}
        plantillasFiltradas={[
          { _id: 'pla-1', titulo: 'Parcial Algebra', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra'] } as Plantilla
        ]}
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', grupos: ['A'] }]}
        plantillaEditandoId="pla-1"
        editorInline={<div>Editor de prueba</div>}
        previewPdfUrlPorPlantillaId={{
          'pla-1': {
            booklet: 'blob://pdf-preview',
            bookletPages: [{ numero: 1, width: 100, height: 140, dataUrl: 'data:image/png;base64,AAAA' }]
          }
        }}
        puedePrevisualizarPlantillas={true}
        cargandoPreviewPdfPlantillaId={null}
        cargarPreviewPdfPlantilla={async () => {}}
        cerrarPreviewPdfPlantilla={() => {}}
        abrirPdfFullscreen={() => {}}
        pdfFullscreenUrl={null}
        cerrarPdfFullscreen={() => {}}
        iniciarEdicion={() => {}}
        puedeGestionarPlantillas={true}
        archivandoPlantillaId={null}
        archivarPlantilla={async () => {}}
        puedeArchivarPlantillas={true}
        formatearFechaHora={() => '-'}
      />
    );

    expect(screen.getByTestId('plantillas-preview-inline')).toBeInTheDocument();
    expect(within(screen.getByTestId('plantillas-preview-inline')).getByAltText('Página 1 de la previsualización del examen')).toBeInTheDocument();
  });
});
