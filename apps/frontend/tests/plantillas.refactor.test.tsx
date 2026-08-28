/**
 * plantillas.refactor.test
 *
 * Responsabilidad: Pruebas unitarias de navegación por pestañas y guías rápidas en Diseño de Exámenes (SPEC-034).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SeccionPlantillas } from '../src/apps/app_docente/SeccionPlantillas';
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
    Record<string, { booklet?: string; omrSheet?: string }>
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
  it('renderiza encabezado principal y pestañas operativas', () => {
    render(<HarnessPlantillas />);
    expect(screen.getByRole('heading', { level: 2, name: /Diseño de Exámenes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Diseñar Exámenes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Historial de Lotes/i })).toBeInTheDocument();
  });

  it('alterna interactivamente entre pestañas y muestra sus componentes y guías rápidas dedicadas', () => {
    render(<HarnessPlantillas />);

    // Pestaña 1 (Diseño) activa por defecto
    expect(screen.getByRole('heading', { name: /Diseño de plantilla/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Plantillas existentes/i })).toBeInTheDocument();
    expect(screen.getByText(/Maquetación OMR y Estructura Temática/i)).toBeInTheDocument();

    // Cambiar a Pestaña 2 (Generación)
    fireEvent.click(screen.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i }));
    expect(screen.getByRole('heading', { name: /Generación de exámenes/i })).toBeInTheDocument();
    expect(screen.getByText(/Producción OMR, Folios Únicos y Códigos QR/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Plantillas existentes/i })).not.toBeInTheDocument();

    // Cambiar a Pestaña 3 (Historial)
    fireEvent.click(screen.getByRole('tab', { name: /Historial de Lotes/i }));
    expect(screen.getByRole('heading', { level: 3, name: /^Exámenes generados$/i })).toBeInTheDocument();
    expect(screen.getByText(/Custodia, Descargas y Trazabilidad OMR/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Flujo OMR V1/i })).toBeInTheDocument();
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
});
