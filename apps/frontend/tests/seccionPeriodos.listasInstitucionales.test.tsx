/**
 * Pruebas de UI para descarga de listas institucionales desde Materias.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SeccionPeriodos } from '../src/apps/app_docente/SeccionPeriodos';
import type { PermisosUI } from '../src/apps/app_docente/tipos';

const permisos: PermisosUI = {
  periodos: { leer: true, gestionar: true, archivar: true },
  alumnos: { leer: true, gestionar: true },
  banco: { leer: true, gestionar: true },
  plantillas: { leer: true, gestionar: true },
  calificaciones: { leer: true, calificar: true },
  analiticas: { leer: true },
  asistencias: { leer: true, gestionar: true },
  classroom: { leer: true, gestionar: true }
};

describe('SeccionPeriodos listas institucionales', () => {
  it('permite descargar XLSX y PDF institucional por periodo activo', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();

    render(
      <SeccionPeriodos
        periodos={[
          {
            _id: 'periodo-1',
            nombre: 'Electronica y Aplicaciones Digitales',
            fechaInicio: '2026-05-18',
            fechaFin: '2026-06-26',
            grupos: ['23'],
            activo: true
          }
        ]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={false}
        enviarConPermiso={vi.fn()}
        avisarSinPermiso={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /lista cuh xlsx/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lista cuh pdf/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /lista cuh xlsx/i }));
    await user.click(screen.getByRole('button', { name: /lista cuh pdf/i }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        '/api/listas-institucionales/generar?periodoId=periodo-1&templateId=asistencia_cuh_control&formato=xlsx',
        '_blank',
        'noopener,noreferrer'
      );
      expect(openSpy).toHaveBeenCalledWith(
        '/api/listas-institucionales/generar?periodoId=periodo-1&templateId=asistencia_cuh_control&formato=pdf',
        '_blank',
        'noopener,noreferrer'
      );
    });

    openSpy.mockRestore();
  });
});
