import { render, screen, within } from '@testing-library/react';
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

    expect(within(panelInfo).getByText(/¿Qué ocurre con las materias archivadas/)).toBeInTheDocument();
    expect(screen.getByText('Materia de prueba', { selector: '.item-title' })).toBeInTheDocument();
    expect(screen.getByText('3 alumnos')).toBeInTheDocument();
    expect(screen.getByText('4 reactivos')).toBeInTheDocument();
    expect(screen.getByText('2 plantillas')).toBeInTheDocument();
    expect(screen.getByText('3 calificaciones')).toBeInTheDocument();
    expect(panelInfo.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(stats?.querySelectorAll('svg')).toHaveLength(4);
    expect(emojisDecorativos.some((emoji) => container.textContent?.includes(emoji))).toBe(false);
  });
});
