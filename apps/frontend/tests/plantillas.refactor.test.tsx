/**
 * plantillas.refactor.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
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

describe('plantillas refactor comportamiento', () => {
  it('renderiza formulario, listado y generados', () => {
    render(<HarnessPlantillas />);
    expect(screen.getByRole('heading', { name: /^Plantillas$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Plantillas existentes/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Generación de exámenes$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Examenes generados/i })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /^Generar paquete de examenes$/i })).toBeDisabled();
  });

  it('aplica filtro de listado por título', () => {
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
});
