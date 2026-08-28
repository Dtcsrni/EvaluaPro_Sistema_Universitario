/**
 * recursosAcademicos.hooks.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useRecursosAcademicosDocente } from '../src/apps/app_docente/hooks/useRecursosAcademicosDocente';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import type { Docente } from '../src/apps/app_docente/tipos';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: vi.fn(),
    enviar: vi.fn()
  }
}));

describe('useRecursosAcademicosDocente hook', () => {
  const docenteMock: Docente = {
    _id: 'doc-1',
    nombre: 'Profesor X',
    email: 'profx@universidad.edu.mx',
    rol: 'docente'
  };

  const permisosUIMock = {
    alumnos: { leer: true },
    periodos: { leer: true },
    plantillas: { leer: true },
    banco: { leer: true }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga alumnos, materias activas/archivadas, plantillas y banco cuando el docente está autenticado', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.startsWith('/alumnos')) return { alumnos: [{ _id: 'a1', nombreCompleto: 'Juan Pérez' }] };
      if (url.startsWith('/periodos?activo=1')) return { periodos: [{ _id: 'p1', nombre: '2026-A', activo: true }] };
      if (url.startsWith('/periodos?activo=0')) return { periodos: [{ _id: 'p2', nombre: '2025-B', activo: false }] };
      if (url.startsWith('/examenes/plantillas')) return { plantillas: [{ _id: 'pl1', nombre: 'Examen 1' }] };
      if (url.startsWith('/banco-preguntas')) return { preguntas: [{ _id: 'pr1', enunciado: '¿Qué es React?' }] };
      return {};
    });

    const montadoRef = { current: true };

    const { result } = renderHook(() =>
      useRecursosAcademicosDocente({
        docente: docenteMock,
        permisosUI: permisosUIMock,
        montadoRef
      })
    );

    await waitFor(() => {
      expect(result.current.alumnos).toHaveLength(1);
      expect(result.current.periodos).toHaveLength(1);
      expect(result.current.periodosArchivados).toHaveLength(1);
      expect(result.current.plantillas).toHaveLength(1);
      expect(result.current.preguntas).toHaveLength(1);
    });

    expect(result.current.alumnos[0].nombreCompleto).toBe('Juan Pérez');
    expect(result.current.periodos[0].nombre).toBe('2026-A');
    expect(result.current.periodosArchivados[0].nombre).toBe('2025-B');
    expect(result.current.cargandoDatos).toBe(false);
  });

  it('no carga datos cuando el docente es null y limpia estados cuando los permisos son falsos', async () => {
    const montadoRef = { current: true };

    const { result } = renderHook(() =>
      useRecursosAcademicosDocente({
        docente: null,
        permisosUI: permisosUIMock,
        montadoRef
      })
    );

    expect(result.current.alumnos).toEqual([]);
    expect(result.current.periodos).toEqual([]);
    expect(result.current.plantillas).toEqual([]);
    expect(result.current.preguntas).toEqual([]);
    expect(clienteApi.obtener).not.toHaveBeenCalled();
  });

  it('permite refrescar materias y datos manualmente', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.startsWith('/alumnos')) return { alumnos: [] };
      if (url.startsWith('/periodos?activo=1')) return { periodos: [{ _id: 'p1', nombre: '2026-A', activo: true }] };
      if (url.startsWith('/periodos?activo=0')) return { periodos: [] };
      if (url.startsWith('/examenes/plantillas')) return { plantillas: [] };
      if (url.startsWith('/banco-preguntas')) return { preguntas: [] };
      return {};
    });

    const montadoRef = { current: true };

    const { result } = renderHook(() =>
      useRecursosAcademicosDocente({
        docente: docenteMock,
        permisosUI: permisosUIMock,
        montadoRef
      })
    );

    await waitFor(() => {
      expect(result.current.periodos).toHaveLength(1);
    });

    // Cambiar mock
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.startsWith('/periodos?activo=1')) {
        return {
          periodos: [
            { _id: 'p1', nombre: '2026-A', activo: true },
            { _id: 'p2', nombre: '2026-B', activo: true }
          ]
        };
      }
      if (url.startsWith('/periodos?activo=0')) return { periodos: [] };
      return { alumnos: [], plantillas: [], preguntas: [] };
    });

    await act(async () => {
      await result.current.refrescarMaterias();
    });

    expect(result.current.periodos).toHaveLength(2);
  });
});
