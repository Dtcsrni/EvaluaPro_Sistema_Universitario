/**
 * seccionPeriodos.edit.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SeccionPeriodos } from '../src/apps/app_docente/SeccionPeriodos';
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
  it('inicia la guía plegada y permite consultarla bajo demanda', () => {
    localStorage.removeItem('ep.guia.materias.oculta');

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

    expect(screen.queryByText('PASO 01')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver guía rápida de configuración/i }));
    expect(screen.getByText('PASO 01')).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: /Abrir grupo E512606A/i }));
    expect(onAbrirGrupo).toHaveBeenCalledWith('per-grupo', 'E512606A');
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
