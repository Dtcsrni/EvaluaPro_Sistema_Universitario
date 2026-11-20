import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlantillasDescargaEstado } from '../src/apps/app_docente/features/plantillas/components/PlantillasDescargaEstado';

describe('estado visible de descarga de lote', () => {
  it('muestra bytes recibidos, tiempo de espera e identificador del lote', () => {
    render(<PlantillasDescargaEstado
      estado={{ loteId: 'LOT-UI', estado: 'descargando', recibidos: 512, total: 1024, iniciadoEn: 1 }}
      esperaSegundos={17}
      ocupado
      onReintentar={vi.fn()}
    />);

    expect(screen.getByRole('progressbar', { name: 'Progreso de descarga del lote LOT-UI' })).toHaveValue(512);
    expect(screen.getByText('512 bytes de 1,024')).toBeInTheDocument();
    expect(screen.getByText('Espera: 17 s')).toBeInTheDocument();
    expect(screen.getByText(/LOT-UI/)).toBeInTheDocument();
  });

  it('mantiene la recuperación asociada al mismo lote y desactiva reintento mientras descarga', () => {
    const onReintentar = vi.fn();
    const { rerender } = render(<PlantillasDescargaEstado
      estado={{ loteId: 'LOT-RECUPERA', estado: 'error', recibidos: 0, iniciadoEn: 1, mensaje: 'HTTP 503' }}
      esperaSegundos={180}
      ocupado
      onReintentar={onReintentar}
    />);

    expect(screen.getByRole('button', { name: 'Reintentar este lote' })).toBeDisabled();
    rerender(<PlantillasDescargaEstado
      estado={{ loteId: 'LOT-RECUPERA', estado: 'error', recibidos: 0, iniciadoEn: 1, mensaje: 'HTTP 503' }}
      esperaSegundos={180}
      ocupado={false}
      onReintentar={onReintentar}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar este lote' }));
    expect(onReintentar).toHaveBeenCalledWith('LOT-RECUPERA');
  });
});
