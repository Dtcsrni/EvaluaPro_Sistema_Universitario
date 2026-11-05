/**
 * bancoGestionTemas.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
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
    const props = {
      periodoId: 'per-1',
      temasAbierto: true,
      setTemasAbierto: vi.fn(),
      temasBanco: temasMock,
      temaNuevo: 'Geometría Analítica',
      setTemaNuevo: mockSetTemaNuevo,
      creandoTema: false,
      bloqueoEdicion: false,
      crearTemaBanco: mockCrearTema,
      cargandoTemas: false,
      conteoPorTema: new Map([['Álgebra Lineal', 5], ['Cálculo Diferencial', 8]]),
      paginasPorTema: new Map<string, number>(),
      paginasEstimadasBackendPorTema: new Map<string, number>(),
      temaEditandoId: null,
      temaEditandoNombre: '',
      setTemaEditandoNombre: vi.fn(),
      guardandoTema: false,
      iniciarEdicionTema: vi.fn(),
      guardarEdicionTema: vi.fn().mockResolvedValue(undefined),
      cancelarEdicionTema: vi.fn(),
      abrirAjusteTema: vi.fn(),
      temaEditando: true,
      archivandoTemaId: null,
      archivarTemaBanco: vi.fn().mockResolvedValue(undefined),
      ajusteProps: defaultAjusteProps
    };
    const { rerender } = render(<BancoGestionTemas {...props} />);

    expect(screen.getByText('Álgebra Lineal')).toBeInTheDocument();
    expect(screen.getByText('Cálculo Diferencial')).toBeInTheDocument();
    expect(screen.getByText(/Preguntas: 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Preguntas: 8/i)).toBeInTheDocument();

    const botonAgregar = screen.getByRole('button', { name: /^Agregar tema$/i });
    expect(botonAgregar).not.toBeDisabled();
    fireEvent.click(botonAgregar);
    expect(mockCrearTema).toHaveBeenCalledTimes(1);

    rerender(<BancoGestionTemas {...props} cargandoPreguntas />);
    expect(screen.getAllByText('Preguntas: Cargando…')).toHaveLength(2);
    expect(screen.queryByText('Preguntas: 0')).not.toBeInTheDocument();

    rerender(<BancoGestionTemas {...props} errorCargaPreguntas />);
    expect(screen.getAllByText('Preguntas: No disponible')).toHaveLength(2);

    rerender(<BancoGestionTemas {...props} errorCargaPreguntas hayPreguntasPrevias />);
    expect(screen.getByText('Preguntas (última carga): 5')).toBeInTheDocument();
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

  it('muestra el error de carga con reintento y no lo confunde con una lista vacía', () => {
    const reintentar = vi.fn();
    render(
      <BancoGestionTemas
        periodoId="per-1"
        temasAbierto
        setTemasAbierto={vi.fn()}
        temasBanco={[]}
        temaNuevo=""
        setTemaNuevo={vi.fn()}
        creandoTema={false}
        bloqueoEdicion={false}
        crearTemaBanco={vi.fn().mockResolvedValue(undefined)}
        cargandoTemas={false}
        errorCargaTemas="Tiempo de espera agotado."
        onReintentarCargaTemas={reintentar}
        conteoPorTema={new Map()}
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
        temaEditando
        archivandoTemaId={null}
        archivarTemaBanco={vi.fn().mockResolvedValue(undefined)}
        ajusteProps={defaultAjusteProps}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Tiempo de espera agotado.');
    expect(screen.queryByText('No hay temas. Crea el primero arriba.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga de temas' }));
    expect(reintentar).toHaveBeenCalledOnce();
  });
});
