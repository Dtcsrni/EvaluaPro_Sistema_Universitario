import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TemaProvider } from '../src/tema/TemaProvider';
import { AppDocente } from '../src/apps/app_docente/AppDocente';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => {
  const enviar = vi.fn(async (ruta: string, payload: unknown) => {
    if (ruta === '/omr/analizar') {
      const body = payload as { numeroPagina?: number };
      if (Number(body?.numeroPagina) === 1) {
        return {
          examenId: 'examen-1',
          folio: 'FOL-1',
          numeroPagina: 1,
          alumnoId: 'alu-1',
          resultado: {
            estadoAnalisis: 'ok',
            calidadPagina: 0.95,
            confianzaPromedioPagina: 0.92,
            ratioAmbiguas: 0,
            templateVersionDetectada: 2,
            respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.9 }],
            advertencias: [],
            motivosRevision: []
          }
        };
      }
      return {
        examenId: 'examen-1',
        folio: 'FOL-1',
        numeroPagina: 2,
        alumnoId: 'alu-1',
        resultado: {
          estadoAnalisis: 'ok',
          calidadPagina: 0.94,
          confianzaPromedioPagina: 0.9,
          ratioAmbiguas: 0,
          templateVersionDetectada: 2,
          respuestasDetectadas: [{ numeroPregunta: 2, opcion: 'B', confianza: 0.9 }],
          advertencias: [],
          motivosRevision: []
        }
      };
    }
    if (ruta === '/calificaciones/calificar') {
      return {
        preview: {
          aciertos: 2,
          totalReactivos: 2,
          calificacionExamenFinalTexto: '5.00'
        }
      };
    }
    return {};
  });

  const obtener = vi.fn(async (ruta: string) => {
    if (ruta === '/autenticacion/perfil') {
      return {
        docente: {
          id: 'doc-1',
          nombreCompleto: 'Docente Test',
          correo: 'docente@test.local',
          roles: ['docente'],
          permisos: [
            'alumnos:leer',
            'periodos:leer',
            'periodos:gestionar',
            'periodos:archivar',
            'banco:leer',
            'plantillas:leer',
            'entregas:gestionar',
            'omr:analizar',
            'calificaciones:calificar',
            'cuenta:leer'
          ]
        }
      };
    }
    if (ruta === '/alumnos') return { alumnos: [] };
    if (ruta.startsWith('/periodos')) return { periodos: [] };
    if (ruta === '/examenes/plantillas') return { plantillas: [] };
    if (ruta === '/banco-preguntas') return { preguntas: [] };
    if (ruta.startsWith('/examenes/generados/folio/')) {
      return {
        examen: {
          _id: 'examen-1',
          folio: 'FOL-1',
          ordenPreguntas: [1, 2]
        }
      };
    }
    return {};
  });

  return {
    clienteApi: {
      baseApi: 'http://localhost:4000/api',
      obtener,
      enviar,
      eliminar: vi.fn(async () => ({})),
      registrarEventosUso: vi.fn(),
      mensajeUsuarioDeError: vi.fn((error: unknown) => String(error ?? 'Error')),
      intentarRefrescarToken: vi.fn(async () => 'token-refrescado')
    }
  };
});

vi.mock('../src/apps/app_docente/SeccionCalificaciones', () => ({
  SeccionCalificaciones: ({ onAnalizar, onPrevisualizar }: { onAnalizar: (...args: unknown[]) => Promise<unknown>; onPrevisualizar: (payload: Record<string, unknown>) => Promise<unknown> }) => (
    <section>
      <h2>Calificaciones</h2>
      <button
        type="button"
        onClick={async () => {
          await onAnalizar('FOL-1', 1, 'img-1');
          await onAnalizar('FOL-1', 2, 'img-2');
        }}
      >
        Sembrar revisión
      </button>
      <button
        type="button"
        onClick={async () => {
          await onPrevisualizar({
            examenGeneradoId: 'examen-1',
            alumnoId: 'alu-1',
            respuestasDetectadas: [{ numeroPregunta: 999, opcion: 'E', confianza: 0.1 }]
          });
        }}
      >
        Lanzar preview
      </button>
    </section>
  )
}));

describe('AppDocente - preview consolidado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('tokenDocente', 'token-falso');
  });

  it('envía respuestas consolidadas de todo el examen en soloPreview', async () => {
    const user = userEvent.setup();
    render(
      <TemaProvider>
        <AppDocente />
      </TemaProvider>
    );

    const nav = await screen.findByRole('navigation', { name: 'Secciones del portal docente' });
    const botonCalificaciones = await screen.findByRole('button', { name: 'Calificaciones' });
    expect(nav).toContainElement(botonCalificaciones);
    await user.click(botonCalificaciones);

    await user.click(await screen.findByRole('button', { name: 'Sembrar revisión' }));
    await user.click(screen.getByRole('button', { name: 'Lanzar preview' }));

    const llamadasCalificar = vi
      .mocked(clienteApi.enviar)
      .mock.calls.filter(([ruta]) => ruta === '/calificaciones/calificar');
    expect(llamadasCalificar).toHaveLength(1);

    const payload = llamadasCalificar[0][1] as {
      soloPreview?: boolean;
      respuestasDetectadas?: Array<{ numeroPregunta: number; opcion: string | null }>;
    };

    expect(payload.soloPreview).toBe(true);
    expect(payload.respuestasDetectadas).toEqual([
      { numeroPregunta: 1, opcion: 'A', confianza: 0.9 },
      { numeroPregunta: 2, opcion: 'B', confianza: 0.9 }
    ]);
  });
});
