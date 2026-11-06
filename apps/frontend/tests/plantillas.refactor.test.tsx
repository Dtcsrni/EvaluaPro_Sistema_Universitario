/**
 * plantillas.refactor.test
 *
 * Responsabilidad: Pruebas unitarias de navegación por pestañas y guías rápidas en Diseño de Exámenes (SPEC-034).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorRemoto } from '../src/servicios_api/clienteComun';
import {
  existeTituloPlantillaDuplicadoPorPeriodo,
  SeccionPlantillas
} from '../src/apps/app_docente/SeccionPlantillas';
import { PlantillasListado } from '../src/apps/app_docente/features/plantillas/components/PlantillasListado';
import { ConfirmDialogProvider } from '../src/ui/feedback/ConfirmDialogProvider';
import * as toastBus from '../src/ui/toast/toastBus';
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
  onRefrescar = () => {},
  plantillasTrasRefrescar = [] as Plantilla[]
}: {
  permisosEntrada?: PermisosUI;
  plantillas?: Plantilla[];
  preguntas?: Pregunta[];
  alumnos?: Alumno[];
  enviarConPermiso?: (permiso: string, ruta: string, payload: Record<string, unknown>, mensaje?: string) => Promise<unknown>;
  onRefrescar?: () => void;
  plantillasTrasRefrescar?: Plantilla[];
}) {
  const [previewPorPlantillaId, setPreviewPorPlantillaId] = useState<Record<string, PreviewPlantilla>>({});
  const [catalogoPlantillas, setCatalogoPlantillas] = useState(plantillas);
  const [cargandoPreviewPlantillaId, setCargandoPreviewPlantillaId] = useState<string | null>(null);
  const [plantillaPreviewId, setPlantillaPreviewId] = useState<string | null>(null);
  const [previewPdfUrlPorPlantillaId, setPreviewPdfUrlPorPlantillaId] = useState<
    Record<string, PreviewPdfUrls>
  >({});
  const [cargandoPreviewPdfPlantillaId, setCargandoPreviewPdfPlantillaId] = useState<string | null>(null);

  return (
    <SeccionPlantillas
      plantillas={catalogoPlantillas}
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
      onRefrescar={() => {
        if (plantillasTrasRefrescar.length > 0) {
          setCatalogoPlantillas((actuales) => [...actuales, ...plantillasTrasRefrescar]);
        }
        onRefrescar();
      }}
    />
  );
}

describe('plantillas refactor y navegación por pestañas (SPEC-034)', () => {
  beforeEach(() => {
    sessionStorage.removeItem('evaluapro.plantillas.tab-activa');
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(screen.getByRole('button', { name: /^Recargar catálogo$/i })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Tamaño de fuente/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Espaciado de línea/i })).not.toBeInTheDocument();
    expect(screen.getByText('Tipografía e interlineado')).toBeInTheDocument();
    expect(screen.getByText('Gestionados por el motor')).toBeInTheDocument();
    const notaAjusteAutomatico = screen.getByText('El motor selecciona automáticamente la combinación más legible para completar el objetivo.').parentElement;
    expect(notaAjusteAutomatico).toHaveAttribute('role', 'note');
    expect(notaAjusteAutomatico).not.toHaveAttribute('aria-live');
    const estadoVacioTemas = screen.getByText('Selecciona una materia para comenzar').closest('.plantillas-temas-empty');
    expect(estadoVacioTemas).toBeInTheDocument();
    expect(estadoVacioTemas?.querySelector('.plantillas-temas-empty__icon svg')).toBeInTheDocument();
    expect(estadoVacioTemas).not.toHaveTextContent(/\b2\b/);
    expect(screen.getByLabelText('Cantidad de páginas')).toHaveValue(2);
    fireEvent.change(screen.getByLabelText('Tipo de plantilla'), { target: { value: 'global' } });
    expect(screen.getByLabelText('Cantidad de páginas')).toHaveValue(4);
  });

  it('expone como seleccionados los temas y la modalidad de generación', () => {
    render(<HarnessPlantillas preguntas={[
      { _id: 'preg-1', periodoId: 'per-1', tema: 'Álgebra', versiones: [{ enunciado: 'Reactivo de prueba' }] }
    ]} />);

    fireEvent.change(screen.getByLabelText('Materia'), { target: { value: 'per-1' } });
    const tema = screen.getByRole('button', { name: /Álgebra.*1 reactivos/i });
    expect(tema).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(tema);
    expect(tema).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));
    const modalidad = screen.getByRole('group', { name: 'Modalidad de generación' });
    const lote = within(modalidad).getByRole('button', { name: /Paquete por grupo/i });
    const individual = within(modalidad).getByRole('button', { name: /Examen individual de muestra/i });
    expect(lote).toHaveAttribute('aria-pressed', 'true');
    expect(individual).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(individual);
    expect(individual).toHaveAttribute('aria-pressed', 'true');
    expect(lote).toHaveAttribute('aria-pressed', 'false');
  });

  it('explica como estado informativo cómo habilitar un lote sin grupos activos', async () => {
    const user = userEvent.setup();
    render(<HarnessPlantillas plantillas={[{
      _id: 'pla-sin-grupos', titulo: 'Parcial sin grupo', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1'
    }]} />);

    await user.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /Plantilla base para el examen/i }), 'pla-sin-grupos');

    const avisoSinGrupos = screen.getByText(/No hay alumnos activos con grupo asignado/i);
    expect(avisoSinGrupos.closest('[role="status"]')).not.toBeNull();
    expect(avisoSinGrupos).toHaveTextContent(/Registra alumnos o asígnales un grupo en Alumnos/i);
    expect(avisoSinGrupos.closest('[role="alert"]')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Grupo destinatario del lote' })).toBeDisabled();
  });

  it('advierte sobre reverso en blanco y captura solo de caras impresas en la plantilla inline', () => {
    render(<HarnessPlantillas />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Plantilla OMR del examen' }), {
      target: { value: 'omr-inline-exam-v1' }
    });

    expect(screen.getByText('Plantilla seleccionada: Experimental · burbuja junto a cada opción')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Agrega un reverso en blanco por página para impedir trasluz; al imprimir a doble cara usa una hoja por página de examen. Al cargar fotos, envía solo las caras impresas.'
    );
  });

  it('alterna entre pestañas y deja las guías disponibles sin ocupar espacio por defecto', () => {
    localStorage.removeItem('ep.guia.generacion.oculta');
    localStorage.removeItem('ep.guia.historial.oculta');
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
    expect(screen.getByText(/Formato de respuesta: panel OMR reservado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seleccionar imagen izquierda' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Seleccionar imagen derecha' })).toBeVisible();
    expect(document.getElementById('plantillas-imagen-izquierda-estado')).toHaveTextContent('Ilustrativa');
    expect(screen.getByRole('button', { name: 'Seleccionar imagen izquierda' })).toHaveAttribute('aria-describedby', 'plantillas-imagen-izquierda-estado plantillas-imagen-izquierda-ayuda');
    const inputImagenIzquierda = document.getElementById('plantillas-imagen-izquierda') as HTMLInputElement;
    const abrirSelectorImagen = vi.spyOn(inputImagenIzquierda, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar imagen izquierda' }));
    expect(abrirSelectorImagen).toHaveBeenCalledOnce();
    // Cambiar a Pestaña 2 (Generación)
    fireEvent.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));
    expect(screen.getByRole('heading', { name: /Generación de exámenes/i })).toBeInTheDocument();
    expect(screen.getByText('OMR canónico · v4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver guía rápida de generación de exámenes/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver guía rápida de generación de exámenes/i }));
    expect(screen.getByText(/Producción OMR, Folios Únicos y Códigos QR/i)).toBeInTheDocument();
    const formatoLote = screen.getByRole('group', { name: /Formato de salida del lote/i });
    expect(within(formatoLote).getByRole('button', { name: /PDF · lote consolidado/i })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(formatoLote).getByRole('button', { name: /ZIP · PDFs individuales/i }));
    expect(within(formatoLote).getByRole('button', { name: /ZIP · PDFs individuales/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('heading', { name: /Plantillas existentes/i })).not.toBeInTheDocument();

    // Cambiar a Pestaña 3 (Historial)
    fireEvent.click(screen.getByRole('tab', { name: /Historial de Lotes/i }));
    expect(screen.getByRole('heading', { level: 3, name: /^Exámenes generados$/i })).toBeInTheDocument();
    expect(screen.getAllByText('OMR canónico · v4').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: /Ver guía rápida de historial y custodia/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver guía rápida de historial y custodia/i }));
    expect(screen.getByText(/Custodia, Descargas y Trazabilidad OMR/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /OMR canónico · v4/i })).toBeInTheDocument();
  });

  it('mantiene foco y estado expandido al alternar las guías de Generación e Historial', async () => {
    localStorage.removeItem('ep.guia.generacion.oculta');
    localStorage.removeItem('ep.guia.historial.oculta');
    const user = userEvent.setup();
    const toastSpy = vi.spyOn(toastBus, 'emitToast');
    render(<HarnessPlantillas />);

    const casos = [
      { tab: /Generar Paquete PDF\/OMR/i, panel: /Generar Paquete PDF\/OMR/i, mostrar: /Ver guía rápida de generación de exámenes/i, id: 'guia-generacion-toggle', preferencia: 'ep.guia.generacion.oculta' },
      { tab: /Historial de Lotes/i, panel: /Historial de Lotes/i, mostrar: /Ver guía rápida de historial y custodia/i, id: 'guia-historial-toggle', preferencia: 'ep.guia.historial.oculta' }
    ];

    for (const caso of casos) {
      const tab = screen.getByRole('tab', { name: caso.tab });
      if (tab.getAttribute('aria-selected') !== 'true') await user.click(tab);
      const panel = screen.getByRole('tabpanel', { name: caso.panel });
      const botonMostrar = within(panel).getByRole('button', { name: caso.mostrar });
      expect(botonMostrar).toHaveAttribute('aria-expanded', 'false');
      botonMostrar.focus();
      await user.keyboard('{Enter}');
      expect(localStorage.getItem(caso.preferencia)).toBe('false');

      const botonOcultar = within(panel).getByRole('button', { name: 'Ocultar guía rápida' });
      expect(botonOcultar).toHaveAttribute('id', caso.id);
      expect(botonOcultar).toHaveAttribute('aria-expanded', 'true');
      expect(botonOcultar).toHaveFocus();
      await user.keyboard(' ');

      const botonMostrarDeNuevo = within(panel).getByRole('button', { name: caso.mostrar });
      expect(botonMostrarDeNuevo).toHaveAttribute('aria-expanded', 'false');
      expect(botonMostrarDeNuevo).toHaveFocus();
      expect(localStorage.getItem(caso.preferencia)).toBe('true');
    }

    expect(toastSpy).not.toHaveBeenCalled();
  });

  it('enlaza pestañas con paneles y permite navegar con flechas sin activar la vista hasta confirmar', async () => {
    const user = userEvent.setup();
    render(<HarnessPlantillas />);

    const tabDiseno = screen.getByRole('tab', { name: /Diseñar Exámenes/i });
    const tabGeneracion = screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i });
    expect(tabDiseno).toHaveAttribute('aria-controls', 'plantillas-panel-diseno');
    expect(tabDiseno).toHaveAttribute('aria-selected', 'true');
    expect(tabDiseno).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tabpanel', { name: /Diseñar Exámenes/i })).toHaveAttribute(
      'aria-labelledby', 'plantillas-tab-diseno'
    );

    await user.click(tabDiseno);
    await user.keyboard('{ArrowRight}');
    expect(tabGeneracion).toHaveFocus();
    expect(tabGeneracion).toHaveAttribute('aria-selected', 'false');

    await user.keyboard('{Enter}');
    expect(tabGeneracion).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: /Generar Paquete PDF\/OMR/i })).toHaveAttribute(
      'aria-labelledby', 'plantillas-tab-generacion'
    );
  });

  it('exige seleccionar grupo cuando la plantilla tiene varios padrones y calcula solo el grupo elegido', () => {
    render(
      <HarnessPlantillas
        plantillas={[{ _id: 'pla-1', titulo: 'Primer Parcial', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra'] } as Plantilla]}
        alumnos={[
          { _id: 'a-1', matricula: 'M-1', nombreCompleto: 'Ana A', periodoId: 'per-1', grupo: 'A', activo: true },
          { _id: 'a-2', matricula: 'M-2', nombreCompleto: 'Luis A', periodoId: 'per-1', grupo: 'A', activo: true },
          { _id: 'b-1', matricula: 'M-3', nombreCompleto: 'Eva B', periodoId: 'per-1', grupo: 'B', activo: true }
        ]}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));
    fireEvent.change(screen.getByRole('combobox', { name: /Plantilla base para el examen/i }), { target: { value: 'pla-1' } });
    const selectorGrupo = screen.getByRole('combobox', { name: 'Grupo destinatario del lote' });
    expect(selectorGrupo).toHaveValue('');
    expect(screen.getByText(/Alumnos del grupo:/)).toHaveTextContent(/Alumnos del grupo:\s*0 alumnos/);
    expect(screen.getByRole('button', { name: /Generar lote PDF consolidado/i })).toBeDisabled();

    fireEvent.change(selectorGrupo, { target: { value: 'B' } });
    expect(screen.getByText(/Alumno del grupo:/)).toHaveTextContent(/Alumno del grupo:\s*1 alumno/);
    expect(screen.getByRole('button', { name: /Generar lote PDF consolidado \(1 alumno\)/i })).toBeEnabled();
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
    expect(screen.getByRole('button', { name: /Generar extraordinarios \(1 alumno\)/i })).toBeEnabled();
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

  it('conserva feedback de actualización; la pestaña anuncia su selección sin toast redundante', async () => {
    let resolverActualizacion: (() => void) | undefined;
    const onRefrescar = () => new Promise<void>((resolve) => {
      resolverActualizacion = resolve;
    });
    const mensajes: string[] = [];
    const listener = (event: Event) => {
      mensajes.push(String((event as CustomEvent<{ message?: string }>).detail?.message ?? ''));
    };
    window.addEventListener('app:toast', listener);

    try {
      render(<HarnessPlantillas onRefrescar={onRefrescar} />);
      fireEvent.click(screen.getByRole('button', { name: /Recargar catálogo/i }));
      expect(screen.getByRole('button', { name: /Recargando catálogo/i })).toBeDisabled();
      expect(mensajes).not.toContain('Actualizando el catálogo…');

      fireEvent.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));
      expect(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i })).toHaveAttribute('aria-selected', 'true');
      expect(mensajes).not.toContain('Mostrando Generación de paquete PDF/OMR');

      resolverActualizacion?.();
      await waitFor(() => expect(mensajes).toContain('Catálogo actualizado'));
    } finally {
      window.removeEventListener('app:toast', listener);
    }
  });

  it('no interrumpe con toast al cambiar modalidad cuando aria-pressed comunica la selección', () => {
    const toastSpy = vi.spyOn(toastBus, 'emitToast');
    render(<HarnessPlantillas preguntas={[
      { _id: 'preg-1', periodoId: 'per-1', tema: 'Álgebra', versiones: [{ enunciado: 'Reactivo de prueba' }] }
    ]} />);

    fireEvent.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));
    const modalidad = screen.getByRole('group', { name: 'Modalidad de generación' });
    const individual = within(modalidad).getByRole('button', { name: /Examen individual de muestra/i });
    fireEvent.click(individual);

    expect(individual).toHaveAttribute('aria-pressed', 'true');
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it('no repite en un toast la selección de temas ni el ajuste de preguntas', () => {
    const toastSpy = vi.spyOn(toastBus, 'emitToast');
    render(<HarnessPlantillas preguntas={[
      { _id: 'preg-1', periodoId: 'per-1', tema: 'Álgebra', versiones: [{ enunciado: 'Reactivo uno' }] },
      { _id: 'preg-2', periodoId: 'per-1', tema: 'Álgebra', versiones: [{ enunciado: 'Reactivo dos' }] }
    ]} />);
    fireEvent.click(screen.getByRole('tab', { name: /Diseñar Exámenes/i }));
    fireEvent.change(screen.getByLabelText('Materia'), { target: { value: 'per-1' } });

    const temas = screen.getByRole('group', { name: 'Temas disponibles' });
    const algebra = within(temas).getByRole('button', { name: /Álgebra/i });
    fireEvent.click(algebra);
    expect(algebra).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Seleccionados: 1')).toBeInTheDocument();

    const cantidad = screen.getByRole('spinbutton', { name: 'Preguntas del examen' });
    const configuradas = Number((cantidad as HTMLInputElement).value);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar una pregunta' }));
    expect(Number((cantidad as HTMLInputElement).value)).toBe(configuradas - 1);
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it('actualiza filtro y editor en contexto sin duplicar cada cambio con toast', () => {
    const toastSpy = vi.spyOn(toastBus, 'emitToast');
    render(
      <HarnessPlantillas
        plantillas={[{
          _id: 'pla-1', titulo: 'Parcial Algebra', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra']
        }]}
      />
    );

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'Parcial' } });
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtro' }));
    expect(screen.getByLabelText('Buscar')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: /Editar/i }));

    expect(screen.getByText(/Editando:/)).toHaveTextContent('Editando: Parcial Algebra');
    expect(toastSpy).not.toHaveBeenCalled();
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
    expect(screen.getByRole('button', { name: /Generar lote PDF consolidado/i })).toBeDisabled();
  });

  it('aplica filtro de listado por título en la pestaña de diseño', () => {
    render(
      <HarnessPlantillas
        plantillas={[
          { _id: 'pla-1', titulo: 'Parcial Algebra', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra'] },
          { _id: 'pla-2', titulo: 'Global Fisica', tipo: 'global', numeroPaginas: 3, periodoId: 'per-1', temas: [] }
        ]}
      />
    );

    const titulosIniciales = Array.from(document.querySelectorAll('.plantillas-lista .item-title')).map((node) => node.textContent?.trim());
    expect(titulosIniciales).toContain('Parcial Algebra');
    expect(titulosIniciales).toContain('Global Fisica');
    expect(screen.getByLabelText('Buscar')).toHaveAttribute('placeholder', 'Título o tema de la plantilla…');
    const tarjetaParcial = screen.getByText('Parcial Algebra').closest('.plantillas-item');
    expect(tarjetaParcial).toHaveTextContent('Materia: Periodo 1');
    expect(tarjetaParcial).not.toHaveTextContent('ID:');
    expect(screen.getByText('Selección directa de preguntas')).toBeInTheDocument();
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

    expect(screen.getByText(/Editando:/)).toHaveTextContent('Editando: Parcial Algebra');
    expect(screen.getByText(/Editando:/)).not.toHaveTextContent('ID:');
    expect(screen.queryByRole('option', { name: /ID: per-1/i })).not.toBeInTheDocument();

    const inputTitulo = screen.getByLabelText(/Título/i) as HTMLInputElement;
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
    const toastSpy = vi.spyOn(toastBus, 'emitToast');
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
    fireEvent.change(screen.getByLabelText(/Título/i), { target: { value: 'Parcial Algebra actualizado' } });
    fireEvent.click(screen.getByRole('button', { name: /Actualizar plantilla/i }));

    await waitFor(() => expect(enviarConPermiso).toHaveBeenCalledOnce());
    const [, ruta, payload] = enviarConPermiso.mock.calls[0];
    expect(ruta).toBe('/examenes/plantillas/pla-1');
    expect(payload.clientRequestId).toMatch(/^[0-9a-f-]{36}$/i);
    await waitFor(() => expect(onRefrescar).toHaveBeenCalledOnce());
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ level: 'ok', message: 'Plantilla actualizada' }));
    expect(toastSpy).not.toHaveBeenCalledWith(expect.objectContaining({ message: 'Edición cancelada' }));
    fireEvent.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));
    expect(screen.getByRole('combobox', { name: /Plantilla base para el examen/i })).toHaveValue('pla-1');
  });

  it('crea una plantilla con un clientRequestId estable y refresca el listado al confirmar éxito', async () => {
    const toastSpy = vi.spyOn(toastBus, 'emitToast');
    const enviarConPermiso = vi.fn(async () => ({ plantilla: { _id: 'pla-nueva' } }));
    const onRefrescar = vi.fn();
    render(
      <HarnessPlantillas
        enviarConPermiso={enviarConPermiso}
        onRefrescar={onRefrescar}
        plantillasTrasRefrescar={[{ _id: 'pla-nueva', titulo: 'Nuevo examen', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra'] }]}
        preguntas={[{ _id: 'pre-1', periodoId: 'per-1', tema: 'Algebra', versiones: [{ enunciado: 'Pregunta' }] }]}
      />
    );

    fireEvent.change(screen.getByLabelText(/Título/i), { target: { value: 'Nuevo examen' } });
    fireEvent.change(document.querySelector('.campo--materia select') as HTMLSelectElement, { target: { value: 'per-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Algebra/i }));
    fireEvent.click(screen.getByRole('button', { name: /Crear plantilla/i }));

    await waitFor(() => expect(enviarConPermiso).toHaveBeenCalledOnce());
    const [, ruta, payload] = enviarConPermiso.mock.calls[0];
    expect(ruta).toBe('/examenes/plantillas');
    expect(payload.clientRequestId).toMatch(/^[0-9a-f-]{36}$/i);
    await waitFor(() => expect(onRefrescar).toHaveBeenCalledOnce());
    expect(screen.getByText('Plantilla creada')).toHaveAttribute('role', 'status');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.objectContaining({ message: 'Plantilla creada' }));
    fireEvent.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));
    expect(screen.getByRole('combobox', { name: /Plantilla base para el examen/i })).toHaveValue('pla-nueva');
  });

  it('anuncia el título duplicado como error aunque el texto no dependa de palabras clave', () => {
    const toastSpy = vi.spyOn(toastBus, 'emitToast');
    const enviarConPermiso = vi.fn();
    render(
      <HarnessPlantillas
        enviarConPermiso={enviarConPermiso}
        plantillas={[{ _id: 'pla-existente', titulo: 'Examen duplicado', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra'] }]}
        preguntas={[{ _id: 'pre-1', periodoId: 'per-1', tema: 'Algebra', versiones: [{ enunciado: 'Pregunta' }] }]}
      />
    );

    fireEvent.change(screen.getByLabelText(/Título/i), { target: { value: 'Examen duplicado' } });
    fireEvent.change(document.querySelector('.campo--materia select') as HTMLSelectElement, { target: { value: 'per-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Algebra/i }));
    fireEvent.click(screen.getByRole('button', { name: /Crear plantilla/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Ya existe una plantilla activa con ese nombre.');
    expect(screen.getByRole('alert')).toHaveClass('mensaje', 'error');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.objectContaining({ message: 'Ya existe una plantilla activa con ese nombre.' }));
    expect(enviarConPermiso).not.toHaveBeenCalled();
  });

  it('mantiene el error de alta en el formulario sin repetirlo en un toast', async () => {
    const toastSpy = vi.spyOn(toastBus, 'emitToast');
    const enviarConPermiso = vi.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:3000'));
    render(
      <HarnessPlantillas
        enviarConPermiso={enviarConPermiso}
        preguntas={[{ _id: 'pre-1', periodoId: 'per-1', tema: 'Algebra', versiones: [{ enunciado: 'Pregunta' }] }]}
      />
    );

    fireEvent.change(screen.getByLabelText(/Título/i), { target: { value: 'Nuevo examen' } });
    fireEvent.change(document.querySelector('.campo--materia select') as HTMLSelectElement, { target: { value: 'per-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Algebra/i }));
    fireEvent.click(screen.getByRole('button', { name: /Crear plantilla/i }));

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Servidor local no disponible.');
    expect(error).not.toHaveTextContent('127.0.0.1:3000');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
  });

  it('ofrece en un toast separado la recuperación cuando vence la sesión durante el alta', async () => {
    const toastSpy = vi.spyOn(toastBus, 'emitToast');
    const enviarConPermiso = vi.fn().mockRejectedValue(new ErrorRemoto('No autorizado', {
      status: 401,
      codigo: 'NO_AUTORIZADO',
      mensaje: 'No autorizado'
    }));
    render(
      <HarnessPlantillas
        enviarConPermiso={enviarConPermiso}
        preguntas={[{ _id: 'pre-1', periodoId: 'per-1', tema: 'Algebra', versiones: [{ enunciado: 'Pregunta' }] }]}
      />
    );

    fireEvent.change(screen.getByLabelText(/Título/i), { target: { value: 'Nuevo examen' } });
    fireEvent.change(document.querySelector('.campo--materia select') as HTMLSelectElement, { target: { value: 'per-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Algebra/i }));
    fireEvent.click(screen.getByRole('button', { name: /Crear plantilla/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Tu sesion expiro. Inicia sesion de nuevo.');
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warn',
      title: 'Recupera tu sesión',
      message: 'Recupera el acceso y vuelve a intentar la operación.',
      action: expect.objectContaining({ label: 'Cerrar sesión' })
    }));
    expect(toastSpy).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
  });

  it('confirma la generación individual en contexto sin repetirla en un toast', async () => {
    const toastSpy = vi.spyOn(toastBus, 'emitToast');
    const enviarConPermiso = vi.fn().mockResolvedValue({});
    render(
      <HarnessPlantillas
        enviarConPermiso={enviarConPermiso}
        plantillas={[{ _id: 'pla-1', titulo: 'Parcial Algebra', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra'] }]}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));
    fireEvent.change(screen.getByRole('combobox', { name: /Plantilla base para el examen/i }), { target: { value: 'pla-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Examen individual de muestra/i }));
    fireEvent.click(screen.getByRole('button', { name: /Generar examen individual de muestra/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('Examen generado');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'ok', message: 'Examen generado' }));
    expect(enviarConPermiso).toHaveBeenCalledWith('examenes:generar', '/examenes/generados', { plantillaId: 'pla-1' }, expect.any(String));
  });

  it('mantiene el error de generación junto al formulario y solo agrega toast para recuperar la sesión', async () => {
    const toastSpy = vi.spyOn(toastBus, 'emitToast');
    const enviarConPermiso = vi.fn().mockRejectedValue(new Error('Error de red'));
    render(
      <HarnessPlantillas
        enviarConPermiso={enviarConPermiso}
        plantillas={[{ _id: 'pla-1', titulo: 'Parcial Algebra', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra'] }]}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));
    fireEvent.change(screen.getByRole('combobox', { name: /Plantilla base para el examen/i }), { target: { value: 'pla-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Examen individual de muestra/i }));
    fireEvent.click(screen.getByRole('button', { name: /Generar examen individual de muestra/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Error de red');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));

    enviarConPermiso.mockRejectedValueOnce(new ErrorRemoto('No autorizado', {
      status: 401,
      codigo: 'NO_AUTORIZADO',
      mensaje: 'No autorizado'
    }));
    fireEvent.click(screen.getByRole('button', { name: /Generar examen individual de muestra/i }));
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warn',
      title: 'Recupera tu sesión',
      action: expect.objectContaining({ label: 'Cerrar sesión' })
    })));
    expect(toastSpy).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
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

  it('identifica materia y plantilla por su nombre legible en el selector de generación', () => {
    render(
      <HarnessPlantillas
        plantillas={[
          { _id: 'pla-1', titulo: 'Segundo Parcial', tipo: 'parcial', numeroPaginas: 2, periodoId: 'per-1', temas: ['Algebra'] }
        ]}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));

    expect(screen.getByRole('option', { name: 'Periodo 1 · Segundo Parcial' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /ID: pla-1/i })).not.toBeInTheDocument();
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
    const toastSpy = vi.spyOn(toastBus, 'emitToast');
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
    const abrirPdf = screen.getByRole('link', { name: 'Abrir en pestaña' });
    abrirPdf.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(abrirPdf);
    expect(toastSpy).not.toHaveBeenCalled();
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
