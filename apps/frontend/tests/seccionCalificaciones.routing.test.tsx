import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SeccionCalificaciones } from '../src/apps/app_docente/SeccionCalificaciones';

vi.mock('../src/apps/app_docente/ClassroomEnCalificaciones', () => ({
  ClassroomEnCalificaciones: () => <div>Contenido de sincronización Classroom</div>
}));
vi.mock('../src/apps/app_docente/ConsultaCalificaciones', () => ({
  ConsultaCalificaciones: () => <div>Contenido de resultados</div>
}));
vi.mock('../src/apps/app_docente/ExtraordinariosCalificaciones', () => ({
  ExtraordinariosCalificaciones: () => <div>Contenido de extraordinarios</div>
}));
vi.mock('../src/apps/app_docente/SeccionEscaneo', () => ({ SeccionEscaneo: () => null }));
vi.mock('../src/apps/app_docente/SeccionCalificar', () => ({ SeccionCalificar: () => null }));
vi.mock('../src/apps/app_docente/GuiaCalificacionesVisual', () => ({ GuiaCalificacionesVisual: () => null }));
vi.mock('../src/apps/app_docente/SolicitudesRevisionPanel', () => ({ SolicitudesRevisionPanel: () => null }));
vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: { obtener: async () => ({}), baseApi: 'http://localhost:4000/api' }
}));

const permisos = {
  periodos: { leer: true, gestionar: false, archivar: false },
  alumnos: { leer: true, gestionar: false },
  banco: { leer: true, gestionar: false, archivar: false },
  plantillas: { leer: true, gestionar: false, archivar: false, previsualizar: false },
  examenes: { leer: true, generar: false, archivar: false, regenerar: false, descargar: false },
  entregas: { gestionar: false },
  omr: { analizar: false },
  calificaciones: { calificar: true },
  rehidratacion: { usar: false },
  evaluaciones: { leer: true, gestionar: false },
  classroom: { conectar: false, pull: true },
  publicar: { publicar: false },
  sincronizacion: { listar: false, exportar: false, importar: false, push: false, pull: false },
  cuenta: { leer: false, actualizar: false }
};

const propsBase = {
  periodos: [{ _id: 'periodo-1', nombre: 'Inteligencia de Negocios' }],
  periodosArchivados: [],
  alumnos: [],
  onAnalizar: vi.fn(async () => ({})),
  onPrevisualizar: vi.fn(async () => ({ preview: {} })),
  resultado: null,
  onActualizar: vi.fn(),
  onActualizarPregunta: vi.fn(),
  respuestasPaginaEditable: [],
  revisionOmrConfirmada: false,
  onConfirmarRevisionOmr: vi.fn(),
  revisionesOmr: [],
  examenIdActivo: null,
  paginaActiva: null,
  onSeleccionarRevision: vi.fn(),
  claveCorrectaPorNumero: {},
  ordenPreguntasClave: [],
  examenId: null,
  alumnoId: null,
  resultadoParaCalificar: null,
  respuestasParaCalificar: [],
  onCalificar: vi.fn(async () => undefined),
  permisos,
  avisarSinPermiso: vi.fn()
} as unknown as ComponentProps<typeof SeccionCalificaciones>;

describe('ruta Classroom desde Calificaciones', () => {
  it('abre el espacio Classroom al seleccionar su navegación', async () => {
    render(<SeccionCalificaciones {...propsBase} />);

    fireEvent.click(screen.getByRole('button', { name: /ClassroomVínculos/ }));
    expect(await screen.findByText('Contenido de sincronización Classroom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ClassroomVínculos/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('mantiene Resultados como entrada normal a Calificaciones', async () => {
    render(<SeccionCalificaciones {...propsBase} />);

    expect(await screen.findByText('Contenido de resultados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ResultadosConsulta por alumno/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
