import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SeccionPeriodosArchivados } from '../src/apps/app_docente/SeccionPeriodos';
import type { Periodo } from '../src/apps/app_docente/tipos';

const emojisDecorativos = ['🛡️', '📦', '👥', '📝', '📄', '🎖️'];

describe('SeccionPeriodosArchivados', () => {
  it('explica el archivo y presenta un estado vacío sin emojis', () => {
    const { container } = render(<SeccionPeriodosArchivados periodos={[]} onVerActivas={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Materias archivadas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No hay materias archivadas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a materias activas' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Información sobre archivo de materias' }).querySelector('svg'))
      .toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.empty-state-card__icon svg')).toHaveAttribute('aria-hidden', 'true');
    expect(emojisDecorativos.some((emoji) => container.textContent?.includes(emoji))).toBe(false);
  });

  it('permite reintentar el historial y no presenta un fallo como archivo vacío', () => {
    const reintentar = vi.fn(async () => {});
    render(
      <SeccionPeriodosArchivados
        periodos={[]}
        errorCarga
        onReintentar={reintentar}
        onVerActivas={vi.fn()}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo actualizar el historial de materias');
    expect(screen.queryByRole('heading', { name: 'No hay materias archivadas' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga del historial' }));
    expect(reintentar).toHaveBeenCalledOnce();
  });

  it('no presenta un archivo vacío o con cero registros mientras consulta o falla', () => {
    const { rerender, container } = render(
      <SeccionPeriodosArchivados periodos={[]} cargando onVerActivas={vi.fn()} />
    );

    expect(screen.getByText('Cargando historial…')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Registro histórico' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No hay materias archivadas' })).not.toBeInTheDocument();

    rerender(<SeccionPeriodosArchivados periodos={[]} errorCarga onVerActivas={vi.fn()} />);

    expect(screen.getByText('Historial no disponible')).toBeInTheDocument();
    expect(container.querySelector('.materias-section-title')).toHaveTextContent('Registro histórico');
    expect(container.querySelector('.materias-section-title')).not.toHaveTextContent('(0)');
    expect(screen.queryByRole('heading', { name: 'No hay materias archivadas' })).not.toBeInTheDocument();
  });

  it('conserva las cantidades y sus etiquetas en las tarjetas históricas', () => {
    const periodo: Periodo = {
      _id: 'periodo-archivado-1',
      nombre: 'Materia de prueba',
      fechaInicio: '2025-08-01',
      fechaFin: '2025-12-01',
      createdAt: '2025-07-20T12:00:00.000Z',
      archivadoEn: '2025-12-15T12:00:00.000Z',
      resumenArchivado: { alumnos: 3, bancoPreguntas: 4, plantillas: 2, calificaciones: 3 }
    };
    const { container } = render(<SeccionPeriodosArchivados periodos={[periodo]} onVerActivas={vi.fn()} />);
    const panelInfo = screen.getByRole('region', { name: 'Información sobre archivo de materias' });
    const stats = container.querySelector('.archivadas-chips-row');

    expect(within(panelInfo).getByText('¿Qué conserva el archivo?')).toBeInTheDocument();
    expect(within(panelInfo).getByText(/Deja de aparecer en la lista de materias activas/)).toBeInTheDocument();
    expect(screen.getByText('Materia de prueba', { selector: '.item-title' })).toBeInTheDocument();
    expect(container.querySelector('.materia-meta-tag--id')).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\bID:/);
    expect(screen.getByText(/20 jul 2025/)).toBeInTheDocument();
    expect(screen.getByText(/15 dic 2025/)).toBeInTheDocument();
    expect(screen.getByText('3 alumnos')).toBeInTheDocument();
    expect(screen.getByText('4 reactivos')).toBeInTheDocument();
    expect(screen.getByText('2 plantillas')).toBeInTheDocument();
    expect(screen.getByText('3 calificaciones')).toBeInTheDocument();
    expect(panelInfo.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(stats?.querySelectorAll('svg')).toHaveLength(4);
    expect(emojisDecorativos.some((emoji) => container.textContent?.includes(emoji))).toBe(false);
  });
});
