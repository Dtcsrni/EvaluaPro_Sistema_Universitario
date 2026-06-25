/**
 * banco.estimadores.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BancoAjustePreguntas } from '../src/apps/app_docente/features/banco/components/BancoAjustePreguntas';
import { estimarAltoPregunta, sugerirPreguntasARecortar } from '../src/apps/app_docente/features/banco/hooks/estimadoresBanco';

const pregunta = (id: string, enunciado: string) =>
  ({
    _id: id,
    tema: 'Tema 1',
    periodoId: 'per-1',
    versiones: [{ enunciado, opciones: [{ texto: 'A', esCorrecta: true }] }]
  }) as unknown as Parameters<typeof estimarAltoPregunta>[0];

describe('estimadores banco', () => {
  it('estima alto de pregunta con valor positivo', () => {
    const alto = estimarAltoPregunta(pregunta('p-1', 'Pregunta de prueba'));
    expect(alto).toBeGreaterThan(0);
  });

  it('sugiere preguntas a recortar cuando excede paginas objetivo', () => {
    const lista = [pregunta('p-1', 'Uno'), pregunta('p-2', 'Dos'), pregunta('p-3', 'Tres')];
    const ids = sugerirPreguntasARecortar(lista, 1);
    expect(Array.isArray(ids)).toBe(true);
  });
});

describe('BancoAjustePreguntas', () => {
  it('renderiza panel de ajuste y permite seleccionar preguntas', async () => {
    const user = userEvent.setup();
    let seleccion = new Set<string>();
    const setSeleccion = vi.fn((next: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      seleccion = typeof next === 'function' ? next(seleccion) : next;
    });
    const tema = { _id: 'tema-1', nombre: 'Tema 1' } as unknown as { _id: string; nombre: string };
    const preguntasTema = [pregunta('p-1', 'Enunciado largo para testear ajuste'), pregunta('p-2', 'Enunciado dos')];

    render(
      <BancoAjustePreguntas
        tema={tema}
        temasBanco={[tema, { _id: 'tema-2', nombre: 'Tema 2' } as unknown as { _id: string; nombre: string }]}
        ajusteTemaId="tema-1"
        ajustePaginasObjetivo={1}
        setAjustePaginasObjetivo={() => {}}
        ajusteAccion="mover"
        setAjusteAccion={() => {}}
        ajusteTemaDestinoId=""
        setAjusteTemaDestinoId={() => {}}
        ajusteSeleccion={seleccion}
        setAjusteSeleccion={setSeleccion}
        preguntasPorTemaId={new Map([['tema-1', preguntasTema]])}
        paginasPorTema={new Map([['tema 1', 2]])}
        sugerirPreguntasARecortar={sugerirPreguntasARecortar}
        estimarAltoPregunta={estimarAltoPregunta}
        cerrarAjusteTema={() => {}}
        aplicarAjusteTema={async () => {}}
        moviendoTema={false}
        sinTemaDestinoId=""
        setSinTemaDestinoId={() => {}}
        preguntasSinTema={[]}
        sinTemaSeleccion={new Set()}
        setSinTemaSeleccion={() => {}}
        moviendoSinTema={false}
        asignarSinTemaATema={async () => {}}
      />
    );

    expect(screen.getByText(/Paginas objetivo/i)).toBeInTheDocument();
    await user.click(screen.getAllByRole('checkbox')[0]);
    expect(setSeleccion).toHaveBeenCalled();
  });
});
