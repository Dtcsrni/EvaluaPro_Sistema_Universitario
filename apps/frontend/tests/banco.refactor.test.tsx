/**
 * banco.refactor.test
 *
 * Responsabilidad: Pruebas de integración y comportamiento para el módulo de Banco de Preguntas.
 * Limites: Mantener contrato y comportamiento observable del módulo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SeccionBanco } from '../src/apps/app_docente/SeccionBanco';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import type { PermisosUI, Pregunta } from '../src/apps/app_docente/tipos';

const permisosLectura: PermisosUI = {
  periodos: { leer: true, gestionar: true, archivar: true },
  alumnos: { leer: true, gestionar: true },
  banco: { leer: true, gestionar: false, archivar: false },
  plantillas: { leer: true, gestionar: true, archivar: true, previsualizar: true },
  examenes: { leer: true, generar: true, archivar: true, regenerar: true, descargar: true },
  entregas: { gestionar: true },
  omr: { analizar: true },
  calificaciones: { calificar: true },
  publicar: { publicar: true },
  sincronizacion: { listar: true, exportar: true, importar: true, push: true, pull: true },
  cuenta: { leer: true, actualizar: true }
};

const permisosCompletos: PermisosUI = {
  ...permisosLectura,
  banco: { leer: true, gestionar: true, archivar: true }
};

describe('banco refactor comportamiento', () => {
  it('renderiza banco y bloquea edición sin permiso de gestión', () => {
    render(
      <SeccionBanco
        preguntas={[] as Pregunta[]}
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1' }]}
        permisos={permisosLectura}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
        onRefrescar={() => {}}
        onRefrescarPlantillas={() => {}}
        paginasEstimadasBackendPorTema={new Map()}
      />
    );

    expect(screen.getByRole('heading', { name: /Banco de preguntas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Validar y guardar borrador$/i })).toBeDisabled();
  });

  it('permite interactuar con el formulario y escribir opciones cuando tiene permisos completos', () => {
    const mockEnviar = vi.fn().mockResolvedValue({});

    render(
      <SeccionBanco
        preguntas={[] as Pregunta[]}
        periodos={[{ _id: 'per-1', nombre: 'Matemáticas I' }]}
        permisos={permisosCompletos}
        enviarConPermiso={mockEnviar}
        avisarSinPermiso={() => {}}
        onRefrescar={() => {}}
        onRefrescarPlantillas={() => {}}
        paginasEstimadasBackendPorTema={new Map()}
      />
    );

    expect(screen.getByRole('heading', { name: /Banco de preguntas/i })).toBeInTheDocument();

    const selectMateria = screen.getByLabelText(/^Materia$/i);
    fireEvent.change(selectMateria, { target: { value: 'per-1' } });

    const inputEnunciado = screen.getByPlaceholderText(/Redacta una pregunta clara y directa/i);
    fireEvent.change(inputEnunciado, { target: { value: '¿Cuál es el valor de Pi aproximado?' } });

    const opcionInputs = screen.getAllByPlaceholderText(/Texto opcion/i);
    expect(opcionInputs.length).toBe(5);

    fireEvent.change(opcionInputs[0]!, { target: { value: '3.1416' } });
    fireEvent.change(opcionInputs[1]!, { target: { value: '2.7182' } });
    fireEvent.change(opcionInputs[2]!, { target: { value: '1.4142' } });
    fireEvent.change(opcionInputs[3]!, { target: { value: '1.6180' } });
    fireEvent.change(opcionInputs[4]!, { target: { value: '0.5772' } });

    expect(opcionInputs[0]).toHaveValue('3.1416');
  });

  it('renderiza preguntas existentes y permite filtrar por texto en el listado', () => {
    const preguntasMock: Pregunta[] = [
      {
        _id: 'preg-1',
        periodoId: 'per-1',
        tema: 'Álgebra',
        versionActual: 1,
        versiones: [
          {
            numeroVersion: 1,
            enunciado: '¿Qué es una función cuadrática?',
            opciones: [
              { texto: 'Una función polinómica de grado 2', esCorrecta: true },
              { texto: 'Una recta en el plano', esCorrecta: false }
            ],
            creadoEn: '2026-01-01T00:00:00.000Z'
          }
        ]
      },
      {
        _id: 'preg-2',
        periodoId: 'per-1',
        tema: 'Física',
        versionActual: 1,
        versiones: [
          {
            numeroVersion: 1,
            enunciado: '¿Cuál es la primera ley de Newton?',
            opciones: [
              { texto: 'Ley de la inercia', esCorrecta: true },
              { texto: 'Fuerza es masa por aceleración', esCorrecta: false }
            ],
            creadoEn: '2026-01-01T00:00:00.000Z'
          }
        ]
      }
    ];

    render(
      <SeccionBanco
        preguntas={preguntasMock}
        periodos={[{ _id: 'per-1', nombre: 'Ciencias Básicas' }]}
        permisos={permisosCompletos}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
        onRefrescar={() => {}}
        onRefrescarPlantillas={() => {}}
        paginasEstimadasBackendPorTema={new Map()}
      />
    );

    // Seleccionar materia para activar listado
    const selectMateria = screen.getByLabelText(/^Materia$/i);
    fireEvent.change(selectMateria, { target: { value: 'per-1' } });

    expect(screen.getByText('¿Qué es una función cuadrática?')).toBeInTheDocument();
    expect(screen.getByText('¿Cuál es la primera ley de Newton?')).toBeInTheDocument();

    const inputBuscar = screen.getByLabelText(/Buscar en enunciado/i);
    fireEvent.change(inputBuscar, { target: { value: 'cuadrática' } });

    expect(screen.getByText('¿Qué es una función cuadrática?')).toBeInTheDocument();
    expect(screen.queryByText('¿Cuál es la primera ley de Newton?')).not.toBeInTheDocument();
  });

  it('conserva el tema seleccionado al guardar una pregunta para facilitar la captura consecutiva', async () => {
    const mockEnviar = vi.fn()
      .mockResolvedValueOnce({
        importId: 'imp-manual',
        planHash: 'plan-manual',
        summary: { create: 1, noOp: 0, newVersion: 0, conflict: 0, error: 0 }
      })
      .mockResolvedValueOnce({
        draftReactivoIds: ['reactivo-manual'],
        reactivoIds: ['reactivo-manual']
      })
      .mockResolvedValueOnce({ reactivo: { id: 'reactivo-manual', estado: 'review' } })
      .mockResolvedValueOnce({ reactivo: { id: 'reactivo-manual', estado: 'published' } });
    vi.spyOn(clienteApi, 'obtener').mockResolvedValue({
      temas: [{ _id: 't-1', nombre: 'Cookies y sesiones', materiaId: 'per-1' }]
    });

    const { container } = render(
      <SeccionBanco
        preguntas={[] as Pregunta[]}
        periodos={[{ _id: 'per-1', nombre: 'Desarrollo Web' }]}
        permisos={permisosCompletos}
        enviarConPermiso={mockEnviar}
        avisarSinPermiso={() => {}}
        onRefrescar={() => {}}
        onRefrescarPlantillas={() => {}}
        paginasEstimadasBackendPorTema={new Map()}
      />
    );

    const selectMateria = screen.getByLabelText(/^Materia$/i);
    fireEvent.change(selectMateria, { target: { value: 'per-1' } });

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Cookies y sesiones' })).toBeInTheDocument();
    });

    const selectTema = container.querySelector('#banco-select-tema') as HTMLSelectElement;
    expect(selectTema).toBeInTheDocument();
    fireEvent.change(selectTema, { target: { value: 't-1' } });
    expect(selectTema).toHaveValue('t-1');

    const inputEnunciado = screen.getByPlaceholderText(/Redacta una pregunta clara y directa/i);
    fireEvent.change(inputEnunciado, { target: { value: '¿Qué cabecera HTTP envía una cookie?' } });

    const opcionInputs = screen.getAllByPlaceholderText(/Texto opcion/i);
    fireEvent.change(opcionInputs[0]!, { target: { value: 'Set-Cookie' } });
    fireEvent.change(opcionInputs[1]!, { target: { value: 'Cookie-Header' } });
    fireEvent.change(opcionInputs[2]!, { target: { value: 'Authorization' } });
    fireEvent.change(opcionInputs[3]!, { target: { value: 'Accept' } });
    fireEvent.change(opcionInputs[4]!, { target: { value: 'Host' } });

    const btnGuardar = screen.getByRole('button', { name: /^Validar y guardar borrador$/i });
    fireEvent.click(btnGuardar);

    expect(mockEnviar).toHaveBeenNthCalledWith(
      1,
      'banco:ingestar',
      '/banco-preguntas/importaciones/preview',
      expect.objectContaining({
        target: { periodoId: 'per-1', temaIds: ['t-1'] },
        items: [
          expect.objectContaining({
            externalKey: expect.stringMatching(/^manual-/),
            stem: {
              format: 'richtext',
              value: '¿Qué cabecera HTTP envía una cookie?'
            },
            options: expect.arrayContaining([
              { key: 'A', value: 'Set-Cookie', isCorrect: true },
              { key: 'B', value: 'Cookie-Header', isCorrect: false },
              { key: 'C', value: 'Authorization', isCorrect: false },
              { key: 'D', value: 'Accept', isCorrect: false },
              { key: 'E', value: 'Host', isCorrect: false }
            ])
          })
        ]
      }),
      expect.any(String)
    );
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledTimes(2));
    expect(mockEnviar).toHaveBeenNthCalledWith(
      2,
      'banco:ingestar',
      '/banco-preguntas/importaciones/imp-manual/confirmar',
      expect.objectContaining({ planHash: 'plan-manual', payload: expect.objectContaining({ batchId: expect.stringContaining('manual-') }) }),
      expect.any(String)
    );
    expect(await screen.findByRole('button', { name: 'Enviar a revisión (1)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar a revisión (1)' }));
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledTimes(3));
    fireEvent.click(screen.getByRole('button', { name: 'Publicar revisados (1)' }));
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledTimes(4));
    expect(mockEnviar).toHaveBeenNthCalledWith(3, 'banco:revisar', '/banco-preguntas/reactivos/reactivo-manual/revisar', {}, expect.any(String));
    expect(mockEnviar).toHaveBeenNthCalledWith(4, 'banco:publicar', '/banco-preguntas/reactivos/reactivo-manual/publicar', {}, expect.any(String));

    // El enunciado se limpia tras guardar para la siguiente pregunta pero el tema permanece seleccionado
    await waitFor(() => {
      expect(inputEnunciado).toHaveValue('');
    });
    expect(selectTema).toHaveValue('t-1');
  });
});
