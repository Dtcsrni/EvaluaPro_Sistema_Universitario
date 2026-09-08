/**
 * plantillas.refactor.test
 *
 * Responsabilidad: Pruebas unitarias de navegación por pestañas y guías rápidas en Diseño de Exámenes (SPEC-034).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeccionPlantillas } from '../src/apps/app_docente/SeccionPlantillas';
import { PlantillasListado } from '../src/apps/app_docente/features/plantillas/components/PlantillasListado';
import type { PreviewPdfUrls } from '../src/apps/app_docente/features/plantillas/hooks/usePlantillasPreviewActions';
import type { PermisosUI, Plantilla, PreviewPlantilla } from '../src/apps/app_docente/tipos';

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
  plantillas = [] as Plantilla[]
}: {
  permisosEntrada?: PermisosUI;
  plantillas?: Plantilla[];
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
      preguntas={[]}
      alumnos={[]}
      permisos={permisosEntrada}
      enviarConPermiso={async () => ({})}
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
      onRefrescar={() => {}}
    />
  );
}

describe('plantillas refactor y navegación por pestañas (SPEC-034)', () => {
  beforeEach(() => {
    sessionStorage.removeItem('evaluapro.plantillas.tab-activa');
  });

  it('renderiza encabezado principal y pestañas operativas', () => {
    render(<HarnessPlantillas />);
    expect(screen.getByRole('heading', { level: 2, name: /Diseño de Exámenes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Diseñar Exámenes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Historial de Lotes/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Tamaño de fuente/i })).toHaveValue('1');
    expect(screen.getByRole('combobox', { name: /Espaciado de línea/i })).toHaveValue('1.1');
    expect(screen.getByText('Selecciona una materia para comenzar')).toBeInTheDocument();
  });

  it('alterna interactivamente entre pestañas y muestra sus componentes y guías rápidas dedicadas', () => {
    render(<HarnessPlantillas />);

    // Pestaña 1 (Diseño) activa por defecto
    expect(screen.getByRole('heading', { name: /Diseño de plantilla/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Plantillas existentes/i })).toBeInTheDocument();
    expect(screen.getAllByText('OMR canónico · v4').length).toBeGreaterThanOrEqual(2);
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

    expect(screen.getByRole('button', { name: /Guardar cambios/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Cancelar$/i })).toBeInTheDocument();

    // Cancelar edición
    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }));
    expect(screen.getByRole('button', { name: /Crear plantilla/i })).toBeInTheDocument();
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

  it('abre el panel al pulsar Previsualizar y delega la carga al toggle del preview', () => {
    const togglePreviewPlantilla = vi.fn(async () => {});

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
        previewPorPlantillaId={{}}
        plantillaPreviewId={null}
        previewPdfUrlPorPlantillaId={{}}
        cargandoPreviewPlantillaId={null}
        puedePrevisualizarPlantillas={true}
        cargandoPreviewPdfPlantillaId={null}
        cargarPreviewPdfPlantilla={async () => {}}
        cerrarPreviewPdfPlantilla={() => {}}
        abrirPdfFullscreen={() => {}}
        pdfFullscreenUrl={null}
        cerrarPdfFullscreen={() => {}}
        togglePreviewPlantilla={togglePreviewPlantilla}
        iniciarEdicion={() => {}}
        puedeGestionarPlantillas={true}
        archivandoPlantillaId={null}
        archivarPlantilla={async () => {}}
        puedeArchivarPlantillas={true}
        formatearFechaHora={() => '-'}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Previsualizar$/i }));

    expect(togglePreviewPlantilla).toHaveBeenCalledWith('pla-1');
  });

  it('renderiza las paginas rasterizadas del PDF dentro del boceto', () => {
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
        previewPorPlantillaId={{
          'pla-1': {
            paginas: [
              {
                numero: 1,
                preguntasDel: 1,
                preguntasAl: 1,
                elementos: [],
                preguntas: [{ numero: 1, id: 'q-1', tieneImagen: false, enunciadoCorto: 'Pregunta de prueba' }]
              }
            ]
          }
        }}
        plantillaPreviewId="pla-1"
        previewPdfUrlPorPlantillaId={{
          'pla-1': {
            booklet: 'blob://pdf-preview',
            bookletPages: [{ numero: 1, width: 100, height: 140, dataUrl: 'data:image/png;base64,AAAA' }]
          }
        }}
        cargandoPreviewPlantillaId={null}
        puedePrevisualizarPlantillas={true}
        cargandoPreviewPdfPlantillaId={null}
        cargarPreviewPdfPlantilla={async () => {}}
        cerrarPreviewPdfPlantilla={() => {}}
        abrirPdfFullscreen={() => {}}
        pdfFullscreenUrl={null}
        cerrarPdfFullscreen={() => {}}
        togglePreviewPlantilla={async () => {}}
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
    expect(screen.getAllByText('Página 1').length).toBeGreaterThanOrEqual(1);
  });
});
