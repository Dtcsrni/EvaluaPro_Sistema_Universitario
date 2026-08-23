import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BancoGestionTemas } from '../src/apps/app_docente/features/banco/components/BancoGestionTemas';
import type { TemaBanco } from '../src/apps/app_docente/SeccionBanco.helpers';

describe('BancoGestionTemas', () => {
  const temasMock: TemaBanco[] = [
    { _id: 'tema-1', nombre: 'Álgebra Lineal' },
    { _id: 'tema-2', nombre: 'Cálculo Diferencial' }
  ];

  const defaultAjusteProps = {
    ajusteTemaId: null,
    ajustePaginasObjetivo: 2,
    setAjustePaginasObjetivo: vi.fn(),
    ajusteAccion: 'mover' as const,
    setAjusteAccion: vi.fn(),
    ajusteTemaDestinoId: '',
    setAjusteTemaDestinoId: vi.fn(),
    ajusteSeleccion: new Set<string>(),
    setAjusteSeleccion: vi.fn(),
    preguntasPorTemaId: new Map(),
    sugerirPreguntasARecortar: vi.fn().mockReturnValue([]),
    estimarAltoPregunta: vi.fn().mockReturnValue(120),
    cerrarAjusteTema: vi.fn(),
    aplicarAjusteTema: vi.fn().mockResolvedValue(undefined),
    moviendoTema: false,
    sinTemaDestinoId: '',
    setSinTemaDestinoId: vi.fn(),
    preguntasSinTema: [],
    sinTemaSeleccion: new Set<string>(),
    setSinTemaSeleccion: vi.fn(),
    moviendoSinTema: false,
    asignarSinTemaATema: vi.fn().mockResolvedValue(undefined)
  };

  it('renderiza la lista de temas y permite agregar un nuevo tema', () => {
    const mockCrearTema = vi.fn().mockResolvedValue(undefined);
    const mockSetTemaNuevo = vi.fn();

    render(
      <BancoGestionTemas
        periodoId="per-1"
        temasAbierto={true}
        setTemasAbierto={vi.fn()}
        temasBanco={temasMock}
        temaNuevo="Geometría Analítica"
        setTemaNuevo={mockSetTemaNuevo}
        creandoTema={false}
        bloqueoEdicion={false}
        crearTemaBanco={mockCrearTema}
        cargandoTemas={false}
        conteoPorTema={new Map([['Álgebra Lineal', 5], ['Cálculo Diferencial', 8]])}
        paginasPorTema={new Map()}
        paginasEstimadasBackendPorTema={new Map()}
        temaEditandoId={null}
        temaEditandoNombre=""
        setTemaEditandoNombre={vi.fn()}
        guardandoTema={false}
        iniciarEdicionTema={vi.fn()}
        guardarEdicionTema={vi.fn().mockResolvedValue(undefined)}
        cancelarEdicionTema={vi.fn()}
        abrirAjusteTema={vi.fn()}
        temaEditando={true}
        archivandoTemaId={null}
        archivarTemaBanco={vi.fn().mockResolvedValue(undefined)}
        ajusteProps={defaultAjusteProps}
      />
    );

    expect(screen.getByText('Álgebra Lineal')).toBeInTheDocument();
    expect(screen.getByText('Cálculo Diferencial')).toBeInTheDocument();
    expect(screen.getByText(/Preguntas: 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Preguntas: 8/i)).toBeInTheDocument();

    const botonAgregar = screen.getByRole('button', { name: /^Agregar$/i });
    expect(botonAgregar).not.toBeDisabled();
    fireEvent.click(botonAgregar);
    expect(mockCrearTema).toHaveBeenCalledTimes(1);
  });

  it('permite renombrar y archivar temas existentes', () => {
    const mockIniciarEdicion = vi.fn();
    const mockArchivarTema = vi.fn().mockResolvedValue(undefined);

    render(
      <BancoGestionTemas
        periodoId="per-1"
        temasAbierto={true}
        setTemasAbierto={vi.fn()}
        temasBanco={temasMock}
        temaNuevo=""
        setTemaNuevo={vi.fn()}
        creandoTema={false}
        bloqueoEdicion={false}
        crearTemaBanco={vi.fn().mockResolvedValue(undefined)}
        cargandoTemas={false}
        conteoPorTema={new Map()}
        paginasPorTema={new Map()}
        paginasEstimadasBackendPorTema={new Map()}
        temaEditandoId={null}
        temaEditandoNombre=""
        setTemaEditandoNombre={vi.fn()}
        guardandoTema={false}
        iniciarEdicionTema={mockIniciarEdicion}
        guardarEdicionTema={vi.fn().mockResolvedValue(undefined)}
        cancelarEdicionTema={vi.fn()}
        abrirAjusteTema={vi.fn()}
        temaEditando={true}
        archivandoTemaId={null}
        archivarTemaBanco={mockArchivarTema}
        ajusteProps={defaultAjusteProps}
      />
    );

    const botonesRenombrar = screen.getAllByRole('button', { name: /Renombrar/i });
    fireEvent.click(botonesRenombrar[0]!);
    expect(mockIniciarEdicion).toHaveBeenCalledWith(temasMock[0]);

    const botonesArchivar = screen.getAllByRole('button', { name: /Archivar/i });
    fireEvent.click(botonesArchivar[0]!);
    expect(mockArchivarTema).toHaveBeenCalledWith(temasMock[0]);
  });
});
