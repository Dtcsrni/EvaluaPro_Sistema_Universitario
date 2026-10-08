import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtraordinariosCalificaciones } from '../src/apps/app_docente/ExtraordinariosCalificaciones';

const obtenerMock = vi.fn();
const enviarMock = vi.fn();
vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: { obtener: (...args: unknown[]) => obtenerMock(...args), enviar: (...args: unknown[]) => enviarMock(...args), baseApi: 'http://localhost/api' }
}));

describe('ExtraordinariosCalificaciones', () => {
  beforeEach(() => {
    obtenerMock.mockReset();
    enviarMock.mockReset();
    obtenerMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/analiticas/lista-academica')) return Promise.resolve({ filas: [
        { alumnoId: 'a-1', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: '', matricula: 'A001', grupo: 'A', calificacionFinalCurso: '5.99', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, solicitudExtraVersion: 1, resultadosExtraordinarios: [] },
        { alumnoId: 'a-2', nombre: 'Luis', apellidoPaterno: 'Soto', apellidoMaterno: '', matricula: 'A002', grupo: 'A', calificacionFinalCurso: '6.00', calificacionFinalCursoActa: '6', extraDisponible: false, solicitaExtra: false, resultadosExtraordinarios: [{ claseRegistro: 'externo', folio: 'FOLIO-1', calificacionSobre5: '2.29', calificacionSobre10: '4.58', estadoAprobatorio: 'No aprobatoria', origen: 'inferida manualmente' }] }
      ] });
      return Promise.resolve({ plantillas: [] });
    });
  });

  it('muestra elegibilidad exacta y conserva historial de un alumno ya no elegible', async () => {
    render(<ExtraordinariosCalificaciones
      periodos={[{ _id: 'p-1', nombre: 'Materia de prueba' }]}
      periodoId="p-1"
      onPeriodoChange={vi.fn()}
      puedeCalificar
      puedeGenerar
      onAbrirRevision={vi.fn()}
    />);

    expect((await screen.findAllByText('Pérez Ana')).length).toBeGreaterThan(0);
    expect(screen.getByText('5.99')).toBeInTheDocument();
    expect(screen.getAllByText('6.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Resultado externo · folio FOLIO-1')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Seleccionar para generar Extra: Pérez Ana' })).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Seleccionar para generar Extra: Soto Luis' })).not.toBeInTheDocument();
    await waitFor(() => expect(obtenerMock).toHaveBeenCalledWith('/examenes/plantillas?periodoId=p-1&archivado=true'));
  });

  it('calcula SHA-256 del PDF local y envía solo metadatos confirmados', async () => {
    vi.stubGlobal('crypto', {
      subtle: { digest: vi.fn(async () => new Uint8Array(32).fill(0x0a).buffer) },
      getRandomValues: (value: Uint8Array) => value.fill(1),
      randomUUID: () => 'request-test-1'
    });
    enviarMock.mockResolvedValue({});
    render(<ExtraordinariosCalificaciones
      periodos={[{ _id: 'p-1', nombre: 'Materia de prueba' }]}
      periodoId="p-1"
      onPeriodoChange={vi.fn()}
      puedeCalificar
      puedeGenerar
      onAbrirRevision={vi.fn()}
    />);

    fireEvent.change(await screen.findByRole('combobox', { name: 'Alumno solicitante elegible' }), { target: { value: 'a-1' } });
    const archivo = new File(['%PDF-1.7 contenido privado'], 'anwar-extra.pdf', { type: 'application/pdf' });
    Object.defineProperty(archivo, 'arrayBuffer', { value: async () => new TextEncoder().encode('%PDF-1.7 contenido privado').buffer });
    fireEvent.change(screen.getByLabelText('PDF local'), { target: { files: [archivo] } });
    expect(await screen.findByText(`SHA-256 local: ${'0a'.repeat(32)}`)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Folio visible'), { target: { value: 'FOLIO-EXTRA' } });
    fireEvent.change(screen.getByLabelText('Aciertos confirmados'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Reactivos evaluables'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Criterios aplicados'), { target: { value: 'Revisión manual con rúbrica documentada.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado externo' }));

    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/analiticas/lista-academica/resultados-extra-externos', expect.objectContaining({
      fuenteArchivo: 'anwar-extra.pdf', documentoSha256: '0a'.repeat(32), folio: 'FOLIO-EXTRA', aciertos: 7, totalReactivos: 10
    })));
    const payload = enviarMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('archivo');
    expect(JSON.stringify(payload)).not.toContain('contenido privado');
  });
});
