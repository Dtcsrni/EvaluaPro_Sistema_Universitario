import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BancoListadoPreguntas } from '../src/apps/app_docente/features/banco/components/BancoListadoPreguntas';
import type { Pregunta } from '../src/apps/app_docente/tipos';

function pregunta(id: string, tema: string, enunciado: string): Pregunta {
  return {
    _id: id,
    reactivoId: `reactivo-${id}`,
    periodoId: `periodo-${id}`,
    tema,
    versionActual: 1,
    versiones: [{ numeroVersion: 1, enunciado, opciones: [] }]
  };
}

describe('BancoListadoPreguntas', () => {
  it('no presenta una consulta en curso como una lista vacía', () => {
    render(
      <BancoListadoPreguntas
        periodoId="periodo-1"
        preguntasMateria={[]}
        cargandoPreguntas
        bloqueoEdicion={false}
        archivandoPreguntaId={null}
        puedeArchivar
        puedeRetirar
        iniciarEdicion={vi.fn()}
        archivarPregunta={vi.fn().mockResolvedValue(undefined)}
        verVersiones={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Cargando preguntas de esta materia');
    expect(screen.getByRole('region', { name: 'Preguntas recientes' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('No hay preguntas en esta materia. Redacta la primera arriba.')).not.toBeInTheDocument();
  });

  it('explica y permite reintentar un error de lectura sin afirmar que la lista está vacía', () => {
    const reintentar = vi.fn();
    render(
      <BancoListadoPreguntas
        periodoId="periodo-1"
        preguntasMateria={[]}
        errorCargaPreguntas
        onReintentarCargaPreguntas={reintentar}
        bloqueoEdicion={false}
        archivandoPreguntaId={null}
        puedeArchivar
        puedeRetirar
        iniciarEdicion={vi.fn()}
        archivarPregunta={vi.fn().mockResolvedValue(undefined)}
        verVersiones={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo actualizar la lista de preguntas');
    expect(screen.getByRole('button', { name: 'Reintentar carga de preguntas' })).toBeInTheDocument();
    expect(screen.queryByText('No hay preguntas en esta materia. Redacta la primera arriba.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga de preguntas' }));
    expect(reintentar).toHaveBeenCalledOnce();
  });

  it('distingue las acciones repetidas con enunciado, tema e identificador del reactivo', () => {
    render(
      <BancoListadoPreguntas
        periodoId="periodo-1"
        preguntasMateria={[
          pregunta('1', 'Álgebra', 'Función cuadrática'),
          pregunta('2', 'Geometría', 'Ángulos complementarios')
        ]}
        bloqueoEdicion={false}
        archivandoPreguntaId={null}
        puedeArchivar
        puedeRetirar
        iniciarEdicion={vi.fn()}
        archivarPregunta={vi.fn().mockResolvedValue(undefined)}
        verVersiones={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const botonesRetirar = screen.getAllByRole('button', { name: /^Retirar reactivo:/i });
    expect(botonesRetirar).toHaveLength(2);
    expect(botonesRetirar[0]).toHaveAccessibleName(/Función cuadrática.*tema Álgebra.*ID/i);
    expect(botonesRetirar[1]).toHaveAccessibleName(/Ángulos complementarios.*tema Geometría.*ID/i);
    expect(screen.getByRole('button', { name: /Editar pregunta:.*Función cuadrática.*tema Álgebra/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Versiones del reactivo:.*Ángulos complementarios.*tema Geometría/i })).toBeInTheDocument();
  });

  it('explica los permisos faltantes junto a retirar o eliminar y asocia la ayuda a cada control', () => {
    const heredada: Pregunta = {
      _id: 'legado-1',
      periodoId: 'periodo-1',
      tema: 'Geometría',
      versiones: [{ numeroVersion: 1, enunciado: 'Registro heredado', opciones: [] }]
    };

    render(
      <BancoListadoPreguntas
        periodoId="periodo-1"
        preguntasMateria={[pregunta('1', 'Álgebra', 'Función cuadrática'), heredada]}
        bloqueoEdicion
        archivandoPreguntaId={null}
        puedeArchivar={false}
        puedeRetirar={false}
        iniciarEdicion={vi.fn()}
        archivarPregunta={vi.fn().mockResolvedValue(undefined)}
        verVersiones={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const retirar = screen.getByRole('button', { name: /^Retirar reactivo:/i });
    const eliminar = screen.getByRole('button', { name: /^Eliminar pregunta:/i });
    expect(retirar).toBeDisabled();
    expect(eliminar).toBeDisabled();

    const ayudaRetirar = screen.getByText(/Retirar reactivos requiere permiso de publicación/i);
    const ayudaEliminar = screen.getByText(/Eliminar preguntas heredadas requiere permiso de archivo/i);
    expect(retirar).toHaveAttribute('aria-describedby', ayudaRetirar.id);
    expect(eliminar).toHaveAttribute('aria-describedby', ayudaEliminar.id);
    expect(ayudaRetirar).toHaveAttribute('role', 'status');
    expect(ayudaEliminar).toHaveAttribute('role', 'status');
    expect(ayudaRetirar).toBeVisible();
    expect(ayudaEliminar).toBeVisible();
  });

  it('restablece el tema al cambiar a una materia donde ya no existe', async () => {
    const callbacks = {
      iniciarEdicion: vi.fn(),
      archivarPregunta: vi.fn().mockResolvedValue(undefined),
      verVersiones: vi.fn().mockResolvedValue(undefined)
    };
    const props = {
      periodoId: 'periodo-1',
      preguntasMateria: [pregunta('1', 'Álgebra', 'Función cuadrática')],
      bloqueoEdicion: false,
      archivandoPreguntaId: null,
      puedeArchivar: true,
      puedeRetirar: true,
      ...callbacks
    };
    const { rerender } = render(<BancoListadoPreguntas {...props} />);

    const filtroTema = screen.getByRole('combobox', { name: 'Filtrar por tema' });
    fireEvent.change(filtroTema, { target: { value: 'Álgebra' } });
    expect(filtroTema).toHaveValue('Álgebra');
    expect(screen.getByText('Función cuadrática')).toBeInTheDocument();

    rerender(
      <BancoListadoPreguntas
        {...props}
        periodoId="periodo-2"
        preguntasMateria={[pregunta('2', 'Geometría', 'Ángulos complementarios')]}
      />
    );

    await waitFor(() => expect(filtroTema).toHaveValue(''));
    expect(screen.getByRole('option', { name: 'Todos los temas' })).toBeInTheDocument();
    expect(screen.getByText('Ángulos complementarios')).toBeInTheDocument();
    expect(screen.queryByText('No hay preguntas que coincidan con los filtros actuales.')).not.toBeInTheDocument();
  });

  it('normaliza espacios del nombre de tema al aplicar el filtro', () => {
    render(
      <BancoListadoPreguntas
        periodoId="periodo-1"
        preguntasMateria={[pregunta('3', '  Álgebra  ', 'Polinomios')]}
        bloqueoEdicion={false}
        archivandoPreguntaId={null}
        puedeArchivar
        puedeRetirar
        iniciarEdicion={vi.fn()}
        archivarPregunta={vi.fn().mockResolvedValue(undefined)}
        verVersiones={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const filtroTema = screen.getByRole('combobox', { name: 'Filtrar por tema' });
    expect(screen.getByRole('option', { name: 'Álgebra' })).toBeInTheDocument();
    fireEvent.change(filtroTema, { target: { value: 'Álgebra' } });

    expect(screen.getByText('Polinomios')).toBeInTheDocument();
    expect(screen.queryByText('No hay preguntas que coincidan con los filtros actuales.')).not.toBeInTheDocument();
  });

  it('conserva el tema seleccionado si sigue disponible en la nueva materia', () => {
    const callbacks = {
      iniciarEdicion: vi.fn(),
      archivarPregunta: vi.fn().mockResolvedValue(undefined),
      verVersiones: vi.fn().mockResolvedValue(undefined)
    };
    const { rerender } = render(
      <BancoListadoPreguntas
        periodoId="periodo-1"
        preguntasMateria={[pregunta('4', 'Álgebra', 'Polinomios')]}
        bloqueoEdicion={false}
        archivandoPreguntaId={null}
        puedeArchivar
        puedeRetirar
        {...callbacks}
      />
    );

    const filtroTema = screen.getByRole('combobox', { name: 'Filtrar por tema' });
    fireEvent.change(filtroTema, { target: { value: 'Álgebra' } });
    rerender(
      <BancoListadoPreguntas
        periodoId="periodo-2"
        preguntasMateria={[pregunta('5', 'álgebra', 'Ecuaciones de segundo grado')]}
        bloqueoEdicion={false}
        archivandoPreguntaId={null}
        puedeArchivar
        puedeRetirar
        {...callbacks}
      />
    );

    expect(filtroTema).toHaveValue('álgebra');
    expect(screen.getByText('Ecuaciones de segundo grado')).toBeInTheDocument();
  });
});
